/**
 * Parse the Hot Wheels Fandom hub page for "List of YYYY Hot Wheels" links
 * (Yearly Lists → By year). Used to refresh scripts/config/mainline_urls.json.
 */

import * as cheerio from 'cheerio';

export const HOT_WHEELS_HUB_WIKI_URL = 'https://hotwheels.fandom.com/wiki/Hot_Wheels';

const ORIGIN = 'https://hotwheels.fandom.com';

function absolutize(href: string): string {
  if (href.startsWith('http')) return href.split('#')[0]!;
  const path = href.startsWith('/') ? href : `/${href}`;
  return `${ORIGIN}${path}`.split('#')[0]!;
}

/** Extract calendar year from a /wiki/... path like List_of_2010_Hot_Wheels_(International). */
export function yearFromListOfHotWheelsPath(pathname: string): number | null {
  const decoded = decodeURIComponent(pathname);
  const m = decoded.match(/List_of_(20\d{2})_Hot_Wheels/i);
  return m ? parseInt(m[1]!, 10) : null;
}

/**
 * Collect List_of_*_Hot_Wheels links from hub HTML. When multiple URLs exist for one year
 * (e.g. 2010 USA vs International), prefers (International) then longest path.
 */
export function extractMainlineListUrlsFromHubHtml(html: string): Map<number, string> {
  const $ = cheerio.load(html);
  const byYear = new Map<number, string[]>();

  $('a[href*="List_of_"][href*="Hot_Wheels"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || href.includes('redlink=1')) return;

    let pathname: string;
    try {
      pathname = new URL(absolutize(href)).pathname;
    } catch {
      return;
    }
    if (!/\/wiki\//i.test(pathname)) return;

    const year = yearFromListOfHotWheelsPath(pathname);
    if (year === null || year < 1968 || year > 2100) return;

    const abs = absolutize(href);
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(abs);
  });

  const chosen = new Map<number, string>();
  for (const [year, urls] of byYear) {
    const uniq = [...new Set(urls)];

    const wikiTail = (u: string): string => {
      try {
        const p = decodeURIComponent(new URL(u).pathname);
        const i = p.indexOf('/wiki/');
        return i >= 0 ? p.slice(i + '/wiki/'.length) : p;
      } catch {
        return '';
      }
    };

    // 2010 mainline import uses the International list page when both USA and Intl exist.
    if (year === 2010) {
      const intlRe = /^List_of_2010_Hot_Wheels_\(International\)$/i;
      const intl = uniq.find(u => intlRe.test(wikiTail(u)));
      if (intl) {
        chosen.set(year, intl);
        continue;
      }
    }

    // Prefer canonical page title exactly List_of_YYYY_Hot_Wheels (imports use this layout).
    const exactRe = new RegExp(`^List_of_${year}_Hot_Wheels$`, 'i');
    const canonical = uniq.filter(u => exactRe.test(wikiTail(u)));
    if (canonical.length === 1) {
      chosen.set(year, canonical[0]!);
      continue;
    }
    if (canonical.length > 1) {
      canonical.sort((a, b) => a.length - b.length);
      chosen.set(year, canonical[0]!);
      continue;
    }

    if (uniq.length === 1) {
      chosen.set(year, uniq[0]!);
      continue;
    }
    const intl = uniq.find(u => /\(International\)/i.test(u));
    if (intl) {
      chosen.set(year, intl);
      continue;
    }
    uniq.sort((a, b) => a.length - b.length);
    chosen.set(year, uniq[0]!);
  }

  return chosen;
}
