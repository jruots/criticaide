window.api.receiveAnalysis((data) => {
    const resultsDiv = document.getElementById('results');
    
    let html = `
        <div class="analyzed-text">
            <h3>Analyzed Text:</h3>
            <p>${data.text}</p>
        </div>
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