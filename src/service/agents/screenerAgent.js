const BaseAgent = require('./baseAgent');
const logger = require('../../utils/logger');

class ScreenerAgent extends BaseAgent {
  constructor(llamaService) {
    super('Screener', llamaService);
    
    this.systemPrompt = {
      role: 'system',
      content: `You are a text screener who quickly evaluates if content needs deeper analysis for misinformation, bias, or credibility issues. Be efficient and direct in your assessment.`
    };
  }

  formatPrompt(text, context = {}) {
    return {
      role: 'user',
      content: `Analyze this text and determine if it needs deeper specialist analysis for potential credibility issues.

Source: ${context.source || 'N/A'}
Text: "${text}"

Source credibility guidelines:
- Content from established journalistic sources (e.g., major newspapers, wire services, public broadcasting) should only be flagged if you identify specific, substantial issues
- Social media, personal blogs, and user-generated content warrant closer scrutiny
- Consider both the source platform and the author/publisher when available

Your task is to:
1. Make a quick assessment of whether this content needs deeper specialist analysis
2. Provide very brief reasoning (2-3 sentences maximum)

Respond in this JSON format:
{
  "needsDeepAnalysis": boolean,
  "reasoning": string
}

Be extremely concise in your reasoning. Focus only on key factors that determined your decision. If the content is reliable information without significant credibility concerns, respond with 'needsDeepAnalysis: false'.`
    };
  }

  async analyze(text, context = {}) {
    logger.info('Screener agent analyzing text');
    const result = await super.analyze(text, context);
    logger.info(`Screener assessment: ${result.needsDeepAnalysis ? 'Needs deeper analysis' : 'No issues detected'}`);
    return result;
  }
}

module.exports = ScreenerAgent;