/**
 * Fandom/Wikia often returns 403 to minimal fetch() clients. Use browser-like headers,
 * try ?action=render, and optional local HTML for offline runs.
 */

import fs from 'fs/promises';
import fsSync from 'fs';

/** Document fetch (wiki pages) */
export const FANDOM_DOC_HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept:
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://hotwheels.fandom.com/',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Cache-Control': 'max-age=0',
};

/** Static image CDN (wikia) — Referer often required */
export const FANDOM_IMAGE_HEADERS: Record<string, string> = {
  'User-Agent': FANDOM_DOC_HEADERS['User-Agent']!,
  Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  Referer: 'https://hotwheels.fandom.com/',
  'Sec-Fetch-Dest': 'image',
  'Sec-Fetch-Mode': 'no-cors',
  'Sec-Fetch-Site': 'cross-site',
};

function renderUrl(canonicalUrl: string): string {
  return canonicalUrl.includes('?')
    ? `${canonicalUrl}&action=render`
    : `${canonicalUrl}?action=render`;
}

/** e.g. https://hotwheels.fandom.com/wiki/List_of_2009_Hot_Wheels → "List of 2009 Hot Wheels" */
export function wikiPageTitleFromArticleUrl(canonicalWikiUrl: string): string {
  let pathname: string;
  try {
    pathname = new URL(canonicalWikiUrl).pathname;
  } catch {
    throw new Error(`Invalid wiki URL: ${canonicalWikiUrl}`);
  }
  const wikiIdx = pathname.indexOf('/wiki/');
  if (wikiIdx < 0) {
    throw new Error(`URL has no /wiki/ segment: ${canonicalWikiUrl}`);
  }
  const raw = pathname.slice(wikiIdx + '/wiki/'.length);
  return decodeURIComponent(raw).replace(/_/g, ' ');
}

/**
 * MediaWiki parse API often returns 200 when /wiki/ HTML gets 403 (different path / bot rules).
 */
async function fetchWikiHtmlViaMediaWikiApi(
  canonicalWikiUrl: string,
  headers: Record<string, string>,
): Promise<string | null> {
  let origin: string;
  let title: string;
  try {
    const u = new URL(canonicalWikiUrl);
    origin = `${u.protocol}//${u.host}`;
    title = wikiPageTitleFromArticleUrl(canonicalWikiUrl);
  } catch {
    return null;
  }

  const api = new URL(`${origin}/api.php`);
  api.searchParams.set('action', 'parse');
  api.searchParams.set('page', title);
  api.searchParams.set('prop', 'text');
  api.searchParams.set('format', 'json');
  api.searchParams.set('formatversion', '2');

  const res = await fetch(api.toString(), { headers, redirect: 'follow' });
  if (!res.ok) {
    console.warn(`MediaWiki API parse failed (${res.status}): ${api.toString()}`);
    return null;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return null;
  }

  const parse = (data as { parse?: { text?: string | { '*': string } }; error?: { info?: string } })
    .parse;
  if (!parse?.text) {
    const errInfo = (data as { error?: { info?: string } }).error?.info;
    if (errInfo) console.warn(`MediaWiki API: ${errInfo}`);
    return null;
  }

  const t = parse.text;
  const html = typeof t === 'string' ? t : t['*'];
  if (!html || html.length < 500) return null;

  console.log(`Fetched OK via MediaWiki API (parse): ${title}`);
  return html;
}

function docHeadersWithOptionalCookie(): Record<string, string> {
  const h = { ...FANDOM_DOC_HEADERS };
  const cookie = process.env.FANDOM_COOKIE?.trim();
  if (cookie) {
    h.Cookie = cookie;
    console.log('Using FANDOM_COOKIE from environment for wiki requests.');
  }
  return h;
}

/**
 * Load wiki article HTML. Set FANDOM_WIKI_HTML_PATH to a saved .html file to skip network.
 */
export async function fetchFandomWikiHtml(canonicalWikiUrl: string): Promise<string> {
  const localPath = process.env.FANDOM_WIKI_HTML_PATH?.trim();
  if (localPath) {
    console.log(`Using local wiki HTML (FANDOM_WIKI_HTML_PATH): ${localPath}`);
    return fsSync.readFileSync(localPath, 'utf-8');
  }

  const attempts: string[] = [canonicalWikiUrl, renderUrl(canonicalWikiUrl)];
  const headers = docHeadersWithOptionalCookie();

  let lastStatus = 0;
  for (const url of attempts) {
    const res = await fetch(url, { headers, redirect: 'follow' });
    lastStatus = res.status;
    if (res.ok) {
      if (url !== canonicalWikiUrl) {
        console.log(`Fetched OK via action=render: ${url}`);
      }
      return res.text();
    }
    console.warn(`Fetch failed (${res.status}): ${url}`);
  }

  const viaApi = await fetchWikiHtmlViaMediaWikiApi(canonicalWikiUrl, headers);
  if (viaApi) {
    return viaApi;
  }

  throw new Error(
    `Fandom blocked wiki HTML (${lastStatus}) and MediaWiki API parse also failed. Try: FANDOM_WIKI_HTML_PATH, FANDOM_COOKIE, or VPN.`,
  );
}

/** Download a static asset from Fandom CDN / wiki with image-friendly headers. */
export async function downloadFandomBinary(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, { headers: FANDOM_IMAGE_HEADERS, redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(destPath, buffer);
}
