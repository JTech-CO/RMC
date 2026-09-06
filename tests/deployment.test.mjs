import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createHash } from 'node:crypto';
import { canonicalBase, verifyDeployment } from '../scripts/deployment-lib.mjs';
const root = new URL('../', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('release.json', root), 'utf8'));
const html = await readFile(new URL('index.html', root), 'utf8');
test('Release: HTML local runtime references all carry the release query', () => {
  for (const match of html.matchAll(/(?:src|href)="((?:css|js|assets)\/[^"#]+)"/g)) {
    assert.equal(new URL(match[1], 'https://example.test/RMC/').searchParams.get('v'), manifest.version);
  }
});
test('Release: all local static JS imports and dynamic Worker/CSS URLs carry the query', async () => {
  for (const asset of manifest.files.filter(x => x.path.endsWith('.js'))) {
    const source = await readFile(new URL(asset.path, root), 'utf8');
    for (const match of source.matchAll(/(?:from\s+|new URL\()['"](\.\.?\/[^'"]+\.(?:js|css)(?:\?[^'"]+)?)['"]/g)) {
      const url = new URL(match[1], new URL(asset.path, root));
      assert.equal(url.searchParams.get('v'), manifest.version, `${asset.path}: ${match[1]}`);
      assert.ok((await readFile(url)).length);
    }
  }
});
test('Release: every asset checksum matches the distributed file', async () => {
  for (const asset of manifest.files) {
    const bytes = await readFile(new URL(asset.path, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.path);
  }
});
test('Release: every UI SVG has a bounded intrinsic size, including a zero-size symbol sheet', () => {
  for (const match of html.matchAll(/<svg\b([^>]*)>/g)) {
    const expected = match[1].includes('icon-definitions') ? '0' : '20';
    assert.ok(match[1].includes(`width="${expected}"`));
    assert.ok(match[1].includes(`height="${expected}"`));
  }
});
test('Deployment URL handles a project subpath and an index filename', () => {
  assert.equal(canonicalBase('https://example.test/RMC').href, 'https://example.test/RMC/');
  assert.equal(canonicalBase('https://example.test/RMC/index.html?old=1').href, 'https://example.test/RMC/');
  assert.throws(() => canonicalBase('file:///tmp/RMC/'));
  assert.throws(() => canonicalBase('https://user:password@example.test/'));
});
async function fixtureResponse(url, overrides = {}) {
  const name = new URL(url).pathname.replace(/^\/RMC\//, '');
  if (overrides[name]) return overrides[name]();
  let bytes;
  try { bytes = await readFile(new URL(name, root)); } catch { return new Response('Not found', { status: 404 }); }
  const type = name.endsWith('.html') ? 'text/html' : name.endsWith('.css') ? 'text/css' : name.endsWith('.js') ? 'text/javascript' : name.endsWith('.svg') ? 'image/svg+xml' : 'application/json';
  return new Response(bytes, { headers: { 'content-type': type } });
}
test('Deployment verifier passes a complete versioned fixture', async () => {
  const result = await verifyDeployment('https://example.test/RMC/', manifest, fixtureResponse);
  assert.equal(result.ok, true); assert.equal(result.results.length, manifest.files.length + 2);
});
test('Deployment verifier rejects old CSS bytes despite HTTP 200 and correct MIME', async () => {
  const report = await verifyDeployment('https://example.test/RMC/', manifest, url => fixtureResponse(url, {
    'css/styles.css': () => new Response('body{background:#000;color:#fff}', { headers: { 'content-type':'text/css' } }),
  }));
  assert.equal(report.ok, false); assert.match(report.results.find(x => x.path.startsWith('css/styles')).reason, /Bytes differ/);
});
test('Deployment verifier rejects HTML returned in place of CSS', async () => {
  const report = await verifyDeployment('https://example.test/RMC/', manifest, url => fixtureResponse(url, {
    'css/styles.css': () => new Response('<html>404</html>', { headers: { 'content-type':'text/html' } }),
  }));
  assert.equal(report.ok, false); assert.match(report.results.find(x => x.path.startsWith('css/styles')).reason, /Content-Type/);
});
test('Deployment verifier reports an absent JavaScript module', async () => {
  const report = await verifyDeployment('https://example.test/RMC/', manifest, url => fixtureResponse(url, {
    'js/config.js': () => new Response('Not found', { status:404 }),
  }));
  assert.equal(report.ok, false); assert.match(report.results.find(x => x.path.startsWith('js/config')).reason, /404/);
});
test('Actual HTTP: project path, trailing slash redirect, full release, and root-absolute 404', async () => {
  const child = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: root, env: { ...process.env, PORT:'0', BASE_PATH:'/RMC/' }, stdio:['ignore','pipe','pipe'] });
  try {
    const [output] = await once(child.stdout, 'data');
    const base = output.toString().match(/http:\/\/127\.0\.0\.1:\d+\/RMC\//)[0];
    const slashless = await fetch(base.slice(0,-1), { redirect:'manual' });
    assert.equal(slashless.status,308); assert.equal(slashless.headers.get('location'), '/RMC/');
    assert.equal((await fetch(new URL('/css/styles.css',base))).status,404);
    const report = await verifyDeployment(base,manifest);
    assert.equal(report.ok,true,JSON.stringify(report));
    assert.equal(report.results.length,21);
  } finally { child.kill(); await once(child, 'exit'); }
});
