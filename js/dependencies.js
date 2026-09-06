import { RUNTIME_URLS } from './runtime-urls.js?v=2.0.2';
export const runtimeUrl = key => new URL(RUNTIME_URLS[key], import.meta.url).href;

function loadScript(key, globalName, timeout = 12000) {
  if (globalThis[globalName]) return Promise.resolve(globalThis[globalName]);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      script.onload = script.onerror = null;
      error ? reject(error) : resolve(globalThis[globalName]);
    };
    const timer = setTimeout(() => finish(new Error(`${globalName} took too long to load.`)), timeout);
    script.src = runtimeUrl(key);
    script.referrerPolicy = 'no-referrer';
    script.onload = () => finish(globalThis[globalName] ? null : new Error(`${globalName} is unavailable.`));
    script.onerror = () => finish(new Error(`${globalName} could not load. Check the network or run npm run vendor.`));
    document.head.append(script);
  });
}
export function loadSanitizer() { return loadScript('purify', 'DOMPurify'); }
export function loadHighlighter() { return loadScript('highlight', 'hljs').catch(() => null); }
