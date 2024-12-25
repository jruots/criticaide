const path = require('path');
const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');

class OllamaService {
    constructor() {
        this.childProcess = null;
        this.host = 'http://127.0.0.1:11434';
        // Set development mode based on npm start vs packaged app
        this.isDev = process.env.NODE_ENV !== 'production';
        console.log(`OllamaService initialized in ${this.isDev ? 'development' : 'production'} mode`);
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

        if (this.isDev) {
            // In development, try to use system Ollama first
            try {
                await this.startSystemOllama();
                return;
            } catch (err) {
                console.log('Could not start system Ollama:', err);
                console.log('Falling back to packaged Ollama...');
            }
        }

        // If we're in production or system Ollama failed, use packaged version
        await this.startPackagedOllama();
    }

    async startSystemOllama() {
        return new Promise((resolve, reject) => {
            this.childProcess = exec('ollama serve', (err) => {
                if (err) {
                    reject(err);
                    return;
                }
            });

            this.waitForOllama()
                .then(resolve)
                .catch(reject);
        });
    }

    async startPackagedOllama() {
        const binaryPath = this.getOllamaBinaryPath();
        const appDataPath = this.getAppDataPath();

        if (!fs.existsSync(appDataPath)) {
            fs.mkdirSync(appDataPath, { recursive: true });
        }

        return new Promise((resolve, reject) => {
            const env = {
                ...process.env,
                OLLAMA_MODELS: appDataPath
            };

            console.log(`Starting packaged Ollama from: ${binaryPath}`);
            this.childProcess = exec(`"${binaryPath}" serve`, { env }, (err) => {
                if (err) {
                    reject(`Failed to start Ollama: ${err}`);
                    return;
                }
            });

            this.waitForOllama()
                .then(resolve)
                .catch(reject);
        });
    }

    getOllamaBinaryPath() {
        const binariesPath = this.isDev 
            ? path.join(__dirname, '..', '..', 'resources')
            : process.resourcesPath;

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