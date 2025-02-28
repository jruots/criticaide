console.log('Simplified renderer-agents.js loaded!');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded in simplified-renderer-agents.js');

    // Update the shortcut text in the header based on platform
    const headerSubtitle = document.querySelector('.header-subtitle');
    const isMac = window.api.platform === 'darwin';
    const shortcutText = isMac ? 'Cmd+Option+Shift+T' : 'Ctrl+Alt+Shift+T';
    headerSubtitle.textContent = `Press ${shortcutText} to analyze copied text`;
    
    // Configuration
    const specialistTypes = {
        cognitive_bias: { icon: '🧠', name: 'Cognitive Bias Analysis' },
        emotional_manipulation: { icon: '😢', name: 'Emotional Manipulation Analysis' },
        logical_fallacy: { icon: '⚖️', name: 'Logical Fallacy Analysis' },
        source_credibility: { icon: '📚', name: 'Source Credibility Analysis' },
        technical_accuracy: { icon: '🔬', name: 'Technical Accuracy Analysis' }
    };
    
    // Analysis stages for progress tracking
    const analysisStages = [
        { id: 'screener', name: 'Initial Screening', progress: 0 },
        { id: 'orchestrator', name: 'Analysis Planning', progress: 25 },
        { id: 'specialists', name: 'Specialist Analysis', progress: 50 },
        { id: 'summarizer', name: 'Final Assessment', progress: 90 },
        { id: 'complete', name: 'Complete', progress: 100 }
    ];
    
    // Store results for reference
    const analysisResults = {
        screener: null,
        orchestrator: null,
        specialists: {},
        summarizer: null,
        activeSpecialists: []
    };
        
    // Set keyboard shortcut text based on platform
    function updateShortcutText() {
        const shortcutElements = document.querySelectorAll('.keyboard-shortcut-text');
        const isMac = window.api.platform === 'darwin';
        const shortcutText = isMac ? 'Cmd+Option+Shift+T' : 'Ctrl+Alt+Shift+T';
        
        shortcutElements.forEach(el => {
            el.textContent = shortcutText;
        });
    }
    
    // Create empty state UI
    function createEmptyState() {
        const loadingDiv = document.getElementById('loading');
        if (!loadingDiv) return;
        
        // Determine platform-specific shortcuts
        const isMac = window.api.platform === 'darwin';
        const copyShortcut = isMac ? 'Cmd+C' : 'Ctrl+C';
        const analyzeShortcut = isMac ? 'Cmd+Option+Shift+T' : 'Ctrl+Alt+Shift+T';
        
        // Use the actual app icon
        const iconHtml = `<img src="../resources/icons/icon.png" alt="Criticaide Logo" class="criticaide-logo">`;
        
        loadingDiv.innerHTML = `
            <div class="empty-state">
                <div class="logo-container">
                    ${iconHtml}
                </div>
                <h2 class="empty-state-title"><span class="criticaide-title">Criticaide</span></h2>
                <p class="empty-state-subtitle">
                    Select any text you want to analyze, copy it with 
                    <span class="keyboard-shortcut">${copyShortcut}</span>, 
                    then press 
                    <span class="keyboard-shortcut">${analyzeShortcut}</span> 
                    to analyze for credibility.
                </p>
                <p class="empty-state-subtitle tagline">
                    Your first line of defense in an era of digital manipulation.
                </p>
            </div>
        `;
    }
        
    // Create analysis UI with fixed header approach
    function createAnalysisUI() {
        const loadingDiv = document.getElementById('loading');
        if (!loadingDiv) return;
        
        // Clear previous content
        loadingDiv.innerHTML = '';
        
        // Create app container with fixed header and scrollable content
        const appContainer = document.createElement('div');
        appContainer.className = 'app-container';
        
        // Create fixed header for progress bar
        const fixedHeader = document.createElement('div');
        fixedHeader.className = 'fixed-header';
        
        // Create progress bar inside fixed header
        const progressBarContainer = document.createElement('div');
        progressBarContainer.className = 'progress-bar-container';
        progressBarContainer.innerHTML = `
            <div class="progress-bar">
                <div class="progress-indicator" style="width: 0%"></div>
            </div>
            <div class="progress-label">
                <span>Analysis in progress...</span>
                <span>0%</span>
            </div>
        `;
        fixedHeader.appendChild(progressBarContainer);
        
        // Create scrollable content area
        const scrollableContent = document.createElement('div');
        scrollableContent.className = 'scrollable-content';
        
        // Create analysis container inside scrollable area
        const container = document.createElement('div');
        container.className = 'analysis-container';
        
        // Add results container that will be populated dynamically
        const resultsContainer = document.createElement('div');
        resultsContainer.id = 'results-container';
        container.appendChild(resultsContainer);
        
        // Add loading indicator
        const loadingIndicator = document.createElement('div');
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = `
            <div class="spinner"></div>
            <div class="loading-text">Analyzing content...</div>
        `;
        container.appendChild(loadingIndicator);
        
        // Add container to scrollable content
        scrollableContent.appendChild(container);
        
        // Add both areas to the app container
        appContainer.appendChild(fixedHeader);
        appContainer.appendChild(scrollableContent);
        
        // Add app container to loading div
        loadingDiv.appendChild(appContainer);
        
        // Force scrollable content to start at the top
        setTimeout(() => {
            scrollableContent.scrollTop = 0;
            console.log('Scroll reset to top');
        }, 50);
        
        return { 
            resultsContainer, 
            loadingIndicator, 
            progressBarContainer,
            scrollableContent 
        };
    }
    
    // Helper function to sanitize text
    function sanitizeText(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // Update progress bar
    function updateProgress(stage, percentage = null) {
        const stageInfo = analysisStages.find(s => s.id === stage);
        if (!stageInfo) return;
        
        const progress = percentage !== null ? percentage : stageInfo.progress;
        
        const progressBar = document.querySelector('.progress-indicator');
        const progressLabel = document.querySelector('.progress-label span:last-child');
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (progressLabel) {
            progressLabel.textContent = `${Math.round(progress)}%`;
        }
        
        // Update stage label
        const stageLabel = document.querySelector('.progress-label span:first-child');
        if (stageLabel) {
            stageLabel.textContent = `Stage: ${stageInfo.name}`;
        }
    }
    
    // Create a result card
    function createResultCard(id, title, icon, status = 'in-progress') {
        const card = document.createElement('div');
        card.className = 'result-card';
        card.dataset.cardId = id;
        
        let statusText, statusClass;
        switch (status) {
            case 'in-progress':
                statusText = 'Analyzing...';
                statusClass = 'status-in-progress';
                break;
            case 'complete':
                statusText = 'Complete';
                statusClass = 'status-complete';
                break;
            case 'warning':
                statusText = 'Warning';
                statusClass = 'status-warning';
                break;
            case 'error':
                statusText = 'Error';
                statusClass = 'status-error';
                break;
            default:
                statusText = status;
                statusClass = '';
        }
        
        card.innerHTML = `
            <div class="result-card-header">
                <span class="card-icon">${icon}</span>
                <span class="card-title">${title}</span>
                <span class="card-status ${statusClass}">${statusText}</span>
            </div>
            <div class="result-card-content">
                <!-- Content will be populated dynamically -->
                <div class="card-loading">Analyzing content...</div>
            </div>
        `;
        
        return card;
    }
    
    // Create expandable card
    function createExpandableCard(id, title, icon, content, isExpanded = false) {
        const card = document.createElement('div');
        card.className = `result-card expandable ${isExpanded ? 'expanded' : ''}`;
        card.dataset.cardId = id;
        
        card.innerHTML = `
            <div class="result-card-header expandable-header" tabindex="0" role="button" aria-expanded="${isExpanded ? 'true' : 'false'}">
                <span class="card-icon">${icon}</span>
                <span class="card-title">${title}</span>
                <span class="expand-icon">▼</span>
            </div>
            <div class="expandable-content">
                <div class="result-card-content">
                    ${content}
                </div>
            </div>
        `;
        
        // Add event listener for expansion toggle
        const header = card.querySelector('.expandable-header');
        header.addEventListener('click', () => toggleCardExpansion(card));
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleCardExpansion(card);
            }
        });
        
        // If card should start expanded, set the appropriate height
        if (isExpanded) {
            setTimeout(() => {
                const content = card.querySelector('.expandable-content');
                content.style.maxHeight = content.scrollHeight + 'px';
            }, 0);
        }
        
        return card;
    }
    
    // Toggle card expansion
    function toggleCardExpansion(card) {
        const isExpanded = card.classList.contains('expanded');
        const header = card.querySelector('.expandable-header');
        const content = card.querySelector('.expandable-content');
        
        if (isExpanded) {
            // Collapse
            card.classList.remove('expanded');
            header.setAttribute('aria-expanded', 'false');
            content.style.maxHeight = '0px';
        } else {
            // Expand
            card.classList.add('expanded');
            header.setAttribute('aria-expanded', 'true');
            content.style.maxHeight = content.scrollHeight + 'px';
        }
    }
    
    // Update existing card content
    function updateCardContent(cardId, contentHtml, status = null) {
        const card = document.querySelector(`.result-card[data-card-id="${cardId}"]`);
        if (!card) return;
        
        // Update content
        const contentContainer = card.querySelector('.result-card-content');
        if (contentContainer) {
            contentContainer.innerHTML = contentHtml;
        }
        
        // Update status if provided
        if (status) {
            const statusEl = card.querySelector('.card-status');
            if (statusEl) {
                // Remove old status classes
                statusEl.classList.remove('status-in-progress', 'status-complete', 'status-warning', 'status-error');
                
                // Set new status
                switch (status) {
                    case 'in-progress':
                        statusEl.textContent = 'Analyzing...';
                        statusEl.classList.add('status-in-progress');
                        break;
                    case 'complete':
                        statusEl.textContent = 'Complete';
                        statusEl.classList.add('status-complete');
                        break;
                    case 'warning':
                        statusEl.textContent = 'Warning';
                        statusEl.classList.add('status-warning');
                        break;
                    case 'error':
                        statusEl.textContent = 'Error';
                        statusEl.classList.add('status-error');
                        break;
                }
            }
        }
        
        // If card is expandable and expanded, update the max height
        if (card.classList.contains('expandable') && card.classList.contains('expanded')) {
            const expandableContent = card.querySelector('.expandable-content');
            if (expandableContent) {
                expandableContent.style.maxHeight = expandableContent.scrollHeight + 'px';
            }
        }
    }
    
    // Create initial screening card
    function createInitialScreeningCard(result) {
        const needsAnalysis = result.needsDeepAnalysis;
        
        let content = `
            <p>${sanitizeText(result.reasoning || 'Initial analysis complete.')}</p>
        `;
        
        if (needsAnalysis) {
            content += `
                <div class="recommendation">
                    This content requires deeper analysis. The specialists will examine specific aspects of the text.
                </div>
            `;
        } else {
            content += `
                <div class="recommendation">
                    Initial analysis indicates this content is likely reliable. 
                    No significant issues were detected that would require deeper analysis.
                </div>
            `;
        }
        
        return content;
    }
    
    // Create specialist card content
    function createSpecialistContent(specialistType, result) {
        if (!result) {
            return '<p>Analysis in progress...</p>';
        }
        
        let issues = [];
        let overallAssessment = '';
        
        // Extract issues based on specialist type
        if (specialistType === 'cognitive_bias' && result.biases_identified) {
            issues = result.biases_identified;
            overallAssessment = result.overall_assessment;
        } else if (specialistType === 'emotional_manipulation' && result.manipulation_tactics) {
            issues = result.manipulation_tactics;
            overallAssessment = result.overall_assessment;
        } else if (specialistType === 'logical_fallacy' && result.fallacies_identified) {
            issues = result.fallacies_identified;
            overallAssessment = result.overall_assessment;
        } else if (specialistType === 'source_credibility' && result.credibility_issues) {
            issues = result.credibility_issues;
            overallAssessment = result.overall_assessment;
        } else if (specialistType === 'technical_accuracy' && result.accuracy_issues) {
            issues = result.accuracy_issues;
            overallAssessment = result.overall_assessment;
        }
        
        // If no recognized field is found, try to find any array that might contain issues
        if (!issues || issues.length === 0) {
            for (const key in result) {
                if (Array.isArray(result[key]) && 
                    result[key].length > 0 && 
                    result[key][0] && 
                    (result[key][0].type || result[key][0].severity)) {
                    issues = result[key];
                    break;
                }
            }
        }
        
        // Look for any field that might contain an assessment
        if (!overallAssessment) {
            for (const key of ['assessment', 'summary', 'conclusion', 'overview']) {
                if (typeof result[key] === 'string' && result[key].length > 0) {
                    overallAssessment = result[key];
                    break;
                }
            }
        }
        
        // Generate content
        let content = '';
        
        if (overallAssessment) {
            content += `<p>${sanitizeText(overallAssessment)}</p>`;
        }
        
        if (issues && issues.length > 0) {
            content += `
                <h3>Identified Issues</h3>
                <ul class="issue-list">
            `;
            
            issues.forEach(issue => {
                if (!issue) return;
                
                const issueType = issue.bias_type || issue.tactic_type || 
                                issue.fallacy_type || issue.issue_type || 
                                issue.type || 'Issue';
                                
                const severity = issue.severity || 'medium';
                
                content += `
                    <li class="issue-item">
                        <div class="issue-header">
                            <span class="issue-type">${sanitizeText(issueType)}</span>
                            <span class="issue-severity severity-${severity}">${severity}</span>
                        </div>
                        <p class="issue-explanation">${sanitizeText(issue.explanation || 'No explanation provided')}</p>
                    </li>
                `;
            });
            
            content += '</ul>';
        } else {
            content += '<p>No significant issues found.</p>';
        }
        
        return content;
    }
    
    // Create final assessment card
    function createFinalAssessmentCard(result) {
        const score = result.credibility_score || 0;
        let scoreClass = 'score-medium';
        
        if (score >= 7) {
            scoreClass = 'score-high';
        } else if (score <= 4) {
            scoreClass = 'score-low';
        }
        
        let content = `
            <div class="score-display">
                <div class="score-circle ${scoreClass}">${score}</div>
                <div class="score-details">
                    <div class="score-label">Credibility Score (0-10)</div>
                    <h3>Final Assessment</h3>
                </div>
            </div>
        `;
        
        if (result.recommendation) {
            content += `
                <div class="recommendation">
                    ${sanitizeText(result.recommendation)}
                </div>
            `;
        }
        
        if (result.key_concerns && result.key_concerns.length > 0) {
            content += `
                <div class="key-concerns">
                    <h3>Key Concerns</h3>
                    <ul class="key-concerns-list">
                        ${result.key_concerns.map(concern => 
                            `<li class="key-concerns-item">${sanitizeText(concern)}</li>`
                        ).join('')}
                    </ul>
                </div>
            `;
        }
        
        if (result.potential_issues && result.potential_issues.length > 0) {
            content += `
                <h3>Potential Issues</h3>
                <ul class="issue-list">
                    ${result.potential_issues.map(issue => `
                        <li class="issue-item">
                            <div class="issue-header">
                                <span class="issue-type">${sanitizeText(issue.type)}</span>
                                <span class="issue-severity severity-${issue.severity}">${issue.severity}</span>
                            </div>
                            <p class="issue-explanation">${sanitizeText(issue.explanation)}</p>
                        </li>
                    `).join('')}
                </ul>
            `;
        }
        
        return content;
    }
    
    // Handle analysis start
    function handleAnalysisStart() {
        const ui = createAnalysisUI();
        
        // Reset stored results
        Object.keys(analysisResults).forEach(key => {
            if (key === 'specialists') {
                analysisResults[key] = {};
            } else if (key === 'activeSpecialists') {
                analysisResults[key] = [];
            } else {
                analysisResults[key] = null;
            }
        });
        
        // Set initial progress
        updateProgress('screener');
        
        return ui;
    }
    
    // Handle agent progress updates
    function handleAgentProgress(update, ui) {
        console.log('Agent progress update:', update);
        const { stage, status, result } = update;
        
        // Store result
        if (status === 'complete' && result) {
            if (stage === 'screener' || stage === 'orchestrator' || stage === 'summarizer') {
                analysisResults[stage] = result;
            } else if (Object.keys(specialistTypes).includes(stage)) {
                analysisResults.specialists[stage] = result;
                
                // If this specialist wasn't already in the active list, add it
                if (!analysisResults.activeSpecialists.includes(stage)) {
                    analysisResults.activeSpecialists.push(stage);
                }
            }
        }
        
        // Update UI based on stage
        if (stage === 'screener') {
            handleScreenerUpdate(status, result, ui);
        } else if (stage === 'orchestrator') {
            handleOrchestratorUpdate(status, result, ui);
        } else if (Object.keys(specialistTypes).includes(stage)) {
            handleSpecialistUpdate(stage, status, result, ui);
        } else if (stage === 'summarizer') {
            handleSummarizerUpdate(status, result, ui);
        }
        
        // Update progress
        const stageInfo = analysisStages.find(s => s.id === stage);
        if (stageInfo) {
            updateProgress(stage);
        }
        
        // If analysis is complete, remove loading indicator
        if (stage === 'summarizer' && status === 'complete') {
            if (ui.loadingIndicator) {
                ui.loadingIndicator.style.display = 'none';
                updateProgress('complete');
            }
        }
    }

    // Handle screener update
    function handleScreenerUpdate(status, result, ui) {
        const { resultsContainer } = ui;
        
        // Create initial card if it doesn't exist
        let initialCard = document.querySelector('.result-card[data-card-id="screener"]');
        
        if (!initialCard && status === 'starting') {
            initialCard = createResultCard('screener', 'Initial Assessment', '🔍', 'in-progress');
            if (resultsContainer) {
                resultsContainer.appendChild(initialCard);
            }
        }
        
        // Update card content when complete
        if (status === 'complete' && result) {
            if (initialCard) {
                const content = createInitialScreeningCard(result);
                updateCardContent('screener', content, 'complete');
            }
        }
    }

    // Handle orchestrator update
    function handleOrchestratorUpdate(status, result, ui) {
        // We don't need to show the orchestrator card to users
        // Just use the results to prepare for specialists
        
        if (status === 'complete' && result && result.selected_specialists) {
            // Store the list of expected specialists
            analysisResults.activeSpecialists = result.selected_specialists;
            
            // Explicitly update to specialists stage
            updateProgress('specialists');
            
            // Add a small delay before updating the stage text to ensure the UI updates
            setTimeout(() => {
                const stageLabel = document.querySelector('.progress-label span:first-child');
                if (stageLabel) {
                    stageLabel.textContent = 'Stage: Specialist Analysis';
                }
            }, 100);
        }
    }

    // Handle specialist update
    function handleSpecialistUpdate(specialistType, status, result, ui) {
        const { resultsContainer } = ui;
        const specialistInfo = specialistTypes[specialistType] || { 
            icon: '🔍', 
            name: specialistType.charAt(0).toUpperCase() + specialistType.slice(1).replace(/_/g, ' ') 
        };
        
        // Create specialist card if it doesn't exist
        let specialistCard = document.querySelector(`.result-card[data-card-id="${specialistType}"]`);
        
        if (!specialistCard && status === 'starting') {
            // Create an expandable card that starts collapsed
            const initialContent = '<p>Analysis in progress...</p>';
            specialistCard = createExpandableCard(
                specialistType, 
                specialistInfo.name, 
                specialistInfo.icon, 
                initialContent,
                false // Start collapsed
            );
            
            if (resultsContainer) {
                resultsContainer.appendChild(specialistCard);
            }
        }
        
        // Update card content when complete
        if (status === 'complete' && result) {
            if (specialistCard) {
                const content = createSpecialistContent(specialistType, result);
                updateCardContent(specialistType, content, 'complete');
            }
        }
        
        // Check if all specialists are complete
        if (status === 'complete') {
            const allSpecialistsComplete = analysisResults.activeSpecialists.every(
                specialist => analysisResults.specialists[specialist]
            );
            
            if (allSpecialistsComplete && analysisResults.activeSpecialists.length > 0) {
                // Update progress to summarizer when all specialists are done
                updateProgress('summarizer');
            }
        }
    }

    // Handle summarizer update
    function handleSummarizerUpdate(status, result, ui) {
        const { resultsContainer } = ui;
        
        // Create summarizer card if it doesn't exist
        let summaryCard = document.querySelector('.result-card[data-card-id="summary"]');
        
        if (!summaryCard && status === 'starting') {
            summaryCard = createResultCard('summary', 'Final Assessment', '📊', 'in-progress');
            if (resultsContainer) {
                resultsContainer.appendChild(summaryCard);
                // No auto-scrolling - user controls their view
            }
        }
        
        // Update card content when complete
        if (status === 'complete' && result) {
            if (summaryCard) {
                const content = createFinalAssessmentCard(result);
                updateCardContent('summary', content, 'complete');
                // No auto-scrolling - user stays where they are reading
            }
        }
    }

    // Create empty state at startup
    createEmptyState();

    // Set up event handlers
    if (window.api) {
        // Handle analysis start
        if (window.api.onAnalysisStart) {
            window.api.onAnalysisStart(() => {
                console.log('Analysis started');
                const ui = handleAnalysisStart();
                
                // Store UI references in window for access by other handlers
                window.currentUI = ui;
            });
        }
        
        // Handle agent progress
        if (window.api.onAgentProgress) {
            window.api.onAgentProgress((update) => {
                if (window.currentUI) {
                    handleAgentProgress(update, window.currentUI);
                }
            });
        }
        
        // Handle receiving analysis results
        if (window.api.receiveAnalysis) {
            window.api.receiveAnalysis((data) => {
                console.log('Analysis result received:', data);
                
                // If token limit exceeded, show error
                if (data.error === 'TOKEN_LIMIT_EXCEEDED') {
                    const loadingDiv = document.getElementById('loading');
                    if (loadingDiv) {
                        loadingDiv.innerHTML = `
                            <div class="app-container">
                                <div class="fixed-header">
                                    <div class="progress-bar-container">
                                        <div class="progress-bar">
                                            <div class="progress-indicator" style="width: 100%"></div>
                                        </div>
                                        <div class="progress-label">
                                            <span>Error</span>
                                            <span>100%</span>
                                        </div>
                                    </div>
                                </div>
                                <div class="scrollable-content">
                                    <div class="analysis-container">
                                        <div class="result-card">
                                            <div class="result-card-header">
                                                <span class="card-icon">⚠️</span>
                                                <span class="card-title">Error</span>
                                                <span class="card-status status-error">Error</span>
                                            </div>
                                            <div class="result-card-content">
                                                <h3>Text Too Long</h3>
                                                <p>${sanitizeText(data.message)}</p>
                                                <p>Please try again with a shorter text selection.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `;
                    }
                }
            });
        }
        
        // Handle server events
        if (window.api.onServerStarting) {
            window.api.onServerStarting(() => {
                console.log('Server starting');
                // Show loading state
                const loadingDiv = document.getElementById('loading');
                if (loadingDiv) {
                    loadingDiv.innerHTML = `
                        <div class="loading-indicator" style="height: 80vh; display: flex; align-items: center; justify-content: center;">
                            <div class="spinner"></div>
                            <div class="loading-text">Starting analysis engine...</div>
                        </div>
                    `;
                }
            });
        }
        
        if (window.api.onServerReady) {
            window.api.onServerReady(() => {
                console.log('Server ready');
                // Show empty state
                createEmptyState();
            });
        }
        
        if (window.api.onServerError) {
            window.api.onServerError((error) => {
                console.log('Server error:', error);
                // Show error
                const loadingDiv = document.getElementById('loading');
                if (loadingDiv) {
                    loadingDiv.innerHTML = `
                        <div class="app-container">
                            <div class="fixed-header">
                                <div class="progress-bar-container">
                                    <div class="progress-bar">
                                        <div class="progress-indicator" style="width: 100%"></div>
                                    </div>
                                    <div class="progress-label">
                                        <span>Error</span>
                                        <span>100%</span>
                                    </div>
                                </div>
                            </div>
                            <div class="scrollable-content">
                                <div class="analysis-container">
                                    <div class="result-card">
                                        <div class="result-card-header">
                                            <span class="card-icon">⚠️</span>
                                            <span class="card-title">Server Error</span>
                                            <span class="card-status status-error">Error</span>
                                        </div>
                                        <div class="result-card-content">
                                            <h3>Failed to Start Analysis Engine</h3>
                                            <p>${sanitizeText(error)}</p>
                                            <p>Please try restarting the application. If the problem persists, check the logs.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }
            });
        }
    }
});