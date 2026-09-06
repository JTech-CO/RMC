import { STORAGE_KEY, BACKUP_KEY, LEGACY_KEY, LEGACY_BACKUP_KEY, SETTINGS_KEY } from './config.js';
import { record, validDocument } from './utils.js';

// The storage provider is injected so denial/quota/corruption can be tested without a browser.
export class DraftStore {
  constructor(provider = () => globalThis.localStorage) {
    this.provider = provider;
    this.baseline = null;
  }
  load() {
    try {
      const store = this.provider();
      const raw = store.getItem(STORAGE_KEY);
      this.baseline = raw;
      if (raw !== null) {
        const data = JSON.parse(raw);
        if (data.schema !== 2 || !validDocument(data)) throw new Error('Saved draft is invalid. It has not been overwritten.');
        return { ok: true, document: record(data.content, data.name), migrated: false };
      }
      const legacy = store.getItem(LEGACY_KEY);
      return { ok: true, document: legacy === null ? null : record(legacy), migrated: legacy !== null };
    } catch (error) { return { ok: false, reason: 'storage', error }; }
  }
  save(document, { force = false } = {}) {
    if (!validDocument(document)) return { ok: false, reason: 'invalid' };
    try {
      const store = this.provider();
      if (!force && store.getItem(STORAGE_KEY) !== this.baseline) return { ok: false, reason: 'conflict' };
      const raw = JSON.stringify({ ...record(document.content, document.name), schema: 2,
        revision: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, savedAt: new Date().toISOString() });
      store.setItem(STORAGE_KEY, raw);
      this.baseline = raw;
      return { ok: true };
    } catch (error) { return { ok: false, reason: 'storage', error }; }
  }
  backup(document) {
    if (!validDocument(document)) return { ok: false, reason: 'invalid' };
    try {
      this.provider().setItem(BACKUP_KEY, JSON.stringify({ ...document, schema: 2, savedAt: new Date().toISOString() }));
      return { ok: true };
    } catch (error) { return { ok: false, reason: 'storage', error }; }
  }
  readBackup() {
    try {
      const store = this.provider();
      const modern = store.getItem(BACKUP_KEY);
      if (modern !== null) {
        const data = JSON.parse(modern);
        if (data.schema !== 2 || !validDocument(data)) throw new Error('Invalid backup');
        return { ok: true, document: record(data.content, data.name) };
      }
      const old = store.getItem(LEGACY_BACKUP_KEY);
      if (old === null) return { ok: true, document: null };
      const data = JSON.parse(old);
      if (typeof data?.content !== 'string') throw new Error('Invalid legacy backup');
      return { ok: true, document: record(data.content) };
    } catch (error) { return { ok: false, reason: 'storage', error }; }
  }
}
export function readSettings(provider = () => globalThis.localStorage) {
  try {
    const data = JSON.parse(provider().getItem(SETTINGS_KEY) || '{}');
    return { sync: data.sync !== false, images: data.images === true, breaks: data.breaks !== false };
  } catch { return { sync: true, images: false, breaks: true }; }
}
export function writeSettings(settings, provider = () => globalThis.localStorage) {
  try { provider().setItem(SETTINGS_KEY, JSON.stringify(settings)); return true; }
  catch { return false; }
}
