const BaseAgent = require('./baseAgent');
const logger = require('../../utils/logger');

class OrchestratorAgent extends BaseAgent {
  constructor(llamaService) {
    super('Orchestrator', llamaService);
    
    this.systemPrompt = {
      role: 'system',
      content: `You are an orchestrator who determines which specialist analysis agents should be used to evaluate potentially problematic content. You select specialists based on the content and initial screening results.`
    };
  }

  formatPrompt(text, context = {}) {
    const { screenerResult } = context;
    
    return {
      role: 'user',
      content: `Based on the initial screening of this text, determine which specialist analyzers should be used.

Source: ${context.source || 'N/A'}
Text: "${text}"

Initial screening result:
${JSON.stringify(screenerResult, null, 2)}

Available specialists:
- cognitive_bias: Identifies cognitive biases in content
- emotional_manipulation: Detects emotional manipulation tactics
- logical_fallacy: Identifies logical fallacies and reasoning errors
- source_credibility: Evaluates source reliability and authority
- technical_accuracy: Checks factual and technical accuracy of claims

You must select at least one specialist and at most three specialists that would be most effective for analyzing this content.

Respond in this JSON format:
{
  "selected_specialists": string[],
  "reasoning": string
}

Be specific about why each selected specialist is appropriate for this content.`
    };
  }
}

module.exports = OrchestratorAgent;