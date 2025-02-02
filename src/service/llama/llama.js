const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const logger = require('../../utils/logger');
const { checkMemory } = require('../../utils/memory');
const { analyzePrompt: defaultAnalyze } = require('../../prompts/phi35/analyze.js');
const { systemPrompt: defaultSystem } = require('../../prompts/phi35/system.js');

// Constants for token management
const TOKEN_MULTIPLIER = 2;  // Conservative estimate for words to tokens
const CONTEXT_SIZE = 4096;
const SAFETY_BUFFER = 0.95;  // 95% of context size to be safe
const MAX_TOKENS = Math.floor(CONTEXT_SIZE * SAFETY_BUFFER);
const MODEL_REPO = 'MaziyarPanahi/Phi-3.5-mini-instruct-GGUF';
const MODEL_VERSION = 'Q4_K_M';

class LlamaCppService {
    constructor() {
        this.process = null;
        this.isServerReady = false;
        this.isDev = process.env.NODE_ENV === 'development';
        this.serverRetries = 0;
        this.maxRetries = 3;
    }

    async getModelPath() {
        if (this.isDev) {
            return path.join(process.cwd(), 'resources', 'llama', 'models', 'Phi-3.5-mini-instruct-Q4_K_M.gguf');
        }
        
        // In production, use app data directory
        const appDataPath = path.join(
            process.platform === 'darwin' 
                ? process.env.HOME + '/Library/Application Support/Criticaide'
                : process.env.APPDATA + '/Criticaide',
            'models'
        );
        
        return path.join(appDataPath, 'Phi-3.5-mini-instruct-Q4_K_M.gguf');
    }
    
    async getCliPath() {
        if (this.isDev) {
            return path.join(process.cwd(), 'resources', 'llama', 'binaries', 'win', 'llama-cli.exe');
        }
        return path.join(process.resourcesPath, 'bin', 'llama-cli.exe');
    }

    async getBinaryPath() {
        if (this.isDev) {
            const binaryDir = path.join(process.cwd(), 'resources', 'llama', 'binaries', 'win');
            return path.join(binaryDir, 'llama-server.exe');
        }
        return path.join(process.resourcesPath, 'bin', 'llama-server.exe');
    }
    
    async getBinaryDir() {
        if (this.isDev) {
            return path.join(process.cwd(), 'resources', 'llama', 'binaries', 'win');
        }
        return path.join(process.resourcesPath, 'bin');
    }

    async checkModelExists() {
        try {
            const modelPath = await this.getModelPath();
            await fs.access(modelPath);
            logger.info('Model found at:', modelPath);
            return true;
        } catch (error) {
            logger.info('Model not found, will need to download');
            return false;
        }
    }

    async downloadModel() {
        const modelPath = await this.getModelPath();
        const modelDir = path.dirname(modelPath);
        const modelUrl = 'https://huggingface.co/MaziyarPanahi/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct.Q4_K_M.gguf?download=true';
    
        logger.info('Initiating model download...');
        logger.info(`Model will be saved to: ${modelPath}`);
    
        // Ensure models directory exists
        try {
            await fs.mkdir(modelDir, { recursive: true });
        } catch (error) {
            logger.error('Failed to create models directory:', error);
            throw new Error(`Unable to create models directory: ${error.message}`);
        }
    
        try {
            const response = await fetch(modelUrl, {
                timeout: 60000 // 60 second timeout
            });
            
            if (!response.ok) {
                throw new Error(`Failed to download model (HTTP ${response.status}): ${response.statusText}`);
            }
    
            if (!response.body) {
                throw new Error('No response body received');
            }
    
            const totalSize = parseInt(response.headers.get('content-length'), 10);
            if (!totalSize) {
                throw new Error('Could not determine model size');
            }
    
            let downloadedSize = 0;
            const fileStream = require('fs').createWriteStream(modelPath);
    
            return new Promise((resolve, reject) => {
                const body = response.body;
                const reader = body.getReader();
    
                const processChunk = ({ done, value }) => {
                    if (done) {
                        fileStream.end();
                        logger.info('Model download completed');
                        resolve();
                        return;
                    }
    
                    downloadedSize += value.length;
                    const progress = (downloadedSize / totalSize) * 100;
                    logger.debug(`Download progress: ${progress.toFixed(2)}%`);
                    
                    fileStream.write(Buffer.from(value));
                    reader.read().then(processChunk).catch(reject);
                };
    
                fileStream.on('error', (error) => {
                    logger.error('Error writing model file:', error);
                    reject(new Error(`Failed to save model: ${error.message}`));
                });
    
                reader.read().then(processChunk).catch(reject);
            });
    
        } catch (error) {
            logger.error('Model download failed:', error);
            
            // Format user-friendly error message
            let userMessage = 'Failed to download language model. ';
            if (error.code === 'ENOTFOUND') {
                userMessage += 'Please check your internet connection.';
            } else if (error.type === 'request-timeout') {
                userMessage += 'The download timed out. Please try again.';
            } else {
                userMessage += `${error.message}. Please try again later or check logs for details.`;
            }
            
            throw new Error(userMessage);
        }
    }

    estimateTokens(text) {
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        const estimatedTokens = words.length * TOKEN_MULTIPLIER;
        logger.debug(`Estimated ${estimatedTokens} tokens for ${words.length} words`);
        return estimatedTokens;
    }

    isTextTooLong(text) {
        const estimatedTokens = this.estimateTokens(text);
        if (estimatedTokens > MAX_TOKENS) {
            const maxWords = Math.floor(MAX_TOKENS / TOKEN_MULTIPLIER);
            logger.warn(`Text too long: ${estimatedTokens} tokens exceeds limit of ${MAX_TOKENS}`);
            return {
                isTooLong: true,
                estimatedTokens,
                maxTokens: MAX_TOKENS,
                currentWords: text.trim().split(/\s+/).length,
                maxWords
            };
        }
        return { isTooLong: false };
    }

    async checkServerHealth() {
        try {
            const response = await fetch('http://127.0.0.1:8080/health');
            if (response.ok) {
                return true;
            }
        } catch (error) {
            return false;
        }
        return false;
    }

    async startServer() {
        const modelPath = await this.getModelPath();
        const binaryPath = await this.getBinaryPath();
        const binaryDir = await this.getBinaryDir();

        const args = [
            '--model', modelPath,
            '--ctx-size', '4096',
            '--n-gpu-layers', '99'
        ];

        logger.info(`Starting server with binary: ${binaryPath}`);
        logger.info(`Using model: ${modelPath}`);
        logger.debug('Arguments:', args);

        // Check files exist - now only checking server binary and model
        if (!await this.fileExists(binaryPath)) {
            throw new Error(`Server binary not found: ${binaryPath}`);
        }
        if (!await this.fileExists(modelPath)) {
            throw new Error(`Model not found: ${modelPath}`);
        }

        this.process = spawn(binaryPath, args, {
            cwd: binaryDir
        });

        return new Promise((resolve, reject) => {
            let serverOutput = '';
            let isStarting = true;

            this.process.stdout.on('data', (data) => {
                const output = data.toString();
                serverOutput += output;
                logger.debug('Server stdout:', output);
            });

            this.process.stderr.on('data', (data) => {
                const error = data.toString();
                logger.debug('Server stderr:', error);
                serverOutput += error;

                if (error.includes('server is listening')) {
                    this.startHealthCheck(resolve, reject);
                }
            });

            this.process.on('error', (error) => {
                logger.error('Process error:', error);
                reject(error);
            });

            this.process.on('close', (code) => {
                if (isStarting && !this.isServerReady) {
                    logger.error('Server closed before ready. Exit code:', code);
                    logger.error('Server output:', serverOutput);
                    reject(new Error(`Server closed with code ${code}`));
                }
            });

            setTimeout(() => {
                if (!this.isServerReady) {
                    isStarting = false;
                    logger.error('Server startup timeout');
                    logger.error('Accumulated output:', serverOutput);
                    this.stop();
                    reject(new Error('Server startup timeout'));
                }
            }, 60000);
        });
    }

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    async startHealthCheck(resolve, reject) {
        let attempts = 0;
        const maxAttempts = 10;
        const interval = setInterval(async () => {
            attempts++;
            const isHealthy = await this.checkServerHealth();
            
            if (isHealthy) {
                clearInterval(interval);
                this.isServerReady = true;
                logger.info('Server is healthy and ready');
                resolve('system');
            } else if (attempts >= maxAttempts) {
                clearInterval(interval);
                this.stop();
                reject(new Error('Server health check failed'));
            }
        }, 1000);
    }

    async serve() {
        logger.setScope('LlamaCpp');
        logger.info('Starting llama.cpp server...');

        // Check memory before starting
        const memoryState = checkMemory();
        if (memoryState.isCritical) {
            logger.error('Critical memory state before starting server');
            throw new Error(memoryState.messages.warning);
        }

        // Check and download model if needed
        const modelExists = await this.checkModelExists();
        if (!modelExists) {
            logger.info('Model not found, initiating download...');
            try {
                await this.downloadModel();
            } catch (error) {
                logger.error('Model download failed:', error);
                throw new Error(`Failed to download model: ${error.message}`);
            }
        }

        for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
            try {
                await this.startServer();
                this.serverRetries = 0; // Reset retry counter on success
                return 'system';
            } catch (error) {
                logger.error(`Server start attempt ${attempt} failed:`, error);
                
                if (attempt === this.maxRetries) {
                    throw error;
                }

                const delay = 1000 * Math.pow(2, attempt - 1); // Exponential backoff
                logger.info(`Waiting ${delay}ms before retry ${attempt + 1}...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async analyze(text, source = 'N/A') {
        try {
            logger.debug('Starting analysis');

            // Check text length
            const lengthCheck = this.isTextTooLong(text);
            if (lengthCheck.isTooLong) {
                throw new Error(`Text is too long. Please reduce from ${lengthCheck.currentWords} words to around ${lengthCheck.maxWords} words.`);
            }

            // Check memory
            const memoryState = checkMemory();
            logger.info(`Memory state before analysis - Free: ${memoryState.freeMemGB}GB`);
            
            if (memoryState.isCritical) {
                logger.warn('Memory is critically low before analysis');
                throw new Error(memoryState.messages.warning);
            }

            const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer no-key'
                },
                body: JSON.stringify({
                    model: "phi-3.5",
                    messages: [
                        defaultSystem,
                        defaultAnalyze(source, text)
                    ],
                    temperature: 0.2,
                    top_k: 50,
                    top_p: 0.95,
                    stream: false,
                    response_format: { 
                        type: "json_object",
                        schema: {
                            type: "object",
                            properties: {
                                potential_issues: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            type: { type: "string" },
                                            explanation: { type: "string" },
                                            severity: { 
                                                type: "string",
                                                enum: ["low", "medium", "high"]
                                            }
                                        },
                                        required: ["type", "explanation", "severity"]
                                    }
                                },
                                credibility_score: {
                                    type: "number",
                                    minimum: 0,
                                    maximum: 10
                                },
                                key_concerns: {
                                    type: "array",
                                    items: { type: "string" }
                                },
                                recommendation: { type: "string" }
                            },
                            required: ["potential_issues", "credibility_score", "key_concerns", "recommendation"]
                        }
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Analysis failed: ${response.statusText}`);
            }

            const result = await response.json();
            
            try {
                // Parse the chat completion response
                const analysis = JSON.parse(result.choices[0].message.content);
                logger.debug('Analysis result:', analysis);
                return analysis;
            } catch (parseError) {
                logger.error('Failed to parse analysis:', parseError);
                return {
                    credibility_score: 0,
                    potential_issues: [],
                    key_concerns: ['Error parsing analysis'],
                    recommendation: 'Failed to analyze text. Please try again.'
                };
            }
        } catch (error) {
            logger.error('Analysis error:', error);
            throw error;
        }
    }

    async stop() {
        if (this.process) {
            logger.info('Stopping llama.cpp server...');
            this.process.kill();
            this.process = null;
            this.isServerReady = false;
        }
    }
}

module.exports = LlamaCppService;