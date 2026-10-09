export const isTauri = () => !!(window.__TAURI__ || window.__TAURI_INTERNALS__ || window.__TAURI_IPC__ || window.location.hostname === 'tauri.localhost' || window.location.protocol === 'tauri:');
