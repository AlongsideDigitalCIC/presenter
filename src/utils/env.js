export const isTauri = () => {
  if (typeof window === 'undefined') return false;
  return (
    !!window.isTauri ||
    !!window.__TAURI_INTERNALS__ ||
    !!window.__TAURI__ ||
    typeof window.__TAURI_INTERNALS__?.invoke === 'function'
  );
};
