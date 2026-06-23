/**
 * localStorage persistence layer for Infinity Scholar's Hub.
 * Provides debounced save/load with type-safe fallbacks.
 * Designed to be swappable with Supabase later.
 */

const STORAGE_PREFIX = 'ish_';
const DEBOUNCE_MS = 300;

// Debounce timers per key
const debounceTimers: Record<string, ReturnType<typeof setTimeout>> = {};

/**
 * Save data to localStorage with debouncing to avoid excessive writes.
 */
export function saveState<T>(key: string, data: T): void {
  const storageKey = STORAGE_PREFIX + key;

  if (debounceTimers[storageKey]) {
    clearTimeout(debounceTimers[storageKey]);
  }

  debounceTimers[storageKey] = setTimeout(() => {
    try {
      const serialized = JSON.stringify(data);
      localStorage.setItem(storageKey, serialized);
    } catch (err) {
      console.warn(`[Storage] Failed to save "${key}":`, err);
    }
  }, DEBOUNCE_MS);
}

/**
 * Save data immediately (no debounce). Use for critical writes like auth.
 */
export function saveStateImmediate<T>(key: string, data: T): void {
  const storageKey = STORAGE_PREFIX + key;
  try {
    const serialized = JSON.stringify(data);
    localStorage.setItem(storageKey, serialized);
  } catch (err) {
    console.warn(`[Storage] Failed to save "${key}":`, err);
  }
}

/**
 * Load data from localStorage. Returns fallback if key doesn't exist or parse fails.
 */
export function loadState<T>(key: string, fallback: T): T {
  const storageKey = STORAGE_PREFIX + key;
  try {
    const serialized = localStorage.getItem(storageKey);
    if (serialized === null) return fallback;
    return JSON.parse(serialized) as T;
  } catch (err) {
    console.warn(`[Storage] Failed to load "${key}", using fallback:`, err);
    return fallback;
  }
}

/**
 * Check if a key exists in storage.
 */
export function hasState(key: string): boolean {
  return localStorage.getItem(STORAGE_PREFIX + key) !== null;
}

/**
 * Remove a specific key from storage.
 */
export function removeState(key: string): void {
  localStorage.removeItem(STORAGE_PREFIX + key);
}

/**
 * Clear ALL app data from localStorage. Used for "Reset Demo Data".
 */
export function clearAllState(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(STORAGE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

/**
 * Session management — uses sessionStorage so login survives refresh but not tab close.
 */
export function saveSession(data: { displayName: string; role: 'admin' | 'faculty'; token?: string }): void {
  try {
    sessionStorage.setItem(STORAGE_PREFIX + 'session', JSON.stringify(data));
  } catch (err) {
    console.warn('[Storage] Failed to save session:', err);
  }
}

export function loadSession(): { displayName: string; role: 'admin' | 'faculty'; token?: string } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + 'session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed.role !== 'admin' && parsed.role !== 'faculty') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  sessionStorage.removeItem(STORAGE_PREFIX + 'session');
}
