const BaseAgent = require('./baseAgent');
const logger = require('../../utils/logger');

class SummarizerAgent extends BaseAgent {
  constructor(llamaService) {
    super('Summarizer', llamaService);
    
    this.systemPrompt = {
      role: 'system',
      content: `You are a summarizer who creates comprehensive analysis reports by combining screening results and specialist analyses. You provide clear, concise summaries with actionable recommendations.`
    };
  }

  formatPrompt(text, context = {}) {
    const { screenerResult, specialistResults = {} } = context;
    const specialistAnalyses = Object.entries(specialistResults)
      .map(([name, result]) => `${name} Analysis:\n${JSON.stringify(result, null, 2)}`)
      .join('\n\n');
    
    return {
      role: 'user',
      content: `Create a comprehensive summary of the credibility and potential issues in this content based on all analyses.

Source: ${context.source || 'N/A'}
Text: "${text}"

Screener Result:
${JSON.stringify(screenerResult, null, 2)}

${specialistAnalyses ? `Specialist Analyses:\n${specialistAnalyses}` : 'No specialist analyses were conducted.'}

Create a final report that synthesizes all analyses into a clear assessment. Include:
1. A final credibility score (0-10)
2. A list of all potential issues identified, ordered by severity
3. Key concerns that readers should be aware of
4. A clear, actionable recommendation for the reader

Respond in this JSON format:
{
  "credibility_score": number,
  "potential_issues": [
    {
      "type": string,
      "explanation": string,
      "severity": "low"|"medium"|"high"
    }
  ],
  "key_concerns": string[],
  "recommendation": string
}`
    };
  }
}

module.exports = SummarizerAgent;