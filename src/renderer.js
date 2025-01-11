document.addEventListener('DOMContentLoaded', () => {
    const headerSubtitle = document.querySelector('.header-subtitle');
    const isMac = window.api.platform === 'darwin';
    const shortcutText = isMac ? 'Cmd+Option+Shift+T' : 'Ctrl+Alt+Shift+T';
    headerSubtitle.textContent = `Press ${shortcutText} to analyze copied text`;
});

window.api.receiveAnalysis((data) => {
    const resultsDiv = document.getElementById('results');
    
    // Check if we received a token limit error
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