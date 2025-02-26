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
    
    const headerSubtitle = document.querySelector('.header-subtitle');
    if (headerSubtitle) {
        const isMac = window.api.platform === 'darwin';
        const shortcutText = isMac ? 'Cmd+Option+Shift+T' : 'Ctrl+Alt+Shift+T';
        headerSubtitle.textContent = `Press ${shortcutText} to analyze copied text`;
    }

    // Create agent-based UI elements
    const createAgentUI = () => {
        const loadingDiv = document.getElementById('loading');
        if (!loadingDiv) {
            console.error('Loading div not found');
            return;
        }
        
        loadingDiv.innerHTML = `
            <div class="loading-content">
                <h1 class="text-4xl font-bold text-sky-500">
                    Criticaide
                </h1>
                <div class="agent-progress">
                    <div class="agent-step screener">
                        <div class="agent-icon">🔍</div>
                        <div class="agent-name">Screener</div>
                        <div class="agent-status">Waiting...</div>
                    </div>
                    <div class="agent-preview screener-preview"></div>
                    
                    <div class="agent-step orchestrator">
                        <div class="agent-icon">🧠</div>
                        <div class="agent-name">Orchestrator</div>
                        <div class="agent-status">Waiting...</div>
                    </div>
                    <div class="agent-preview orchestrator-preview"></div>
                    
                    <div class="agent-step specialists">
                        <div class="specialists-header">
                            <div class="agent-icon">👨‍🔬</div>
                            <div class="agent-name">Specialists</div>
                            <div class="agent-status">Waiting...</div>
                        </div>
                        <div class="specialist-list"></div>
                    </div>
                    
                    <div class="agent-step summarizer">
                        <div class="agent-icon">📝</div>
                        <div class="agent-name">Summarizer</div>
                        <div class="agent-status">Waiting...</div>
                    </div>
                    <div class="agent-preview summarizer-preview"></div>
                </div>
                <p class="initial-findings"></p>
            </div>
        `;
    };

    // Create the agent UI
    createAgentUI();

    // Specialist agent details
    const specialistDetails = {
        cognitive_bias: { icon: '🧠', name: 'Cognitive Bias' },
        emotional_manipulation: { icon: '😢', name: 'Emotional Manipulation' },
        logical_fallacy: { icon: '⚖️', name: 'Logical Fallacy' },
        source_credibility: { icon: '📚', name: 'Source Credibility' },
        technical_accuracy: { icon: '🔬', name: 'Technical Accuracy' }
    };

    // Handle agent progress updates
    if (window.api && window.api.onAgentProgress) {
        window.api.onAgentProgress((update) => {
            console.log('Agent progress update:', update);
            const { stage, status, result } = update;
            
            // Store the result for final summary
            if (status === 'complete' && result) {
                if (stage === 'screener' || stage === 'orchestrator' || stage === 'summarizer') {
                    agentResults[stage] = result;
                } else if (Object.keys(specialistDetails).includes(stage)) {
                    agentResults.specialists[stage] = result;
                }
            }
            
            // Update UI based on stage and status
            updateAgentUI(stage, status, result);
            
            // If we have initial findings from the screener, display them
            if (stage === 'screener' && status === 'complete' && result) {
                const initialFindingsElement = document.querySelector('.initial-findings');
                if (initialFindingsElement) {
                    initialFindingsElement.textContent = `Initial assessment: ${result.reasoning}`;
                    initialFindingsElement.style.display = 'block';
                    
                    // Show preview of screener results
                    const previewElement = document.querySelector('.screener-preview');
                    if (previewElement) {
                        previewElement.innerHTML = `
                            <h4>Initial Screening</h4>
                            <p>Credibility Score: <strong>${result.initial_score}/10</strong></p>
                            <p>${result.needsDeepAnalysis ? 'Needs deeper analysis' : 'No significant issues detected'}</p>
                        `;
                        previewElement.style.display = 'block';
                    }
                }
            }
            
            // Show preview of orchestrator results
            if (stage === 'orchestrator' && status === 'complete' && result) {
                const previewElement = document.querySelector('.orchestrator-preview');
                if (previewElement) {
                    previewElement.innerHTML = `
                        <h4>Analysis Plan</h4>
                        <p>Selected specialists:</p>
                        <ul>
                            ${result.selected_specialists.map(spec => {
                                const details = specialistDetails[spec] || { icon: '🔍', name: spec };
                                return `<li>${details.icon} ${details.name}</li>`;
                            }).join('')}
                        </ul>
                    `;
                    previewElement.style.display = 'block';
                }
            }
            
            // Show preview of specialist results
            if (Object.keys(specialistDetails).includes(stage) && status === 'complete' && result) {
                const specialistElement = document.querySelector(`.agent-step.specialist.${stage}`);
                if (specialistElement) {
                    // Find existing preview or create new one
                    let previewElement = document.querySelector(`.${stage}-preview`);
                    if (!previewElement) {
                        previewElement = document.createElement('div');
                        previewElement.className = `agent-preview ${stage}-preview`;
                        specialistElement.after(previewElement);
                    }
                    
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
                    
                    previewElement.innerHTML = `
                        <h4>${details.icon} ${details.name} Findings</h4>
                        ${issues.length > 0 ? `
                            <p>Identified ${issues.length} issue${issues.length !== 1 ? 's' : ''}:</p>
                            <ul>
                                ${issues.slice(0, 2).map(issue => {
                                    const issueType = issue.bias_type || issue.tactic_type || 
                                                     issue.fallacy_type || issue.issue_type || 
                                                     issue.type;
                                    return `<li><strong>${issueType}</strong> (${issue.severity})</li>`;
                                }).join('')}
                                ${issues.length > 2 ? `<li>...and ${issues.length - 2} more</li>` : ''}
                            </ul>
                        ` : '<p>No significant issues found</p>'}
                    `;
                    previewElement.style.display = 'block';
                }
            }
            
            // Show preview of summarizer results
            if (stage === 'summarizer' && status === 'complete' && result) {
                const previewElement = document.querySelector('.summarizer-preview');
                if (previewElement) {
                    previewElement.innerHTML = `
                        <h4>Final Assessment</h4>
                        <p>Credibility Score: <strong>${result.credibility_score}/10</strong></p>
                        <p>Found ${result.potential_issues.length} potential issue${result.potential_issues.length !== 1 ? 's' : ''}</p>
                        <p>${result.key_concerns.length > 0 ? `${result.key_concerns.length} key concerns identified` : 'No key concerns'}</p>
                    `;
                    previewElement.style.display = 'block';
                }
            }
        });
    }

    // Update the agent UI based on progress
    function updateAgentUI(stage, status, result) {
        console.log(`Updating UI: ${stage} - ${status}`);
        const loadingDiv = document.getElementById('loading');
        if (!loadingDiv) {
            console.error('Loading div not found');
            return;
        }
        
        // Update the status for the current stage
        const stageElement = loadingDiv.querySelector(`.agent-step.${stage}`);
        if (stageElement) {
            const statusElement = stageElement.querySelector('.agent-status');
            
            if (status === 'starting') {
                statusElement.textContent = 'Working...';
                statusElement.className = 'agent-status working';
                stageElement.classList.add('active');
            } else if (status === 'complete') {
                statusElement.textContent = 'Complete';
                statusElement.className = 'agent-status complete';
                stageElement.classList.add('completed');
                stageElement.classList.remove('active');
            } else if (status === 'error') {
                statusElement.textContent = 'Error';
                statusElement.className = 'agent-status error';
                stageElement.classList.add('error');
                stageElement.classList.remove('active');
            }
        }
        
        // Handle specialist agents
        if (stage === 'orchestrator' && status === 'complete' && result?.selected_specialists) {
            const specialistList = loadingDiv.querySelector('.specialist-list');
            if (specialistList) {
                specialistList.innerHTML = '';
                
                // Create elements for each selected specialist
                result.selected_specialists.forEach(specialist => {
                    const details = specialistDetails[specialist] || { icon: '🔍', name: specialist };
                    
                    const specialistElement = document.createElement('div');
                    specialistElement.className = `agent-step specialist ${specialist}`;
                    specialistElement.innerHTML = `
                        <div class="agent-icon">${details.icon}</div>
                        <div class="agent-name">${details.name}</div>
                        <div class="agent-status">Waiting...</div>
                    `;
                    specialistList.appendChild(specialistElement);
                });
            }
        }
        
        // Update individual specialist status
        if (Object.keys(specialistDetails).includes(stage)) {
            const specialistElement = loadingDiv.querySelector(`.agent-step.specialist.${stage}`);
            if (specialistElement) {
                const statusElement = specialistElement.querySelector('.agent-status');
                
                if (status === 'starting') {
                    statusElement.textContent = 'Working...';
                    statusElement.className = 'agent-status working';
                    specialistElement.classList.add('active');
                } else if (status === 'complete') {
                    statusElement.textContent = 'Complete';
                    statusElement.className = 'agent-status complete';
                    specialistElement.classList.add('completed');
                    specialistElement.classList.remove('active');
                }
            }
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
            
            // Hide loading screen, show results
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
            
            // Generate the new agent-based results view
            let html = `<div class="agent-results-container">`;
            
            // Add Score at the top
            html += `
                <div class="agent-result-card summarizer">
                    <div class="agent-result-header">
                        <div class="agent-result-icon">📊</div>
                        <h3 class="agent-result-title">Analysis Summary</h3>
                    </div>
                    <div class="agent-result-content">
                        <div class="score-circle">${data.analysis.credibility_score}</div>
                        <p style="text-align: center; margin-bottom: 1rem;">Credibility Score out of 10</p>
                        
                        ${data.analysis.recommendation ? `
                            <h4>Recommendation:</h4>
                            <p>${data.analysis.recommendation}</p>
                        ` : ''}
                    </div>
                </div>
            `;
            
            // Add specialists' findings if available
            if (agentResults.specialists && Object.keys(agentResults.specialists).length > 0) {
                Object.entries(agentResults.specialists).forEach(([specialistName, result]) => {
                    const details = specialistDetails[specialistName] || { icon: '🔍', name: specialistName };
                    
                    // Get the issues array based on specialist type
                    let issues = [];
                    let overallAssessment = '';
                    
                    if (specialistName === 'cognitive_bias' && result.biases_identified) {
                        issues = result.biases_identified;
                        overallAssessment = result.overall_assessment;
                    } else if (specialistName === 'emotional_manipulation' && result.manipulation_tactics) {
                        issues = result.manipulation_tactics;
                        overallAssessment = result.overall_assessment;
                    } else if (specialistName === 'logical_fallacy' && result.fallacies_identified) {
                        issues = result.fallacies_identified;
                        overallAssessment = result.overall_assessment;
                    } else if (specialistName === 'source_credibility' && result.credibility_issues) {
                        issues = result.credibility_issues;
                        overallAssessment = result.overall_assessment;
                    } else if (specialistName === 'technical_accuracy' && result.accuracy_issues) {
                        issues = result.accuracy_issues;
                        overallAssessment = result.overall_assessment;
                    }
                    
                    if (issues.length > 0) {
                        html += `
                            <div class="agent-result-card">
                                <div class="agent-result-header">
                                    <div class="agent-result-icon">${details.icon}</div>
                                    <h3 class="agent-result-title">${details.name} Analysis</h3>
                                </div>
                                <div class="agent-result-content">
                                    ${overallAssessment ? `<p>${overallAssessment}</p>` : ''}
                                    <h4>Findings:</h4>
                                    <ul>
                                        ${issues.map(issue => {
                                            const issueType = issue.bias_type || issue.tactic_type || 
                                                            issue.fallacy_type || issue.issue_type || 
                                                            issue.type;
                                            const explanation = issue.explanation;
                                            const severity = issue.severity;
                                            
                                            return `
                                                <li>
                                                    <strong>${issueType}</strong> (${severity})
                                                    <p>${explanation}</p>
                                                </li>
                                            `;
                                        }).join('')}
                                    </ul>
                                </div>
                            </div>
                        `;
                    }
                });
            }
            
            // Add key concerns section
            if (data.analysis.key_concerns && data.analysis.key_concerns.length > 0) {
                html += `
                    <div class="agent-result-card">
                        <div class="agent-result-header">
                            <div class="agent-result-icon">⚠️</div>
                            <h3 class="agent-result-title">Key Concerns</h3>
                        </div>
                        <div class="agent-result-content">
                            <ul>
                                ${data.analysis.key_concerns.map(concern => `<li>${concern}</li>`).join('')}
                            </ul>
                        </div>
                    </div>
                `;
            }
            
            html += `</div>`;
            resultsDiv.innerHTML = html;
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
            }
        });
    }
    
    if (window.api && window.api.onServerReady) {
        window.api.onServerReady(() => {
            console.log('Server ready event received');
            const loadingDiv = document.getElementById('loading');
            
            if (loadingDiv) {
                // Reset all agent states
                const agentSteps = loadingDiv.querySelectorAll('.agent-step');
                agentSteps.forEach(step => {
                    step.classList.remove('active', 'completed', 'error');
                    const statusElement = step.querySelector('.agent-status');
                    if (statusElement) {
                        statusElement.textContent = 'Waiting...';
                        statusElement.className = 'agent-status';
                    }
                });
                
                // Clear previews
                const previews = document.querySelectorAll('.agent-preview');
                previews.forEach(preview => {
                    preview.style.display = 'none';
                    preview.innerHTML = '';
                });
                
                // Clear initial findings
                const initialFindings = document.querySelector('.initial-findings');
                if (initialFindings) {
                    initialFindings.style.display = 'none';
                    initialFindings.textContent = '';
                }
                
                // Clear specialist list
                const specialistList = document.querySelector('.specialist-list');
                if (specialistList) {
                    specialistList.innerHTML = '';
                }
            }
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