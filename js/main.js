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
import { cancelAutoSave, triggerAutoSave } from './autoSave.js';
import { showToast, toggleViewMode } from './ui.js';
import { downloadHTML, downloadMarkdown, copyToClipboard } from './export.js';

const JTECH_HOME_URL = 'https://jtech-co.github.io/';
const JTECH_REDIRECT_DELAY_MS = 2000;
const ACTION_FEEDBACK_DURATION_MS = 900;

const elements = {};
const appState = {
    currentHtml: '',
    viewMode: 'preview',
    lastRenderErrorMessage: '',
    redirectTimerId: null,
};
const actionFeedbackTimers = new WeakMap();

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

async function handleAction(event) {
    event.preventDefault();

    const control = event.currentTarget;
    const action = event.currentTarget.dataset.action;
    closeMenus();

    if (action === 'download-html') {
        renderMarkdownSafely();
        downloadHTML(appState.currentHtml);
        flashActionFeedback(control);
        return;
    }

    if (action === 'download-markdown') {
        downloadMarkdown(elements.editor.value);
        flashActionFeedback(control);
        return;
    }

    if (action === 'copy-html') {
        renderMarkdownSafely();
        if (await copyToClipboard(appState.currentHtml, 'HTML copied to clipboard')) {
            flashActionFeedback(control, 'Copied!');
        }
        return;
    }

    if (action === 'copy-markdown') {
        if (await copyToClipboard(elements.editor.value, 'Markdown copied to clipboard')) {
            flashActionFeedback(control, 'Copied!');
        }
        return;
    }

    if (action === 'open-jtech-home') {
        prepareJtechRedirect(control);
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

}

function flashActionFeedback(control, temporaryLabel = '') {
    const icon = control.querySelector('i');
    const label = control.querySelector('[data-action-label]');

    if (actionFeedbackTimers.has(control)) {
        clearTimeout(actionFeedbackTimers.get(control));
    }

    if (label && !control.dataset.feedbackOriginalLabel) {
        control.dataset.feedbackOriginalLabel = label.textContent;
    }

    if (icon && !control.dataset.feedbackIconWasGreen) {
        control.dataset.feedbackIconWasGreen = String(icon.classList.contains('text-green-400'));
    }

    if (temporaryLabel && label) {
        label.textContent = temporaryLabel;
    }

    icon?.classList.add('text-green-400');

    const timerId = setTimeout(() => {
        if (temporaryLabel && label) {
            label.textContent = control.dataset.feedbackOriginalLabel ?? label.textContent;
        }

        if (control.dataset.feedbackIconWasGreen !== 'true') {
            icon?.classList.remove('text-green-400');
        }

        delete control.dataset.feedbackOriginalLabel;
        delete control.dataset.feedbackIconWasGreen;
        actionFeedbackTimers.delete(control);
    }, ACTION_FEEDBACK_DURATION_MS);

    actionFeedbackTimers.set(control, timerId);
}

function prepareJtechRedirect(control) {
    if (appState.redirectTimerId) {
        clearTimeout(appState.redirectTimerId);
    }

    cancelAutoSave();
    saveToStorage(elements.editor.value);

    elements.editor.value = createJtechRedirectMarkdown();
    renderMarkdownSafely();
    updateEditorMeta();
    setViewMode('preview');
    flashActionFeedback(control);
    showToast('JTech main page redirecting');

    appState.redirectTimerId = setTimeout(() => {
        window.location.assign(JTECH_HOME_URL);
    }, JTECH_REDIRECT_DELAY_MS);
}

function createJtechRedirectMarkdown() {
    const createdAt = new Date().toLocaleString('ko-KR', {
        hour12: false,
        timeZone: 'Asia/Seoul',
    });

    return `# JTech 메인페이지로 이동합니다

> R.M.C. redirect handoff initialized. 이 화면은 로컬 저장소에 기록되지 않는 임시 안내 문서입니다.

## Navigation Manifest

| Field | Value |
|---|---|
| Destination | [https://jtech-co.github.io/](${JTECH_HOME_URL}) |
| Method | delayed client-side navigation |
| Countdown | 2 seconds |
| Persistence | temporary preview only |
| Generated At | ${createdAt} |

## Redirect Pipeline

- [x] Preserve current Markdown document in local storage
- [x] Inject temporary Markdown into editor surface
- [x] Render live preview from Markdown source
- [ ] Transfer browser location to JTech main page

\`\`\`yaml
redirect:
  origin: R.M.C.
  target: ${JTECH_HOME_URL}
  delay_ms: ${JTECH_REDIRECT_DELAY_MS}
  storage_policy: transient-preview
  status: pending-navigation
\`\`\`

\`\`\`http
GET / HTTP/2
Host: jtech-co.github.io
Accept: text/html,application/xhtml+xml
Purpose: JTech mainpage handoff
\`\`\`

**JTech 메인페이지로 이동합니다.**`;
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
