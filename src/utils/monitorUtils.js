/**
 * Normalizes a Tauri Monitor object into a stable serializable descriptor
 * so minor OS workArea changes (e.g. taskbar auto-hide) never break saved monitor matching.
 */
export function serializeMonitorChoice(monitor) {
  if (!monitor || typeof monitor !== 'object') return '';
  return JSON.stringify({
    name: monitor.name || null,
    position: {
      x: monitor.position?.x ?? 0,
      y: monitor.position?.y ?? 0
    },
    size: {
      width: monitor.size?.width ?? 1920,
      height: monitor.size?.height ?? 1080
    },
    scaleFactor: monitor.scaleFactor ?? 1
  });
}

export function isSameMonitor(a, b) {
  if (!a || !b) return false;
  const samePos =
    a.position?.x !== undefined &&
    b.position?.x !== undefined &&
    a.position.x === b.position.x &&
    a.position.y === b.position.y;
  const sameName = Boolean(a.name && b.name && a.name === b.name);
  if (sameName && samePos) return true;
  if (samePos) return true;
  if (sameName && (a.position?.x === undefined || b.position?.x === undefined)) return true;
  return false;
}

/**
 * Matches a saved monitor value (IDB string) against the current live availableMonitors() list.
 * Supports:
 * - 'windowed' -> explicit non-fullscreen preview window
 * - JSON monitor string -> matched to live monitor by name + position, name, or position
 * - '' / null (Auto) -> prefers secondary/external projector monitor if >1 display is connected,
 *   otherwise uses the primary monitor in fullscreen.
 */
export function resolveTargetMonitor(savedValue, liveMonitors = [], mainMonitor = null) {
  let parsed = null;
  if (savedValue && typeof savedValue === 'string' && savedValue !== 'windowed') {
    try {
      parsed = JSON.parse(savedValue);
    } catch {
      parsed = null;
    }
  }

  let target = null;

  if (parsed) {
    if (Array.isArray(liveMonitors) && liveMonitors.length > 0) {
      target =
        liveMonitors.find(
          (m) =>
            m.name &&
            parsed.name &&
            m.name === parsed.name &&
            m.position?.x === parsed.position?.x &&
            m.position?.y === parsed.position?.y
        ) ||
        liveMonitors.find(
          (m) =>
            m.position?.x !== undefined &&
            m.position.x === parsed.position?.x &&
            m.position.y === parsed.position?.y
        ) ||
        liveMonitors.find((m) => m.name && parsed.name && m.name === parsed.name) ||
        parsed;
    } else {
      target = parsed;
    }
  } else if (Array.isArray(liveMonitors) && liveMonitors.length > 0) {
    // Auto mode: prefer an external/secondary display (not the one hosting the main control window)
    if (liveMonitors.length > 1 && mainMonitor) {
      target = liveMonitors.find((m) => !isSameMonitor(m, mainMonitor)) || liveMonitors[1] || liveMonitors[0];
    } else if (liveMonitors.length > 1) {
      target = liveMonitors.find((m) => (m.position?.x ?? 0) !== 0 || (m.position?.y ?? 0) !== 0) || liveMonitors[1];
    } else {
      target = liveMonitors[0];
    }
  }

  const sameAsMain = !target || !mainMonitor ? true : isSameMonitor(target, mainMonitor);
  return {
    mode: 'fullscreen',
    monitor: target,
    isSameAsMain: sameAsMain
  };
}

/**
 * Finds the matching <option> value in SettingsView for a saved monitor string.
 */
export function matchSavedMonitorToOptionValue(savedValue, liveMonitors = []) {
  if (!savedValue || savedValue === 'windowed') return '';

  let parsed = null;
  try {
    parsed = JSON.parse(savedValue);
  } catch {
    return '';
  }
  if (!parsed) return '';

  const matched =
    liveMonitors.find(
      (m) =>
        m.name &&
        parsed.name &&
        m.name === parsed.name &&
        m.position?.x === parsed.position?.x &&
        m.position?.y === parsed.position?.y
    ) ||
    liveMonitors.find(
      (m) =>
        m.position?.x !== undefined &&
        m.position.x === parsed.position?.x &&
        m.position.y === parsed.position?.y
    ) ||
    liveMonitors.find((m) => m.name && parsed.name && m.name === parsed.name);

  return matched ? serializeMonitorChoice(matched) : serializeMonitorChoice(parsed);
}

/**
 * Formats a user-friendly monitor name based on hardware info, position, and connected displays:
 * e.g. "Internal Display / Monitor 1 (1920x1080)" or "External Projector / Monitor 2 (1920x1080)"
 */
export function getMonitorDisplayName(monitor, index = 0, allMonitors = [], mainMonitor = null) {
  if (!monitor) return 'Internal Display / Monitor 1';

  const width = monitor.size?.width || 1920;
  const height = monitor.size?.height || 1080;
  const resolution = `${width}x${height}`;

  const isPrimary = (monitor.position?.x === 0 && monitor.position?.y === 0) ||
                    (mainMonitor && isSameMonitor(monitor, mainMonitor));

  let rawName = monitor.name || '';
  if (rawName.includes('DISPLAY')) {
    const match = rawName.match(/DISPLAY(\d+)/i);
    if (match) {
      rawName = `Monitor ${match[1]}`;
    }
  }

  const num = index + 1;
  const baseName = rawName && !rawName.includes('\\\\.\\') ? rawName : `Monitor ${num}`;

  if (allMonitors.length > 1) {
    if (isPrimary) {
      return `Internal Display / ${baseName} (${resolution})`;
    } else {
      return `External Projector / ${baseName} (${resolution})`;
    }
  }

  return `Internal Display / ${baseName} (${resolution})`;
}
