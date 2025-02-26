console.log('Renderer-agents.js loaded!');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM content loaded in renderer-agents.js');
    
    // Store agent results for the final summary
    const agentResults = {
        screener: null,
        orchestrator: null,
        specialists: {},
        summarizer: null
    };

    // Track analysis progress
    const analysisStages = [
        { id: 'screener', name: 'Initial Screening', progress: 0 },
        { id: 'orchestrator', name: 'Analysis Planning', progress: 25 },
        { id: 'specialists', name: 'Specialist Analysis', progress: 50 },
        { id: 'summarizer', name: 'Final Assessment', progress: 90 },
        { id: 'complete', name: 'Complete', progress: 100 }
    ];
    let currentStage = 0;
    
    const headerSubtitle = document.querySelector('.header-subtitle');
    if (headerSubtitle) {
        const isMac = window.api.platform === 'darwin';
        const shortcutText = isMac ? 'Cmd+Option+Shift+T' : 'Ctrl+Alt+Shift+T';
        headerSubtitle.textContent = `Press ${shortcutText} to analyze copied text`;
    }

    // Create unified evolving interface
    const createUnifiedUI = () => {
        const loadingDiv = document.getElementById('loading');
        if (!loadingDiv) {
            console.error('Loading div not found');
            return;
        }
        
        // Clear previous content
        loadingDiv.innerHTML = '';
        
        // Add evolving UI container
        const container = document.createElement('div');
        container.className = 'analysis-container';
        
        // Add progress bar
        const progressContainer = document.createElement('div');
        progressContainer.innerHTML = `
            <div class="progress-bar">
                <div class="progress-indicator" style="width: 0%"></div>
            </div>
            <div class="progress-stages">
                ${analysisStages.map(stage => 
                    `<div class="progress-stage ${stage.id}">${stage.name}</div>`
                ).join('')}
            </div>
        `;
        container.appendChild(progressContainer);
        
        // Add placeholder for final summary
        const summaryPlaceholder = document.createElement('div');
        summaryPlaceholder.className = 'summary-placeholder';
        summaryPlaceholder.innerHTML = `
            <div class="summary-placeholder-title">
                <span class="agent-icon">📊</span>
                <span>Analysis Summary</span>
            </div>
            <div class="summary-placeholder-content">
                Summary will appear here when analysis is complete
            </div>
        `;
        container.appendChild(summaryPlaceholder);
        
        // Add agent modules
        const addAgentModule = (id, name, icon) => {
            const module = document.createElement('div');
            module.className = `agent-module ${id}`;
            module.innerHTML = `
                <div class="agent-module-header" onclick="this.parentElement.classList.toggle('expanded')">
                    <span class="toggle-icon">▶</span>
                    <span class="agent-icon">${icon}</span>
                    <span class="agent-name">${name}</span>
                    <span class="agent-status">Waiting...</span>
                </div>
                <div class="agent-module-content">
                    <!-- Content will be populated dynamically -->
                </div>
            `;
            container.appendChild(module);
            return module;
        };
        
        // Add agent modules
        addAgentModule('screener', 'Initial Screening', '🔍');
        addAgentModule('orchestrator', 'Analysis Planning', '🧠');
        
        // Specialists container
        const specialistsModule = addAgentModule('specialists', 'Specialist Analysis', '👨‍🔬');
        
        // Add summarizer
        addAgentModule('summarizer', 'Final Assessment', '📝');
        
        // Add placeholder for key concerns
        const concernsPlaceholder = document.createElement('div');
        concernsPlaceholder.className = 'summary-placeholder concerns-placeholder';
        concernsPlaceholder.innerHTML = `
            <div class="summary-placeholder-title">
                <span class="agent-icon">⚠️</span>
                <span>Key Concerns</span>
            </div>
            <div class="summary-placeholder-content">
                Key concerns will appear here when analysis is complete
            </div>
        `;
        container.appendChild(concernsPlaceholder);
        
        // Add scroll indicator
        const scrollIndicator = document.createElement('div');
        scrollIndicator.className = 'scroll-indicator';
        scrollIndicator.innerHTML = '↓ Scroll for more ↓';
        container.appendChild(scrollIndicator);
        
        loadingDiv.appendChild(container);
    };

    // Create the unified evolving UI
    createUnifiedUI();

    // Specialist agent details
    const specialistDetails = {
        cognitive_bias: { icon: '🧠', name: 'Cognitive Bias' },
        emotional_manipulation: { icon: '😢', name: 'Emotional Manipulation' },
        logical_fallacy: { icon: '⚖️', name: 'Logical Fallacy' },
        source_credibility: { icon: '📚', name: 'Source Credibility' },
        technical_accuracy: { icon: '🔬', name: 'Technical Accuracy' }
    };
    
    // Update progress indicator
    const updateProgress = (stage) => {
        const currentStageInfo = analysisStages.find(s => s.id === stage) || analysisStages[0];
        
        // Update progress bar
        const progressBar = document.querySelector('.progress-indicator');
        if (progressBar) {
            progressBar.style.width = `${currentStageInfo.progress}%`;
        }
        
        // Update stage indicators
        document.querySelectorAll('.progress-stage').forEach(el => {
            el.classList.remove('active', 'completed');
        });
        
        // Mark current and completed stages
        let foundCurrent = false;
        analysisStages.forEach(stageInfo => {
            const stageEl = document.querySelector(`.progress-stage.${stageInfo.id}`);
            if (stageEl) {
                if (stageInfo.id === currentStageInfo.id) {
                    stageEl.classList.add('active');
                    foundCurrent = true;
                } else if (!foundCurrent) {
                    stageEl.classList.add('completed');
                }
            }
        });
    };

    // Handle agent progress updates
    if (window.api && window.api.onAgentProgress) {
        window.api.onAgentProgress((update) => {
            console.log('Agent progress update:', update);
            const { stage, status, result } = update;
            
            // Update progress indicator
            updateProgress(stage);
            
            // Store the result for final summary
            if (status === 'complete' && result) {
                if (stage === 'screener' || stage === 'orchestrator' || stage === 'summarizer') {
                    agentResults[stage] = result;
                } else if (Object.keys(specialistDetails).includes(stage)) {
                    agentResults.specialists[stage] = result;
                }
            }
            
            // Update the specific agent module
            updateAgentModule(stage, status, result);
            
            // Handle the final analysis when summarizer is complete
            if (stage === 'summarizer' && status === 'complete') {
                updateSummary(result);
                updateProgress('complete');
            }
        });
    }

    // Update a specific agent module
    function updateAgentModule(stage, status, result) {
        // Find the module
        let moduleElement;
        if (Object.keys(specialistDetails).includes(stage)) {
            // For specialists, check if module exists or create it
            moduleElement = document.querySelector(`.specialist-module.${stage}`);
            if (!moduleElement && status === 'starting') {
                createSpecialistModule(stage);
                moduleElement = document.querySelector(`.specialist-module.${stage}`);
            }
        } else {
            moduleElement = document.querySelector(`.agent-module.${stage}`);
        }
        
        if (!moduleElement) {
            console.error(`Module element for ${stage} not found`);
            return;
        }
        
        // Update module status
        const statusElement = moduleElement.querySelector('.agent-status');
        if (statusElement) {
            if (status === 'starting') {
                statusElement.textContent = 'Working...';
                statusElement.className = 'agent-status working';
                moduleElement.classList.add('active');
                moduleElement.classList.add('expanded');
                
                // Ensure module is visible by scrolling to it
                moduleElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (status === 'complete') {
                statusElement.textContent = 'Complete';
                statusElement.className = 'agent-status complete';
                moduleElement.classList.remove('active');
                moduleElement.classList.add('completed');
                
                // Add findings to module content
                if (result) {
                    populateModuleContent(stage, moduleElement, result);
                }
            } else if (status === 'error') {
                statusElement.textContent = 'Error';
                statusElement.className = 'agent-status error';
                moduleElement.classList.remove('active');
                moduleElement.classList.add('error');
            }
        }
        
        // Special handling for orchestrator - create specialist modules
        if (stage === 'orchestrator' && status === 'complete' && result?.selected_specialists) {
            // Create specialist modules
            const specialistsContainer = document.querySelector('.agent-module.specialists .agent-module-content');
            if (specialistsContainer) {
                specialistsContainer.innerHTML = `
                    <div class="agent-module-findings">
                        <h4>Selected Specialists</h4>
                        <ul>
                            ${result.selected_specialists.map(spec => {
                                const details = specialistDetails[spec] || { icon: '🔍', name: spec };
                                return `<li>${details.icon} ${details.name}</li>`;
                            }).join('')}
                        </ul>
                    </div>
                `;
                
                // Create modules for each specialist
                result.selected_specialists.forEach(specialist => {
                    createSpecialistModule(specialist);
                });
            }
        }
    }
    
    // Create a specialist module
    function createSpecialistModule(specialist) {
        const details = specialistDetails[specialist] || { icon: '🔍', name: specialist };
        const specialistsContainer = document.querySelector('.agent-module.specialists .agent-module-content');
        
        if (specialistsContainer) {
            const specialistModule = document.createElement('div');
            specialistModule.className = `specialist-module agent-module ${specialist}`;
            specialistModule.innerHTML = `
                <div class="agent-module-header" onclick="this.parentElement.classList.toggle('expanded')">
                    <span class="toggle-icon">▶</span>
                    <span class="agent-icon">${details.icon}</span>
                    <span class="agent-name">${details.name}</span>
                    <span class="agent-status">Waiting...</span>
                </div>
                <div class="agent-module-content">
                    <!-- Content will be populated dynamically -->
                </div>
            `;
            specialistsContainer.appendChild(specialistModule);
        }
    }
    
    // Populate a module's content with findings
    function populateModuleContent(stage, moduleElement, result) {
        const contentElement = moduleElement.querySelector('.agent-module-content');
        if (!contentElement) return;
        
        let content = '';
        
        if (stage === 'screener') {
            content = `
                <div class="agent-module-findings">
                    <h4>Initial Assessment</h4>
                    <p>Credibility Score: <strong>${result.initial_score}/10</strong></p>
                    <p>${result.needsDeepAnalysis ? 'Content requires deeper analysis' : 'No significant issues detected'}</p>
                    <p>${result.reasoning}</p>
                </div>
            `;
        } else if (stage === 'orchestrator') {
            // Content already added in updateAgentModule
            return;
        } else if (stage === 'summarizer') {
            content = `
                <div class="agent-module-findings">
                    <h4>Final Assessment</h4>
                    <p>Credibility Score: <strong>${result.credibility_score}/10</strong></p>
                    <p>Found ${result.potential_issues.length} potential issue${result.potential_issues.length !== 1 ? 's' : ''}</p>
                    <p>${result.recommendation.substring(0, 150)}...</p>
                </div>
            `;
        } else if (Object.keys(specialistDetails).includes(stage)) {
            // Get the issues array based on specialist type
            let issues = [];
            if (stage === 'cognitive_bias' && result.biases_identified) {
                issues = result.biases_identified;
            } else if (stage === 'emotional_manipulation' && result.manipulation_tactics) {
                issues = result.manipulation_tactics;
            } else if (stage === 'logical_fallacy' && result.fallacies_identified) {
                issues = result.fallacies_identified;
            } else if (stage === 'source_credibility' && result.credibility_issues) {
                issues = result.credibility_issues;
            } else if (stage === 'technical_accuracy' && result.accuracy_issues) {
                issues = result.accuracy_issues;
            }
            
            const details = specialistDetails[stage];
            
            content = `
                <div class="agent-module-findings">
                    <h4>${details.icon} ${details.name} Findings</h4>
                    ${result.overall_assessment ? `<p>${result.overall_assessment}</p>` : ''}
                    ${issues.length > 0 ? `
                        <p>Identified ${issues.length} issue${issues.length !== 1 ? 's' : ''}:</p>
                        <ul>
                            ${issues.map(issue => {
                                const issueType = issue.bias_type || issue.tactic_type || 
                                                issue.fallacy_type || issue.issue_type || 
                                                issue.type;
                                return `
                                    <li>
                                        <strong>${issueType}</strong> (${issue.severity})
                                        <p>${issue.explanation}</p>
                                    </li>
                                `;
                            }).join('')}
                        </ul>
                    ` : '<p>No significant issues found</p>'}
                </div>
            `;
        }
        
        contentElement.innerHTML = content;
    }
    
    // Update the summary section
    function updateSummary(result) {
        // Update the summary placeholder
        const summaryPlaceholder = document.querySelector('.summary-placeholder');
        if (summaryPlaceholder) {
            summaryPlaceholder.classList.add('active');
            summaryPlaceholder.innerHTML = `
                <div class="summary-placeholder-title">
                    <span class="agent-icon">📊</span>
                    <span>Analysis Summary</span>
                </div>
                <div class="score-circle">${result.credibility_score}</div>
                <p style="text-align: center; margin-bottom: 1rem;">Credibility Score out of 10</p>
                <p>${result.recommendation}</p>
            `;
        }
        
        // Update key concerns
        const concernsPlaceholder = document.querySelector('.concerns-placeholder');
        if (concernsPlaceholder && result.key_concerns && result.key_concerns.length > 0) {
            concernsPlaceholder.classList.add('active');
            concernsPlaceholder.innerHTML = `
                <div class="summary-placeholder-title">
                    <span class="agent-icon">⚠️</span>
                    <span>Key Concerns</span>
                </div>
                <ul>
                    ${result.key_concerns.map(concern => `<li>${concern}</li>`).join('')}
                </ul>
            `;
        }
        
        // Hide the scroll indicator when done
        const scrollIndicator = document.querySelector('.scroll-indicator');
        if (scrollIndicator) {
            scrollIndicator.style.display = 'none';
        }
    }

    // Handle analysis complete
    if (window.api && window.api.receiveAnalysis) {
        window.api.receiveAnalysis((data) => {
            console.log('Analysis result received:', data);
            const loadingDiv = document.getElementById('loading');
            const resultsDiv = document.getElementById('results');
            
            if (!loadingDiv || !resultsDiv) {
                console.error('Results or loading div not found');
                return;
            }
            
            // Handle token limit exceeded error
            if (data.error === 'TOKEN_LIMIT_EXCEEDED') {
                loadingDiv.style.display = 'none';
                resultsDiv.style.display = 'block';
                resultsDiv.innerHTML = `
                    <div class="error-message">
                        <h3>Text Too Long</h3>
                        <p>${data.message}</p>
                        <p>Please try again with a shorter text.</p>
                    </div>
                `;
                return;
            }
            
            // In our new approach, loading div continues to show the evolving results
            // We don't switch to a separate results view
        });
    }
    
    // Handle initial setup events
    if (window.api && window.api.onInitialSetup) {
        window.api.onInitialSetup(() => {
            console.log('Initial setup event received');
            const resultsDiv = document.getElementById('results');
            const loadingDiv = document.getElementById('loading');
            
            if (resultsDiv && loadingDiv) {
                resultsDiv.style.display = 'none';
                loadingDiv.style.display = 'flex';
                
                // Reset UI
                createUnifiedUI();
            }
        });
    }
    
    if (window.api && window.api.onServerReady) {
        window.api.onServerReady(() => {
            console.log('Server ready event received');
            // Reset UI when server is ready
            createUnifiedUI();
        });
    }
    
    if (window.api && window.api.onServerError) {
        window.api.onServerError((error) => {
            console.log('Server error event received:', error);
            const resultsDiv = document.getElementById('results');
            
            if (resultsDiv) {
                resultsDiv.innerHTML = `
                    <div class="error-message">
                        <h3>Server Error</h3>
                        <p>Failed to start llama.cpp server: ${error}</p>
                        <p>Please try restarting the application. If the problem persists, check the logs.</p>
                    </div>
                `;
            }
        });
    }
});