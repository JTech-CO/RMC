export function escapeHtml(value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}
export function normalizeText(value) {
  return String(value).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}
export function safeFilename(value, extension = 'md') {
  const base = String(value ?? '').normalize('NFC').replace(/\.(md|markdown|txt|html?)$/i, '')
    .replace(/[<>:"/\\|?*\u0000-\u001F\u007F]/g, '-').replace(/[.\s]+$/g, '').trim().slice(0, 100);
  const safe = !base || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base) ? 'untitled' : base;
  return `${safe}.${extension === 'html' ? 'html' : 'md'}`;
}
export function textStats(text, position = text.length) {
  const before = text.slice(0, position);
  const last = before.lastIndexOf('\n');
  return { characters: Array.from(text).length, lines: text.split('\n').length,
    line: before.split('\n').length, column: Array.from(before.slice(last + 1)).length + 1 };
}
export function scrollRatio(scrollTop, scrollHeight, clientHeight) {
  const range = scrollHeight - clientHeight;
  return range > 0 ? Math.max(0, Math.min(1, scrollTop / range)) : 0;
}
export function isSafeLink(value) {
  return /^(https?:\/\/|mailto:|#)/i.test(value) && !/[\u0000-\u0020\u007F]/.test(value);
}
export function debounce(fn, delay) {
  let timer;
  const run = (...args) => { clearTimeout(timer); timer = setTimeout(() => { timer = undefined; fn(...args); }, delay); };
  run.cancel = () => { clearTimeout(timer); timer = undefined; };
  return run;
}
export function record(content = '', name = 'untitled.md') {
  return { content, name: safeFilename(name) };
}
export function validDocument(value) {
  return Boolean(value && typeof value === 'object' && typeof value.content === 'string' &&
    typeof value.name === 'string' && value.content.length <= 2_000_000);
}
