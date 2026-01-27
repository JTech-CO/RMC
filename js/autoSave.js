import { saveToStorage } from './storage.js';
import { AUTO_SAVE_DELAY, SAVE_STATUS_DISPLAY_TIME, STORAGE_KEY } from './config.js';
import { updateSaveStatus } from './ui.js';

let autoSaveTimer = null;

export function triggerAutoSave(editor, saveStatusElement) {
    updateSaveStatus(saveStatusElement, false);
    if (autoSaveTimer) clearTimeout(autoSaveTimer);

    autoSaveTimer = setTimeout(() => {
        saveToStorage(editor.value);
        updateSaveStatus(saveStatusElement, true);
        setTimeout(() => {
            updateSaveStatus(saveStatusElement, false);
        }, SAVE_STATUS_DISPLAY_TIME);
    }, AUTO_SAVE_DELAY);
}
