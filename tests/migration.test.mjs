import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, cp, stat, rm, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const source = new URL('../', import.meta.url);
async function fixture(modified = false) {
  const parent = await mkdtemp(path.join(os.tmpdir(), 'rmc-migration-'));
  const root = path.join(parent,'RMC');
  await mkdir(path.join(root,'scripts'), {recursive:true}); await mkdir(path.join(root,'js'));
  for (const name of ['cleanup-legacy.mjs','legacy-files.mjs']) await cp(new URL('scripts/'+name, source), path.join(root,'scripts',name));
  const original = await readFile(new URL('tests/fixtures/legacy-preview.txt', source),'utf8');
  await writeFile(path.join(root,'js/preview.js'), original + (modified ? '\n// user edit\n' : ''));
  await writeFile(path.join(root,'js/main.js'), 'do not touch');
  return {parent,root};
}
test('Migration: dry run is non-destructive; apply backs up only known original legacy files', async () => {
  const {parent,root} = await fixture();
  try {
    const run = args => spawnSync(process.execPath, ['scripts/cleanup-legacy.mjs',...args], {cwd:root,encoding:'utf8'});
    const dry=run([]); assert.equal(dry.status,0,dry.stderr); assert.match(dry.stdout,/WOULD MOVE/); assert.ok(await stat(path.join(root,'js/preview.js')));
    const apply=run(['--apply']); assert.equal(apply.status,0,apply.stderr);
    await assert.rejects(stat(path.join(root,'js/preview.js')));
    assert.equal(await readFile(path.join(root,'js/main.js'),'utf8'),'do not touch');
    const backup=(await readdir(parent)).find(x=>x.startsWith('.RMC-legacy-backup-'));
    assert.ok(await stat(path.join(parent,backup,'js/preview.js')));
  } finally {await rm(parent,{recursive:true,force:true});}
});
test('Migration: modified obsolete file is refused and preserved', async () => {
  const {parent,root}=await fixture(true);
  try {
    const result=spawnSync(process.execPath,['scripts/cleanup-legacy.mjs','--apply'],{cwd:root,encoding:'utf8'});
    assert.equal(result.status,1); assert.match(result.stderr,/REVIEW REQUIRED/);
    assert.match(await readFile(path.join(root,'js/preview.js'),'utf8'),/user edit/);
  } finally {await rm(parent,{recursive:true,force:true});}
});
