/**
 * This file contains code adapted from chatd
 * https://github.com/BruceMacD/chatd
 * Original work Copyright (c) 2024 Bruce MacDonald
 * Licensed under MIT License
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec } = require('child_process');
const logger = require('../../utils/logger');

const { systemPrompt: defaultSystem } = require('../../prompts/phi35/system.js');
const { analyzePrompt: defaultAnalyze } = require('../../prompts/phi35/analyze.js');

const analysisSchema = {
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
};

let store;
(async () => {
    const Store = await import('electron-store');
    store = new Store.default();
})();

// Model configuration remains the same
const MODEL_CONFIG = {
    'mistral': {
        tokenLimit: 32000,
        safetyBuffer: 0.95,
    },
    'phi': {
        tokenLimit: 2000,
        safetyBuffer: 0.95,
    },
    'llama3.2:3b': {
        tokenLimit: 131072,  // Using the actual context length from model metadata
        safetyBuffer: 0.95,  // Using same safety buffer as other models
    },
    'gemma2:2b': {
        tokenLimit: 8192,  // from context_length in metadata
        safetyBuffer: 0.95,
    },
    'smallthinker': {
        tokenLimit: 32768,  // from context_length in metadata
        safetyBuffer: 0.95,
    },
    'qwen2.5:3b': {
        tokenLimit: 32768,  // from context_length in metadata
        safetyBuffer: 0.95,
    },
    'phi3.5': {
        tokenLimit: 4096,  // from context_length in metadata
        safetyBuffer: 0.95,
    },
    'hf.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF:Q2_K': {
        tokenLimit: 4096,  // from context_length in metadata
        safetyBuffer: 0.95,
    }
};

const TOKEN_MULTIPLIER = 2;

var OllamaServeType = {
    SYSTEM: "system",
    PACKAGED: "packaged"
};

class OllamaOrchestrator {
    static instance = null;
    
    constructor(ollamaModule) {
        logger.setScope('Ollama');
        logger.info('Initializing OllamaOrchestrator');
        this.childProcess = null;
        this.host = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
        this.ollama = new ollamaModule.Ollama({ host: this.host });
        this.currentModel = this.determineModel();
        logger.info(`Constructor: Using model ${this.currentModel}`);
    }

    static async getOllama() {
        logger.setScope('Ollama');
        logger.info('getOllama called');
        if (this.instance === null) {
            const ollamaModule = await import("ollama");
            this.instance = new this(ollamaModule);
        }
        logger.debug(`Using model: ${this.instance.currentModel}`);
        return this.instance;
    }

    determineModel() {
        logger.setScope('Ollama:Model');
        //logger.info('Using SmallThinker model');
        //logger.info('Using Qwen2.5 model');
        logger.info('Using phi 3.5 model');
        //logger.info('Using mistral 7b gguf 2bit model');
        //return 'smallthinker';
        //return 'qwen2.5:3b';
        return 'phi3.5';
        //return 'hf.co/TheBloke/Mistral-7B-Instruct-v0.2-GGUF:Q2_K';
    }

//    determineModel() {
//        logger.setScope('Ollama:Model');
//        logger.info('Determining appropriate model based on system memory');
//        const totalMemoryGB = os.totalmem() / (1024 * 1024 * 1024);
//        logger.info(`System has ${totalMemoryGB.toFixed(2)}GB of RAM`);
//        
//        if (totalMemoryGB < 8) {
//            logger.info('Selecting phi-2 model due to system memory constraints');
//            return 'phi';
//        }
//        
//        logger.info('Selecting mistral model based on available system memory');
//        return 'mistral';
//    }

    async pullModel() {
        logger.setScope('Ollama:Pull');
        const MAX_RETRIES = 3;
        const INITIAL_DELAY = 1000; // 1 second

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
                logger.info(`Pulling model: ${this.currentModel}`);
                const modelToUse = this.currentModel;
            
                try {
                    const response = await fetch(`${this.host}/api/tags`);
                    const data = await response.json();
                    const modelExists = data.models?.some(model => model.name === modelToUse);
                
                    if (!modelExists && !store.get('initialModelDownloaded')) {
                        logger.info(`Model ${modelToUse} not found, starting download...`);
                        const { Notification } = require('electron');
                        new Notification({
                            title: 'Model Download',
                            body: `First time startup: Downloading ${modelToUse} model. This may take a few minutes depending on your internet connection.`
                        }).show();
                        store.set('initialModelDownloaded', true);
                    }
                } catch (error) {
                    logger.warn('Error checking model existence:', error);
                    // Continue with pull anyway
                }
            
                logger.info(`Starting model pull for ${modelToUse} (Attempt ${attempt}/${MAX_RETRIES})`);
                const stream = await this.ollama.pull({
                    model: modelToUse,
                    stream: true
                });
            
                for await (const part of stream) {
                    logger.debug('Pull progress:', part);
                }
            
                logger.info('Model pull complete');
                return; // Success - exit the retry loop

            } catch (err) {
                logger.error('Failed to pull model:', err);
                
                if (attempt === MAX_RETRIES) {
                    logger.error('Max retries reached, giving up');
                    throw err;  // Maintain original error throwing
                }

                // Calculate delay with exponential backoff (1s, 2s, 4s)
                const delay = INITIAL_DELAY * Math.pow(2, attempt - 1);
                logger.info(`Waiting ${delay}ms before retry ${attempt + 1}...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    async serve() {
        logger.setScope('Ollama:Serve');
        logger.info(`Starting serve process. Current model: ${this.currentModel}`);
        
        let serveType = null;
        
        // Try to find existing instance
        try {
            await this.ping();
            logger.info('Found existing Ollama instance');
            await this.pullModel();
            serveType = OllamaServeType.SYSTEM;
        } catch (err) {
            // Try to start system Ollama
            try {
                await this.execServe("ollama");
                logger.info('Started system Ollama');
                await this.pullModel();
                serveType = OllamaServeType.SYSTEM;
            } catch (sysErr) {
                logger.debug(`System Ollama not available: ${sysErr}`);
                
                // Try packaged Ollama as last resort
                // start the packaged ollama server
                let exe = "";
                let appDataPath = "";
                switch (process.platform) {
                    case "win32":
                        exe = "ollama.exe";
                        appDataPath = path.join(os.homedir(), "AppData", "Local", "ContentAnalyzer");
                        break;
                    case "darwin":
                        exe = "ollama-darwin";
                        appDataPath = path.join(os.homedir(), "Library", "Application Support", "ContentAnalyzer");
                        break;
                    case "linux":
                        exe = "ollama-linux";
                        appDataPath = path.join(os.homedir(), ".config", "ContentAnalyzer");
                        break;
                    default:
                        const error = `Unsupported platform: ${process.platform}`;
                        logger.error(error);
                        throw new Error(error);
                }
            
                const pathToBinary = path.join(process.resourcesPath, "bin", exe);
                try {
                    await this.execServe(pathToBinary, appDataPath);
                    logger.info('Started packaged Ollama successfully');
                    await this.pullModel();
                    serveType = OllamaServeType.PACKAGED;
                } catch (pkgErr) {
                    logger.error('Failed to start packaged Ollama:', pkgErr);
                    throw pkgErr;
                }
            }
        }
        
        if (!serveType) {
            throw new Error('Failed to initialize Ollama');
        }
        
        return serveType;
    }

    async execServe(path, appDataDirectory) {
        logger.setScope('Ollama:Exec');
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(appDataDirectory)) {
                fs.mkdirSync(appDataDirectory, { recursive: true });
                logger.debug(`Created app data directory: ${appDataDirectory}`);
            }
            const env = {
                ...process.env,
                OLLAMA_MODELS: appDataDirectory
            };

            logger.info(`Starting Ollama process from: ${path}`);
            this.childProcess = exec(`"${path}" serve`, { env }, (err, stdout, stderr) => {
                if (err) {
                    logger.error(`Exec error:`, err);
                    reject(`exec error: ${err}`);
                    return;
                }
                if (stderr) {
                    logger.warn(`Ollama stderr: ${stderr}`);
                }
                if (stdout) {
                    logger.debug(`Ollama stdout: ${stdout}`);
                }
            });

            this.waitForPing()
                .then(() => {
                    logger.info('Ollama server started successfully');
                    resolve();
                })
                .catch((pingError) => {
                    if (this.childProcess && !this.childProcess.killed) {
                        this.childProcess.kill();
                        logger.warn('Killed non-responsive Ollama process');
                    }
                    reject(pingError);
                });
        });
    }

    async ping() {
        logger.setScope('Ollama:Ping');
        const response = await fetch(this.host, {
            method: "GET",
            cache: "no-store"
        });

        if (response.status !== 200) {
            throw new Error(`failed to ping ollama server: ${response.status}`);
        }

        logger.debug("Ollama server ping successful");
        return true;
    }

    async waitForPing(delay = 1000, retries = 5) {
        logger.setScope('Ollama:Ping');
        for (let i = 0; i < retries; i++) {
            try {
                await this.ping();
                return;
            } catch (err) {
                logger.debug(`Waiting for Ollama server... Attempt ${i + 1}/${retries}`);
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }
        const error = "Max retries reached. Ollama server didn't respond.";
        logger.error(error);
        throw new Error(error);
    }

    async stop() {
        logger.setScope('Ollama:Stop');
        if (!this.childProcess) {
            logger.debug('No child process to stop');
            return;
        }
    
        return new Promise((resolve) => {
            if (os.platform() === "win32") {
                // Windows-specific termination (unchanged)
                exec(`taskkill /pid ${this.childProcess.pid} /f /t`, (err) => {
                    if (err) {
                        logger.error(`Failed to kill process ${this.childProcess.pid}:`, err);
                    } else {
                        logger.info(`Successfully terminated process ${this.childProcess.pid}`);
                    }
                    this.verifyProcessTermination();
                    resolve();
                });
            } else {
                // Mac/Linux termination
                try {
                    process.kill(this.childProcess.pid, 'SIGTERM');
                    logger.info('Sent SIGTERM to Ollama process');
                    
                    // Give it a moment to terminate gracefully
                    setTimeout(() => {
                        try {
                            // Check if process still exists
                            process.kill(this.childProcess.pid, 0);
                            // If we get here, process still exists, force kill
                            process.kill(this.childProcess.pid, 'SIGKILL');
                            logger.info('Process required SIGKILL');
                        } catch(e) {
                            // Process no longer exists, which is good
                            logger.info('Process terminated gracefully');
                        }
                        resolve();
                    }, 1000);
                } catch(e) {
                    logger.warn('Error during process termination:', e);
                    resolve();
                }
            }
        });
    }
    
    async verifyProcessTermination() {
        if (os.platform() === "win32") {
            exec('tasklist /FI "IMAGENAME eq ollama.exe"', (err, stdout) => {
                if (!err && stdout.includes('ollama.exe')) {
                    logger.warn('Ollama process still running, attempting force kill');
                    exec('taskkill /IM ollama.exe /F');
                }
            });
        } else {
            // For Mac/Linux
            exec('ps aux | grep ollama | grep -v grep', (err, stdout) => {
                if (!err && stdout) {
                    logger.warn('Ollama process still running, attempting force kill');
                    exec('pkill -9 Ollama');
                }
            });
        }
    }

    estimateTokens(text) {
        logger.setScope('Ollama:Tokens');
        const words = text.trim().split(/\s+/).filter(word => word.length > 0);
        const estimatedTokens = words.length * TOKEN_MULTIPLIER;
        logger.debug(`Estimated ${estimatedTokens} tokens for ${words.length} words`);
        return estimatedTokens;
    }

    isTextTooLong(text) {
        logger.setScope('Ollama:Validation');
        if (!this.currentModel || !MODEL_CONFIG[this.currentModel]) {
            const error = 'Model configuration not found';
            logger.error(error);
            throw new Error(error);
        }

        const config = MODEL_CONFIG[this.currentModel];
        const estimatedTokens = this.estimateTokens(text);
        const maxTokens = config.tokenLimit * config.safetyBuffer;

        if (estimatedTokens > maxTokens) {
            const maxWords = Math.floor(maxTokens / TOKEN_MULTIPLIER);
            logger.warn(`Text too long: ${estimatedTokens} tokens exceeds limit of ${maxTokens}`);
            return {
                isTooLong: true,
                estimatedTokens,
                maxTokens,
                currentWords: text.trim().split(/\s+/).length,
                maxWords
            };
        }

        logger.debug('Text length validation passed');
        return { isTooLong: false };
    }

    async analyze(text, source = 'N/A') {
        logger.setScope('Ollama:Analysis');
        try {
            if (!this.currentModel) {
                this.currentModel = this.determineModel();
                logger.info(`Model selected: ${this.currentModel}`);
            }

            const lengthCheck = this.isTextTooLong(text);
            if (lengthCheck.isTooLong) {
                logger.warn('Text exceeds token limit', lengthCheck);
                const { Notification } = require('electron');
                new Notification({
                    title: 'Content Too Long',
                    body: `Text exceeds model's capacity. Please reduce from ${lengthCheck.currentWords} words to around ${lengthCheck.maxWords} words.`
                }).show();

                return {
                    error: 'TOKEN_LIMIT_EXCEEDED',
                    message: `Text is too long. Please reduce from ${lengthCheck.currentWords} words to around ${lengthCheck.maxWords} words.`,
                    details: lengthCheck
                };
            }

            const systemPrompt = defaultSystem;
    
            const analyzePrompt = defaultAnalyze(source, text);
    
            const response = await this.ollama.chat({
                model: this.currentModel,
                messages: [systemPrompt, analyzePrompt],
                format: analysisSchema,
                options: {
                    temperature: 0.2, //0.7,
                    top_k: 50, //50,
                    top_p: 0.95, //0.95,
                    stream: false
                }
            });
    
            try {
                logger.debug('Raw model response:', response.message.content);
                const analysis = JSON.parse(response.message.content);
                
                if (!this.isValidAnalysis(analysis)) {
                    throw new Error('Invalid analysis format');
                }
                
                logger.info('Analysis completed successfully');
                logger.debug('Analysis result:', analysis);
                return analysis;
            } catch (parseError) {
                logger.error('Failed to parse analysis response:', parseError);
                throw new Error('Invalid analysis response format');
            }
        } catch (error) {
            logger.error('Analysis failed:', {
                message: error.message,
                stack: error.stack,
                name: error.name,
                // Add any additional error properties
                details: error.toString()
            });
            throw error;
        }
    }
    
    isValidAnalysis(analysis) {
        logger.setScope('Ollama:Validation');
        const isValid = (
            analysis &&
            Array.isArray(analysis.potential_issues) &&
            typeof analysis.credibility_score === 'number' &&
            analysis.credibility_score >= 0 &&
            analysis.credibility_score <= 10 &&
            Array.isArray(analysis.key_concerns) &&
            typeof analysis.recommendation === 'string'
        );
        
        if (!isValid) {
            logger.warn('Invalid analysis format detected');
        }
        
        return isValid;
    }
}

module.exports = OllamaOrchestrator;