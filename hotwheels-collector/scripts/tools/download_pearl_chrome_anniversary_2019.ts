/**
 * Script to download images for 2019 Pearl&Chrome Anniversary Series (Satin and Chrome Series).
 *
 * How to use:
 *   npx ts-node scripts/tools/download_pearl_chrome_anniversary_2019.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import http from 'http';

const prisma = new PrismaClient();
const YEAR = 2019;
const COLLECTION_NAME = 'Pearl&Chrome Anniversary Series';
const WIKI_URL = 'https://hotwheels.fandom.com/wiki/Satin_and_Chrome_Series_(2019)';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanImageUrl(url: string): string {
  let cleaned = url
    .replace(/\/revision\/[^/]+/, '')
    .replace(/\/scale-to-width-down\/\d+/, '')
    .replace(/\/scale-to-width\/\d+/, '')
    .replace(/\?.*$/, '');

  if (cleaned.startsWith('//')) {
    cleaned = 'https:' + cleaned;
  } else if (cleaned.startsWith('/')) {
    cleaned = 'https://static.wikia.nocookie.net' + cleaned;
  }

  return cleaned;
}

async function downloadImage(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https:') ? https : http;
    
    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        return downloadImage(response.headers.location || url, destPath)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }

      const fileStream = fs.createWriteStream(destPath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve();
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(destPath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function fetchWithRetry(url: string, retries = 3, delay = 2000): Promise<string> {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Cache-Control': 'max-age=0',
    'Referer': 'https://hotwheels.fandom.com/'
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${retries} to fetch ${url}…`);
      const resp = await fetch(url, { headers });
      
      if (!resp.ok) {
        throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);
      }

      const html = await resp.text();
      
      if (html.includes('Client Challenge') || html.includes('title>Client Challenge') || html.length < 5000) {
        throw new Error('Received bot challenge page');
      }

      console.log(`Successfully fetched ${url} (${html.length} characters)`);
      return html;
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt < retries) {
        console.log(`Waiting ${delay}ms before retry…`);
        await sleep(delay);
        delay *= 1.5;
      } else {
        throw error;
      }
    }
  }

  throw new Error('All retry attempts failed');
}

async function processTable(table: cheerio.Cheerio<cheerio.Element>, $: cheerio.CheerioAPI, baseDir: string, mixNumber: string | null) {
  const rows = table.find('tbody tr');
  let downloadCount = 0;
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const cells = $(row).find('td');
    
    if (cells.length === 0) continue;

    const cardNumber = cells.length > 1 ? $(cells[1]).text().trim() : '';
    const castingName = cells.length > 2 ? $(cells[2]).text().trim() : '';

    if (!cardNumber || !castingName) {
      skippedCount++;
      continue;
    }

    const cleanCastingName = castingName.replace(/\[\[.*?\|(.*?)\]\]/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1').trim();
    const castingSlug = slugify(cleanCastingName);
    const mixFolder = mixNumber ? `mix-${mixNumber}` : '';
    const targetFolder = mixFolder 
      ? path.join(baseDir, mixFolder, castingSlug)
      : path.join(baseDir, castingSlug);
    await fs.promises.mkdir(targetFolder, { recursive: true });

    const variant = await prisma.variant.findFirst({
      where: {
        cardNumber: cardNumber,
        year: YEAR,
        model: {
          collection: {
            name: COLLECTION_NAME,
            year: { year: YEAR },
          },
        },
      },
      include: { images: true },
    });

    if (!variant) {
      skippedCount++;
      continue;
    }

    const imageTypes = [
      { type: 'carded', order: 1, columnIndex: 8, isMain: true },
      { type: 'loose', order: 2, columnIndex: 7, isMain: false },
    ] as const;

    for (const imageType of imageTypes) {
      const cellIndex = imageType.columnIndex;
      if (cells.length <= cellIndex) continue;

      const imgElement = $(cells[cellIndex]).find('img').first();
      let imgUrl = imgElement.attr('data-src') || imgElement.attr('src');

      if (!imgUrl) continue;

      const fullImgUrl = cleanImageUrl(imgUrl);
      const altText = imgElement.attr('alt') || `${cleanCastingName} - ${imageType.type}`;

      const urlObj = new URL(fullImgUrl);
      const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
      const ext = extMatch ? extMatch[1] : 'jpg';
      const fileName = `${cardNumber}_${imageType.type}.${ext}`;
      const destPath = path.join(targetFolder, fileName);

      const existingImage = variant.images.find(img => img.notes === imageType.type);

      if (existingImage) {
        skippedCount++;
        continue;
      }

      if (!fs.existsSync(destPath)) {
        try {
          await downloadImage(fullImgUrl, destPath);
          downloadCount++;
          console.log(`Downloaded ${imageType.type} image for ${cleanCastingName} (Card#: ${cardNumber}) → ${fileName}`);
        } catch (err) {
          console.error(`Error downloading ${fullImgUrl}:`, err);
          errorCount++;
          continue;
        }
      }

      const relativePath = path.join('/images', 'hotwheels', YEAR.toString(), 'pearl-chrome-anniversary', mixFolder, castingSlug, fileName)
        .replace(/\\/g, '/').replace(/\/+/g, '/');

      try {
        const imageRecord = await prisma.image.create({
          data: {
            path: relativePath,
            alt: altText,
            variant: { connect: { id: variant.id } },
            notes: imageType.type,
            order: imageType.order,
          },
        });
        
        if (imageType.isMain) {
          await prisma.variant.update({
            where: { id: variant.id },
            data: { imageId: imageRecord.id },
          });
        }
        
        createdCount++;
        console.log(`Created ${imageType.type} image record for ${cleanCastingName} (Card#: ${cardNumber})${imageType.isMain ? ' [MAIN]' : ''}`);
      } catch (err) {
        console.error(`Error creating ${imageType.type} image record for ${cleanCastingName} (Card#: ${cardNumber}):`, err);
        errorCount++;
      }
    }
  }

  return { downloadCount, createdCount, skippedCount, errorCount };
}

async function main() {
  console.log(`\n=== Processing Year ${YEAR} ===`);

  const variants = await prisma.variant.findMany({
    where: {
      year: YEAR,
      model: {
        collection: {
          name: COLLECTION_NAME,
          year: { year: YEAR },
        },
      },
    },
  });

  if (variants.length > 0) {
    console.log('Deleting existing images...');
    for (const variant of variants) {
      await prisma.image.deleteMany({ where: { variantId: variant.id } });
      await prisma.variant.update({ where: { id: variant.id }, data: { imageId: null } });
    }
    console.log(`Deleted images for ${variants.length} variants`);
  }

  let html: string;
  try {
    html = await fetchWithRetry(WIKI_URL);
  } catch (error) {
    console.error(`Failed to fetch ${WIKI_URL} after retries:`, error);
    return;
  }

  const $ = cheerio.load(html);

  const yearHeading = $('h2, h3, h4').filter((_, el) => {
    const text = $(el).text().trim();
    return text.includes(String(YEAR)) || text.includes('Mix 1') || text.includes('Mix 2');
  }).first();

  let tablesToProcess: Array<{ table: cheerio.Cheerio<cheerio.Element>; mixNumber: string | null }> = [];

  if (yearHeading.length > 0) {
    const mixHeadings = $('h2, h3, h4').filter((_, el) => {
      const text = $(el).text().trim();
      return /Mix\s+[12]/i.test(text);
    });

    if (mixHeadings.length > 0) {
      mixHeadings.each((_, heading) => {
        const mixText = $(heading).text().trim();
        const mixMatch = mixText.match(/Mix\s+([12])/i);
        const mixNumber = mixMatch ? mixMatch[1] : null;
        
        const nextHeading = $(heading).nextAll('h2, h3, h4').first();
        let table;
        if (nextHeading.length > 0) {
          table = $(heading).nextUntil(nextHeading).filter('table.wikitable').first();
        } else {
          table = $(heading).nextAll('table.wikitable').first();
        }
        
        if (table.length > 0) {
          tablesToProcess.push({ table, mixNumber });
        }
      });
    } else {
      const table = yearHeading.nextUntil('h2, h3, h4').filter('table.wikitable').first();
      if (table.length === 0) {
        table = yearHeading.next('table.wikitable').first();
      }
      if (table.length > 0) {
        tablesToProcess = [{ table, mixNumber: null }];
      }
    }
  } else {
    const table = $('table.wikitable').first();
    if (table.length > 0) {
      tablesToProcess = [{ table, mixNumber: null }];
    }
  }

  if (tablesToProcess.length === 0) {
    console.error(`Could not find any tables on ${WIKI_URL}`);
    return;
  }

  const baseDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', YEAR.toString(), 'pearl-chrome-anniversary');
  await fs.promises.mkdir(baseDir, { recursive: true });

  let totalDownload = 0;
  let totalCreated = 0;
  let totalSkipped = 0;
  let totalError = 0;

  for (const { table, mixNumber } of tablesToProcess) {
    const result = await processTable(table, $, baseDir, mixNumber);
    totalDownload += result.downloadCount;
    totalCreated += result.createdCount;
    totalSkipped += result.skippedCount;
    totalError += result.errorCount;
  }

  console.log(`\n=== Year ${YEAR} completed ===`);
  console.log(`  - Images downloaded: ${totalDownload}`);
  console.log(`  - Image records created: ${totalCreated}`);
  console.log(`  - Skipped: ${totalSkipped}`);
  console.log(`  - Errors: ${totalError}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
