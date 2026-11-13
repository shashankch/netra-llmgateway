import { useState, useEffect } from 'react';
import pkg from '../../package.json';

export const CONSOLE_VERSION = pkg.version || '0.7.1';

/**
 * NETRA Operations Console - Gateway API Configuration
 * 
 * Supports flexible multi-tier gateway URL resolution:
 * 1. Runtime override via localStorage ('netra_gateway_url')
 * 2. Build-time Environment Variable (import.meta.env.VITE_GATEWAY_URL)
 * 3. Default relative path ('') for local dev proxy and reverse proxy path rewrites
 */

export function normalizeGatewayUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim().replace(/\/+$/, '');
  // Sanitize common operator copy-paste errors (e.g. pasting full completions or v1 path)
  if (trimmed.endsWith('/v1/chat/completions')) {
    trimmed = trimmed.slice(0, -'/v1/chat/completions'.length);
  } else if (trimmed.endsWith('/chat/completions')) {
    trimmed = trimmed.slice(0, -'/chat/completions'.length);
  } else if (trimmed.endsWith('/v1')) {
    trimmed = trimmed.slice(0, -'/v1'.length);
  }
  return trimmed.replace(/\/+$/, '');
}

export function getGatewayBaseUrl() {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('netra_gateway_url');
    if (custom && custom.trim()) {
      return normalizeGatewayUrl(custom);
    }
  }
  const envUrl = (import.meta.env.VITE_GATEWAY_URL || '').trim();
  return envUrl ? normalizeGatewayUrl(envUrl) : '';
}

/**
 * Resolves the build-time or Vercel environment variable for NETRA_ADMIN_TOKEN.
 * Supports VITE_NETRA_ADMIN_TOKEN, NETRA_ADMIN_TOKEN, and VITE_ADMIN_TOKEN.
 */
export function getEnvAdminToken() {
  const envToken = (
    import.meta.env.VITE_NETRA_ADMIN_TOKEN ||
    import.meta.env.NETRA_ADMIN_TOKEN ||
    import.meta.env.VITE_ADMIN_TOKEN ||
    ''
  ).trim();
  return envToken;
}

/**
 * Multi-tier Admin Token resolution:
 * 1. Runtime override via localStorage ('netra_admin_token')
 * 2. Build-time / Vercel Environment Variable (NETRA_ADMIN_TOKEN / VITE_NETRA_ADMIN_TOKEN)
 * 3. Default demo sandbox token ('netra-admin-demo')
 */
export function getDefaultAdminToken() {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem('netra_admin_token');
    if (custom && custom.trim()) {
      return custom.trim();
    }
  }
  const envToken = getEnvAdminToken();
  return envToken || 'netra-admin-demo';
}

export function setGatewayBaseUrl(url) {
  if (typeof window !== 'undefined') {
    const normalized = normalizeGatewayUrl(url);
    if (!normalized) {
      localStorage.removeItem('netra_gateway_url');
    } else {
      localStorage.setItem('netra_gateway_url', normalized);
    }
    window.dispatchEvent(new Event('netra-gateway-url-changed'));
  }
}

/**
 * React hook that reactively subscribes to runtime gateway URL changes.
 * Ensures SSE streams, pollers, and API requests update immediately upon config save.
 */
export function useGatewayUrl() {
  const [gatewayUrl, setGatewayUrl] = useState(() => getGatewayBaseUrl());

  useEffect(() => {
    const handleUrlChange = () => {
      setGatewayUrl(getGatewayBaseUrl());
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('netra-gateway-url-changed', handleUrlChange);
      return () => {
        window.removeEventListener('netra-gateway-url-changed', handleUrlChange);
      };
    }
  }, []);

  return gatewayUrl;
}

export function getApiUrl(path) {
  const base = getGatewayBaseUrl();
  let cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (base) {
    // If base ends with /v1 and path starts with /v1/, deduplicate cleanly
    if (base.endsWith('/v1') && cleanPath.startsWith('/v1/')) {
      cleanPath = cleanPath.slice(3);
    }
    return `${base}${cleanPath}`;
  }
  return cleanPath;
}

// ============================================================================
// Production Health Monitor & Free-Tier Friendly Adaptive Probe
// ============================================================================

export function isHealthPollingEnabled() {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('netra_health_poll_enabled') === 'true';
  }
  return false;
}

export function setHealthPollingEnabled(enabled) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('netra_health_poll_enabled', String(Boolean(enabled)));
    window.dispatchEvent(new Event('netra-health-poll-changed'));
  }
}

// Singleton state across all console components with SessionStorage Stale-While-Revalidate caching
function getInitialHealth() {
  if (typeof window !== 'undefined') {
    try {
      const stored = sessionStorage.getItem('netra_gateway_health_cache');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && typeof parsed.isOnline === 'boolean' && Date.now() - (parsed.lastChecked || 0) < 60000) {
          return {
            ...parsed,
            isChecking: false,
            isPollingEnabled: isHealthPollingEnabled(),
            consecutiveFailures: 0,
            version: parsed.version || CONSOLE_VERSION,
          };
        }
      }
    } catch (e) {
      // ignore
    }
  }
  return {
    isOnline: false,
    isChecking: false,
    isPollingEnabled: isHealthPollingEnabled(),
    lastChecked: null,
    latencyMs: null,
    consecutiveFailures: 0,
    version: CONSOLE_VERSION,
  };
}

function saveHealthCache(h) {
  if (typeof window !== 'undefined' && h && h.lastChecked) {
    try {
      sessionStorage.setItem('netra_gateway_health_cache', JSON.stringify({
        isOnline: h.isOnline,
        lastChecked: h.lastChecked,
        latencyMs: h.latencyMs,
        version: h.version,
      }));
    } catch (e) {
      // ignore
    }
  }
}

let currentHealth = getInitialHealth();

let inFlightHealthPromise = null;
const healthListeners = new Set();
let healthPollTimer = null;

function notifyListeners() {
  healthListeners.forEach(listener => {
    try {
      listener(currentHealth);
    } catch (e) {
      // ignore
    }
  });
}

function stopPoller() {
  if (healthPollTimer) {
    clearTimeout(healthPollTimer);
    healthPollTimer = null;
  }
}

function scheduleNextProbe(delayMs) {
  stopPoller();
  if (!isHealthPollingEnabled()) return;

  // Compute adaptive delay: base 30s, back off exponentially on errors to protect free tier
  let nextDelay = delayMs;
  if (!nextDelay) {
    if (currentHealth.consecutiveFailures === 0) {
      nextDelay = 30000; // 30s healthy baseline
    } else if (currentHealth.consecutiveFailures === 1) {
      nextDelay = 45000; // 45s first backoff
    } else if (currentHealth.consecutiveFailures === 2) {
      nextDelay = 60000; // 60s second backoff
    } else {
      nextDelay = 120000; // 2 minutes deep backoff to avoid waking sleeping free tier VMs
    }
  }

  healthPollTimer = setTimeout(async () => {
    // Page Visibility API check: do NOT wake sleeping instance if operator tab is hidden
    if (typeof document !== 'undefined' && document.hidden) {
      scheduleNextProbe(30000);
      return;
    }
    await checkGatewayHealth();
  }, nextDelay);
}

/**
 * Actively probes GET /health against the active gateway endpoint.
 * Respects timeout, parses version, measures latency, and triggers adaptive backoff.
 */
export async function checkGatewayHealth() {
  if (inFlightHealthPromise) {
    return inFlightHealthPromise;
  }

  inFlightHealthPromise = (async () => {
    const url = getApiUrl('/health');
    currentHealth = { ...currentHealth, isChecking: true };
    notifyListeners();

    const probeStart = performance.now();
    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timeoutId = controller ? setTimeout(() => controller.abort(), 3500) : null;

      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller ? controller.signal : undefined,
      });

      if (timeoutId) clearTimeout(timeoutId);
      const roundTripMs = Math.round(performance.now() - probeStart);

      if (res.ok) {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('text/html')) {
          currentHealth = {
            isOnline: false,
            isChecking: false,
            isPollingEnabled: isHealthPollingEnabled(),
            lastChecked: Date.now(),
            latencyMs: null,
            consecutiveFailures: (currentHealth.consecutiveFailures || 0) + 1,
            version: CONSOLE_VERSION,
          };
        } else {
          const data = await res.json().catch(() => ({}));
          const isHealthy = data.status === 'ok' || data.status === 'UP' || res.status === 200;
          currentHealth = {
            isOnline: isHealthy,
            isChecking: false,
            isPollingEnabled: isHealthPollingEnabled(),
            lastChecked: Date.now(),
            latencyMs: roundTripMs,
            consecutiveFailures: isHealthy ? 0 : (currentHealth.consecutiveFailures || 0) + 1,
            version: data.version || CONSOLE_VERSION,
          };
        }
      } else {
        currentHealth = {
          isOnline: false,
          isChecking: false,
          isPollingEnabled: isHealthPollingEnabled(),
          lastChecked: Date.now(),
          latencyMs: null,
          consecutiveFailures: (currentHealth.consecutiveFailures || 0) + 1,
          version: CONSOLE_VERSION,
        };
      }
    } catch (err) {
      currentHealth = {
        isOnline: false,
        isChecking: false,
        isPollingEnabled: isHealthPollingEnabled(),
        lastChecked: Date.now(),
        latencyMs: null,
        consecutiveFailures: (currentHealth.consecutiveFailures || 0) + 1,
        version: CONSOLE_VERSION,
      };
    } finally {
      inFlightHealthPromise = null;
    }

    saveHealthCache(currentHealth);
    notifyListeners();

    // Schedule next adaptive probe if enabled
    if (isHealthPollingEnabled()) {
      scheduleNextProbe();
    } else {
      stopPoller();
    }

    return currentHealth;
  })();

  return inFlightHealthPromise;
}

/**
 * React hook that subscribes to live gateway reachability and /health telemetry.
 * Fully compliant with Cloud Free Tier best practices:
 * - Uses Page Visibility API: halts completely when tab is hidden or backgrounded.
 * - Exponential backoff: avoids flooding cold or sleeping instances (Render, Fly, OCI).
 * - Operator toggle: can be paused or re-enabled on demand with zero background churn.
 */
export function useGatewayHealth() {
  const [health, setHealth] = useState(currentHealth);

  useEffect(() => {
    const listener = (h) => setHealth({ ...h });
    healthListeners.add(listener);

    // Always execute at least one initial check on mount to establish live connectivity
    if (!currentHealth.lastChecked || Date.now() - currentHealth.lastChecked > 10000) {
      checkGatewayHealth();
    } else if (isHealthPollingEnabled()) {
      scheduleNextProbe();
    }

    const handleUrlOrToggleChange = () => {
      const enabled = isHealthPollingEnabled();
      currentHealth = { ...currentHealth, isPollingEnabled: enabled };
      notifyListeners();
      if (enabled) {
        checkGatewayHealth();
      } else {
        stopPoller();
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (!document.hidden && isHealthPollingEnabled()) {
        // Tab restored: probe once to refresh UI state then resume normal loop
        checkGatewayHealth();
      } else if (document.hidden) {
        stopPoller();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('netra-gateway-url-changed', handleUrlOrToggleChange);
      window.addEventListener('netra-health-poll-changed', handleUrlOrToggleChange);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      healthListeners.delete(listener);
      if (healthListeners.size === 0) {
        stopPoller();
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('netra-gateway-url-changed', handleUrlOrToggleChange);
        window.removeEventListener('netra-health-poll-changed', handleUrlOrToggleChange);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, []);

  const togglePolling = (enabled) => {
    setHealthPollingEnabled(enabled);
  };

  return {
    ...health,
    checkNow: checkGatewayHealth,
    togglePolling,
  };
}
