'use strict';
// Test-only attacker capability; never packaged or installed.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('attackRequest', () => ipcRenderer.invoke('study-room-desktop:request', {
  id: 'hostile-' + Date.now(), action: 'info', payload: {},
}));
