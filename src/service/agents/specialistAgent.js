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
      content: `Analyze this text for cognitive biases. Identify only clear examples of cognitive biases with specific textual evidence.

Source: ${context.source || 'N/A'}
Text: "${text}"

Consider these cognitive biases:
- Confirmation bias: Favoring information confirming existing beliefs
- Authority bias: Trusting claims based on source, not evidence
- Bandwagon effect: Appeal to popularity instead of merit
- Framing effect: Using specific presentation to influence interpretation
- Other relevant cognitive biases

Severity guide:
- Low: Subtle bias unlikely to affect core message
- Medium: Noticeable bias that influences but doesn't dominate reasoning
- High: Significant bias that fundamentally undermines objectivity

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
}

Only identify biases with clear textual evidence. Regular persuasion is not automatically bias.`
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
      content: `Analyze this text for emotional manipulation tactics. Identify only clear instances where emotions are leveraged to bypass rational thinking.

Source: ${context.source || 'N/A'}
Text: "${text}"

Consider these manipulation tactics:
- Fear-mongering: Exaggerating threats to provoke anxiety
- Appeal to anger/outrage: Inflaming indignation beyond what facts warrant
- Guilt-tripping: Inducing unwarranted guilt to influence behavior
- Urgency creation: Artificial time pressure to force hasty decisions
- Other emotional manipulation techniques

Severity guide:
- Low: Mild emotional appeal that doesn't distort facts
- Medium: Notable emotional leverage that partially obscures rational assessment
- High: Strong emotional manipulation that overwhelms factual content

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
}

Important: Not all emotional content is manipulative. Only flag tactics that appear designed to circumvent rational judgment or distort understanding.`
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
      content: `Analyze this text for logical fallacies and flawed reasoning. Identify only fallacies present in actual arguments (not descriptions or quotations).

Source: ${context.source || 'N/A'}
Text: "${text}"

Consider these common fallacies:
- Straw man: Misrepresenting an opponent's argument to make it easier to attack
- False dichotomy: Presenting only two options when others exist
- Ad hominem: Attacking the person instead of addressing their argument
- Slippery slope: Claiming one event will lead to extreme outcomes without evidence
- False cause: Assuming correlation implies causation

Severity guide:
- Low: Minor reasoning flaw that doesn't undermine the main argument
- Medium: Significant flaw that weakens but doesn't invalidate the entire argument
- High: Critical flaw that invalidates the central reasoning

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
}

Important: Only identify fallacies in actual arguments. Descriptive text, quotations of others' views, or non-argumentative content should not be flagged as containing fallacies.`
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
      content: `Analyze this text for source credibility issues. Evaluate how sources are used, cited, or represented, considering the content type.

Source: ${context.source || 'N/A'}
Text: "${text}"

Consider these credibility factors:
- Attribution clarity: Are claims properly attributed to specific sources?
- Source expertise: Do cited sources have relevant expertise for their claims?
- Citation completeness: Is there sufficient sourcing for key claims?
- Source diversity: Are multiple perspectives or sources considered?
- Transparency: Is the author/publisher clearly identified?

Severity guide:
- Low: Minor attribution issues that don't affect key claims
- Medium: Notable sourcing problems that affect some important claims
- High: Critical source issues that undermine core reliability

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
}

Note: Consider context appropriately. News articles, academic papers, and social media have different citation standards. Self-evident claims or personal experiences may not require external sourcing.`
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
      content: `Analyze this text for technical accuracy issues. Evaluate factual claims, statistics, and technical details within your knowledge domain.

Source: ${context.source || 'N/A'}
Text: "${text}"

Consider these accuracy factors:
- Statistical integrity: Are statistics presented accurately and in proper context?
- Causality claims: Are cause-effect relationships properly established or overstated?
- Data selection: Is evidence cherry-picked or representative?
- Technical terminology: Are specialized terms used correctly?
- Complexity handling: Are complex topics explained appropriately or oversimplified?

Severity guide:
- Low: Minor inaccuracies that don't affect main conclusions
- Medium: Notable issues that partially undermine key points
- High: Critical errors that fundamentally misrepresent important facts

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
}

Note: Consider the audience and purpose of the content. Technical writing for experts has different standards than general audience material. Only flag issues you can confidently identify based on the text.`
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