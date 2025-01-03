const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    receiveAnalysis: (callback) => {
        ipcRenderer.on('analysis-result', (event, data) => callback(data));
    }
});