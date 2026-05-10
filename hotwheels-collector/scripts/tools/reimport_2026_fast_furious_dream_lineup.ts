/**
 * Dream Lineup 2026: cleanup DB + disk → wiki import → images (force refresh).
 *
 *   npx ts-node scripts/tools/reimport_2026_fast_furious_dream_lineup.ts
 */

import { spawnSync } from 'child_process';
import path from 'path';

const root = process.cwd();

function run(label: string, args: string[], env: NodeJS.ProcessEnv): void {
  console.log(`\n>>> ${label}`);
  const r = spawnSync('npx', ['ts-node', ...args], {
    cwd: root,
    stdio: 'inherit',
    shell: true,
    env,
  });
  if (r.status !== 0 && r.status !== null) {
    process.exit(r.status);
  }
  if (r.error) {
    console.error(r.error);
    process.exit(1);
  }
}

run(
  'cleanup Dream Lineup 2026',
  ['scripts/tools/cleanup_2026_fast_furious_dream_lineup.ts'],
  { ...process.env },
);

run(
  'import Dream Lineup 2026 (wiki)',
  ['scripts/import/import_2026_fast_and_furious.ts'],
  { ...process.env, FF_2026_SUBSERIES: 'Dream Lineup' },
);

run(
  'download + sync images',
  ['scripts/tools/download_and_sync_images_2026_fast_and_furious.ts'],
  {
    ...process.env,
    FF_2026_SUBSERIES: 'Dream Lineup',
    WIKI_IMAGES_FORCE: '1',
  },
);

console.log('\n>>> All steps finished.');
