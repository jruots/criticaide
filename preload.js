const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    receiveAnalysis: (callback) => {
        ipcRenderer.on('analysis-result', (event, data) => callback(data));
    },
    platform: process.platform,  // Add this line
    
    onAnalysisStart: (callback) => {
        ipcRenderer.on('analysis-start', () => callback());
    },

    onInitialSetup: (callback) => {
        ipcRenderer.on('show-initial-setup', () => callback());
    },
    
    onSetupComplete: (callback) => {
        ipcRenderer.on('initial-setup-complete', () => callback());
    },
    
    onSetupError: (callback) => {
        ipcRenderer.on('initial-setup-error', (event, error) => callback(error));
    },
});