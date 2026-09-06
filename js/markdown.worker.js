/* A classic worker intentionally keeps parsing and potentially expensive regexes off the UI thread. */
let initialized = false;
self.addEventListener('message', ({ data }) => {
  try {
    if (data.type === 'init') {
      importScripts(data.url);
      if (!self.marked?.parse) throw new Error('Markdown parser did not load.');
      initialized = true;
      self.postMessage({ type: 'ready' });
      return;
    }
    if (!initialized || data.type !== 'parse') return;
    if (typeof data.text !== 'string' || data.text.length > 300000) throw new Error('Preview limit: 300,000 UTF-16 code units. You can still export Markdown.');
    const html = self.marked.parse(data.text.replace(/^\uFEFF/, ''), { gfm: true, breaks: data.breaks === true, async: false });
    if (typeof html !== 'string' || html.length > 2000000) throw new Error('Generated HTML is too large for preview.');
    self.postMessage({ type: 'result', id: data.id, html });
  } catch (error) {
    self.postMessage({ type: 'error', id: data.id, message: error instanceof Error ? error.message : 'Markdown conversion failed.' });
  }
});
