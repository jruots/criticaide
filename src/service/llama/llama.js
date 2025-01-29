// src/service/llama/llama.js
const { spawn } = require('child_process');
const path = require('path');
const logger = require('../../utils/logger');

class LlamaCppService {
    constructor() {
        this.process = null;
        this.isServerReady = false;
    }

    async getModelPath() {
        return path.join(process.resourcesPath, 'models', 'Phi-3.5-mini-instruct-Q4_K_M.gguf');
    }

    async getBinaryPath() {
        return path.join(process.resourcesPath, 'bin', process.platform === 'win32' ? 'llama-server.exe' : 'llama-server');
    }

    async serve() {
        logger.setScope('LlamaCpp');
        logger.info('Starting llama.cpp server...');

        const modelPath = await this.getModelPath();
        const binaryPath = await this.getBinaryPath();
        const binaryDir = path.dirname(binaryPath);

        const args = [
            '--model', modelPath,
            '--ctx-size', '2048',
            '--n-gpu-layers', '35'
        ];

        logger.info(`Starting server with binary: ${binaryPath}`);
        logger.info(`Using model: ${modelPath}`);
        logger.debug('Arguments:', args);

        this.process = spawn(binaryPath, args, {
            cwd: binaryDir
        });

        return new Promise((resolve, reject) => {
            let serverOutput = '';

            this.process.stdout.on('data', (data) => {
                const output = data.toString();
                serverOutput += output;
                logger.debug('Server stdout:', output);
                
                if (output.includes('server listening')) {
                    this.isServerReady = true;
                    resolve('system');  // Match Ollama's return type
                }
            });

            this.process.stderr.on('data', (data) => {
                const error = data.toString();
                logger.debug('Server stderr:', error);
                serverOutput += error;

                // Still check stderr for the listening message as llama.cpp outputs to stderr
                if (error.includes('server listening')) {
                    this.isServerReady = true;
                    resolve('system');
                }
            });

            this.process.on('error', (error) => {
                logger.error('Process error:', error);
                reject(error);
            });

            this.process.on('close', (code) => {
                if (!this.isServerReady) {
                    logger.error('Server closed before ready. Exit code:', code);
                    logger.error('Server output:', serverOutput);
                    reject(new Error(`Server closed with code ${code}`));
                }
            });

            setTimeout(() => {
                if (!this.isServerReady) {
                    logger.error('Server startup timeout');
                    logger.error('Accumulated output:', serverOutput);
                    this.stop();
                    reject(new Error('Server startup timeout'));
                }
            }, 30000);
        });
    }

    async analyze(text, source = 'N/A') {
        try {
            logger.debug('Starting analysis');
            const response = await fetch('http://127.0.0.1:8080/completion', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: `### Instruction:
Analyze the following text for credibility and manipulation:

Text from ${source}:
"${text}"

Provide your analysis in this format:
{
    "potential_issues": [
        {
            "type": "type of manipulation",
            "explanation": "detailed explanation with specific examples from text",
            "severity": "low/medium/high"
        }
    ],
    "credibility_score": <number 0-10>,
    "key_concerns": ["list of major concerns"],
    "recommendation": "specific guidance for reader"
}

### Response:`,
                    n_predict: 1024,
                    temperature: 0.7,
                    stop: ["###"],
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(`Analysis failed: ${response.statusText}`);
            }

            const result = await response.json();
            
            try {
                // Parse the generated JSON from the content
                const analysisMatch = result.content.match(/\{[\s\S]*\}/);
                if (!analysisMatch) {
                    throw new Error('No JSON found in response');
                }
                const analysis = JSON.parse(analysisMatch[0]);
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