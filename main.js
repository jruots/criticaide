const { app, BrowserWindow, ipcMain, clipboard, Notification } = require('electron');
const path = require('path');
const { GlobalKeyboardListener } = require('node-global-key-listener');
const ollamaService = require('./src/service/ollama');

let mainWindow;
const keyboardListener = new GlobalKeyboardListener();

// Setup basic logging
function log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${type}]: ${message}`);
}

function createWindow() {
    log('Creating main window...');
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        show: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    mainWindow.loadFile('src/index.html');
    mainWindow.webContents.openDevTools();

    mainWindow.webContents.on('did-finish-load', () => {
        log('Main window loaded successfully');
        new Notification({
            title: 'Content Analyzer',
            body: 'App is running! To analyze text:\n1. Select text\n2. Press Ctrl+C\n3. Press Ctrl+Alt+Shift+T'
        }).show();
    });
}

async function checkOllamaConnection() {
    log('Checking Ollama connection...');
    try {
        log('Making request to Ollama version endpoint...');
        const response = await fetch('http://127.0.0.1:11434/api/version');  // Changed from localhost to 127.0.0.1
        if (!response.ok) {
            log(`Ollama responded with status: ${response.status}`);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        log('Ollama connection successful:', JSON.stringify(data));
        return true;
    } catch (error) {
        log('Ollama connection failed. Full error:', error);
        if (error.cause) {
            log('Error cause:', error.cause);
        }
        return false;
    }
}

async function analyzeText(text) {
    log('Starting text analysis...');
    
    try {
        // Check Ollama connection first
        log('Checking Ollama connection before analysis...');
        const isOllamaRunning = await checkOllamaConnection();
        if (!isOllamaRunning) {
            throw new Error('Ollama connection check failed');
        }

    const prompt = `Analyze the following text for clear signs of misinformation or manipulation. Only flag serious issues that would genuinely mislead readers. For legitimate news reporting from established sources, it's perfectly fine to report "no significant issues found."

Consider the source when analyzing credibility, though source information may not always be available. Examples of source types:
- News organizations (.com/news, known publishers)
- Social media platforms (twitter.com, facebook.com)
- Academic sources (.edu)
- Government sites (.gov)
- Blog posts or personal sites
   
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

Base your analysis purely on the content provided. Don't invent problems where none exist.`;

        log('Sending request to Ollama...');
        const response = await fetch('http://127.0.0.1:11434/api/generate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'mistral',
                prompt: prompt,
                stream: false  // No streaming, get complete response
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        log('Received response from Ollama:', result);

        if (!result.response) {
            throw new Error('No response data in Ollama result');
        }

        // Parse the complete JSON response
        const analysis = JSON.parse(result.response);
        log('Successfully parsed analysis:', analysis);
        return analysis;

        } catch (error) {
        log(`Error during analysis: ${error.message}`, 'error');
        log(`Error stack: ${error.stack}`, 'error');
        return {
            credibility_score: 0,
            potential_issues: [],
            recommendation: `Error: Could not complete analysis - ${error.message}. Please try again.`
        };
    }
}


function isValidText(text) {
    // Check if text looks like code (simple heuristic)
    const codeIndicators = [
        'function', 
        'const', 
        'let', 
        'var', 
        'if (', 
        'else {',
        '});'
    ];
    
    const hasCodeIndicators = codeIndicators.some(indicator => 
        text.includes(indicator)
    );

    // Text should be non-empty and not look like code
    return text.trim().length > 0 && 
           text.trim().length < 5000 && // Reasonable length
           !hasCodeIndicators;
}

function setupKeyboardShortcuts() {
    log('Setting up keyboard shortcuts...');
    let currentKeys = new Set();

    keyboardListener.addListener(function (e) {
        if (e.state === 'DOWN') {
            currentKeys.add(e.name);
            log(`Key pressed: ${e.name}`);
            log(`Current keys held: ${Array.from(currentKeys).join(', ')}`);

            // Check for Ctrl + Alt + Shift + T
            if ((currentKeys.has('LEFT CTRL') || currentKeys.has('RIGHT CTRL')) && 
                (currentKeys.has('LEFT ALT') || currentKeys.has('RIGHT ALT')) && 
                (currentKeys.has('LEFT SHIFT') || currentKeys.has('RIGHT SHIFT')) && 
                currentKeys.has('T')) {
                
                log('Text capture hotkey detected!');
                
                // Get currently selected text from clipboard
                const selectedText = clipboard.readText();
                
                if (isValidText(selectedText)) {
                    log('Found valid text in clipboard:', selectedText.substring(0, 100) + '...');
                    new Notification({
                        title: 'Content Analyzer',
                        body: 'Analyzing text...'
                    }).show();

                    // Analyze immediately
                    analyzeText(selectedText).then(analysis => {
                        log('Analysis complete, showing results');
                        mainWindow.webContents.send('analysis-result', {
                            text: selectedText,
                            analysis: analysis
                        });
                        mainWindow.show();
                    }).catch(error => {
                        log('Analysis failed:', error);
                        new Notification({
                            title: 'Content Analyzer',
                            body: 'Error analyzing text. Please try again.'
                        }).show();
                    });
                } else {
                    log('No valid text in clipboard');
                    new Notification({
                        title: 'Content Analyzer',
                        body: 'Please select text and press Ctrl+C first, then use the shortcut.'
                    }).show();
                }
            }
        } else if (e.state === 'UP') {
            log(`Key released: ${e.name}`);
            currentKeys.delete(e.name);
            log(`Updated keys held: ${Array.from(currentKeys).join(', ')}`);
        }
    });

    log('Keyboard shortcuts setup complete');
}

///
///app.whenReady().then(() => {
///    log('App ready, initializing...');
///    createWindow();
///    setupKeyboardShortcuts();
///    log('Initialization complete');
///});

app.whenReady().then(async () => {
    try {
        await ollamaService.startOllama();
        createWindow();
        setupKeyboardShortcuts();
    } catch (error) {
        console.error('Failed to start Ollama:', error);
        // Handle error appropriately
    }
});

// Add before app.quit
app.on('will-quit', () => {
    ollamaService.stop();
});

app.on('window-all-closed', () => {
    log('All windows closed');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    log('App activated');
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});