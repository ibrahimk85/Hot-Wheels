/**
 * Canonical mainline list URLs per year. Prefer values synced from the Hot Wheels hub
 * (Yearly Lists → By year); see sync_mainline_urls_from_hub.ts and mainline_urls.json.
 */

import fs from 'fs';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'scripts', 'config', 'mainline_urls.json');

export function defaultMainlineListUrl(year: number): string {
  return `https://hotwheels.fandom.com/wiki/List_of_${year}_Hot_Wheels`;
}

export function loadMainlineUrlMap(): Record<string, string> {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Resolve wiki URL for a year's mainline list page (JSON override or List_of_YYYY default). */
export function getMainlineWikiUrlForYear(year: number): string {
  const map = loadMainlineUrlMap();
  return map[String(year)] ?? defaultMainlineListUrl(year);
}
