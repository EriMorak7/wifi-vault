const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getNetworks: () => ipcRenderer.invoke('wifi:list'),
});
