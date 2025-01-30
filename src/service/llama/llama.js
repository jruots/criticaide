// src/service/llama/llama.js
const { spawn } = require('child_process');
const path = require('path');
const logger = require('../../utils/logger');
const { checkMemory } = require('../../utils/memory');
const { analyzePrompt: defaultAnalyze } = require('../../prompts/phi35/analyze.js');
const { systemPrompt: defaultSystem } = require('../../prompts/phi35/system.js');

// Constants for token management
const TOKEN_MULTIPLIER = 2;  // Conservative estimate for words to tokens
const CONTEXT_SIZE = 4096;
const SAFETY_BUFFER = 0.95;  // 95% of context size to be safe
const MAX_TOKENS = Math.floor(CONTEXT_SIZE * SAFETY_BUFFER);

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
        return path.join(process.resourcesPath, 'models', 'Phi-3.5-mini-instruct-Q4_K_M.gguf');
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

        // Check files exist
        const fs = require('fs');
        if (!fs.existsSync(binaryPath)) {
            throw new Error(`Binary not found: ${binaryPath}`);
        }
        if (!fs.existsSync(modelPath)) {
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