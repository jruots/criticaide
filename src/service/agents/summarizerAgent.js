const BaseAgent = require('./baseAgent');
const logger = require('../../utils/logger');

class SummarizerAgent extends BaseAgent {
  constructor(llamaService) {
    super('Summarizer', llamaService);
    
    this.systemPrompt = {
      role: 'system',
      content: `You are a summarizer who creates comprehensive analysis reports by combining screening results and specialist analyses. You provide clear, concise summaries with actionable recommendations without inventing problems where none exist..`
    };
  }

  formatPrompt(text, context = {}) {
    const { screenerResult, specialistResults = {} } = context;
    const specialistAnalyses = Object.entries(specialistResults)
      .map(([name, result]) => `${name} Analysis:\n${JSON.stringify(result, null, 2)}`)
      .join('\n\n');
    
    return {
      role: 'user',
      content: `Create a comprehensive summary of the credibility of this content based on all analyses.

Source: ${context.source || 'N/A'}
Text: "${text}"

Screener Result:
${JSON.stringify(screenerResult, null, 2)}

${specialistAnalyses ? `Specialist Analyses:\n${specialistAnalyses}` : 'No specialist analyses were conducted.'}

Important: If the screener determined no deeper analysis was needed (needsDeepAnalysis: false) and the content appears reliable, do NOT manufacture potential issues. For highly credible content, it's perfectly acceptable to report zero issues.

Synthesize all analyses into one clear assessment. When specialists disagree, weigh the evidence and reasoning from each to determine the most accurate conclusion.

Your summary must include:
1. A final credibility score (0-10):
   * 0-3: Significant credibility issues, generally unreliable
   * 4-6: Mixed credibility, some valuable content alongside issues
   * 7-10: Generally reliable, follows good information practices

2. A list of potential issues identified, ordered by severity (if any exist):
   * Only include actual credibility problems, not contextual information
   * Prioritize issues that substantially impact credibility
   * Include specific examples from the text where possible
   * Consolidate similar issues raised by different specialists

3. A clear, actionable recommendation for the reader that:
   * Offers specific guidance based on content type
   * Provides concrete steps for verification if needed
   * Considers the source's overall reliability

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
  "recommendation": string
}`
    };
  }
}

module.exports = SummarizerAgent;