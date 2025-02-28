const BaseAgent = require('./baseAgent');
const logger = require('../../utils/logger');

class OrchestratorAgent extends BaseAgent {
  constructor(llamaService) {
    super('Orchestrator', llamaService);
    
    this.systemPrompt = {
      role: 'system',
      content: `You are an orchestrator who determines which specialist analysis agents should be used to evaluate potentially problematic content. You select specialists based on the content characteristics and initial screening results.`
    };
  }

  formatPrompt(text, context = {}) {
    const { screenerResult } = context;
    
    return {
      role: 'user',
      content: `Based on the initial screening of this text, determine which specialist analyzers would be most effective.

Source: ${context.source || 'N/A'}
Text: "${text}"

Initial screening result:
${JSON.stringify(screenerResult, null, 2)}

Available specialists:
- cognitive_bias: Identifies cognitive biases like confirmation bias, authority bias, etc.
- emotional_manipulation: Detects appeals to fear, outrage, urgency, or other emotional tactics
- logical_fallacy: Identifies reasoning errors like straw man arguments, false dichotomies, etc.
- source_credibility: Evaluates source reliability, citation quality, and authority
- technical_accuracy: Checks factual claims, statistics usage, and technical information

Selection guidelines:
- News articles: Focus on source_credibility and factual aspects
- Opinion pieces: Emphasize cognitive_bias and logical_fallacy
- Emotional content: Prioritize emotional_manipulation detection
- Technical/scientific: Include technical_accuracy when specific claims are made
- Choose complementary specialists that address the most concerning aspects

You must select at least one specialist and at most three specialists that would be most effective.

Respond in this JSON format:
{
  "selected_specialists": string[],
  "reasoning": string
}

Include brief, specific reasoning for why each selected specialist is appropriate for this particular content.`
    };
  }
}

module.exports = OrchestratorAgent;