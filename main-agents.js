const { app, BrowserWindow, ipcMain, clipboard, Notification } = require('electron');
const path = require('path');
const { GlobalKeyboardListener } = require('node-global-key-listener');
const LlamaCppService = require('./src/service/llama/llama.js');
const AgentService = require('./src/service/agentService.js');
const logger = require('./src/utils/logger');
const os = require('os');
const { checkMemory } = require('./src/utils/memory');

let mainWindow;
let llamaService = null;
let agentService = null;
const keyboardListener = new GlobalKeyboardListener();
const MAX_DETAILED_LOGGING_ATTEMPTS = 3;
let shortcutAttemptCount = 0;

let store = null;

if (process.platform === 'win32') {
    app.setAppUserModelId('Criticaide-Agents-PoC');
}

function logSystemInfo() {
    logger.setScope('System');
    const totalMemGB = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
    const freeMemGB = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
    logger.info(`System memory - Total: ${totalMemGB}GB, Free: ${freeMemGB}GB`);
}

function createWindow() {
    logger.setScope('Window');
    logger.info('Creating main window...');
    
    const isDev = process.env.NODE_ENV === 'development';
    logger.info(`Running in ${isDev ? 'development' : 'production'} mode`);

    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload-agents.js'),
            devTools: isDev
        }
    });

    mainWindow.loadFile('src/index-agents.html');
    
    if (isDev) {
        mainWindow.webContents.openDevTools();
        logger.debug('DevTools opened for development');
    }

    mainWindow.webContents.on('did-finish-load', () => {
        logger.info('Main window loaded successfully');
        // Send server starting event after window is loaded
        mainWindow.webContents.send('server-starting');
    });
}

function sendAgentProgress(update) {
    if (mainWindow?.webContents) {
        mainWindow.webContents.send('agent-progress', update);
    }
}

async function analyzeText(text, source='N/A') {
    logger.setScope('Analysis');
    logger.info('Starting agent-based text analysis...');
    logger.debug(`Text source: ${source}`);

    mainWindow.webContents.send('analysis-start');

    const memoryState = checkMemory();
    logger.info(`Memory state before analysis - Free: ${memoryState.freeMemGB}GB`);
    
    if (memoryState.isCritical) {
        logger.warn('Memory is critically low before analysis');
        new Notification({
            title: 'Low Memory Warning',
            body: memoryState.messages.warning
        }).show();
    }

    try {
        logger.debug('Starting analysis with agent service...');
        try {
            const analysis = await agentService.analyze(text, source);
            logger.info('Analysis complete');
            logger.debug('Analysis result:', analysis);
            return analysis;
        } catch (error) {
            logger.error('Error during analysis:', error);
            
            const postFailureMemory = checkMemory();
            logger.debug(`Memory state after failure - Free: ${postFailureMemory.freeMemGB}GB`);
            
            const message = (memoryState.isCritical || postFailureMemory.isCritical) 
                ? postFailureMemory.messages.failureCritical
                : `Error: Could not complete analysis - ${error.message}. Please try again.`;
            
            return {
                credibility_score: 0,
                potential_issues: [],
                recommendation: message
            };
        }
    } catch (error) {
        logger.error('Error setting up analysis:', error);
        return {
            credibility_score: 0,
            potential_issues: [],
            recommendation: `Error: Could not complete analysis - ${error.message}. Please try again.`
        };
    }
}

function extractSourceFromClipboard() {
    logger.setScope('Clipboard');
    logger.info('Extracting source from clipboard...');
    
    const formats = clipboard.availableFormats();
    logger.debug(`Available clipboard formats: ${formats.join(', ')}`);
    
    if (formats.includes('text/html')) {
        const html = clipboard.readHTML();
        logger.debug('Found HTML content in clipboard');
        
        try {
            if (html.includes('SourceURL:')) {
                logger.debug('Found SourceURL marker in HTML');
                const match = html.match(/SourceURL:\s*(.*?)[\n\r]/);
                if (match && match[1]) {
                    logger.info('Found source URL in metadata:', match[1].trim());
                    return match[1].trim();
                }
            }

            const urlMatch = html.match(/https?:\/\/[^\s<>"']+/);
            if (urlMatch) {
                logger.info('Found URL in HTML:', urlMatch[0]);
                return urlMatch[0];
            }
        } catch (error) {
            logger.error('Error parsing HTML content:', error);
        }
    }

    if (formats.includes('text/x-moz-url')) {
        try {
            const urls = clipboard.readBuffer('text/x-moz-url').toString();
            logger.debug('Firefox URL buffer content:', urls);
            const firstUrl = urls.split('\n')[0];
            if (firstUrl) {
                logger.info('Found Firefox URL:', firstUrl);
                return firstUrl;
            }
        } catch (error) {
            logger.error('Error reading Firefox URL:', error);
        }
    }

    logger.info('No source URL found in clipboard');
    return 'N/A';
}

function isValidText(text) {
    logger.setScope('Validation');

    if (!text || typeof text !== 'string') {
        logger.warn('Invalid text: text is null, undefined, or not a string');
        return { valid: false, reason: 'No text found in clipboard' };
    }

    if (text.trim().length === 0) {
        logger.warn('Invalid text: text is empty or only whitespace');
        return { valid: false, reason: 'Selected text is empty' };
    }

    if (text.trim().length >= 5000) {
        logger.warn('Invalid text: text exceeds maximum length');
        return { valid: false, reason: 'Text is too long (maximum 5000 characters). Please select a shorter portion of text.' };
    }

    logger.debug('Text validation passed');
    return { valid: true };
}

function setupKeyboardShortcuts() {
    logger.setScope('Keyboard');
    logger.info('Setting up keyboard shortcuts...');
    let currentKeys = new Set();

    keyboardListener.addListener(function (e) {
        if (e.name.startsWith('MOUSE')) {
            return;
        }

        const handleKeyboardEvent = () => {
            logger.setScope('Keyboard');
            
            if (e.state === 'DOWN') {
                currentKeys.add(e.name);
                
                const isWindows = process.platform === 'win32';
                const isMac = process.platform === 'darwin';
                
                const hasCtrlOrCmd = isWindows 
                    ? (currentKeys.has('LEFT CTRL') || currentKeys.has('RIGHT CTRL'))
                    : (currentKeys.has('LEFT META') || currentKeys.has('RIGHT META'));
                
                const hasAltOrOption = isWindows
                    ? (currentKeys.has('LEFT ALT') || currentKeys.has('RIGHT ALT'))
                    : (currentKeys.has('LEFT OPTION') || currentKeys.has('RIGHT OPTION'));
                
                const hasShift = currentKeys.has('LEFT SHIFT') || currentKeys.has('RIGHT SHIFT');
                const hasT = currentKeys.has('T');

                const isFullShortcut = hasCtrlOrCmd && hasAltOrOption && hasShift && hasT;
                
                if (isFullShortcut) {
                    shortcutAttemptCount++;
                    logger.info(`Shortcut attempt ${shortcutAttemptCount} detected`);
                    
                    setTimeout(() => {
                        const selectedText = clipboard.readText();
                        logger.debug(`Clipboard content length: ${selectedText?.length || 0}`);
                        
                        const validation = isValidText(selectedText);
                        if (validation.valid) {
                            logger.info('Found valid text in clipboard:', selectedText.substring(0, 100) + '...');
                            const source = extractSourceFromClipboard();
                            logger.debug(`Extracted source: ${source}`);
                            new Notification({
                                title: 'Analysis Status',
                                body: 'Analyzing text with agent system...'
                            }).show();

                            analyzeText(selectedText, source).then(analysis => {
                                logger.info('Analysis complete, showing results');
                                mainWindow.webContents.send('analysis-result', {
                                    text: selectedText,
                                    analysis: analysis
                                });
                                mainWindow.show();
                            }).catch(error => {
                                logger.error('Analysis failed:', error);
                                new Notification({
                                    title: 'Criticaide',
                                    body: 'Error analyzing text. Please try again.'
                                }).show();
                            });
                        } else {
                            logger.warn(`Invalid text: ${validation.reason}`);
                            new Notification({
                                title: 'Criticaide',
                                body: validation.reason
                            }).show();
                        }
                    }, 100);
                }
            } else if (e.state === 'UP') {
                const keyName = e.name;
                currentKeys.delete(keyName);
            }
        };
        
        handleKeyboardEvent();
    });

    logger.info('Keyboard shortcuts setup complete');
}

app.whenReady().then(async () => {
    try {
        logger.setScope('Startup');
        logger.info('Starting Criticaide Agents PoC...');
        logSystemInfo();
        
        const Store = await import('electron-store');
        store = new Store.default();
        
        createWindow(store);
        
        llamaService = new LlamaCppService();
        logger.info('LlamaCpp service initialized');
        
        await llamaService.serve();
        logger.info('LlamaCpp server started');
        
        // Initialize agent service
        agentService = new AgentService(llamaService);
        agentService.init(sendAgentProgress);
        logger.info('Agent service initialized');
        
        // Server is ready - send event only if window exists
        if (mainWindow?.webContents) {
            mainWindow.webContents.send('server-ready');
        }
        
        // Show welcome notification
        const isMac = process.platform === 'darwin';
        const copyKey = isMac ? 'Cmd+C' : 'Ctrl+C';
        const shortcutKey = isMac ? 'Cmd+Option+Shift+T' : 'Ctrl+Alt+Shift+T';
        new Notification({
            title: 'Welcome to Criticaide Agents!',
            body: `App is ready! To analyze text:\n1. Select text\n2. Press ${copyKey}\n3. Press ${shortcutKey}`
        }).show();
        
        setupKeyboardShortcuts();
        shortcutAttemptCount = 0;
        
    } catch (error) {
        logger.error('Failed to start:', error);
        logger.createErrorDump(error);
        
        if (mainWindow) {
            mainWindow.webContents.send('server-error', error.message);
        }
        
        new Notification({
            title: 'Criticaide',
            body: 'Error starting application. Please check logs.'
        }).show();
    }
});

app.on('will-quit', async (event) => {
    logger.setScope('Shutdown');
    logger.info('Application shutting down');
    
    event.preventDefault();
    
    try {
        const cleanupTimeout = setTimeout(() => {
            logger.warn('Cleanup timeout reached, forcing quit');
            app.exit(0);
        }, 5000);

        await llamaService.stop();
        clearTimeout(cleanupTimeout);
        
        app.exit(0);
    } catch (error) {
        logger.error('Error during shutdown:', error);
        app.exit(1);
    }
});

app.on('window-all-closed', () => {
    logger.info('All windows closed');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    logger.info('App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});