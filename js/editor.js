import { textStats } from './utils.js?v=2.0.2';
const FORMATS = {
  bold: ['**', '**', 'bold text'], italic: ['*', '*', 'italic text'],
  link: ['[', '](https://example.com)', 'link text'], code: ['`', '`', 'code'],
  block: ['```text\n', '\n```', 'Your code here'], heading: ['## ', '', 'Heading'],
  quote: ['> ', '', 'A note worth keeping'], task: ['- [ ] ', '', 'Task'],
};
export function editOperation(text, start, end, action) {
  let [prefix, suffix, placeholder] = FORMATS[action] || FORMATS.bold;
  const selected = text.slice(start, end);
  if (['block','heading','quote','task'].includes(action)) {
    if (start > 0 && text[start - 1] !== '\n') prefix = '\n' + prefix;
    if (end < text.length && text[end] !== '\n') suffix += '\n';
  }
  if (action === 'block') {
    const longest = Math.max(2, ...(selected.match(/`+/g) || []).map(x => x.length));
    const fence = '`'.repeat(longest + 1);
    prefix = prefix.replace('```', fence);
    suffix = suffix.replace('```', fence);
  }
  const replacement = prefix + (selected || placeholder) + suffix;
  return { replacement, selectionStart: start + prefix.length, selectionEnd: start + prefix.length + (selected || placeholder).length };
}
export function applyFormat(editor, action, onChange) {
  const start = editor.selectionStart, end = editor.selectionEnd;
  const operation = editOperation(editor.value, start, end, action);
  editor.focus();
  editor.setSelectionRange(start, end);
  // insertText preserves the native undo stack in browsers that still implement it.
  let inserted = false;
  try { inserted = document.execCommand('insertText', false, operation.replacement); } catch { /* fallback below */ }
  if (!inserted) editor.setRangeText(operation.replacement, start, end, 'end');
  editor.setSelectionRange(operation.selectionStart, operation.selectionEnd);
  onChange();
}
export function updateMetadata(editor, elements) {
  const stats = textStats(editor.value, editor.selectionStart);
  elements.charCount.textContent = stats.characters.toLocaleString();
  elements.totalLines.textContent = stats.lines.toLocaleString();
  elements.cursor.textContent = `Ln ${stats.line}, Col ${stats.column}`;
}
