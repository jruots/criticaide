const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    receiveAnalysis: (callback) => {
        ipcRenderer.on('analysis-result', (event, data) => callback(data));
    },
    platform: process.platform,  // Add this line
    
    onAnalysisStart: (callback) => {
        ipcRenderer.on('analysis-start', () => callback());
    },
});