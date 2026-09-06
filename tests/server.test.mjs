import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import http from 'node:http';
let child, base;
before(async () => {
  child = spawn(process.execPath, ['scripts/serve.mjs'], { cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: '0' }, stdio: ['ignore','pipe','pipe'] });
  base = await new Promise((resolve, reject) => {
    let log = '';
    const timer = setTimeout(() => reject(new Error('Development server did not start')), 5000);
    child.stdout.on('data', chunk => { log += chunk; const match = log.match(/http:\/\/127\.0\.0\.1:\d+/); if (match) { clearTimeout(timer); resolve(match[0]); } });
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('exit', code => { clearTimeout(timer); reject(new Error(`Server exited: ${code}`)); });
  });
});
after(async () => { if (child && child.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; } });
test('HTTP: index is actually served at root', async () => { const r = await fetch(base); assert.equal(r.status, 200); assert.match(await r.text(), /R\.M\.C\./); });
test('HTTP: JavaScript module MIME type', async () => { const r = await fetch(base+'/js/main.js'); assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/javascript/); });
test('HTTP: document export stylesheet is reachable', async () => { const r = await fetch(base+'/css/document.css'); assert.equal(r.status, 200); assert.match(await r.text(), /markdown-body/); });
test('HTTP: missing files return 404', async () => { assert.equal((await fetch(base+'/does-not-exist.js')).status, 404); });
test('HTTP: server is read-only', async () => { assert.equal((await fetch(base, {method:'POST', body:'no'})).status, 405); });
test('HTTP: HEAD returns metadata without body', async () => { const r = await fetch(base, {method:'HEAD'}); assert.equal(r.status, 200); assert.equal(await r.text(), ''); assert.equal(r.headers.get('x-content-type-options'), 'nosniff'); });
test('HTTP: encoded directory traversal cannot escape project root', async () => {
  const code = await new Promise((resolve,reject) => {
    const req = http.get(base+'/..%2f..%2fetc%2fpasswd', r => { r.resume(); resolve(r.statusCode); }); req.on('error',reject);
  });
  assert.equal(code,403);
});
