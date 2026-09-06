import { readFile, writeFile } from 'node:fs/promises';
import { verifyDeployment } from './deployment-lib.mjs';
const input = process.argv[2];
if (!input || input.startsWith('--')) {
  console.error('Usage: npm run check:deployment -- https://OWNER.github.io/REPOSITORY/ [--json output.json]');
  process.exitCode = 2;
} else {
  try {
    const expected = JSON.parse(await readFile(new URL('../release.json', import.meta.url), 'utf8'));
    const report = await verifyDeployment(input, expected);
    for (const item of report.results) console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.path}${item.reason ? ' — ' + item.reason : ''}`);
    console.log(`\n${report.results.filter(item => item.ok).length}/${report.results.length} HTTP deployment checks passed.\n${report.scope}`);
    const jsonIndex = process.argv.indexOf('--json');
    if (jsonIndex >= 0 && process.argv[jsonIndex + 1]) await writeFile(process.argv[jsonIndex + 1], JSON.stringify(report, null, 2) + '\n');
    process.exitCode = report.ok ? 0 : 1;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
