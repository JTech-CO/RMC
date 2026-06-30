import { saveToStorage } from './storage.js';
import { AUTO_SAVE_DELAY, SAVE_STATUS_DISPLAY_TIME } from './config.js';
import { updateSaveStatus } from './ui.js';

let autoSaveTimer = null;

export function triggerAutoSave(editor, saveStatusElement) {
    updateSaveStatus(saveStatusElement, false);
    if (autoSaveTimer) clearTimeout(autoSaveTimer);

    autoSaveTimer = setTimeout(() => {
        if (saveToStorage(editor.value)) {
            updateSaveStatus(saveStatusElement, true);
            setTimeout(() => {
                updateSaveStatus(saveStatusElement, false);
            }, SAVE_STATUS_DISPLAY_TIME);
        }
        autoSaveTimer = null;
    }, AUTO_SAVE_DELAY);
}

export function cancelAutoSave() {
    if (!autoSaveTimer) return;

    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
}
