import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGACY_FILES } from './legacy-files.mjs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
let failures = 0, count = 0;
const check = (condition, label) => { count++; if (!condition) { failures++; console.error(`FAIL ${label}`); } };
function walk(dir) { return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() && !['vendor','.git','node_modules','.test-results','__pycache__'].includes(entry.name) ? walk(path.join(dir, entry.name)) : entry.isFile() ? [path.join(dir, entry.name)] : []); }
for (const file of walk(root).filter(name => /\.(m?js)$/.test(name))) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  check(result.status === 0, `Syntax: ${path.relative(root, file)} ${result.stderr || ''}`);
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    if (match[1].startsWith('.')) check(fs.existsSync(path.resolve(path.dirname(file), match[1].split(/[?#]/)[0])), `Import: ${match[1]}`);
  }
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(x => x[1]);
check(ids.length === new Set(ids).size, 'Unique HTML ids');
for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
  if (!/^(https?:|data:)/.test(match[1])) check(fs.existsSync(path.resolve(root, match[1].split(/[?#]/)[0])), `HTML asset: ${match[1]}`);
}
for (const match of html.matchAll(/aria-(?:controls|labelledby|describedby)="([^"]+)"/g)) {
  for (const id of match[1].split(' ')) check(ids.includes(id), `ARIA target: ${id}`);
}
check(!/cdn\.tailwindcss|fonts\.googleapis|font-awesome/.test(html), 'No runtime CSS/font CDN');
check(!/\son\w+=/.test(html), 'No inline event handlers');
check(html.includes('Content-Security-Policy'), 'CSP present');
for (const name of ['README.md','README-KR.md','LICENSE','docs/AUDIT-KR.md','docs/QA-REPORT.md']) check(fs.existsSync(path.join(root, name)), `Document: ${name}`);
check(fs.existsSync(path.join(root, '.nojekyll')), 'Static publishing marker .nojekyll');
// Leftover 1.x modules must be removed, not hidden from validation.
for (const relative of Object.keys(LEGACY_FILES)) check(!fs.existsSync(path.join(root, relative)), `Legacy file ${relative}: run npm run migrate -- --apply`);
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release.json'), 'utf8'));
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
check(manifest.version === pkg.version, 'Release manifest version');
for (const asset of manifest.files) {
  const actual = createHash('sha256').update(fs.readFileSync(path.join(root, asset.path))).digest('hex');
  check(actual === asset.sha256, `Release hash ${asset.path}: run npm run release:stamp after edits`);
}
console.log(`${count - failures}/${count} structural checks passed.`);
process.exitCode = failures ? 1 : 0;
