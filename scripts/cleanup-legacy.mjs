/** Dry-run by default. --apply moves only known, unchanged obsolete files OUTSIDE the web root. */
import { readFile, access, mkdir, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGACY_FILES } from './legacy-files.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const apply = process.argv.includes('--apply');
const backup = path.join(root, '..', `.RMC-legacy-backup-${Date.now()}`);
let found = 0, refused = 0;
for (const [relative, expected] of Object.entries(LEGACY_FILES)) {
  const file = path.join(root, relative);
  try { await access(file); } catch { continue; }
  found++;
  const bytes = await readFile(file);
  // Allow checkout CRLF normalization, but not substantive local modifications.
  const blobHash = b => createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
  const lf = Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n'));
  const crlf = Buffer.from(lf.toString('utf8').replace(/\n/g, '\r\n'));
  if (![bytes, lf, crlf].some(b => blobHash(b) === expected)) {
    console.error(`REVIEW REQUIRED: ${relative} differs from the known obsolete file. Not moved.`); refused++; continue;
  }
  if (apply) {
    const target = path.join(backup, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await rename(file, target);
    console.log(`MOVED ${relative}`);
  } else console.log(`WOULD MOVE ${relative}`);
}
console.log(found ? (apply ? `Backup directory: ${backup}` : 'Dry-run only. Re-run with --apply to move the unchanged legacy files.') : 'No obsolete files found.');
console.log('Existing drafts, .git/, CNAME, current source files and unknown files are never cleared.');
process.exitCode = refused ? 1 : 0;
