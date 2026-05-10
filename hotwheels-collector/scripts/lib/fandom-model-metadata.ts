/**
 * Scrape model infobox / intro from a Hot Wheels Fandom wiki article.
 * Uses fetchFandomWikiHtml (403-safe).
 */

import * as cheerio from 'cheerio';
import { fetchFandomWikiHtml } from './fandom-fetch.ts';

export async function fetchFandomModelMetadata(modelUrl: string): Promise<{
  debutSeries: string | null;
  produced: string | null;
  designer: string | null;
  castingNumber: string | null;
  description: string | null;
}> {
  const empty = {
    debutSeries: null as string | null,
    produced: null as string | null,
    designer: null as string | null,
    castingNumber: null as string | null,
    description: null as string | null,
  };

  try {
    const html = await fetchFandomWikiHtml(modelUrl);
    const $ = cheerio.load(html);

    let debutSeries: string | null = null;
    let produced: string | null = null;
    let designer: string | null = null;
    let castingNumber: string | null = null;
    let description: string | null = null;

    const infobox = $('.infobox, .wikitable').first();
    if (infobox.length > 0) {
      infobox.find('tr').each((_, row) => {
        const cells = $(row).find('td, th');
        if (cells.length >= 2) {
          const label = $(cells[0]).text().trim().toLowerCase();
          const value = $(cells[1]).text().trim();

          if (/debut|first.*appear/i.test(label)) {
            debutSeries = value || null;
          }
          if (/produced|years/i.test(label)) {
            produced = value || null;
          }
          if (/designer/i.test(label)) {
            designer = value || null;
          }
          if (/number|casting.*number/i.test(label)) {
            castingNumber = value || null;
          }
        }
      });
    }

    const descriptionPara = $('p').first().text().trim();
    if (descriptionPara && descriptionPara.length > 20) {
      description = descriptionPara;
    }

    return {
      debutSeries,
      produced,
      designer,
      castingNumber,
      description,
    };
  } catch (error) {
    console.warn(`Error fetching model metadata from ${modelUrl}:`, error);
    return empty;
  }
}
