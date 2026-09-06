import { isSafeLink } from './utils.js';
const TAGS = ['p','br','hr','h1','h2','h3','h4','h5','h6','strong','em','b','i','s','del','blockquote',
  'ul','ol','li','pre','code','a','img','table','thead','tbody','tfoot','tr','th','td','input',
  'details','summary','kbd','samp','sub','sup','mark','span','div','dl','dt','dd'];
const ATTRS = ['href','title','src','alt','width','height','start','align','colspan','rowspan','class','type','checked','disabled','open'];

/** All preview, source and export paths go through this one sanitizer boundary. */
export function sanitizeHtml(raw, purify, highlighter, { images = false } = {}) {
  if (!purify?.isSupported || typeof purify.sanitize !== 'function') throw new Error('HTML sanitization is unavailable. Preview and HTML export are disabled.');
  const options = { ALLOWED_TAGS: TAGS, ALLOWED_ATTR: ATTRS, ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false, FORBID_ATTR: ['style','id','name','srcset'], RETURN_DOM_FRAGMENT: true };
  const fragment = purify.sanitize(raw, options);
  let blockedImages = 0;
  fragment.querySelectorAll('*').forEach(element => {
    // Do not let imported HTML impersonate application CSS or introduce arbitrary classes.
    const language = (element.className || '').match(/(?:^|\s)language-([\w+-]{1,40})(?=\s|$)/);
    element.removeAttribute('class');
    if (element.tagName === 'CODE' && language) element.className = `language-${language[1]}`;
    if (element.tagName === 'A') {
      const href = element.getAttribute('href') || '';
      if (!isSafeLink(href)) { element.removeAttribute('href'); }
      else if (!href.startsWith('#')) { element.setAttribute('target', '_blank'); element.setAttribute('rel', 'noopener noreferrer'); }
    }
    if (element.tagName === 'INPUT') {
      if (element.getAttribute('type') !== 'checkbox') element.remove();
      else { element.setAttribute('disabled', ''); element.setAttribute('aria-label', 'Task status'); }
    }
    if (element.tagName === 'IMG') {
      const src = element.getAttribute('src') || '';
      const inline = /^data:image\/(png|jpeg|gif|webp);base64,[a-z\d+/=\s]+$/i.test(src);
      const remote = images && /^https:\/\//i.test(src) && !/[\u0000-\u0020]/.test(src);
      if (!inline && !remote) {
        const placeholder = document.createElement('span');
        placeholder.className = 'image-placeholder';
        placeholder.textContent = `[Image blocked: ${element.getAttribute('alt') || 'no alternative text'}]`;
        element.replaceWith(placeholder);
        blockedImages++;
      } else {
        element.setAttribute('loading', 'lazy');
        element.setAttribute('referrerpolicy', 'no-referrer');
      }
    }
  });
  let highlighted = 0;
  fragment.querySelectorAll('pre code').forEach(code => {
    const language = (code.className.match(/language-([\w+-]+)/) || [])[1];
    const text = code.textContent;
    if (highlighter && language && highlighter.getLanguage(language) && text.length <= 20000 && highlighted < 100) {
      try {
        const output = highlighter.highlight(text, { language, ignoreIllegals: true }).value;
        // Even syntax-highlighter output is sanitized. Only safe token spans are retained.
        code.innerHTML = purify.sanitize(output, { ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['class'], ALLOW_DATA_ATTR: false });
        code.classList.add('hljs');
        highlighted++;
      } catch { code.textContent = text; }
    }
  });
  const holder = document.createElement('div');
  holder.append(fragment);
  return { html: holder.innerHTML, blockedImages };
}
