import { DEFAULT_MARKDOWN } from './config.js';
import {
    loadBackupFromStorage,
    loadFromStorage,
    saveBackupToStorage,
    saveToStorage,
} from './storage.js';
import { updatePreview } from './preview.js';
import { updateCounts, updateCursorPos } from './editor.js';
import { handleEditorScroll, handlePreviewScroll } from './scrollSync.js';
import { triggerAutoSave } from './autoSave.js';
import { showToast, toggleViewMode } from './ui.js';
import { downloadHTML, downloadMarkdown, copyToClipboard } from './export.js';

const elements = {};
const appState = {
    currentHtml: '',
    viewMode: 'preview',
    lastRenderErrorMessage: '',
};

document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
    cacheElements();
    bindEvents();

    const savedContent = loadFromStorage();
    elements.editor.value = savedContent !== null ? savedContent : DEFAULT_MARKDOWN;

    renderMarkdownSafely();
    updateEditorMeta();
}

function cacheElements() {
    Object.assign(elements, {
        editor: getElement('editor'),
        preview: getElement('previewContainer'),
        sourceView: getElement('sourceContainer'),
        sourceCode: getElement('sourceCode'),
        charCount: getElement('charCount'),
        saveStatus: getElement('saveStatus'),
        lineCount: getElement('lineCount'),
        colCount: getElement('colCount'),
        btnPreview: getElement('btnPreview'),
        btnSource: getElement('btnSource'),
        confirmDialog: getElement('confirmDialog'),
        menuTriggers: document.querySelectorAll('[data-menu-trigger]'),
        menuPanels: document.querySelectorAll('[data-menu-panel]'),
        dialogActions: document.querySelectorAll('[data-dialog-action]'),
    });
}

function getElement(id) {
    const element = document.getElementById(id);
    if (!element) {
        throw new Error(`Missing required element: ${id}`);
    }

    return element;
}

function bindEvents() {
    elements.editor.addEventListener('input', handleInput);
    elements.editor.addEventListener('scroll', () => handleEditorScroll(elements.editor, elements.preview));
    elements.editor.addEventListener('click', updateEditorMeta);
    elements.editor.addEventListener('keyup', updateEditorMeta);
    elements.preview.addEventListener('scroll', () => handlePreviewScroll(elements.editor, elements.preview));

    document.querySelectorAll('[data-action]').forEach((button) => {
        button.addEventListener('click', handleAction);
    });

    document.querySelectorAll('[data-view-mode]').forEach((button) => {
        button.addEventListener('click', () => setViewMode(button.dataset.viewMode));
    });

    elements.menuTriggers.forEach((button) => {
        button.addEventListener('click', handleMenuTrigger);
    });

    elements.dialogActions.forEach((button) => {
        button.addEventListener('click', handleDialogAction);
    });

    document.addEventListener('click', closeMenus);
    document.addEventListener('keydown', handleGlobalKeydown);
}

function handleInput() {
    renderMarkdownSafely();
    updateEditorMeta();
    triggerAutoSave(elements.editor, elements.saveStatus);
}

function renderMarkdownSafely() {
    try {
        renderMarkdown();
        appState.lastRenderErrorMessage = '';
        return true;
    } catch (error) {
        handleRenderError(error);
        return false;
    }
}

function renderMarkdown() {
    const result = updatePreview(
        elements.editor.value,
        elements.preview,
        elements.sourceCode,
        elements.sourceView
    );

    appState.currentHtml = result.html;
}

function handleRenderError(error) {
    const message = error instanceof Error ? error.message : 'Unknown render error';
    console.error('Markdown render failed', error);

    appState.currentHtml = '';
    elements.preview.innerHTML = `<div class="m-4 border border-red-900 bg-red-950/40 p-4 text-sm text-red-100">
        <strong>Preview unavailable</strong>
        <p class="mt-2 text-red-200">${escapeHtml(message)}</p>
    </div>`;
    elements.sourceCode.textContent = `Preview unavailable\n${message}`;

    if (appState.lastRenderErrorMessage !== message) {
        showToast('Preview unavailable');
    }
    appState.lastRenderErrorMessage = message;
}

function updateEditorMeta() {
    updateCounts(elements.editor, elements.charCount);
    updateCursorPos(elements.editor, elements.lineCount, elements.colCount);
}

function setViewMode(mode) {
    if (mode !== 'preview' && mode !== 'source') return;

    appState.viewMode = mode;
    toggleViewMode(
        mode,
        elements.preview,
        elements.sourceView,
        elements.sourceCode,
        elements.btnPreview,
        elements.btnSource
    );
    closeMenus();
}

function handleAction(event) {
    const action = event.currentTarget.dataset.action;
    closeMenus();

    if (action === 'download-html') {
        renderMarkdownSafely();
        downloadHTML(appState.currentHtml);
        return;
    }

    if (action === 'download-markdown') {
        downloadMarkdown(elements.editor.value);
        return;
    }

    if (action === 'copy-html') {
        renderMarkdownSafely();
        copyToClipboard(appState.currentHtml);
        return;
    }

    if (action === 'new-document') {
        createNewDocument();
        return;
    }

    if (action === 'restore-backup') {
        restoreBackup();
        return;
    }

    if (action === 'insert-bold') {
        insertMarkdownAroundSelection('**', '**', 'bold text');
        return;
    }

    if (action === 'insert-italic') {
        insertMarkdownAroundSelection('*', '*', 'italic text');
        return;
    }

    if (action === 'insert-link') {
        insertMarkdownAroundSelection('[', '](https://example.com)', 'link text');
        return;
    }

    if (action === 'insert-code-block') {
        insertMarkdownAroundSelection('```javascript\n', '\n```', 'console.log("Hello, R.M.C.");');
        return;
    }

    if (action === 'focus-editor') {
        elements.editor.focus();
        return;
    }

    if (action === 'focus-preview') {
        setViewMode('preview');
        elements.preview.focus();
    }
}

function handleMenuTrigger(event) {
    event.stopPropagation();

    const menuName = event.currentTarget.dataset.menuTrigger;
    const isOpen = event.currentTarget.getAttribute('aria-expanded') === 'true';
    closeMenus();

    if (!isOpen) {
        openMenu(menuName);
    }
}

function handleGlobalKeydown(event) {
    if (event.key === 'Escape') {
        closeConfirmDialog();
        closeMenus();
    }
}

function openMenu(menuName) {
    const trigger = document.querySelector(`[data-menu-trigger="${menuName}"]`);
    const panel = document.querySelector(`[data-menu-panel="${menuName}"]`);

    if (!trigger || !panel) return;

    trigger.setAttribute('aria-expanded', 'true');
    panel.classList.remove('hidden');
}

function closeMenus() {
    elements.menuTriggers.forEach((button) => {
        button.setAttribute('aria-expanded', 'false');
    });

    elements.menuPanels.forEach((panel) => {
        panel.classList.add('hidden');
    });
}

function createNewDocument() {
    if (elements.editor.value.trim().length > 0) {
        openConfirmDialog();
        return;
    }

    startNewDocument();
}

function startNewDocument() {
    const previousContent = elements.editor.value;
    if (previousContent.length > 0) {
        saveBackupToStorage(previousContent);
    }

    elements.editor.value = '';
    saveToStorage('');
    renderMarkdownSafely();
    updateEditorMeta();
    elements.editor.focus();
    showToast('New document ready');
}

function restoreBackup() {
    const backup = loadBackupFromStorage();

    if (!backup?.content) {
        showToast('No backup found');
        return;
    }

    elements.editor.value = backup.content;
    saveToStorage(backup.content);
    renderMarkdownSafely();
    updateEditorMeta();
    elements.editor.focus();
    showToast('Backup restored');
}

function handleDialogAction(event) {
    const action = event.currentTarget.dataset.dialogAction;

    if (action === 'confirm-new-document') {
        closeConfirmDialog();
        startNewDocument();
        return;
    }

    closeConfirmDialog();
    elements.editor.focus();
}

function openConfirmDialog() {
    elements.confirmDialog.classList.remove('hidden');
    elements.confirmDialog.classList.add('flex');
    const confirmButton = elements.confirmDialog.querySelector('[data-dialog-action="confirm-new-document"]');
    confirmButton?.focus();
}

function closeConfirmDialog() {
    elements.confirmDialog.classList.add('hidden');
    elements.confirmDialog.classList.remove('flex');
}

function insertMarkdownAroundSelection(prefix, suffix, placeholder) {
    const { editor } = elements;
    const selectionStart = editor.selectionStart;
    const selectionEnd = editor.selectionEnd;
    const selectedText = editor.value.slice(selectionStart, selectionEnd);
    const hasSelection = selectedText.length > 0;
    const insertedText = `${prefix}${hasSelection ? selectedText : placeholder}${suffix}`;

    editor.setRangeText(insertedText, selectionStart, selectionEnd, 'end');

    if (!hasSelection) {
        const placeholderStart = selectionStart + prefix.length;
        const placeholderEnd = placeholderStart + placeholder.length;
        editor.setSelectionRange(placeholderStart, placeholderEnd);
    }

    editor.focus();
    handleInput();
}

function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
