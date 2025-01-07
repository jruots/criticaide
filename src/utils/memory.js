const os = require('os');
const logger = require('./logger');

// 500MB in bytes
const CRITICAL_THRESHOLD = 500 * 1024 * 1024;

function checkMemory() {
    logger.setScope('Memory');
    const freeMemory = os.freemem();
    const totalMemory = os.totalmem();
    
    const freeMemGB = (freeMemory / (1024 * 1024 * 1024)).toFixed(2);
    const totalMemGB = (totalMemory / (1024 * 1024 * 1024)).toFixed(2);
    
    const isCritical = freeMemory < CRITICAL_THRESHOLD;
    
    logger.debug(`Memory check - Free: ${freeMemGB}GB, Total: ${totalMemGB}GB, Critical: ${isCritical}`);
    
    return {
        freeMemory,
        totalMemory,
        freeMemGB,
        totalMemGB,
        isCritical,
        messages: {
            warning: "System memory is very low. Analysis may fail. You can try closing other applications first, or continue anyway.",
            failureCritical: "Analysis failed. Your system is currently low on memory which might be the cause. Try closing some other applications and try again."
        }
    };
}

module.exports = {
    checkMemory,
    CRITICAL_THRESHOLD
};