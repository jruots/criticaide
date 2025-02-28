const AgentOrchestrator = require('./agentOrchestrator');

/**
 * Create an agent orchestrator
 * @param {Object} llamaService - LlamaCpp service instance
 * @param {Function} progressCallback - Callback for progress updates
 * @returns {AgentOrchestrator} Agent orchestrator instance
 */
function createAgentOrchestrator(llamaService, progressCallback) {
  return new AgentOrchestrator(llamaService, progressCallback);
}

module.exports = {
  createAgentOrchestrator
};