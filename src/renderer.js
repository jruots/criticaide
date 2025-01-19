document.addEventListener('DOMContentLoaded', () => {
    const headerSubtitle = document.querySelector('.header-subtitle');
    const isMac = window.api.platform === 'darwin';
    const shortcutText = isMac ? 'Cmd+Option+Shift+T' : 'Ctrl+Alt+Shift+T';
    headerSubtitle.textContent = `Press ${shortcutText} to analyze copied text`;

    // Create loading screen elements
    const loadingScreen = `
    <div class="loading-content">
        <h1 class="text-4xl font-bold text-sky-500 animate-pulse">
            Criticaide
        </h1>
        <div class="loading-spinner"></div>
        <p class="loading-text"></p>
    </div>
`;

    const loadingDiv = document.getElementById('loading');
    loadingDiv.innerHTML = loadingScreen;

    // Set up flavor text rotation
    const flavorTexts = [
        "Analyzing credibility patterns...",
        "Checking for manipulation tactics...",
        "Evaluating source reliability...",
        "Scanning for cognitive bias markers...",
        "Examining rhetorical patterns...",
        "Detecting emotional manipulation...",
        "Verifying factual consistency...",
        "Assessing logical fallacies...",
        "Identifying citation patterns...",
        "Cross-referencing claims...",
        "Measuring information integrity...",
        "Detecting propaganda techniques...",
        "Evaluating narrative framing...",
        "Analyzing tone and intent...",
        "Checking source authenticity...",
        "Mapping information context...",
        "Examining argument structure...",
        "Validating evidential support...",
        "Detecting agenda markers...",
        "Analyzing source attribution...",
        "Evaluating expert credentials...",
        "Checking for cherry-picked data...",
        "Scanning persuasion patterns...",
        "Identifying cognitive shortcuts..."
    ];

        // In renderer.js, add to the top of the file where other constants are defined:
    const setupFlavorTexts = [
        "Initializing Criticaide...",
        "Setting up analysis engine...",
        "Preparing language model...",
        "Configuring system...",
        "Almost ready...",
    ];
    
    let currentText = 0;
    const textElement = loadingDiv.querySelector('.loading-text');
    
    function rotateText() {
        textElement.style.opacity = '0';
        setTimeout(() => {
            textElement.textContent = flavorTexts[currentText];
            textElement.style.opacity = '1';
            currentText = (currentText + 1) % flavorTexts.length;
        }, 500);
    }

    let textInterval;

    // Handle analysis start
    window.api.onAnalysisStart(() => {
        const resultsDiv = document.getElementById('results');
        
        resultsDiv.style.display = 'none';
        loadingDiv.style.display = 'flex';
        
        currentText = Math.floor(Math.random() * flavorTexts.length);
        rotateText();
        textInterval = setInterval(rotateText, 3000);
    });

    // Handle analysis complete
    window.api.receiveAnalysis((data) => {
        const resultsDiv = document.getElementById('results');
        
        clearInterval(textInterval);
        loadingDiv.style.display = 'none';
        resultsDiv.style.display = 'block';

        if (data.error === 'TOKEN_LIMIT_EXCEEDED') {
            resultsDiv.innerHTML = `
                <div class="error-message">
                    <h3>Text Too Long</h3>
                    <p>${data.message}</p>
                    <p>Please try again with a shorter text.</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="score">
                <h3>Credibility Score: ${data.analysis.credibility_score}/10</h3>
            </div>
        `;
       
        if (data.analysis.potential_issues.length > 0) {
            html += '<div class="issues"><h3>Potential Issues:</h3><ul>';
            data.analysis.potential_issues.forEach(issue => {
                html += `
                    <li>
                        <strong>${issue.type}</strong> (Severity: ${issue.severity})
                        <p>${issue.explanation}</p>
                    </li>
                `;
            });
            html += '</ul></div>';
        } else {
            html += '<p class="no-issues">No significant issues found</p>';
        }

        if (data.analysis.key_concerns && data.analysis.key_concerns.length > 0) {
            html += '<div class="concerns"><h3>Key Concerns:</h3><ul>';
            data.analysis.key_concerns.forEach(concern => {
                html += `<li>${concern}</li>`;
            });
            html += '</ul></div>';
        }

        if (data.analysis.recommendation) {
            html += `
                <div class="recommendation">
                    <h3>Recommendation:</h3>
                    <p>${data.analysis.recommendation}</p>
                </div>
            `;
        }

        resultsDiv.innerHTML = html;
    });

    window.api.onInitialSetup(() => {
        const resultsDiv = document.getElementById('results');
        const loadingDiv = document.getElementById('loading');
        
        resultsDiv.style.display = 'none';
        loadingDiv.style.display = 'flex';
        
        // Start with setup messages
        currentText = 0;
        textElement.textContent = setupFlavorTexts[0];
        textInterval = setInterval(() => {
            currentText = (currentText + 1) % setupFlavorTexts.length;
            textElement.textContent = setupFlavorTexts[currentText];
        }, 3000);
    });
    
    window.api.onSetupComplete(() => {
        const resultsDiv = document.getElementById('results');
        const loadingDiv = document.getElementById('loading');
        
        clearInterval(textInterval);
        loadingDiv.style.display = 'none';
        resultsDiv.style.display = 'block';
    });
    
    window.api.onSetupError((error) => {
        const resultsDiv = document.getElementById('results');
        resultsDiv.innerHTML = `
            <div class="error-message">
                <h3>Setup Error</h3>
                <p>Failed to initialize Criticaide: ${error}</p>
                <p>Please try restarting the application. If the problem persists, check the logs.</p>
            </div>
        `;
    });
});