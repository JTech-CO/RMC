import { DEFAULT_MARKDOWN, SAVE_DELAY, RENDER_DELAY, MAX_INPUT_BYTES, STORAGE_KEY } from './config.js?v=2.0.2';
import { record, debounce, normalizeText, safeFilename } from './utils.js?v=2.0.2';
import { DraftStore, readSettings, writeSettings } from './storage.js?v=2.0.2';
import { loadSanitizer, loadHighlighter } from './dependencies.js?v=2.0.2';
import { Parser } from './parser.js?v=2.0.2';
import { sanitizeHtml } from './markdown.js?v=2.0.2';
import { applyFormat, updateMetadata } from './editor.js?v=2.0.2';
import { copyText, createHtmlDocument, downloadFile, loadDocumentStyles } from './export.js?v=2.0.2';
import { bindScrollSync } from './scroll-sync.js?v=2.0.2';
import { bindMenus, bindSplitter, toast, askConfirmation } from './ui.js?v=2.0.2';

const $ = id => document.getElementById(id);
const el = Object.fromEntries(['editor','filename','saveStatus','preview','previewContainer','sourceContainer','sourceCode',
  'renderStatus','outputNote','charCount','totalLines','cursor','workspace','splitter','fileInput','appStatus',
  'syncScroll','softBreaks','allowImages','conflictBanner','storageBanner','storageMessage'].map(id => [id, $(id)]));
const store = new DraftStore();
const parser = new Parser();
const settings = readSettings();
const state = { dirty: false, conflict: false, loadFailed: false, composing: false, busy: false,
  revision: 0, html: '', renderedRevision: -1, promiseRevision: -1, promise: null,
  purify: null, highlighter: null, renderError: null, view: 'preview' };
const saveSoon = debounce(flushSave, SAVE_DELAY);
const renderSoon = debounce(() => { void render(); }, RENDER_DELAY);
const closeMenus = bindMenus();

function currentDocument() { return record(el.editor.value, el.filename.value); }
function setSaveStatus(message, kind = '') { el.saveStatus.textContent = message; el.saveStatus.dataset.state = kind; }
function setHtmlEnabled(enabled) { document.querySelectorAll('[data-needs-html]').forEach(button => { button.disabled = !enabled; }); }
function showStorageError(message) { el.storageMessage.textContent = message; el.storageBanner.hidden = false; setSaveStatus('Not saved', 'error'); }
function updateMeta() { updateMetadata(el.editor, el); }

function flushSave() {
  saveSoon.cancel();
  if (!state.dirty) return true;
  if (state.conflict || state.loadFailed) return false;
  const result = store.save(currentDocument());
  if (result.ok) {
    state.dirty = false; setSaveStatus('Saved locally', 'saved'); el.storageBanner.hidden = true; return true;
  }
  if (result.reason === 'conflict') {
    state.conflict = true; el.conflictBanner.hidden = false; setSaveStatus('Save paused', 'error');
  } else showStorageError('Local save failed (storage blocked or full). Export Markdown before leaving.');
  return false;
}
function changed() {
  state.dirty = true; state.revision++; state.html = ''; setHtmlEnabled(false);
  if (!state.conflict && !state.loadFailed) setSaveStatus('Unsaved changes', 'dirty');
  updateMeta(); saveSoon();
  if (!state.composing) renderSoon();
}
function renderFailure(error) {
  state.html = ''; state.renderedRevision = -1; setHtmlEnabled(false);
  el.renderStatus.textContent = 'Preview unavailable'; el.renderStatus.dataset.error = 'true';
  const box = document.createElement('div'); box.className = 'render-error';
  const heading = document.createElement('strong'); heading.textContent = 'Your Markdown is still here.';
  const message = document.createElement('span'); message.textContent = error.message || 'Renderer unavailable.';
  box.append(heading, message); el.preview.replaceChildren(box);
  el.sourceCode.textContent = `Preview unavailable: ${message.textContent}`;
}
function render() {
  renderSoon.cancel();
  const revision = state.revision;
  if (state.renderedRevision === revision) return Promise.resolve(state.html);
  if (state.promise && state.promiseRevision === revision) return state.promise;
  if (!state.purify) {
    if (state.renderError) renderFailure(state.renderError);
    return Promise.resolve(null);
  }
  state.promiseRevision = revision;
  const text = el.editor.value;
  el.renderStatus.textContent = 'Rendering…'; el.renderStatus.dataset.error = 'false';
  const started = performance.now();
  state.promise = (async () => {
    try {
      const raw = await parser.parse(text, settings.breaks);
      if (revision !== state.revision) return null;
      const result = sanitizeHtml(raw, state.purify, state.highlighter, settings);
      if (revision !== state.revision) return null;
      const scroll = el.previewContainer.scrollTop;
      // Sanitized HTML is the sole source for preview, HTML source, copy and export.
      el.preview.innerHTML = result.html;
      el.sourceCode.textContent = result.html;
      el.previewContainer.scrollTop = scroll;
      state.html = result.html; state.renderedRevision = revision;
      el.renderStatus.textContent = `Updated · ${Math.round(performance.now() - started)} ms`;
      el.outputNote.textContent = result.blockedImages ? `${result.blockedImages} image(s) blocked · see Settings` : `Sanitized HTML · ${settings.images ? 'HTTPS images allowed' : 'external images blocked'}`;
      setHtmlEnabled(true);
      return result.html;
    } catch (error) {
      if (revision === state.revision) renderFailure(error);
      return null;
    } finally { if (state.promiseRevision === revision) state.promise = null; }
  })();
  return state.promise;
}
function setView(view) {
  state.view = view;
  // Keep the mobile switcher consistent when output tabs are used directly.
  if (el.workspace.dataset.mobile !== 'editor') {
    el.workspace.dataset.mobile = view;
    document.querySelectorAll('button[data-mobile]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mobile === view)));
  }
  el.previewContainer.hidden = view !== 'preview'; el.sourceContainer.hidden = view !== 'source';
  document.querySelectorAll('[data-view]').forEach(tab => {
    const active = tab.dataset.view === view;
    tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
  });
}
function setMobile(view) {
  el.workspace.dataset.mobile = view;
  document.querySelectorAll('[data-mobile]').forEach(button => {
    if (button.tagName === 'BUTTON') button.setAttribute('aria-pressed', String(button.dataset.mobile === view));
  });
  if (view !== 'editor') setView(view);
}

async function replaceDocument(next, title) {
  if (state.conflict || state.loadFailed) { toast('Resolve the storage warning first. Your current text is unchanged.'); return; }
  const current = currentDocument();
  if (current.content.length > 0 && !(await askConfirmation(title, 'The current document will be kept as the previous-document backup. This is a single recovery slot, not version history.'))) return;
  saveSoon.cancel();
  if (!store.backup(current).ok) { showStorageError('Backup failed. The document was not replaced. Export Markdown first.'); return; }
  const result = store.save(next);
  if (!result.ok) {
    if (result.reason === 'conflict') { state.conflict = true; el.conflictBanner.hidden = false; setSaveStatus('Save paused', 'error'); }
    else showStorageError('Saving the replacement failed. The current document has not been replaced.');
    return;
  }
  el.editor.value = next.content; el.filename.value = next.name;
  state.dirty = false; state.revision++; state.html = ''; state.renderedRevision = -1;
  setSaveStatus('Saved locally', 'saved'); setHtmlEnabled(false); updateMeta(); void render();
  setMobile('editor'); el.editor.focus(); toast('Document ready. Previous document backed up.');
}
async function openFile(file) {
  if (!file) return;
  if (!/\.(md|markdown|txt)$/i.test(file.name)) { toast('Choose a .md, .markdown or .txt file.'); return; }
  if (file.size > MAX_INPUT_BYTES) { toast('File too large. The import limit is 512 KiB.'); return; }
  if (state.busy) return;
  state.busy = true;
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    if (text.includes('\u0000')) throw new Error('This looks like a binary file. Choose a UTF-8 text file.');
    await replaceDocument(record(normalizeText(text), file.name), 'Open this document?');
  } catch (error) { toast(error instanceof TypeError ? 'The file is not valid UTF-8. Save it as UTF-8 and try again.' : error.message); }
  finally { state.busy = false; el.fileInput.value = ''; }
}
async function exportHtml(copy = false) {
  const revision = state.revision;
  const html = await render();
  if (html === null || revision !== state.revision || state.renderedRevision !== revision) {
    toast('HTML is not ready. Finish editing or check the renderer. Markdown export still works.'); return;
  }
  if (copy) { toast(await copyText(html) ? 'HTML fragment copied.' : 'Copy failed. Select the HTML source and copy it manually.'); return; }
  const styles = await loadDocumentStyles();
  if (revision !== state.revision) { toast('The document changed. Export again to use the latest version.'); return; }
  const name = safeFilename(el.filename.value, 'html');
  downloadFile(name, createHtmlDocument(html, name, styles, settings.images), 'text/html');
  toast(`Download requested: ${name}`);
}
async function resolveConflict(keepLocal) {
  if (!state.conflict) return;
  const local = currentDocument();
  const other = store.load();
  if (!other.ok) { showStorageError('The other draft could not be read. Your current text is unchanged.'); return; }
  if (!await askConfirmation(keepLocal ? 'Keep this tab’s document?' : 'Load the other draft?',
    keepLocal ? 'The other saved draft will become the recovery backup before this tab replaces it.' : 'This tab’s document will become the recovery backup before loading the other draft.')) return;
  if (!store.backup(keepLocal ? (other.document || record()) : local).ok) {
    showStorageError('Backup failed. Neither document was replaced.'); return;
  }
  if (keepLocal) {
    const result = store.save(local);
    if (!result.ok) { toast('The draft changed again or saving failed. Resolve the warning again.'); return; }
  } else {
    // Check again after an asynchronous dialog: never silently load a stale snapshot.
    const latest = store.load();
    if (!latest.ok) { toast('The saved draft could not be loaded.'); return; }
    const next = latest.document || record();
    el.editor.value = next.content; el.filename.value = next.name;
  }
  state.conflict = false; state.dirty = false; el.conflictBanner.hidden = true; el.storageBanner.hidden = true;
  setSaveStatus('Saved locally', 'saved'); state.revision++; state.html = ''; setHtmlEnabled(false); updateMeta(); void render();
}
async function action(name) {
  if (state.busy && !['export-md','copy-md'].includes(name)) return;
  switch (name) {
    case 'open': el.fileInput.click(); break;
    case 'export-md': {
      const filename = safeFilename(el.filename.value);
      downloadFile(filename, el.editor.value, 'text/markdown'); toast(`Download requested: ${filename}`); break;
    }
    case 'copy-md': toast(await copyText(el.editor.value) ? 'Markdown copied.' : 'Copy failed. Select the editor text and copy it manually.'); break;
    case 'export-html': await exportHtml(); break;
    case 'copy-html': await exportHtml(true); break;
    case 'new': state.busy = true; try { await replaceDocument(record(), 'Start a new document?'); } finally { state.busy = false; } break;
    case 'restore': {
      const backup = store.readBackup();
      if (!backup.ok) { toast('The backup is unreadable. It has not been overwritten.'); break; }
      if (backup.document === null) { toast('No previous-document backup is available yet.'); break; }
      state.busy = true; try { await replaceDocument(backup.document, 'Restore the previous document?'); } finally { state.busy = false; } break;
    }
    case 'load-other': state.busy = true; try { await resolveConflict(false); } finally { state.busy = false; } break;
    case 'keep-local': state.busy = true; try { await resolveConflict(true); } finally { state.busy = false; } break;
    case 'settings': $('settingsDialog').showModal(); break;
    case 'help': $('helpDialog').showModal(); break;
  }
}
function runAction(name) { void action(name).catch(error => { toast(error.message || 'The action could not be completed.'); }); }

// Bind first: editing and Markdown export remain usable even when external renderers fail.
el.editor.addEventListener('input', changed);
el.editor.addEventListener('compositionstart', () => { state.composing = true; renderSoon.cancel(); });
el.editor.addEventListener('compositionend', () => { state.composing = false; renderSoon(); });
for (const event of ['click','keyup','select']) el.editor.addEventListener(event, updateMeta);
el.filename.addEventListener('change', () => { el.filename.value = safeFilename(el.filename.value); state.dirty = true; setSaveStatus('Unsaved changes', 'dirty'); saveSoon(); });
el.fileInput.addEventListener('change', () => { void openFile(el.fileInput.files?.[0]); });
document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => { closeMenus(); runAction(button.dataset.action); }));
document.querySelectorAll('[data-format]').forEach(button => {
  button.addEventListener('pointerdown', event => { event.preventDefault(); });
  button.addEventListener('click', () => { closeMenus(); if (!state.composing) applyFormat(el.editor, button.dataset.format, changed); });
});
document.querySelectorAll('[data-view]').forEach(button => {
  button.addEventListener('click', () => setView(button.dataset.view));
  button.addEventListener('keydown', event => {
    if (['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) {
      event.preventDefault(); const view = event.key === 'Home' ? 'preview' : event.key === 'End' ? 'source' : state.view === 'preview' ? 'source' : 'preview';
      setView(view); $(view === 'preview' ? 'previewTab' : 'sourceTab').focus();
    }
  });
});
document.querySelectorAll('button[data-mobile]').forEach(button => button.addEventListener('click', () => setMobile(button.dataset.mobile)));
for (const [id, key] of [['syncScroll','sync'],['softBreaks','breaks'],['allowImages','images']]) {
  el[id].checked = settings[key];
  el[id].addEventListener('change', () => {
    settings[key] = el[id].checked;
    if (!writeSettings(settings)) toast('This preference could not be saved; it applies to this session only.');
    if (key !== 'sync') { state.revision++; state.html = ''; setHtmlEnabled(false); void render(); }
  });
}
bindSplitter(el.workspace, el.splitter);
bindScrollSync(el.editor, el.previewContainer, () => settings.sync && state.view === 'preview' && matchMedia('(min-width: 768px)').matches);
document.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) event.preventDefault(); });
document.addEventListener('drop', event => {
  if (!event.dataTransfer?.files.length) return;
  event.preventDefault();
  if (event.dataTransfer.files.length !== 1) { toast('Open one Markdown file at a time.'); return; }
  if (document.querySelector('dialog[open]')) return;
  void openFile(event.dataTransfer.files[0]);
});
document.addEventListener('keydown', event => {
  if (event.isComposing || state.composing || document.querySelector('dialog[open]') || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
  const key = event.key.toLowerCase();
  if (key === 's' || key === 'o') { event.preventDefault(); runAction(key === 's' ? 'export-md' : 'open'); }
  if (document.activeElement === el.editor && ['b','i','k'].includes(key)) {
    event.preventDefault(); applyFormat(el.editor, { b: 'bold', i: 'italic', k: 'link' }[key], changed);
  }
});
window.addEventListener('pagehide', flushSave);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushSave(); });
window.addEventListener('beforeunload', event => { if (state.dirty && !flushSave()) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  // Never automatically overwrite an editor, even if it currently appears clean.
  state.conflict = true; saveSoon.cancel(); el.conflictBanner.hidden = false; setSaveStatus('Save paused', 'error');
});

const loaded = store.load();
if (loaded.ok) {
  const initial = loaded.document || record(DEFAULT_MARKDOWN);
  el.editor.value = initial.content; el.filename.value = initial.name;
  setSaveStatus(loaded.document ? 'Saved locally' : 'Sample · not saved', loaded.document ? 'saved' : '');
  if (loaded.migrated) { state.dirty = true; flushSave(); }
} else {
  state.loadFailed = true; el.editor.value = ''; el.filename.value = 'untitled.md';
  showStorageError('The saved draft could not be read. It has not been overwritten. Editing and Markdown export remain available.');
}
updateMeta(); setHtmlEnabled(false);
el.appStatus.textContent = 'Local workspace';
void loadDocumentStyles().catch(() => {});
void loadHighlighter().then(highlighter => {
  state.highlighter = highlighter;
  if (state.purify) { state.revision++; state.html = ''; setHtmlEnabled(false); void render(); }
});
void loadSanitizer().then(purify => { state.purify = purify; void render(); })
  .catch(error => { state.renderError = error; renderFailure(error); });

// The independent boot watchdog distinguishes a failed module graph from a renderer/CDN error.
document.documentElement.dataset.rmcBoot = "2.0.2";
