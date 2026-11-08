import { initialState } from './reducer';
import { validateParam } from './menus';
import type { MixerState, Snapshot } from './types';

const storageKey = 'mixer-plus.v1';
export interface MediaAsset { id: string; name: string; blob: Blob; type: string }
function validScene(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const scene = value as Record<string, unknown>;
  return ['IN1', 'IN2', 'IN3', 'IN4', 'PAT', 'E-STOP'].includes(String(scene.source)) && ['pip', 'chroma', 'luma'].every(k => typeof scene[k] === 'boolean');
}
function validSnapshot(value: unknown): value is Snapshot {
  if (!value || typeof value !== 'object') return false;
  const snap = value as Snapshot;
  return validScene(snap.pgm) && validScene(snap.pvw) && !!snap.params && !!snap.assets && !!snap.downstream && ['pgm', 'pvw'].every(bus => ['dsk', 'logo'].every(effect => typeof (snap.downstream as any)[bus]?.[effect] === 'boolean'));
}
export function restore(): MixerState {
  const fresh = initialState();
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return fresh;
    const saved = JSON.parse(raw);
    if (saved.schemaVersion !== 1) return { ...fresh, notice: 'Saved data uses a different version. It has been left untouched.' };
    if (saved.params && typeof saved.params === 'object') for (const [id, value] of Object.entries(saved.params)) {
      const valid = validateParam(id, value as any);
      if (valid !== undefined) fresh.params[id] = valid;
    }
    if (saved.assets && typeof saved.assets === 'object') fresh.assets = Object.fromEntries(Object.entries(saved.assets).filter(([slot, id]) => /^(IN[1-4]|PAT[12]|LOGO[1-4])$/.test(slot) && typeof id === 'string')) as Record<string, string>;
    if (Array.isArray(saved.memories)) fresh.memories = [0, 1, 2, 3].map(i => validSnapshot(saved.memories[i]) ? { ...saved.memories[i], params: Object.fromEntries(Object.entries(saved.memories[i].params).filter(([id, value]) => validateParam(id, value as any) !== undefined)) } : null);
    if (Array.isArray(saved.presets) && saved.presets.length === 4) fresh.presets = saved.presets.map((slots: unknown) => Array.isArray(slots) ? [0, 1, 2, 3].map(i => {
      const c = slots[i];
      return c && ['x', 'y', 'zoom'].every(k => Number.isFinite(c[k])) && c.x >= 0 && c.x <= 100 && c.y >= 0 && c.y <= 100 && c.zoom >= 1 && c.zoom <= 4 ? c : null;
    }) : [null, null, null, null]);
    fresh.notice = 'Saved settings restored. Press Start practice for audio.';
  } catch { fresh.notice = 'Could not read saved settings. Starting with defaults.'; }
  return fresh;
}
export function persist(state: MixerState): void {
  const existing = localStorage.getItem(storageKey);
  if (existing) {
    const parsed = JSON.parse(existing);
    if (parsed.schemaVersion !== 1) throw new Error('Saved settings from another version were preserved.');
  }
  localStorage.setItem(storageKey, JSON.stringify({ schemaVersion: 1, params: state.params, memories: state.memories, assets: state.assets, presets: state.presets }));
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('mixer-plus-media', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('assets', { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export async function saveAsset(file: File): Promise<MediaAsset> {
  const asset = { id: crypto.randomUUID(), name: file.name, blob: file, type: file.type || (/\.bmp$/i.test(file.name) ? 'image/bmp' : '') };
  const db = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      tx.objectStore('assets').put(asset);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
    return asset;
  } finally { db.close(); }
}
export async function loadAssets(): Promise<MediaAsset[]> {
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction('assets').objectStore('assets').getAll();
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
