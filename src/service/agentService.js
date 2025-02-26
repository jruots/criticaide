const { createAgentOrchestrator } = require('./agents');
const logger = require('../utils/logger');
const { checkMemory } = require('../utils/memory');

class AgentService {
  constructor(llamaService) {
    this.llamaService = llamaService;
    this.agentOrchestrator = null;
  }

  init(progressCallback) {
    logger.setScope('AgentService');
    logger.info('Initializing agent service');
    this.agentOrchestrator = createAgentOrchestrator(this.llamaService, progressCallback);
    logger.info('Agent service initialized');
  }

  async analyze(text, source = 'N/A') {
    logger.setScope('AgentService');
    logger.info('Starting agent-based analysis');

    // Check memory before starting
    const memoryState = checkMemory();
    logger.info(`Memory state before analysis - Free: ${memoryState.freeMemGB}GB`);
    
    if (memoryState.isCritical) {
      logger.warn('Memory is critically low before analysis');
      throw new Error(memoryState.messages.warning);
    }

    if (!this.agentOrchestrator) {
      throw new Error('Agent service not initialized');
    }

    try {
      const result = await this.agentOrchestrator.analyze(text, source);
      logger.info('Agent-based analysis complete');
      return result;
    } catch (error) {
      logger.error('Agent-based analysis failed:', error);
      throw error;
    }
  }
}

module.exports = AgentService;