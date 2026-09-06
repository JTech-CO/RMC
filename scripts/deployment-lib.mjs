/** Read-only HTTP deployment verifier. Does not run page scripts or access browser storage. */
import { createHash } from 'node:crypto';
export function canonicalBase(input) {
  const base = new URL(input);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password) throw new Error('Use an HTTP(S) URL without credentials.');
  base.search = ''; base.hash = '';
  if (base.pathname.endsWith('/index.html')) base.pathname = base.pathname.slice(0, -10);
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return base;
}
export async function verifyDeployment(input, expected, fetcher = fetch) {
  const base = canonicalBase(input);
  const results = [];
  async function get(relative, validate, mime) {
    const url = new URL(relative, base);
    if (url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) throw new Error(`Asset escapes the application directory: ${relative}`);
    try {
      const response = await fetcher(url.href, { cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000) });
      const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (mime && !mime.includes(type)) throw new Error(`Incorrect Content-Type: ${type || '(missing)'}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const error = validate(bytes);
      if (error) throw new Error(error);
      results.push({ path: relative, ok: true, status: response.status, type, bytes: bytes.length });
    } catch (error) { results.push({ path: relative, ok: false, reason: error.message }); }
  }
  await get(`index.html?v=${expected.version}`, bytes => {
    const text = bytes.toString('utf8');
    if (!text.includes(`data-rmc-version="${expected.version}"`)) return 'Different HTML release or a wrong publishing folder';
    for (const name of ['css/styles.css','css/editor.css','css/document.css','css/preview.css','js/boot.js','js/main.js']) {
      if (!text.includes(`${name}?v=${expected.version}`)) return `Missing or stale asset reference: ${name}`;
    }
    return null;
  }, ['text/html']);
  await get(`release.json?v=${expected.version}`, bytes => {
    const actual = JSON.parse(bytes.toString('utf8'));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) return 'release.json differs from the local release manifest';
    return null;
  }, ['application/json', 'text/json']);
  // .nojekyll is a publishing marker, not a required public HTTP asset.
  // All paths originate in the local package manifest, not untrusted remote HTML.
  for (let start = 0; start < expected.files.length; start += 4) {
    await Promise.all(expected.files.slice(start, start + 4).map(file => get(file.url, bytes => {
      const actual = createHash('sha256').update(bytes).digest('hex');
      return actual === file.sha256 ? null : 'Bytes differ: an older cached file, another deployment, or an unstamped local edit';
    }, file.path.endsWith('.css') ? ['text/css'] : file.path.endsWith('.js') ? ['text/javascript', 'application/javascript'] : ['image/svg+xml'])));
  }
  return { base: base.href, expectedVersion: expected.version, ok: results.every(item => item.ok), results,
    scope: 'HTTP status, MIME, release references and SHA-256 bytes. Not browser execution, layout or CDN dependency validation.' };
}
