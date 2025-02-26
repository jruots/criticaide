const BaseAgent = require('./baseAgent');
const logger = require('../../utils/logger');

class ScreenerAgent extends BaseAgent {
  constructor(llamaService) {
    super('Screener', llamaService);
    
    this.systemPrompt = {
      role: 'system',
      content: `You are a text screener who quickly evaluates if content needs deeper analysis for misinformation, bias, manipulation tactics, or credibility issues. You only flag content that genuinely needs deeper review.`
    };
  }

  formatPrompt(text, context = {}) {
    return {
      role: 'user',
      content: `Analyze this text and determine if it needs deeper analysis for potential misinformation, manipulation, bias, or credibility issues.

Source: ${context.source || 'N/A'}
Text: "${text}"

Your task is to:
1. Make a quick assessment of whether this content needs deeper specialist analysis
2. Provide an initial credibility score (0-10)
3. List which specialist analyses might be needed (choose from: cognitive_bias, emotional_manipulation, logical_fallacy, source_credibility, technical_accuracy)
4. Explain your reasoning

Respond in this JSON format:
{
  "needsDeepAnalysis": boolean,
  "initial_score": number,
  "suggested_specialists": string[],
  "reasoning": string
}

If the content is clearly reliable, well-sourced information without manipulation tactics, respond with 'needsDeepAnalysis: false'.`
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