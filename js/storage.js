import { STORAGE_KEY } from './config.js';

export function loadFromStorage() {
    return localStorage.getItem(STORAGE_KEY);
}

export function saveToStorage(content) {
    localStorage.setItem(STORAGE_KEY, content);
}
