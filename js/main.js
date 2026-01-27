import { DEFAULT_MARKDOWN, STORAGE_KEY } from './config.js';
import { loadFromStorage } from './storage.js';
import { updatePreview, highlightSourceCode } from './preview.js';
import { updateCounts, updateCursorPos } from './editor.js';
import { handleEditorScroll, handlePreviewScroll } from './scrollSync.js';
import { triggerAutoSave } from './autoSave.js';
import { toggleViewMode } from './ui.js';
import { downloadHTML, downloadMarkdown, copyToClipboard } from './export.js';

const editor = document.getElementById('editor');
const preview = document.getElementById('previewContainer');
const sourceView = document.getElementById('sourceContainer');
const sourceCode = document.getElementById('sourceCode');
const charCount = document.getElementById('charCount');
const saveStatus = document.getElementById('saveStatus');
const lineCount = document.getElementById('lineCount');
const colCount = document.getElementById('colCount');
const btnPreview = document.getElementById('btnPreview');
const btnSource = document.getElementById('btnSource');

document.addEventListener('DOMContentLoaded', () => {
    const savedContent = loadFromStorage();
    editor.value = savedContent !== null ? savedContent : DEFAULT_MARKDOWN;
    updatePreview(editor, preview, sourceCode);
    editor.addEventListener('input', handleInput);
    editor.addEventListener('scroll', () => handleEditorScroll(editor, preview));
    editor.addEventListener('click', () => updateCursorPos(editor, lineCount, colCount));
    editor.addEventListener('keyup', () => updateCursorPos(editor, lineCount, colCount));
    preview.addEventListener('scroll', () => handlePreviewScroll(editor, preview));
});

function handleInput() {
    updatePreview(editor, preview, sourceCode);
    updateCounts(editor, charCount);
    updateCursorPos(editor, lineCount, colCount);
    triggerAutoSave(editor, saveStatus);
}
window.toggleViewMode = function(mode) {
    toggleViewMode(mode, preview, sourceView, sourceCode, btnPreview, btnSource);
};

window.downloadHTML = function() {
    downloadHTML(preview);
};

window.downloadMarkdown = function() {
    downloadMarkdown(editor);
};

window.copyToClipboard = function() {
    copyToClipboard(preview);
};
