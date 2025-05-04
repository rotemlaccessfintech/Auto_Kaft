const { contextBridge, ipcRenderer } = require('electron');

// Expose a controlled API to the renderer process (React app)
contextBridge.exposeInMainWorld('electronAPI', {
  // Function the renderer can call
  executeCommand: (env) => {
    // Sends a message to the main process via the 'execute-command' channel
    // and returns a Promise that resolves with the main process's response.
    return ipcRenderer.invoke('execute-command', env);
  },
  // Remove 'env' parameter from checkStatus
  checkStatus: () => {
    // Sends a message to the main process via the 'check-status' channel
    // and returns a Promise that resolves with the main process's response.
    return ipcRenderer.invoke('check-status');
  },
  // --- ADD TOOLTIP FUNCTION START ---
  updateTooltip: (tooltipText) => {
    // Sends the text to the main process via the 'update-tooltip' channel.
    return ipcRenderer.invoke('update-tooltip', tooltipText);
  }
  // --- ADD TOOLTIP FUNCTION END ---
});

console.log('Preload script loaded.'); // For debugging 