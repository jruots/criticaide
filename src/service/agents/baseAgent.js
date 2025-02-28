const logger = require('../../utils/logger');

class BaseAgent {
  /**
   * @param {string} name - Agent name
   * @param {Object} llamaService - LlamaCpp service instance
   */
  constructor(name, llamaService) {
    this.name = name;
    this.llamaService = llamaService;
    this.completeCallbacks = [];
    this.systemPrompt = {
      role: 'system',
      content: 'You are a helpful AI assistant.'
    };
    logger.info(`Agent ${name} initialized`);
  }

  /**
   * Register a callback for when analysis is complete
   * @param {Function} callback - Function to call when analysis is complete
   */
  onComplete(callback) {
    this.completeCallbacks.push(callback);
    return this;
  }

  /**
   * Analyze text with this agent
   * @param {string} text - Text to analyze
   * @param {Object} context - Additional context
   * @returns {Promise<Object>} Analysis result
   */
  async analyze(text, context = {}) {
    logger.setScope(`Agent:${this.name}`);
    logger.info(`Starting analysis`);

    try {
      const prompt = this.formatPrompt(text, context);
      const result = await this.callLLM(prompt);
      this.notifyComplete(result);
      logger.info(`Analysis complete`);
      return result;
    } catch (error) {
      logger.error(`Analysis failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Format the prompt for this agent
   * @param {string} text - Text to analyze
   * @param {Object} context - Additional context
   * @returns {Object} Formatted prompt object
   */
  formatPrompt(text, context = {}) {
    // To be overridden by specific agents
    return {
      role: 'user',
      content: `Analyze the following text: ${text}`
    };
  }

  /**
   * Call the LLM with the formatted prompt
   * @param {Object} prompt - Formatted prompt object
   * @returns {Promise<Object>} LLM response
   */
  async callLLM(prompt) {
    // Use the LlamaCpp service directly
    try {
      const source = prompt.source || 'N/A';
      const content = prompt.content || '';
      
      const response = await fetch('http://127.0.0.1:8080/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer no-key'
        },
        body: JSON.stringify({
          model: "phi-3.5",
          messages: [
            this.systemPrompt,
            prompt
          ],
          temperature: 0.2,
          top_k: 50,
          top_p: 0.95,
          stream: false,
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        throw new Error(`LLM request failed: ${response.statusText}`);
      }

      const result = await response.json();
      logger.debug('LLM response', result);
      
      try {
        const parsedContent = JSON.parse(result.choices[0].message.content);
        return parsedContent;
      } catch (parseError) {
        logger.error('Failed to parse LLM response', parseError);
        throw new Error('Invalid response format from LLM');
      }
    } catch (error) {
      logger.error('Error calling LLM', error);
      throw error;
    }
  }

  /**
   * Notify all registered callbacks that analysis is complete
   * @param {Object} result - Analysis result
   */
  notifyComplete(result) {
    for (const callback of this.completeCallbacks) {
      callback(result);
    }
  }
}

module.exports = BaseAgent;