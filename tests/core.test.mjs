import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml, normalizeText, safeFilename, textStats, scrollRatio, isSafeLink, record, debounce } from '../js/utils.js';
import { DraftStore, readSettings, writeSettings } from '../js/storage.js';
import { STORAGE_KEY, BACKUP_KEY, LEGACY_KEY, LEGACY_BACKUP_KEY } from '../js/config.js';
import { editOperation } from '../js/editor.js';
import { createHtmlDocument, copyText } from '../js/export.js';

function memory(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => data.set(key, String(value)), removeItem: key => data.delete(key), data };
}
for (const [input, expected] of [['hello.md','hello.md'], ['a/b:test.html','a-b-test.md'], ['안녕하세요.md','안녕하세요.md'], ['', 'untitled.md'], ['CON','untitled.md'], ['LPT1.txt','untitled.md'], ['...','untitled.md']]) {
  test(`Filename safety: ${JSON.stringify(input)}`, () => assert.equal(safeFilename(input), expected));
}
test('HTML filename extension', () => assert.equal(safeFilename('note.md','html'), 'note.html'));
test('HTML escaping', () => assert.equal(escapeHtml('<script>"&\''), '&lt;script&gt;&quot;&amp;&#39;'));
test('BOM + Windows/Mac newline normalization', () => assert.equal(normalizeText('\uFEFFa\r\nb\rc'), 'a\nb\nc'));
test('Unicode code-point statistics', () => assert.deepEqual(textStats('한😀\nx', 3), {characters:4,lines:2,line:1,column:3}));
test('Empty document statistics', () => assert.deepEqual(textStats('', 0), {characters:0,lines:1,line:1,column:1}));
test('Cursor after newline', () => assert.equal(textStats('a\nb',2).column, 1));
test('Scroll range zero', () => assert.equal(scrollRatio(12,100,100), 0));
test('Scroll clamped to valid range', () => { assert.equal(scrollRatio(200,200,100),1); assert.equal(scrollRatio(-4,200,100),0); });
test('Scroll normal ratio', () => assert.equal(scrollRatio(50,200,100),.5));
for (const link of ['javascript:alert(1)','data:text/html,test','//example.com','/relative/path','java\nscript:test','https://a.test/ bad']) test(`Reject dangerous/ambiguous URL: ${JSON.stringify(link)}`, () => assert.equal(isSafeLink(link), false));
for (const link of ['https://example.com','http://localhost:8000','mailto:a@example.com','#heading']) test(`Allow explicit URL: ${link}`, () => assert.equal(isSafeLink(link), true));
test('Absent draft differs from empty draft', () => {
  const mem = memory(); const store = new DraftStore(() => mem);
  assert.equal(store.load().document, null); assert.equal(store.save(record('')).ok, true);
  assert.equal(store.load().document.content, '');
});
test('Legacy empty draft does not become sample text', () => {
  const mem = memory({ [LEGACY_KEY]: '' }); const store = new DraftStore(() => mem);
  const result = store.load(); assert.equal(result.migrated, true); assert.equal(result.document.content, '');
  store.save(result.document); assert.equal(mem.getItem(LEGACY_KEY), '');
});
test('Legacy content preserved and migrated non-destructively', () => {
  const mem = memory({ [LEGACY_KEY]: '# 한국어\n\noriginal' }); const store = new DraftStore(() => mem);
  const result = store.load(); assert.equal(result.document.content, '# 한국어\n\noriginal');
  assert.equal(store.save(result.document).ok,true); assert.ok(mem.getItem(LEGACY_KEY));
});
test('Malformed modern draft is never treated as no draft', () => {
  const mem = memory({ [STORAGE_KEY]:'{' }); const store = new DraftStore(() => mem);
  assert.equal(store.load().ok, false); assert.equal(mem.getItem(STORAGE_KEY), '{');
});
test('Unknown schema is rejected', () => {
  const mem = memory({ [STORAGE_KEY]:JSON.stringify({schema:77, ...record('x')}) });
  assert.equal(new DraftStore(() => mem).load().ok,false);
});
test('Storage permission denial is reported', () => {
  const store = new DraftStore(() => { throw new Error('Denied'); });
  assert.equal(store.load().ok,false); assert.equal(store.save(record('x')).ok,false); assert.equal(store.backup(record('x')).ok,false);
});
test('Quota failure does not claim success or update baseline', () => {
  const mem = memory(); const store = new DraftStore(() => mem); store.load();
  mem.setItem = () => { throw new Error('QuotaExceededError'); };
  assert.equal(store.save(record('x')).ok,false); assert.equal(store.baseline,null);
});
test('Cross-tab conflict does not overwrite existing saved draft', () => {
  const mem = memory(); const a = new DraftStore(() => mem), b = new DraftStore(() => mem);
  a.load(); b.load(); a.save(record('A'));
  assert.equal(b.save(record('B')).reason, 'conflict'); assert.equal(a.load().document.content, 'A');
});
test('Loading latest baseline enables explicit conflict resolution', () => {
  const mem = memory(); const a = new DraftStore(() => mem), b = new DraftStore(() => mem);
  a.load(); b.load(); a.save(record('A')); b.load();
  assert.equal(b.save(record('B')).ok, true); assert.equal(a.load().document.content, 'B');
});
test('Invalid backup data rejected', () => {
  const mem = memory({ [BACKUP_KEY]: JSON.stringify({content:12, name:'x.md', schema:2}) });
  assert.equal(new DraftStore(() => mem).readBackup().ok, false);
});
test('Empty backup is valid', () => {
  const mem = memory(); const persisted = new DraftStore(() => mem);
  persisted.backup(record('')); assert.equal(persisted.readBackup().document.content, '');
});
test('Legacy backup accepted without deleting original', () => {
  const mem = memory({ [LEGACY_BACKUP_KEY]:JSON.stringify({content:'# old',savedAt:'2026-01-01'}) });
  const store = new DraftStore(() => mem); assert.equal(store.readBackup().document.content, '# old'); assert.ok(mem.getItem(LEGACY_BACKUP_KEY));
});
test('No backup is an explicit null', () => assert.equal(new DraftStore(() => memory()).readBackup().document,null));
test('Settings default to privacy-safe images and original soft breaks', () => assert.deepEqual(readSettings(() => memory()),{sync:true,images:false,breaks:true}));
test('Settings storage failure is observable', () => assert.equal(writeSettings({},()=>{throw Error('denied');}),false));
test('Selected bold replacement', () => assert.deepEqual(editOperation('word',0,4,'bold'),{replacement:'**word**',selectionStart:2,selectionEnd:6}));
test('Empty-selection placeholder', () => assert.equal(editOperation('',0,0,'italic').replacement,'*italic text*'));
test('Code block fence safely encloses existing triple backticks', () => assert.match(editOperation('```js\nx\n```',0,11,'block').replacement,/^````text\n/));
test('Block insertion is separated from adjacent text', () => assert.equal(editOperation('ab',1,1,'heading').replacement,'\n## Heading\n'));
test('Export contains no runtime script or remote fonts', () => {
  const html = createHtmlDocument('<pre><code>  a\n\n b\n</code></pre>','한국어.md','body { color: white; }');
  assert.ok(html.includes('<pre><code>  a\n\n b\n</code></pre>'));
  assert.ok(html.includes('<title>한국어</title>')); assert.ok(!html.includes('<script')); assert.ok(!html.includes('fonts.googleapis'));
  assert.ok(html.includes("img-src data:;"));
});
test('Export image policy is opt-in', () => assert.ok(createHtmlDocument('', 'a', '', true).includes('img-src data: https:;')));
test('Debounce only runs the latest call', async () => { const seen=[]; const fn=debounce(x=>seen.push(x),8); fn(1);fn(2);await new Promise(r=>setTimeout(r,25));assert.deepEqual(seen,[2]); });
test('Debounce can be canceled', async () => { let calls=0;const fn=debounce(()=>calls++,8);fn();fn.cancel();await new Promise(r=>setTimeout(r,25));assert.equal(calls,0); });
test('Clipboard fallback returning false is NOT success', async () => {
  const originals = { document:globalThis.document, navigator:Object.getOwnPropertyDescriptor(globalThis,'navigator'), HTMLTextAreaElement:globalThis.HTMLTextAreaElement, isSecureContext:globalThis.isSecureContext };
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{}});globalThis.isSecureContext=false;
  globalThis.HTMLTextAreaElement=class {};
  let removed=false;
  globalThis.document={activeElement:null,body:{append(){}},createElement(){return {setAttribute(){},select(){},remove(){removed=true;}};},execCommand(){return false;}};
  try { assert.equal(await copyText('text'),false);assert.equal(removed,true); }
  finally {
    globalThis.document=originals.document;globalThis.HTMLTextAreaElement=originals.HTMLTextAreaElement;globalThis.isSecureContext=originals.isSecureContext;
    if(originals.navigator)Object.defineProperty(globalThis,'navigator',originals.navigator);else delete globalThis.navigator;
  }
});
