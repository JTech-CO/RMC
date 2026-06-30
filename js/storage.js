import { BACKUP_STORAGE_KEY, STORAGE_KEY } from './config.js';

export function loadFromStorage() {
    try {
        return localStorage.getItem(STORAGE_KEY);
    } catch (error) {
        console.warn('Unable to load saved content.', error);
        return null;
    }
}

export function saveToStorage(content) {
    try {
        localStorage.setItem(STORAGE_KEY, content);
        return true;
    } catch (error) {
        console.warn('Unable to save content.', error);
        return false;
    }
}

export function loadBackupFromStorage() {
    try {
        const serializedBackup = localStorage.getItem(BACKUP_STORAGE_KEY);
        return serializedBackup ? JSON.parse(serializedBackup) : null;
    } catch (error) {
        console.warn('Unable to load backup content.', error);
        return null;
    }
}

export function saveBackupToStorage(content) {
    try {
        localStorage.setItem(BACKUP_STORAGE_KEY, JSON.stringify({
            content,
            savedAt: new Date().toISOString(),
        }));
        return true;
    } catch (error) {
        console.warn('Unable to save backup content.', error);
        return false;
    }
}

export function clearBackupFromStorage() {
    try {
        localStorage.removeItem(BACKUP_STORAGE_KEY);
        return true;
    } catch (error) {
        console.warn('Unable to clear backup content.', error);
        return false;
    }
}
