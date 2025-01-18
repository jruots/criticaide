const electronLog = require('electron-log');
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

class Logger {
    constructor() {
        // Set up log directory
        const userDataPath = app.getPath('userData');
        this.logDir = path.join(userDataPath, 'logs');
        this.currentLogPath = path.join(this.logDir, 'current.log');
        this.previousLogPath = path.join(this.logDir, 'previous.log');
        this.errorDumpsDir = path.join(this.logDir, 'error_dumps');

        // Ensure directories exist
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
        if (!fs.existsSync(this.errorDumpsDir)) {
            fs.mkdirSync(this.errorDumpsDir, { recursive: true });
        }

        // Rotate logs on startup
        this.rotateLogsOnStartup();

        // Configure electron-log
        electronLog.transports.file.resolvePathFn = () => this.currentLogPath;
        electronLog.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] [{scope}] {text}';
        
        // Remove default console transport as we'll handle it ourselves in development
        electronLog.transports.console.level = false;
        
        // Initialize scope
        this.currentScope = 'Main';
    }

    rotateLogsOnStartup() {
        try {
            // If current.log exists, move it to previous.log
            if (fs.existsSync(this.currentLogPath)) {
                if (fs.existsSync(this.previousLogPath)) {
                    fs.unlinkSync(this.previousLogPath);
                }
                fs.renameSync(this.currentLogPath, this.previousLogPath);
            }
            
            // Create new empty current.log
            fs.writeFileSync(this.currentLogPath, '');
        } catch (error) {
            console.error('Failed to rotate logs:', error);
        }
    }

    setScope(scope) {
        this.currentScope = scope;
    }

    formatMessage(message, data) {
        if (data) {
            if (typeof data === 'object') {
                return `${message} ${JSON.stringify(data)}`;
            }
            return `${message} ${data}`;
        }
        return message;
    }

    log(level, message, data) {
        const formattedMessage = this.formatMessage(message, data);
        electronLog[level]({ scope: this.currentScope }, formattedMessage);

        // In development, also log to console with colors
        if (process.env.NODE_ENV === 'development') {
            const colors = {
                error: '\x1b[31m', // Red
                warn: '\x1b[33m',  // Yellow
                info: '\x1b[36m',  // Cyan
                debug: '\x1b[90m'  // Gray
            };
            const reset = '\x1b[0m';
            console.log(`${colors[level]}[${level.toUpperCase()}] [${this.currentScope}] ${formattedMessage}${reset}`);
        }
    }

    // Convenience methods
    error(message, data) { 
        const errorData = data instanceof Error ? {
            message: data.message,
            stack: data.stack,
            name: data.name
        } : data;
        
        this.log('error', message, errorData); 
    }
    warn(message, data) { this.log('warn', message, data); }
    info(message, data) { this.log('info', message, data); }
    debug(message, data) { this.log('debug', message, data); }

    // Method for creating error dumps
    createErrorDump(error) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const dumpPath = path.join(this.errorDumpsDir, `error_${timestamp}.json`);
            
            const errorData = {
                timestamp: new Date().toISOString(),
                error: {
                    message: error.message,
                    stack: error.stack,
                    name: error.name
                },
                systemInfo: {
                    platform: process.platform,
                    arch: process.arch,
                    nodeVersion: process.version,
                    electronVersion: process.versions.electron,
                    memory: {
                        total: (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2) + 'GB',
                        free: (os.freemem() / (1024 * 1024 * 1024)).toFixed(2) + 'GB',
                        percentFree: ((os.freemem() / os.totalmem()) * 100).toFixed(1) + '%'
                    }
                }
            };

            fs.writeFileSync(dumpPath, JSON.stringify(errorData, null, 2));
            this.error('Created error dump:', dumpPath);
            
            // Clean up old error dumps (keep last 10)
            this.cleanupErrorDumps();
        } catch (dumpError) {
            this.error('Failed to create error dump:', dumpError);
        }
    }

    cleanupErrorDumps() {
        try {
            const files = fs.readdirSync(this.errorDumpsDir)
                .map(file => ({
                    name: file,
                    path: path.join(this.errorDumpsDir, file),
                    time: fs.statSync(path.join(this.errorDumpsDir, file)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time);

            // Keep only the 10 most recent dumps
            files.slice(10).forEach(file => {
                fs.unlinkSync(file.path);
                this.debug('Cleaned up old error dump:', file.name);
            });
        } catch (error) {
            this.error('Failed to cleanup error dumps:', error);
        }
    }

    // Add this method to the Logger class
    debugShortcut(message, data) {
        const previousScope = this.currentScope;
        this.setScope('Keyboard');  // Force keyboard scope for shortcut logging
        
        if (process.env.NODE_ENV === 'development') {
            this.debug(message, data);
        } else {
            this.info(message, data);
        }
        
        this.setScope(previousScope);  // Restore previous scope
    }

    // Optionally, add this helper method if you want more control
    logKeyboardEvent(eventType, keyInfo, currentKeys) {
        if (process.env.NODE_ENV === 'development') {
            this.debug(`Keyboard event - ${eventType}: ${keyInfo}`, {
                keys: Array.from(currentKeys),
                platform: process.platform
            });
        }
    }
}

// Export a singleton instance
module.exports = new Logger();