/**
 * Refresh scripts/config/mainline_urls.json using links from the Hot Wheels hub
 * (https://hotwheels.fandom.com/wiki/Hot_Wheels → Yearly Lists → By year).
 *
 *   npx ts-node scripts/tools/sync_mainline_urls_from_hub.ts
 *   npx ts-node scripts/tools/sync_mainline_urls_from_hub.ts --dry-run
 */

import fs from 'fs';
import path from 'path';
import { fetchFandomWikiHtml } from '../lib/fandom-fetch.ts';
import {
  extractMainlineListUrlsFromHubHtml,
  HOT_WHEELS_HUB_WIKI_URL,
} from '../lib/hub-mainline-urls.ts';

const CONFIG_PATH = path.join(process.cwd(), 'scripts', 'config', 'mainline_urls.json');

const MIN_YEAR = 2000;
const MAX_YEAR = 2026;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`Fetching hub: ${HOT_WHEELS_HUB_WIKI_URL}${dryRun ? ' (dry-run)' : ''}`);
  const html = await fetchFandomWikiHtml(HOT_WHEELS_HUB_WIKI_URL);
  const fromHub = extractMainlineListUrlsFromHubHtml(html);

  let existing: Record<string, string> = {};
  try {
    existing = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8')) as Record<string, string>;
  } catch {
    console.warn('No existing mainline_urls.json or invalid JSON; starting fresh.');
  }

  const merged: Record<string, string> = { ...existing };
  let updated = 0;
  for (let y = MIN_YEAR; y <= MAX_YEAR; y++) {
    const u = fromHub.get(y);
    if (!u) {
      console.warn(`  Hub: no List_of link found for ${y} (keeping JSON if present).`);
      continue;
    }
    const key = String(y);
    if (merged[key] !== u) {
      console.log(`  ${key}: ${merged[key] ?? '(none)'} → ${u}`);
      merged[key] = u;
      updated++;
    }
  }

  const sortedKeys = Object.keys(merged).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const out: Record<string, string> = {};
  for (const k of sortedKeys) {
    out[k] = merged[k]!;
  }

  if (dryRun) {
    console.log(`\nDry-run: would write ${Object.keys(out).length} keys (${updated} hub updates).`);
    return;
  }

  fs.writeFileSync(CONFIG_PATH, `${JSON.stringify(out, null, 2)}\n`, 'utf-8');
  console.log(`\nWrote ${CONFIG_PATH} (${updated} URLs updated from hub).`);
}

(async () => {
  try {
    await main();
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
})();
