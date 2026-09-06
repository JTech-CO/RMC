import { escapeHtml, safeFilename } from './utils.js?v=2.0.2';
let stylesPromise;
export function loadDocumentStyles() {
  return stylesPromise ??= fetch(new URL('../css/document.css?v=2.0.2', import.meta.url))
    .then(response => { if (!response.ok) throw new Error('Document styles could not load.'); return response.text(); })
    .catch(error => { stylesPromise = null; throw error; });
}
export function createHtmlDocument(html, name, styles, images = false) {
  const title = escapeHtml(safeFilename(name).replace(/\.md$/, ''));
  return `<!doctype html>\n<html lang="en"><head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta name="referrer" content="no-referrer">\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:${images ? ' https:' : ''}; base-uri 'none'; form-action 'none'">\n<title>${title}</title>\n<style>\n${styles.replace(/<\/style/gi, '<\\/style')}\n</style>\n</head>\n<body class="export-document"><article class="markdown-body">${html}</article></body>\n</html>\n`;
}
export function downloadFile(name, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.append(link);
  try { link.click(); } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000); }
}
export async function copyText(text) {
  if (navigator.clipboard && globalThis.isSecureContext) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* Try the legacy clipboard path. */ }
  }
  const active = document.activeElement;
  const range = active instanceof HTMLTextAreaElement ? [active.selectionStart, active.selectionEnd] : null;
  const area = document.createElement('textarea');
  area.value = text; area.className = 'clipboard-helper'; area.setAttribute('readonly', '');
  document.body.append(area); area.select();
  try { return document.execCommand('copy') === true; }
  catch { return false; }
  finally { area.remove(); active?.focus({ preventScroll: true }); if (range) active.setSelectionRange(...range); }
}
