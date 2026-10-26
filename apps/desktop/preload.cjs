'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const production = 'https://study-room-attendance.vercel.app';
// A custom origin is a main-process supplied argument, never renderer-controlled.
const development = process.argv.find(value => value.startsWith('--study-room-development-origin='))?.split('=').slice(1).join('=');
if (process.isMainFrame && (location.origin === production || (development && location.origin === development))) {
  contextBridge.exposeInMainWorld('studyRoomDesktop', Object.freeze({
    protocolVersion: 1,
    request: request => ipcRenderer.invoke('study-room-desktop:request', request),
    onEvent: listener => {
      if (typeof listener !== 'function') throw new TypeError('BAD_LISTENER');
      const handler = (_event, value) => listener(value);
      ipcRenderer.on('study-room-desktop:event', handler);
      return () => ipcRenderer.removeListener('study-room-desktop:event', handler);
    },
  }));
}
