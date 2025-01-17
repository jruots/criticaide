const { app, BrowserWindow, ipcMain, clipboard, Notification } = require('electron');
const path = require('path');
const { GlobalKeyboardListener } = require('node-global-key-listener');
const OllamaOrchestrator = require('./src/service/ollama/ollama.js');
const logger = require('./src/utils/logger');
const os = require('os');
const { checkMemory } = require('./src/utils/memory');
let ollamaService = null;
const MAX_DETAILED_LOGGING_ATTEMPTS = 3;  // Number of attempts to log in detail
let shortcutAttemptCount = 0;  // Counter for shortcut attempts

let mainWindow;
const keyboardListener = new GlobalKeyboardListener();

const { analyzePrompt: defaultAnalyze } = require('./src/prompts/phi35/analyze.js');

let store = null;

if (process.platform === 'win32') {
    app.setAppUserModelId('Criticaide');
}

// Add this function near the other logging functions
function logSystemInfo() {
    logger.setScope('System');
    const totalMemGB = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(2);
    const freeMemGB = (os.freemem() / (1024 * 1024 * 1024)).toFixed(2);
    logger.info(`System memory - Total: ${totalMemGB}GB, Free: ${freeMemGB}GB`);
}

// In main.js, modify createWindow():
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
            preload: path.join(__dirname, 'preload.js'),
            devTools: isDev
        }
    });

    mainWindow.loadFile('src/index.html');
    
    if (isDev) {
        mainWindow.webContents.openDevTools();
        logger.debug('DevTools opened for development');
    }

    mainWindow.webContents.on('did-finish-load', () => {
        logger.info('Main window loaded successfully');
        
        // Only show setup screen if this is first startup
        if (!store.get('initialModelDownloaded')) {
            mainWindow.webContents.send('show-initial-setup');
        }
    });
}

async function checkOllamaConnection() {
    logger.setScope('Ollama');
    logger.info('Checking Ollama connection...');
    try {
        logger.debug('Making request to Ollama version endpoint...');
        const response = await fetch('http://127.0.0.1:11434/api/version');  // Changed from localhost to 127.0.0.1
        if (!response.ok) {
            logger.warn(`Ollama responded with status: ${response.status}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        logger.info('Ollama connection successful:', data);
        return true;
    } catch (error) {
        logger.error('Ollama connection failed:', error);
        if (error.cause) {
            logger.error('Error cause:', error.cause);
        }
        return false;
    }
}

async function analyzeText(text, source='N/A') {
    logger.setScope('Analysis');
    logger.info('Starting text analysis...');
    logger.debug(`Text source: ${source}`);

    // Send analysis-start event to renderer
    mainWindow.webContents.send('analysis-start');

        // Check memory before starting analysis
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
        const prompt = defaultAnalyze(source, text);

        logger.debug('Starting analysis with Ollama service...');
        try {
            const analysis = await ollamaService.analyze(text, source);
            logger.info('Analysis complete');
            logger.debug('Analysis result:', analysis);
            return analysis;
        } catch (error) {
            logger.error('Error during analysis:', error);
            
            // Check memory again after failure
            const postFailureMemory = checkMemory();
            logger.debug(`Memory state after failure - Free: ${postFailureMemory.freeMemGB}GB`);
            
            // If memory was critical during either check, include it in the error message
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
    
    // Get available formats with detailed logging
    const formats = clipboard.availableFormats();
    logger.debug(`Available clipboard formats: ${formats.join(', ')}`);
    
    // Log content for each available format
    formats.forEach(format => {
        try {
            if (format === 'text/html') {
                const html = clipboard.readHTML();
                logger.debug('HTML Content (first 500 chars):', html.substring(0, 500));
            } else if (format === 'text/plain') {
                const text = clipboard.readText();
                logger.debug('Plain Text Content (first 100 chars):', text.substring(0, 100));
            } else {
                const content = clipboard.readBuffer(format).toString();
                logger.debug(`Content for ${format} (first 100 chars):`, content.substring(0, 100));
            }
        } catch (error) {
            logger.error(`Error reading format ${format}:`, error);
        }
    });

    // Check for HTML content
    if (formats.includes('text/html')) {
        const html = clipboard.readHTML();
        logger.debug('Found HTML content in clipboard');
        logger.debug('Full HTML length:', html.length);

        // Try to extract source URL
        try {
            // First check for browser-added metadata
            if (html.includes('SourceURL:')) {
                logger.debug('Found SourceURL marker in HTML');
                const match = html.match(/SourceURL:\s*(.*?)[\n\r]/);
                if (match && match[1]) {
                    logger.info('Found source URL in metadata:', match[1].trim());
                    return match[1].trim();
                }
            } else {
                logger.debug('No SourceURL marker found in HTML');
            }

            // Look for first URL in the HTML content
            const urlMatch = html.match(/https?:\/\/[^\s<>"']+/);
            if (urlMatch) {
                logger.info('Found URL in HTML:', urlMatch[0]);
                return urlMatch[0];
            } else {
                logger.debug('No URLs found in HTML content');
                // Log some context around potential URL locations
                const hrefIndices = [...html.matchAll(/href=/g)].map(match => match.index);
                if (hrefIndices.length > 0) {
                    logger.debug('Found href attributes at positions:', hrefIndices.join(', '));
                    hrefIndices.forEach(index => {
                        logger.debug(`Context around href (${index}):`, html.substring(Math.max(0, index - 20), index + 40));
                    });
                }
            }
        } catch (error) {
            logger.error('Error parsing HTML content:', error);
        }
    }

    // Check for Firefox-specific URL format
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

    // If no source found
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
        // Only track keyboard events (not mouse)
        if (e.name.startsWith('MOUSE')) {
            return;
        }

        const handleKeyboardEvent = () => {
            logger.setScope('Keyboard');
            
            if (e.state === 'DOWN') {
                currentKeys.add(e.name);
                
                // Check if this might be part of our shortcut
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

                // Check for shortcut combination first
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
                                body: 'Analyzing text...'
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
                } else if (shortcutAttemptCount < MAX_DETAILED_LOGGING_ATTEMPTS) {
                    // During initial attempts, log all keys for debugging
                    logger.debugShortcut(
                        `Detailed key event - Key pressed: ${e.name}, ` +
                        `Current keys: [${Array.from(currentKeys).join(', ')}], ` +
                        `Platform: ${process.platform}`
                    );
                } else if (hasCtrlOrCmd || hasAltOrOption || hasShift || hasT) {
                    // After initial attempts, only log potential shortcut keys
                    logger.debug(`Potential shortcut key: ${e.name}`);
                }
            } else if (e.state === 'UP') {
                const keyName = e.name;
                currentKeys.delete(keyName);
                
                // Only log during initial attempts or if it's a shortcut-related key
                if (shortcutAttemptCount < MAX_DETAILED_LOGGING_ATTEMPTS) {
                    logger.debugShortcut(
                        `Detailed key event - Key released: ${keyName}, ` +
                        `Remaining keys: [${Array.from(currentKeys).join(', ')}], ` +
                        `Platform: ${process.platform}`
                    );
                }
            }
        };
        
        handleKeyboardEvent();
    });

    logger.info('Keyboard shortcuts setup complete');
}

// In main.js, modify app.whenReady():
// Modify the app.whenReady handler
app.whenReady().then(async () => {
    try {
        logger.setScope('Startup');
        logger.info('Starting application...');
        logSystemInfo();
        
        // Initialize store first
        const Store = await import('electron-store');
        store = new Store.default();
        
        // Now create window with initialized store
        createWindow(store);
        
        // If this isn't first startup, show the main screen immediately
        if (store.get('initialModelDownloaded')) {
            const isMac = process.platform === 'darwin';
            const copyKey = isMac ? 'Cmd+C' : 'Ctrl+C';
            const shortcutKey = isMac ? 'Cmd+Option+Shift+T' : 'Ctrl+Alt+Shift+T';
            new Notification({
                title: 'Welcome!',
                body: `App is ready! To analyze text:\n1. Select text\n2. Press ${copyKey}\n3. Press ${shortcutKey}`
            }).show();
        }
 
        // Rest of initialization
        ollamaService = await OllamaOrchestrator.getOllama();
        logger.info('OllamaOrchestrator initialized');
        
        const serveType = await ollamaService.serve();
        logger.info(`Ollama started with type: ${serveType}`);
        
        setupKeyboardShortcuts();
        shortcutAttemptCount = 0;
        
        // Send completion event regardless of initialModelDownloaded state
        mainWindow.webContents.send('initial-setup-complete');
        
        // Now set the flag if this was first time setup
        if (!store.get('initialModelDownloaded')) {
            store.set('initialModelDownloaded', true);
        }
        
    } catch (error) {
        logger.error('Failed to start:', error);
        logger.createErrorDump(error);
        
        if (mainWindow) {
            mainWindow.webContents.send('initial-setup-error', error.message);
        }
        
        new Notification({
            title: 'Criticaide',
            body: 'Error starting application. Please check logs.'
        }).show();
    }
 });

// Add before app.quit
app.on('will-quit', async (event) => {
    logger.setScope('Shutdown');
    logger.info('Application shutting down');
    
    // Prevent immediate quit to allow cleanup
    event.preventDefault();
    
    try {
        // Give cleanup operations a timeout
        const cleanupTimeout = setTimeout(() => {
            logger.warn('Cleanup timeout reached, forcing quit');
            app.exit(0);
        }, 5000);

        await ollamaService.stop();
        clearTimeout(cleanupTimeout);
        
        // Now we can quit
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