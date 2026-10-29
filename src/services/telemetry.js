const TELEMETRY_ENDPOINT = 'https://admincentre.alongsidedigital.co.uk/api/ping';
const OPT_OUT_KEY = 'presenter_telemetry_opt_out';
const USER_ID_KEY = 'presenter_anonymous_user_id';
const LAST_PING_KEY = 'presenter_last_telemetry_ping';
const APP_VERSION = '1.0.3';

/**
 * Returns whether anonymous telemetry is enabled (default: true).
 */
export function isTelemetryEnabled() {
  try {
    return localStorage.getItem(OPT_OUT_KEY) !== 'true';
  } catch {
    return false;
  }
}

/**
 * Sets user preference for telemetry.
 */
export function setTelemetryEnabled(enabled) {
  try {
    if (enabled) {
      localStorage.removeItem(OPT_OUT_KEY);
      // Immediately trigger a ping when re-enabled
      sendTelemetryPing(true);
    } else {
      localStorage.setItem(OPT_OUT_KEY, 'true');
    }
  } catch {
    // Ignore storage errors
  }
}

/**
 * Retrieves or generates an anonymous installation UUID.
 */
export function getAnonymousUserId() {
  try {
    let id = localStorage.getItem(USER_ID_KEY);
    if (!id) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        id = `anon_${crypto.randomUUID()}`;
      } else {
        id = `anon_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`;
      }
      localStorage.setItem(USER_ID_KEY, id);
    }
    return id;
  } catch {
    return 'anon_guest';
  }
}

/**
 * Detects the client operating system.
 */
function detectOS() {
  if (typeof navigator === 'undefined') return 'Unknown';
  const ua = navigator.userAgent || '';
  if (/windows|win32/i.test(ua)) return 'Windows';
  if (/macintosh|mac os x/i.test(ua)) return 'macOS';
  if (/linux/i.test(ua)) return 'Linux';
  if (/cros/i.test(ua)) return 'ChromeOS';
  if (/android/i.test(ua)) return 'Android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS';
  return 'Unknown';
}

/**
 * Sends a lightweight, non-blocking telemetry ping.
 * Fails completely silently if offline or if endpoint is unreachable.
 * Rate-limited to once per 12 hours unless force=true.
 */
export async function sendTelemetryPing(force = false) {
  if (!isTelemetryEnabled()) return;

  try {
    const now = Date.now();
    const lastPingStr = localStorage.getItem(LAST_PING_KEY);
    const lastPing = lastPingStr ? parseInt(lastPingStr, 10) : 0;
    
    // 12-hour debounce window (12 * 60 * 60 * 1000 = 43200000 ms)
    if (!force && lastPing && now - lastPing < 43200000) {
      return;
    }

    const payload = {
      userId: getAnonymousUserId(),
      version: APP_VERSION,
      os: detectOS(),
      timestamp: new Date().toISOString()
    };

    // Use a strict 3-second timeout so app boot is never delayed
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    fetch(TELEMETRY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    })
      .then(res => {
        clearTimeout(timeoutId);
        if (res.ok) {
          localStorage.setItem(LAST_PING_KEY, String(Date.now()));
        }
      })
      .catch(() => {
        clearTimeout(timeoutId);
        // Fail silently - never disrupt user when offline
      });
  } catch {
    // Fail silently
  }
}
