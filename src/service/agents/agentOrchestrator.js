const logger = require('../../utils/logger');
const ScreenerAgent = require('./screenerAgent');
const OrchestratorAgent = require('./orchestratorAgent');
const { 
  CognitiveBiasAgent, 
  EmotionalManipulationAgent,
  LogicalFallacyAgent,
  SourceCredibilityAgent,
  TechnicalAccuracyAgent 
} = require('./specialistAgent');
const SummarizerAgent = require('./summarizerAgent');

class AgentOrchestrator {
  /**
   * @param {Object} llamaService - LlamaCpp service instance
   * @param {Function} progressCallback - Callback for progress updates
   */
  constructor(llamaService, progressCallback) {
    this.llamaService = llamaService;
    this.progressCallback = progressCallback || (() => {});
    
    // Initialize agents
    this.screenerAgent = new ScreenerAgent(llamaService);
    this.orchestratorAgent = new OrchestratorAgent(llamaService);
    this.summarizerAgent = new SummarizerAgent(llamaService);
    
    // Initialize specialist agents
    this.specialistAgents = {
      cognitive_bias: new CognitiveBiasAgent(llamaService),
      emotional_manipulation: new EmotionalManipulationAgent(llamaService),
      logical_fallacy: new LogicalFallacyAgent(llamaService),
      source_credibility: new SourceCredibilityAgent(llamaService),
      technical_accuracy: new TechnicalAccuracyAgent(llamaService)
    };
    
    logger.info('Agent orchestrator initialized with all agents');
  }

  /**
   * Analyze text using the agent system
   * @param {string} text - Text to analyze
   * @param {string} source - Source of the text
   * @returns {Promise<Object>} Final analysis result
   */
  async analyze(text, source = 'N/A') {
    logger.setScope('AgentOrchestrator');
    logger.info('Starting analysis workflow');
    const context = { source };
    const specialistResults = {};
    
    try {
      // Step 1: Initial screening
      this.sendProgressUpdate('screener', 'starting');
      const screenerResult = await this.screenerAgent.analyze(text, context);
      this.sendProgressUpdate('screener', 'complete', screenerResult);
      
      // If no deep analysis needed, skip to summarizer
      if (!screenerResult.needsDeepAnalysis) {
        logger.info('No deep analysis needed, skipping to summary');
        this.sendProgressUpdate('summarizer', 'starting');
        const summaryResult = await this.summarizerAgent.analyze(
          text, 
          { ...context, screenerResult, specialistResults }
        );
        this.sendProgressUpdate('summarizer', 'complete', summaryResult);
        return summaryResult;
      }
      
      // Step 2: Orchestration to decide which specialists to use
      this.sendProgressUpdate('orchestrator', 'starting');
      const orchestratorResult = await this.orchestratorAgent.analyze(
        text, 
        { ...context, screenerResult }
      );
      this.sendProgressUpdate('orchestrator', 'complete', orchestratorResult);
      
      // Step 3: Run selected specialist agents sequentially
      const { selected_specialists } = orchestratorResult;
      logger.info(`Selected specialists: ${selected_specialists.join(', ')}`);
      
      for (const specialistName of selected_specialists) {
        if (!this.specialistAgents[specialistName]) {
          logger.warn(`Specialist ${specialistName} not found, skipping`);
          continue;
        }
        
        const specialist = this.specialistAgents[specialistName];
        this.sendProgressUpdate(specialistName, 'starting');
        const specialistResult = await specialist.analyze(text, context);
        specialistResults[specialistName] = specialistResult;
        this.sendProgressUpdate(specialistName, 'complete', specialistResult);
      }
      
      // Step 4: Summarize all results
      this.sendProgressUpdate('summarizer', 'starting');
      const summaryResult = await this.summarizerAgent.analyze(
        text, 
        { ...context, screenerResult, specialistResults }
      );
      this.sendProgressUpdate('summarizer', 'complete', summaryResult);
      
      logger.info('Analysis workflow completed successfully');
      return summaryResult;
      
    } catch (error) {
      logger.error(`Analysis workflow failed: ${error.message}`, error);
      this.sendProgressUpdate('error', error.message);
      
      // Return a basic error result
      return {
        credibility_score: 0,
        potential_issues: [{
          type: 'analysis_error',
          explanation: `Error during analysis: ${error.message}`,
          severity: 'high'
        }],
        key_concerns: ['Analysis could not be completed due to an error'],
        recommendation: 'Please try again or analyze a different text.'
      };
    }
  }

  /**
   * Send a progress update via the callback
   * @param {string} stage - Current stage of analysis
   * @param {string} status - Status of the current stage
   * @param {Object} [result] - Result data if available
   */
  sendProgressUpdate(stage, status, result = null) {
    logger.debug(`Progress update: ${stage} - ${status}`);
    this.progressCallback({
      stage,
      status,
      result,
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = AgentOrchestrator;