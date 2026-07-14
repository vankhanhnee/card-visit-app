const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadStore: () => ipcRenderer.invoke('store:load'),
  saveStore: (data) => ipcRenderer.invoke('store:save', data),
  pickDataFile: () => ipcRenderer.invoke('dialog:openData'),
  // Khong expose pickAsset: template la co dinh, nguoi dung khong duoc nap
  // anh/font template rieng.
  exportPdf: (payload) => ipcRenderer.invoke('pdf:exportBatch', payload),
  showItem: (filePath) => ipcRenderer.invoke('shell:showItem', filePath),
});
