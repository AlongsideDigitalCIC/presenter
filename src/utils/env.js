export const isTauri = () => {
  if (typeof window === 'undefined') return false;
  return (
    !!window.isTauri ||
    !!window.__TAURI_INTERNALS__ ||
    !!window.__TAURI__ ||
    typeof window.__TAURI_INTERNALS__?.invoke === 'function'
  );
};

export const openExternalUrl = async (url) => {
  if (!url) return;
  if (isTauri()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_external_url', { url });
      return;
    } catch (err) {
      console.error('Failed to open external URL via Tauri:', err);
    }
  }
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};
