const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    receiveAnalysis: (callback) => {
        ipcRenderer.on('analysis-result', (event, data) => callback(data));
    },
    platform: process.platform,  // Add this line
    
    onAnalysisStart: (callback) => {
        ipcRenderer.on('analysis-start', () => callback());
    },

    onAgentProgress: (callback) => {
        ipcRenderer.on('agent-progress', (event, update) => callback(update));
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

    // Server events
    onServerStarting: (callback) => {
        ipcRenderer.on('server-starting', () => callback());
    },

    onServerReady: (callback) => {
        ipcRenderer.on('server-ready', () => callback());
    },

    onServerError: (callback) => {
        ipcRenderer.on('server-error', (event, error) => callback(error));
    },

    onModelDownloadStart: (callback) => {
        ipcRenderer.on('model-download-start', () => callback());
    },
    onModelDownloadProgress: (callback) => {
        ipcRenderer.on('model-download-progress', (event, progress) => callback(progress));
    },
    onModelDownloadComplete: (callback) => {
        ipcRenderer.on('model-download-complete', () => callback());
    }
});