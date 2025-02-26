const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs/promises');
const logger = require('../../utils/logger');
const { checkMemory } = require('../../utils/memory');
const { analyzePrompt: defaultAnalyze } = require('../../prompts/phi35/analyze.js');
const { systemPrompt: defaultSystem } = require('../../prompts/phi35/system.js');
const os = require('os');
const { execSync } = require('child_process');

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

    async getShortPathName(longPath) {
        try {
            // Use Windows command to get the short path name
            const shortPath = execSync(`cmd /c "for %I in ("${longPath}") do @echo %~sI"`, { encoding: 'utf8' }).trim();
            logger.debug(`Converted path: ${longPath} → ${shortPath}`);
            return shortPath;
        } catch (error) {
            logger.warn(`Failed to convert to short path: ${error.message}`);
            return longPath; // Fall back to the original path
        }
    }

    async getModelPath() {
        if (this.isDev) {
            return path.join(process.cwd(), 'resources', 'llama', 'models', 'Phi-3.5-mini-instruct-Q4_K_M.gguf');
        }
        
        // In production, use app data directory
        const appDataPath = process.platform === 'darwin' 
        ? path.join(os.homedir(), 'Documents', 'Criticaide', 'models')  // Mac path
        : path.join(process.env.APPDATA, 'Criticaide', 'models');       // Windows path
        
        return path.join(appDataPath, 'Phi-3.5-mini-instruct-Q4_K_M.gguf');
    }

    async getBinaryPath() {
        if (this.isDev) {
            const platform = process.platform === 'darwin' ? 'mac' : 'win';
            const exeName = process.platform === 'darwin' ? 'llama-server' : 'llama-server.exe';
            return path.join(process.cwd(), 'resources', 'llama', 'binaries', platform, exeName);
        }
        
        const exeName = process.platform === 'darwin' ? 'llama-server' : 'llama-server.exe';
        return path.join(process.resourcesPath, 'bin', exeName);
    }
    
    async getBinaryDir() {
        if (this.isDev) {
            const platform = process.platform === 'darwin' ? 'mac' : 'win';
            return path.join(process.cwd(), 'resources', 'llama', 'binaries', platform);
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

    async startServer(modelPath, gpuLayers = 99) {
        const binaryPath = await this.getBinaryPath();
        const binaryDir = await this.getBinaryDir();
    
        // Basic server arguments
        const args = [
            '--model', modelPath,
            '--ctx-size', '4096',
            '--n-gpu-layers', gpuLayers.toString()
        ];
    
        logger.info(`Starting server with binary: ${binaryPath}`);
        logger.info(`Using model: ${modelPath}`);
        logger.debug('Arguments:', args);
    
        // Set up environment and spawn options
        const env = { ...process.env };
        const spawnOptions = {
            cwd: binaryDir,
            env
        };
    
        // Add Mac-specific settings
        if (process.platform === 'darwin') {
            // Ensure executable permissions
            try {
                await fs.promises.chmod(binaryPath, '755');
                logger.info('Set executable permissions for server binary');
            } catch (error) {
                logger.error('Failed to set executable permissions:', error);
                throw error;
            }
        }
    
        this.process = spawn(binaryPath, args, spawnOptions);
    
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
                if (process.platform === 'darwin' && error.code === 'EACCES') {
                    reject(new Error('Server binary lacks executable permissions. Please check file permissions.'));
                } else {
                    reject(error);
                }
            });
    
            this.process.on('close', (code) => {
                if (isStarting && !this.isServerReady) {
                    logger.error('Server closed before ready. Exit code:', code);
                    reject(new Error(`Server closed with code ${code}`));
                }
            });
    
            // Timeout after 30 seconds
            setTimeout(() => {
                if (!this.isServerReady) {
                    isStarting = false;
                    logger.error('Server startup timeout');
                    this.stop();
                    reject(new Error('Server startup timeout'));
                }
            }, 30000);
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
    
        // Get model path and convert to short path if on Windows
        let modelPath = await this.getModelPath();
        if (process.platform === 'win32') {
            modelPath = await this.getShortPathName(modelPath);
            logger.info(`Using short path for model: ${modelPath}`);
        }
    
        // Attempt to start server, starting with GPU and falling back to CPU
        let serverStarted = false;
        let lastError = null;
        
        // First try with GPU acceleration
        try {
            logger.info('Attempting to start with GPU acceleration...');
            await this.startServer(modelPath, 99); // GPU mode
            this.serverRetries = 0;
            serverStarted = true;
            return 'system';
        } catch (error) {
            logger.warn('GPU acceleration failed, will try CPU-only mode:', error);
            lastError = error;
            
            // Ensure process is completely stopped
            await this.stop();
            
            // Add a brief pause to make sure resources are released
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // If GPU failed, try CPU-only mode
        if (!serverStarted) {
            try {
                logger.info('Starting in CPU-only mode');
                await this.startServer(modelPath, 0); // CPU-only mode
                this.serverRetries = 0;
                return 'system';
            } catch (error) {
                logger.error('CPU-only mode also failed:', error);
                throw error; // Both GPU and CPU failed, nothing more we can do
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
        if (!this.process) {
            logger.debug('No child process to stop');
            return;
        }
        
        return new Promise((resolve) => {
            const pid = this.process.pid;
            
            if (process.platform === 'win32') {
                // Add a more robust check and wait for termination
                exec(`taskkill /pid ${pid} /f /t`, (err) => {
                    if (err) {
                        logger.error(`Failed to kill process ${pid}:`, err);
                        // Additional cleanup attempt if needed
                        try {
                            this.process.kill('SIGKILL');
                        } catch (e) {
                            logger.warn('Error during forced termination:', e);
                        }
                    } else {
                        logger.info(`Successfully terminated process ${pid}`);
                    }
                    
                    // Add a delay to ensure OS resources are freed
                    setTimeout(resolve, 500);
                });
            } else {
                // Mac/Linux termination
                try {
                    process.kill(pid, 'SIGTERM');
                    logger.info('Sent SIGTERM to server process');
                    
                    // Give process time to terminate gracefully but with a shorter timeout
                    setTimeout(() => {
                        try {
                            // Check if process still exists
                            process.kill(pid, 0);
                            // If we get here, process still exists, force kill
                            process.kill(pid, 'SIGKILL');
                            logger.info('Process required SIGKILL');
                        } catch(e) {
                            // Process no longer exists, which is good
                            logger.info('Process terminated gracefully');
                        }
                        
                        // Add a delay to ensure OS resources are freed
                        setTimeout(resolve, 300);
                    }, 700);
                } catch(e) {
                    logger.warn('Error during process termination:', e);
                    setTimeout(resolve, 300);
                }
            }
        });
    }
}

module.exports = LlamaCppService;