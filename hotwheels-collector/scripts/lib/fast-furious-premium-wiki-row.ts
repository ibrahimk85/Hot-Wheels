/**
 * Fast & Furious Premium wiki tables: Col# may appear before Toy# (e.g. 2026) or after (older years).
 */

import type { CheerioAPI } from 'cheerio';
import type { Cheerio } from 'cheerio';

function compact(s: string): string {
  return s.replace(/\s+/g, '').trim();
}

function looksLikeSeriesNumber(cellText: string): boolean {
  return /^\d+\/\d+$/.test(compact(cellText));
}

function looksLikeToyNumber(cellText: string): boolean {
  const t = compact(cellText);
  return /^[A-Z0-9]{2,8}$/i.test(t) && /\d/.test(t);
}

export type PremiumImportRow = {
  toyNumber: string;
  collectorNumber: string;
  castingName: string;
  bodyColor: string;
  wheelType: string;
  notes: string;
  castingNameLink: Cheerio<any>;
};

export function parsePremiumWikiRowForImport(
  $: CheerioAPI,
  cells: Cheerio<any>,
): PremiumImportRow {
  const cell0 = $(cells[0]).text().trim();
  const cell1 = $(cells[1]).text().trim();
  const isCollectorFirst = looksLikeSeriesNumber(cell0) && looksLikeToyNumber(cell1);
  const toyNumber = compact(isCollectorFirst ? cell1 : cell0);
  const collectorNumber = compact(isCollectorFirst ? cell0 : cell1);

  const castingNameLink = $(cells[2]).find('a').first();
  const castingName = castingNameLink.length > 0
    ? castingNameLink.text().trim()
    : $(cells[2]).text().trim();

  const bodyColor = cells.length > 3 ? $(cells[3]).text().trim() : '';
  const wheelType = cells.length > 4 ? $(cells[4]).text().trim() : '';
  let notes = '';
  if (cells.length > 6) {
    notes = $(cells[6]).text().trim();
  } else if (cells.length > 5) {
    notes = $(cells[5]).text().trim();
  }

  return {
    toyNumber,
    collectorNumber,
    castingName,
    bodyColor,
    wheelType,
    notes,
    castingNameLink,
  };
}

/** Toy # sanitized for image filenames. */
export function parsePremiumWikiRowForImages(
  $: CheerioAPI,
  cells: Cheerio<any>,
): Omit<PremiumImportRow, 'wheelType' | 'notes' | 'castingNameLink'> {
  const r = parsePremiumWikiRowForImport($, cells);
  return {
    toyNumber: r.toyNumber.replace(/[\/\\<>:"|?*]/g, '_'),
    collectorNumber: r.collectorNumber,
    castingName: r.castingName,
    bodyColor: r.bodyColor,
  };
}

const SKIP_HEADING = /^(contents|references|see also|external links|categories)$/i;

/**
 * Prefer `.mw-headline` inside the preceding h2/h3/h4 so the name is "Mix 2", not "Mix 2[Sign in to edit]".
 */
export function extractFastFuriousPremiumSubSeriesName($: CheerioAPI, table: unknown): string {
  const prevH = $(table as any).prevAll('h2, h3, h4').first();
  if (prevH.length > 0) {
    const fromHeadline = prevH.find('.mw-headline').first().text().trim();
    if (fromHeadline && !SKIP_HEADING.test(fromHeadline)) {
      return fromHeadline.replace(/\[\]$/, '').trim();
    }
    let headingText = prevH.text().trim();
    if (headingText && !SKIP_HEADING.test(headingText)) {
      headingText = headingText.replace(/\s*\[[^\]]*\]\s*$/u, '').trim();
      return headingText.replace(/\[\]$/, '').trim();
    }
  }
  const caption = $(table as any).find('caption').text().trim();
  if (caption && !SKIP_HEADING.test(caption)) {
    return caption.replace(/\[\]$/, '').trim();
  }
  const prevHeadline = $(table as any).prevAll('span.mw-headline').first();
  if (prevHeadline.length > 0) {
    const headlineText = prevHeadline.text().trim();
    if (headlineText && !SKIP_HEADING.test(headlineText)) {
      return headlineText.replace(/\[\]$/, '').trim();
    }
  }
  return 'Unknown Series';
}

/** Resolve Photo Loose / Photo Carded column indices from the table header (falls back to last two columns). */
export function getFastFuriousPremiumPhotoColumnIndices(
  $: CheerioAPI,
  table: unknown,
): { looseIdx: number; cardedIdx: number } {
  const headerRow = $(table as any)
    .find('tr')
    .filter((_: number, tr: unknown) => $(tr as any).find('th').length >= 2)
    .first();
  const ths = headerRow.find('th');
  let looseIdx = -1;
  let cardedIdx = -1;
  ths.each((i: number, el: unknown) => {
    const t = $(el as any)
      .text()
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    if (/\bphoto\s+loose\b/.test(t) || t === 'loose') looseIdx = i;
    if (/\bphoto\s+carded\b/.test(t) || t === 'carded') cardedIdx = i;
  });
  const n = ths.length;
  if (looseIdx < 0 || cardedIdx < 0) {
    if (n >= 2) {
      return { looseIdx: n - 2, cardedIdx: n - 1 };
    }
    return { looseIdx: -1, cardedIdx: -1 };
  }
  return { looseIdx, cardedIdx };
}
