const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');

class OllamaService {
    constructor() {
        this.childProcess = null;
        this.host = 'http://127.0.0.1:11434';
    }

    async startOllama() {
        try {
            // First check if Ollama is already running
            await this.ping();
            console.log('Ollama is already running');
            return;
        } catch (err) {
            console.log('Ollama is not running, starting it up...');
        }

        // Get the appropriate binary path
        const binaryPath = this.getOllamaBinaryPath();
        const appDataPath = this.getAppDataPath();

        // Ensure app data directory exists
        if (!fs.existsSync(appDataPath)) {
            fs.mkdirSync(appDataPath, { recursive: true });
        }

        // Start Ollama
        return new Promise((resolve, reject) => {
            const env = {
                ...process.env,
                OLLAMA_MODELS: appDataPath
            };

            this.childProcess = exec(`${binaryPath} serve`, { env }, (err, stdout, stderr) => {
                if (err) {
                    reject(`Failed to start Ollama: ${err}`);
                    return;
                }
            });

            // Wait for Ollama to start
            this.waitForOllama()
                .then(resolve)
                .catch(reject);
        });
    }

    getOllamaBinaryPath() {
        // Get the path to the packaged Ollama binary
        const isProd = process.env.NODE_ENV === 'production';
        const binariesPath = isProd 
            ? process.resourcesPath
            : path.join(__dirname, '..', '..', 'resources');

        let binaryName;
        switch (process.platform) {
            case 'win32':
                binaryName = 'ollama.exe';
                break;
            case 'darwin':
                binaryName = 'ollama-darwin';
                break;
            case 'linux':
                binaryName = 'ollama-linux';
                break;
            default:
                throw new Error(`Unsupported platform: ${process.platform}`);
        }

        return path.join(binariesPath, 'ollama', 'runners', binaryName);
    }

    getAppDataPath() {
        switch (process.platform) {
            case 'win32':
                return path.join(os.homedir(), 'AppData', 'Local', 'ContentAnalyzer');
            case 'darwin':
                return path.join(os.homedir(), 'Library', 'Application Support', 'ContentAnalyzer');
            case 'linux':
                return path.join(os.homedir(), '.config', 'ContentAnalyzer');
            default:
                throw new Error(`Unsupported platform: ${process.platform}`);
        }
    }

    async ping() {
        const response = await fetch(this.host);
        if (!response.ok) {
            throw new Error('Ollama is not running');
        }
        return true;
    }

    async waitForOllama(retries = 5, delay = 1000) {
        for (let i = 0; i < retries; i++) {
            try {
                await this.ping();
                return true;
            } catch (err) {
                if (i === retries - 1) throw err;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    stop() {
        if (!this.childProcess) return;

        if (process.platform === 'win32') {
            // Windows needs special handling to kill the process tree
            exec(`taskkill /pid ${this.childProcess.pid} /f /t`);
        } else {
            this.childProcess.kill();
        }

        this.childProcess = null;
    }
}

module.exports = new OllamaService();