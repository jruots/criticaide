/**
 * @typedef {Object} AnalysisResult
 * @property {number} credibility_score - Score from 0-10 indicating content credibility
 * @property {Array<Issue>} potential_issues - Identified issues in the content
 * @property {Array<string>} key_concerns - Primary concerns about the content
 * @property {string} recommendation - Recommended action for the user
 */

/**
 * @typedef {Object} Issue
 * @property {string} type - Type of issue identified
 * @property {string} explanation - Detailed explanation of the issue
 * @property {('low'|'medium'|'high')} severity - Severity level of the issue
 */

/**
 * @typedef {Object} ScreenerResult
 * @property {boolean} needsDeepAnalysis - Whether the content needs deeper analysis
 * @property {number} initial_score - Initial credibility score
 * @property {string} reasoning - Reasoning behind the decision
 * @property {Array<string>} suggested_specialists - Suggested specialist agents to use
 */

/**
 * @typedef {Object} ProgressUpdate
 * @property {string} stage - Current stage of analysis
 * @property {string} status - Status of the current stage
 * @property {Object} [result] - Result data if available
 */

module.exports = {};