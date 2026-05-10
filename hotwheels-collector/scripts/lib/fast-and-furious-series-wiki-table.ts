/**
 * Fast & Furious (main line) wiki tables: column count varies — e.g. 2025 has "Film Represented",
 * 2026 Tokyo Drift / Dream Lineup do not. Resolve indices from the header row.
 */

import type { CheerioAPI } from 'cheerio';
import type { Cheerio } from 'cheerio';

export function normalizeFfSeriesHeaderText(s: string): string {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export type FastAndFuriousSeriesColumnMap = {
  series: number;
  toy: number;
  casting: number;
  color: number;
  tampos: number;
  base: number;
  wheel: number;
  film: number | null;
  notes: number;
  loose: number;
  carded: number;
};

export function readFfSeriesTableHeaders($: CheerioAPI, table: unknown): string[] {
  const headerRow = $(table as any)
    .find('tr')
    .filter((_: number, tr: unknown) => $(tr as any).find('th').length >= 5)
    .first();
  return headerRow
    .find('th')
    .toArray()
    .map((el) => normalizeFfSeriesHeaderText($(el).text()));
}

/** @returns null if required columns are missing */
export function buildFastAndFuriousSeriesColumnMap(
  headers: string[],
): FastAndFuriousSeriesColumnMap | null {
  const h = headers;
  const find = (pred: (s: string) => boolean): number => h.findIndex(pred);

  const series = find(
    (s) => /\bseries\s*#/.test(s) || /^col\s*#/.test(s) || s === 'series #' || s.startsWith('col #'),
  );
  const toy = find((s) => /\btoy\s*#/.test(s));
  const casting = find((s) => s.includes('casting'));
  const color = find((s) => s === 'color');
  const tampos = find((s) => s.includes('tamp'));
  const base = find((s) => s.includes('base') && (s.includes('color') || s.includes('type')));
  const wheel = find((s) => s.includes('wheel type') || /^wheel\s/.test(s));
  const film = find((s) => s.includes('film'));
  const notes = find((s) => /\bnotes\b/.test(s) && !s.includes('photo'));
  const loose = find((s) => s.includes('photo') && s.includes('loose'));
  const carded = find((s) => s.includes('photo') && s.includes('carded'));

  if (
    series < 0 ||
    toy < 0 ||
    casting < 0 ||
    color < 0 ||
    wheel < 0 ||
    notes < 0 ||
    loose < 0 ||
    carded < 0
  ) {
    return null;
  }
  if (tampos < 0 || base < 0) {
    return null;
  }

  return {
    series,
    toy,
    casting,
    color,
    tampos,
    base,
    wheel,
    film: film >= 0 ? film : null,
    notes,
    loose,
    carded,
  };
}

export function fastAndFuriousSeriesColumnMapFromTable(
  $: CheerioAPI,
  table: unknown,
): FastAndFuriousSeriesColumnMap | null {
  const headers = readFfSeriesTableHeaders($, table);
  if (headers.length < 9) return null;
  return buildFastAndFuriousSeriesColumnMap(headers);
}

function cellText($: CheerioAPI, cells: Cheerio<any>, idx: number): string {
  if (idx < 0 || idx >= cells.length) return '';
  return $(cells[idx]).text().trim();
}

export type FfSeriesImportRow = {
  collectorNumber: string | undefined;
  toyNumber: string;
  castingName: string;
  color: string;
  wheelType: string;
  notes: string;
  castingNameLink: Cheerio<any>;
};

export function parseFfSeriesTableRowForImport(
  $: CheerioAPI,
  cells: Cheerio<any>,
  col: FastAndFuriousSeriesColumnMap,
): FfSeriesImportRow | null {
  const collectorRaw = cellText($, cells, col.series);
  let collectorNumber: string | undefined;
  if (collectorRaw.includes('/')) {
    collectorNumber = collectorRaw.split('/')[0].trim();
  } else {
    collectorNumber = collectorRaw || undefined;
  }

  const toyNumber = cellText($, cells, col.toy);
  const castingCell = $(cells[col.casting]);
  const castingNameLink = castingCell.find('a').first();
  const castingName = castingNameLink.length
    ? castingNameLink.text().trim()
    : castingCell.text().trim();

  if (!castingName) return null;

  return {
    collectorNumber,
    toyNumber,
    castingName,
    color: cellText($, cells, col.color),
    wheelType: cellText($, cells, col.wheel),
    notes: cellText($, cells, col.notes),
    castingNameLink,
  };
}
