import { Preset } from '../types/editor';

const FAVORITES_KEY = 'lumaforge_preset_favorites';
const RECENT_KEY = 'lumaforge_preset_recent';
const MAX_RECENT = 10;

export function getFavoritePresetIds(): Set<string> {
  if (typeof window === 'undefined' || !window.localStorage) return new Set();
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const list = JSON.parse(raw);
    return new Set(Array.isArray(list) ? list : []);
  } catch {
    return new Set();
  }
}

export function saveFavoritePresetIds(favorites: Set<string>): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(favorites)));
  } catch (err) {
    console.error('Failed to save preset favorites:', err);
  }
}

export function toggleFavoritePresetId(id: string): Set<string> {
  const current = getFavoritePresetIds();
  if (current.has(id)) {
    current.delete(id);
  } else {
    current.add(id);
  }
  saveFavoritePresetIds(current);
  return current;
}

export function getRecentlyUsedPresetIds(): string[] {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function markPresetAsRecentlyUsed(id: string): string[] {
  const current = getRecentlyUsedPresetIds().filter((existing) => existing !== id);
  const updated = [id, ...current].slice(0, MAX_RECENT);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save recent presets:', err);
    }
  }
  return updated;
}
