import { scrollRatio } from './utils.js';
export function bindScrollSync(editor, preview, enabled) {
  let lock = null, unlockFrame, frame;
  const sync = (from, to) => {
    if (!enabled() || lock === from) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const target = scrollRatio(from.scrollTop, from.scrollHeight, from.clientHeight) * Math.max(0, to.scrollHeight - to.clientHeight);
      if (Math.abs(target - to.scrollTop) < 1) return;
      lock = to;
      to.scrollTop = target;
      cancelAnimationFrame(unlockFrame);
      unlockFrame = requestAnimationFrame(() => { unlockFrame = requestAnimationFrame(() => { lock = null; }); });
    });
  };
  editor.addEventListener('scroll', () => sync(editor, preview), { passive: true });
  preview.addEventListener('scroll', () => sync(preview, editor), { passive: true });
}
