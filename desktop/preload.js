// Runs in the sandboxed renderer before the page. Exposes a small, read-only API as window.FSDesktop.
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const arg = (process.argv || []).find((a) => a.startsWith('--fs-desktop-version='));
const version = arg ? arg.slice('--fs-desktop-version='.length) : '';

contextBridge.exposeInMainWorld('FSDesktop', Object.freeze({
  isDesktop: true,
  version,
  platform: process.platform,
  // SHA-256 of this computer's id (with a fixed salt), 64 hex characters. The raw id never reaches the page.
  machineId: () => ipcRenderer.invoke('machine-id'),
}));
