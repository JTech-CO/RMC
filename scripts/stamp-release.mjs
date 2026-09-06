/** Stamp the complete local module graph, not just index.html, with one cache key. */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const { version } = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
if (!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(version)) throw new Error('Invalid release version');
const stamp = value => value.split('?')[0] + `?v=${version}`;
let html = await readFile(new URL('index.html', root), 'utf8');
html = html.replace(/((?:src|href)=")((?:\.\/)?(?:css|js|assets)\/[^"?#]+)(?:\?[^"#]*)?("(?:[^>]*>))/g,
  (_, before, value, after) => before + stamp(value) + after);
html = html.replace(/data-rmc-version="[^"]*"/, `data-rmc-version="${version}"`)
  .replace(/(<span class="version">)[^<]*/, `$1${version}`);
await writeFile(new URL('index.html', root), html);
for (const file of (await readdir(new URL('js/', root))).filter(x => x.endsWith('.js'))) {
  const url = new URL(`js/${file}`, root);
  let source = await readFile(url, 'utf8');
  source = source.replace(/(from\s+['"])(\.\.?\/[^'"]+\.js)(?:\?[^'"]*)?(['"])/g,
    (_, a, b, c) => a + stamp(b) + c);
  source = source.replace(/(new URL\(['"])(\.\.?\/[^'"]+\.(?:js|css))(?:\?[^'"]*)?(['"],\s*import\.meta\.url\))/g,
    (_, a, b, c) => a + stamp(b) + c);
  if (file === 'main.js') source = source.replace(/dataset\.rmcBoot = "[^"]*"/, `dataset.rmcBoot = "${version}"`);
  await writeFile(url, source);
}
const cssUrl = new URL('css/styles.css', root);
let css = await readFile(cssUrl, 'utf8');
css = css.replace(/--rmc-ui-version:\s*"[^"]*"/, `--rmc-ui-version: "${version}"`);
await writeFile(cssUrl, css);
const files = [];
for (const directory of ['css','js','assets']) {
  for (const file of (await readdir(new URL(`${directory}/`, root))).sort()) {
    if (!/\.(css|js|svg)$/.test(file)) continue;
    const relative = `${directory}/${file}`;
    const bytes = await readFile(new URL(relative, root));
    files.push({ path: relative, url: stamp(relative), bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex') });
  }
}
await writeFile(new URL('release.json', root), JSON.stringify({ version, files }, null, 2) + '\n');
console.log(`Stamped ${version}: ${files.length} assets. No build or package installation is required to serve them.`);
