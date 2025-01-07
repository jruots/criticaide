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

// Model configuration remains the same
const MODEL_CONFIG = {
    'mistral': {
        tokenLimit: 32000,
        safetyBuffer: 0.95,
    },
    'phi': {
        tokenLimit: 2000,
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
        logger.info('Determining appropriate model based on system memory');
        const totalMemoryGB = os.totalmem() / (1024 * 1024 * 1024);
        logger.info(`System has ${totalMemoryGB.toFixed(2)}GB of RAM`);
        
        if (totalMemoryGB < 8) {
            logger.info('Selecting phi-2 model due to system memory constraints');
            return 'phi';
        }
        
        logger.info('Selecting mistral model based on available system memory');
        return 'mistral';
    }

    async pullModel() {
        logger.setScope('Ollama:Pull');
        try {
            logger.info(`Pulling model: ${this.currentModel}`);
            const modelToUse = this.currentModel;
            
            try {
                const response = await fetch(`${this.host}/api/tags`);
                const data = await response.json();
                const modelExists = data.models?.some(model => model.name === modelToUse);
                
                if (!modelExists) {
                    logger.info(`Model ${modelToUse} not found, starting download...`);
                    const { Notification } = require('electron');
                    new Notification({
                        title: 'Model Download',
                        body: `First time startup: Downloading ${modelToUse} model. This may take a few minutes depending on your internet connection.`
                    }).show();
                }
            } catch (error) {
                logger.warn('Error checking model existence:', error);
                // Continue with pull anyway
            }
            
            logger.info(`Starting model pull for ${modelToUse}`);
            const stream = await this.ollama.pull({
                model: modelToUse,
                stream: true
            });
            
            for await (const part of stream) {
                logger.debug('Pull progress:', part);
            }
            
            logger.info('Model pull complete');
        } catch (err) {
            logger.error('Failed to pull model:', err);
            throw err;
        }
    }

    async serve() {
        logger.setScope('Ollama:Serve');
        logger.info(`Starting serve process. Current model: ${this.currentModel}`);
        try {
            await this.ping();
            logger.info('Found existing Ollama instance');
            await this.pullModel();
            return OllamaServeType.SYSTEM;
        } catch (err) {
            logger.debug(`No existing Ollama instance found: ${err}`);
        }
    
        try {
            await this.execServe("ollama");
            logger.info('Started system Ollama');
            await this.pullModel();
            return OllamaServeType.SYSTEM;
        } catch (err) {
            logger.debug(`System Ollama not available: ${err}`);
        }
    
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
            return OllamaServeType.PACKAGED;
        } catch (err) {
            logger.error('Failed to start packaged Ollama:', err);
            throw new Error(`Failed to start Ollama: ${err}`);
        }
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
                // Use /T flag to kill tree and /F for force
                exec(`taskkill /pid ${this.childProcess.pid} /f /t`, (err) => {
                    if (err) {
                        logger.error(`Failed to kill process ${this.childProcess.pid}:`, err);
                    } else {
                        logger.info(`Successfully terminated process ${this.childProcess.pid}`);
                    }
                    // Verify termination
                    this.verifyProcessTermination();
                    resolve();
                });
            } else {
                this.childProcess.kill('SIGTERM');
                logger.info('Ollama process terminated');
                this.verifyProcessTermination();
                resolve();
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

            const systemPrompt = {
                role: 'system',
                content: `You are a misinformation and bias analysis tool. Analyze text for signs of manipulation, bias, and credibility issues. Be thorough and specific in identifying problems. Always respond in valid JSON format.`
            };
    
            const analyzePrompt = {
                role: 'user',
                content: `Analyze the following text for clear signs of misinformation or manipulation. Only flag serious issues that would genuinely mislead readers. For legitimate news reporting from established sources, it's perfectly fine to report "no significant issues found."
    
    Consider the source when analyzing credibility, though source information may not always be available. Examples of source types:
    - News organizations (.com/news, known publishers)
    - Social media platforms (twitter.com, facebook.com)
    - Academic sources (.edu)
    - Government sites (.gov)
    - Blog posts or personal sites
    
    Text comes from this source: "${source}"
    Text to analyze: "${text}"
    
    ONLY flag content if it shows clear signs of:
    1. Inflammatory language designed to provoke emotional reactions ("SHOCKING!", "They don't want you to know...", excessive punctuation)
    2. Conspiracy theory narratives or claims of hidden truths
    3. Complete absence of sources for extraordinary claims
    4. Clear attempts to push a specific agenda while disguising it as news
    5. Blatant misrepresentation of facts or statistics
    6. Obvious logical fallacies that undermine the main message
    7. Direct calls to action based on fear or anger
    
    For mainstream news reporting, recognize that the following are NORMAL and should NOT be flagged:
    - Attribution to official sources or reports
    - Reporting on complex issues without exhaustive detail
    - Focus on specific aspects of a larger issue
    - Straightforward reporting of events or outcomes
    - Use of quotes and statements from officials
    - Basic context setting
    
    Provide your analysis in this JSON format:
    {
        "potential_issues": [
            {
                "type": "type of issue",
                "explanation": "detailed explanation",
                "severity": "low/medium/high"
            }
        ],
        "credibility_score": <MUST BE A NUMBER 0-10, where 0 is completely unreliable and 10 is highly credible. Do not include any explanatory text, just the number>,
        "key_concerns": ["list of only major concerns, if any"],
        "recommendation": "brief recommendation for the reader"
    }
    
    If the content appears to be legitimate reporting without significant red flags, respond with:
    {
        "potential_issues": [],
        "credibility_score": <appropriate score based on source and content>,
        "key_concerns": [],
        "recommendation": "This appears to be straightforward reporting from a legitimate news source. Normal critical reading practices apply."
    }
    
    Base your analysis purely on the content provided. Don't invent problems where none exist.`
            };
    
            const response = await this.ollama.chat({
                model: this.currentModel,
                messages: [systemPrompt, analyzePrompt],
                options: {
                    temperature: 0.7,
                    top_k: 50,
                    top_p: 0.95,
                    stream: false
                }
            });
    
            try {
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