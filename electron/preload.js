const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronUpdater', {
  onStatus: (cb) => ipcRenderer.on('update-status', (_e, data) => cb(data)),
  download: () => ipcRenderer.send('update-download'),
  install:  () => ipcRenderer.send('update-install'),
  check:    () => ipcRenderer.send('update-check'),
})
