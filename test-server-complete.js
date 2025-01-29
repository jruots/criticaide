// test-server-complete.js
const { spawn } = require('child_process');
const path = require('path');

class LlamaCppService {
    constructor() {
        this.process = null;
        this.modelPath = path.join(process.cwd(), 'resources', 'llama', 'models');
        this.binaryPath = path.join(process.cwd(), 'resources', 'llama', 'binaries', 'win', 'llama-server.exe');
        this.isServerReady = false;
    }

    async startServer() {
        console.log('Starting server...');
        console.log('Binary path:', this.binaryPath);
        console.log('Model path:', this.modelPath);

        const args = [
            '--model', path.join(this.modelPath, 'Phi-3.5-mini-instruct-Q4_K_M.gguf'),
            '--ctx-size', '2048',
            '--n-gpu-layers', '35'  // Enable GPU acceleration
        ];

        console.log('\nStarting with args:', args);
        this.process = spawn(this.binaryPath, args, { 
            cwd: path.dirname(this.binaryPath) // Run from the binary directory
        });

        return new Promise((resolve, reject) => {
            let serverOutput = '';

            this.process.stdout.on('data', (data) => {
                const output = data.toString();
                serverOutput += output;
                console.log('Server stdout:', output);
                
                if (output.includes('server listening')) {
                    this.isServerReady = true;
                    resolve();
                }
            });

            this.process.stderr.on('data', (data) => {
                const error = data.toString();
                console.error('Server stderr:', error);
                serverOutput += error;
            });

            this.process.on('error', (error) => {
                console.error('Process error:', error);
                reject(error);
            });

            this.process.on('close', (code) => {
                if (!this.isServerReady) {
                    console.error('Server closed before ready. Exit code:', code);
                    console.error('Server output:', serverOutput);
                    reject(new Error(`Server closed with code ${code}`));
                }
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                if (!this.isServerReady) {
                    console.error('Server startup timeout');
                    console.error('Accumulated output:', serverOutput);
                    this.stop();
                    reject(new Error('Server startup timeout'));
                }
            }, 30000);
        });
    }

    async testCompletion() {
        console.log('\nTesting completion API...');
        
        const response = await fetch('http://127.0.0.1:8080/completion', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                prompt: 'Write a short funny joke about programming.',
                n_predict: 128,
                temperature: 0.7,
                stop: ["\n\n"]  // Stop at double newline
            })
        });

        if (!response.ok) {
            throw new Error(`Completion API failed: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('\nCompletion result:', result);
        return result;
    }

    async testHealth() {
        console.log('\nTesting health endpoint...');
        
        const response = await fetch('http://127.0.0.1:8080/health');
        const result = await response.json();
        
        console.log('Health check result:', result);
        return result;
    }

    async stop() {
        if (this.process) {
            console.log('\nStopping server...');
            this.process.kill();
            this.process = null;
            this.isServerReady = false;
        }
    }
}

async function runTest() {
    const service = new LlamaCppService();
    try {
        // Start server
        await service.startServer();
        console.log('\nServer started successfully!');
        
        // Wait a moment for the server to fully initialize
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test health endpoint
        await service.testHealth();
        
        // Test completion
        await service.testCompletion();
        
        console.log('\nAll tests completed successfully!');
    } catch (error) {
        console.error('\nTest failed:', error);
    } finally {
        await service.stop();
        console.log('\nServer stopped');
    }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', async () => {
    console.log('\nReceived SIGINT. Cleaning up...');
    const service = new LlamaCppService();
    await service.stop();
    process.exit(0);
});

runTest();