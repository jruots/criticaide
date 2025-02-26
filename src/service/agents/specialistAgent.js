const BaseAgent = require('./baseAgent');
const logger = require('../../utils/logger');

class SpecialistAgent extends BaseAgent {
  constructor(name, llamaService, specialization) {
    super(name, llamaService);
    this.specialization = specialization;
  }

  formatPrompt(text, context = {}) {
    // Base specialist prompt to be overridden
    return {
      role: 'user',
      content: `Analyze this text for issues related to ${this.specialization}.

Source: ${context.source || 'N/A'}
Text: "${text}"
`
    };
  }
}

class CognitiveBiasAgent extends SpecialistAgent {
  constructor(llamaService) {
    super('CognitiveBias', llamaService, 'cognitive biases');
    
    this.systemPrompt = {
      role: 'system',
      content: `You are a cognitive bias specialist who identifies how content may leverage or exhibit cognitive biases. Your goal is to help readers recognize when their cognitive biases might be exploited.`
    };
  }

  formatPrompt(text, context = {}) {
    return {
      role: 'user',
      content: `Analyze this text for cognitive biases. Identify specific cognitive biases that might be present or exploited.

Source: ${context.source || 'N/A'}
Text: "${text}"

Consider biases such as:
- Confirmation bias
- Bandwagon effect
- Authority bias
- Availability heuristic
- Framing effect
- In-group bias
- And other relevant cognitive biases

Respond in this JSON format:
{
  "biases_identified": [
    {
      "bias_type": string,
      "explanation": string,
      "severity": "low"|"medium"|"high",
      "example_from_text": string
    }
  ],
  "overall_assessment": string,
  "recommendation": string
}`
    };
  }
}

class EmotionalManipulationAgent extends SpecialistAgent {
  constructor(llamaService) {
    super('EmotionalManipulation', llamaService, 'emotional manipulation');
    
    this.systemPrompt = {
      role: 'system',
      content: `You are an emotional manipulation specialist who identifies how content may use emotional appeals to manipulate readers. Your goal is to help readers recognize when their emotions are being leveraged to influence their thinking.`
    };
  }

  formatPrompt(text, context = {}) {
    return {
      role: 'user',
      content: `Analyze this text for emotional manipulation tactics. Identify specific ways emotions might be leveraged to influence the reader.

Source: ${context.source || 'N/A'}
Text: "${text}"

Consider tactics such as:
- Fear-mongering
- Appeal to anger/outrage
- Appeal to pity/sympathy
- Guilt-tripping
- Flattery
- Urgency creation
- And other emotional manipulation techniques

Respond in this JSON format:
{
  "manipulation_tactics": [
    {
      "tactic_type": string,
      "explanation": string,
      "severity": "low"|"medium"|"high",
      "example_from_text": string
    }
  ],
  "overall_assessment": string,
  "recommendation": string
}`
    };
  }
}

class LogicalFallacyAgent extends SpecialistAgent {
  constructor(llamaService) {
    super('LogicalFallacy', llamaService, 'logical fallacies');
    
    this.systemPrompt = {
      role: 'system',
      content: `You are a logical fallacy specialist who identifies flawed reasoning and arguments in content. Your goal is to help readers recognize invalid arguments and reasoning patterns.`
    };
  }

  formatPrompt(text, context = {}) {
    return {
      role: 'user',
      content: `Analyze this text for logical fallacies and flawed reasoning. Identify specific fallacies that might be present.

Source: ${context.source || 'N/A'}
Text: "${text}"

Consider fallacies such as:
- Straw man arguments
- False dichotomies
- Ad hominem attacks
- Appeal to ignorance
- Slippery slope
- False cause (post hoc)
- Appeal to nature
- And other logical fallacies

Respond in this JSON format:
{
  "fallacies_identified": [
    {
      "fallacy_type": string,
      "explanation": string,
      "severity": "low"|"medium"|"high",
      "example_from_text": string
    }
  ],
  "overall_assessment": string,
  "recommendation": string
}`
    };
  }
}

class SourceCredibilityAgent extends SpecialistAgent {
  constructor(llamaService) {
    super('SourceCredibility', llamaService, 'source credibility');
    
    this.systemPrompt = {
      role: 'system',
      content: `You are a source credibility specialist who evaluates the reliability and authority of content sources. Your goal is to help readers understand the credibility of information sources.`
    };
  }

  formatPrompt(text, context = {}) {
    return {
      role: 'user',
      content: `Analyze this text for source credibility issues. Evaluate how sources are used, cited, or represented.

Source: ${context.source || 'N/A'}
Text: "${text}"

Consider factors such as:
- Expertise of cited sources
- Missing or vague attributions
- Anonymous sources
- Misrepresented credentials
- Circular references
- Primary vs secondary sources
- And other source credibility issues

Respond in this JSON format:
{
  "credibility_issues": [
    {
      "issue_type": string,
      "explanation": string,
      "severity": "low"|"medium"|"high",
      "example_from_text": string
    }
  ],
  "overall_assessment": string,
  "recommendation": string
}`
    };
  }
}

class TechnicalAccuracyAgent extends SpecialistAgent {
  constructor(llamaService) {
    super('TechnicalAccuracy', llamaService, 'technical accuracy');
    
    this.systemPrompt = {
      role: 'system',
      content: `You are a technical accuracy specialist who evaluates factual claims and technical details in content. Your goal is to help readers identify potential factual errors or misrepresentations.`
    };
  }

  formatPrompt(text, context = {}) {
    return {
      role: 'user',
      content: `Analyze this text for technical accuracy issues. Evaluate factual claims, statistics, and technical details.

Source: ${context.source || 'N/A'}
Text: "${text}"

Consider issues such as:
- Misrepresented statistics
- Cherry-picked data
- Correlation vs causation confusion
- Outdated information
- Simplistic explanations of complex topics
- Misleading technical terminology
- And other technical accuracy issues

Respond in this JSON format:
{
  "accuracy_issues": [
    {
      "issue_type": string,
      "explanation": string,
      "severity": "low"|"medium"|"high",
      "example_from_text": string
    }
  ],
  "overall_assessment": string,
  "recommendation": string
}`
    };
  }
}

module.exports = {
  SpecialistAgent,
  CognitiveBiasAgent,
  EmotionalManipulationAgent,
  LogicalFallacyAgent,
  SourceCredibilityAgent,
  TechnicalAccuracyAgent
};