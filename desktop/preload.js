// Runs in the sandboxed renderer before the page. Exposes a small, read-only API as window.FSDesktop.
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const arg = (process.argv || []).find((a) => a.startsWith('--fs-desktop-version='));
const version = arg ? arg.slice('--fs-desktop-version='.length) : '';

// Calls with progress: the page passes a callback, the main process sends progress events tagged with a job id.
function withProgress(channel, progressChannel, payload, onProgress) {
  const id = Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  const listener = (_e, msg) => {
    if (msg && msg.id === id && typeof onProgress === 'function') { try { onProgress(msg.data); } catch { /* page error */ } }
  };
  ipcRenderer.on(progressChannel, listener);
  return ipcRenderer.invoke(channel, Object.assign({}, payload, { id }))
    .finally(() => ipcRenderer.removeListener(progressChannel, listener));
}

// Local AI engine (stable-diffusion.cpp + FLUX.2 klein 4B). Only plain values cross; files and arguments stay in main.
const localAI = Object.freeze({
  status: () => ipcRenderer.invoke('local-ai:status'),
  gpuInfo: () => ipcRenderer.invoke('local-ai:gpu'),
  install: (onProgress, opts) => withProgress('local-ai:install', 'local-ai:install-progress',
    { variant: opts && (opts.variant === 'cpu' || opts.variant === 'vulkan') ? opts.variant : undefined }, onProgress),
  cancelInstall: () => ipcRenderer.invoke('local-ai:cancel-install'),
  remove: () => ipcRenderer.invoke('local-ai:remove'),
  run: (o, onProgress) => withProgress('local-ai:run', 'local-ai:run-progress', {
    mode: o && o.mode, prompt: o && o.prompt, imageB64: o && o.imageB64, w: o && o.w, h: o && o.h, seed: o && o.seed,
  }, onProgress),
  cancel: () => ipcRenderer.invoke('local-ai:cancel'),
});

contextBridge.exposeInMainWorld('FSDesktop', Object.freeze({
  isDesktop: true,
  version,
  platform: process.platform,
  // SHA-256 of this computer's id (with a fixed salt), 64 hex characters. The raw id never reaches the page.
  machineId: () => ipcRenderer.invoke('machine-id'),
  localAI,
  // closes the program (same as the window's X; unsaved photos are asked about first)
  close: () => ipcRenderer.send('app:close'),
  // removes the program from this computer (asks first, then opens Windows' uninstaller and closes)
  uninstall: () => ipcRenderer.invoke('app:uninstall'),
}));
