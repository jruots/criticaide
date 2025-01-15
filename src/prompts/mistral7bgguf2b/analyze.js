module.exports = {
    analyzePrompt: (source, text) => ({
        role: 'user',
        role: 'user',
        content: `Analyze the following text for clear signs of misinformation or manipulation. Only flag serious issues that would genuinely mislead readers. For legitimate news reporting from established sources, it's perfectly fine to report "no significant issues found."

    Consider the source when analyzing credibility, though source information may not always be available. Examples of source types:
    - News organizations (.com/news, known publishers)
    - Social media platforms (twitter.com, facebook.com)
    - Academic sources (.edu)
    - Government sites (.gov)
    - Blog posts or personal sites

    Text comes from this source: "${source}"
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

    Base your analysis purely on the content provided. Don't invent problems where none exist.`
    })
};