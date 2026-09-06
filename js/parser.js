import { runtimeUrl } from './dependencies.js';

export class Parser {
  constructor() { this.worker = null; this.pending = new Map(); this.sequence = 0; this.ready = null; }
  init() {
    if (this.ready) return this.ready;
    this.ready = new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./markdown.worker.js', import.meta.url));
      this.worker = worker;
      const timer = setTimeout(() => { reject(new Error('Markdown parser could not load. Check the network.')); this.dispose(); }, 12000);
      worker.addEventListener('message', ({ data }) => {
        if (data.type === 'ready') { clearTimeout(timer); resolve(); return; }
        if (data.type === 'error' && data.id === undefined) { clearTimeout(timer); reject(new Error(data.message)); this.dispose(); return; }
        const job = this.pending.get(data.id);
        if (!job) return;
        clearTimeout(job.timer);
        this.pending.delete(data.id);
        data.type === 'error' ? job.reject(new Error(data.message)) : job.resolve(data.html);
      });
      worker.addEventListener('error', () => {
        clearTimeout(timer);
        reject(new Error('Markdown worker is unavailable. Serve the folder over HTTP(S), not file://.'));
        this.dispose();
      });
      worker.postMessage({ type: 'init', url: runtimeUrl('marked') });
    });
    return this.ready;
  }
  async parse(text, breaks) {
    await this.init();
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => { reject(new Error('Preview timed out. Your Markdown is still available.')); this.dispose(); }, 2500);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ type: 'parse', id, text, breaks });
    });
  }
  dispose() {
    this.worker?.terminate();
    this.worker = null;
    this.ready = null;
    for (const job of this.pending.values()) { clearTimeout(job.timer); job.reject(new Error('Markdown rendering was interrupted.')); }
    this.pending.clear();
  }
}
