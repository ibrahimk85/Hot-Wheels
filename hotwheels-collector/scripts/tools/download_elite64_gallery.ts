/**
 * Script to download Elite 64 Gallery images from the wiki
 * 
 * This script:
 * 1. Fetches the Elite 64 wiki page
 * 2. Finds the Gallery section
 * 3. Downloads all gallery images
 * 4. Creates Image records with isGalleryImage=true
 * 5. Stores images with their names from the gallery
 * 
 * Usage:
 *   npx ts-node scripts/tools/download_elite64_gallery.ts
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const ELITE64_URL = 'https://hotwheels.fandom.com/wiki/Elite_64';

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function downloadImage(url: string, dest: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download image ${url}: ${res.status} ${res.statusText}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await fs.promises.writeFile(dest, buffer);
}

function cleanImageUrl(imgUrl: string): string {
  if (imgUrl.startsWith('//')) {
    imgUrl = 'https:' + imgUrl;
  }
  
  let fullImgUrl = imgUrl
    .replace(/\/scale-to-width-down\/\d+/g, '')
    .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '')
    .replace(/\/revision\/latest\/scale-to-width-down\/\d+/g, '');
  
  return fullImgUrl;
}

async function main() {
  console.log('Fetching Elite 64 page for Gallery section...');
  const response = await fetch(ELITE64_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${ELITE64_URL}: ${response.status} ${response.statusText}`);
  }
  const html = await response.text();
  const $ = cheerio.load(html);

  // Find Gallery section
  // Look for heading containing "Gallery" or similar
  const allHeaders = $('h2, h3');
  let galleryHeader: any = null;
  
  allHeaders.each((_, el) => {
    const text = $(el).text().trim().toLowerCase();
    if (text.includes('gallery')) {
      galleryHeader = el;
      return false; // break
    }
  });
  
  if (!galleryHeader) {
    console.log('Gallery section not found on the page');
    return;
  }
  
  console.log(`Found Gallery section: "${$(galleryHeader).text().trim()}"`);

  // Get Elite 64 collection (any year, we'll use the first one)
  const elite64Collection = await prisma.collection.findFirst({
    where: {
      name: 'Elite 64',
    },
  });

  if (!elite64Collection) {
    console.log('Elite 64 collection not found. Please run import scripts first.');
    return;
  }

  // Create gallery directory
  // Gallery images are stored in: public/images/hotwheels/elite64/gallery
  const galleryDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', 'elite64', 'gallery');
  await fs.promises.mkdir(galleryDir, { recursive: true });

  // Find gallery images after the header
  let current: any = galleryHeader;
  let depth = 0;
  const maxDepth = 100;
  let imagesFound = 0;
  let imagesDownloaded = 0;
  let imagesCreated = 0;

  // Look for gallery structure - could be in a gallery div, or images with captions
  while (depth < maxDepth && current) {
    current = current.nextSibling;
    if (!current) break;
    
    const $current = $(current);
    const tagName = current.tagName?.toLowerCase();
    
    // Stop at next major section
    if (tagName === 'h2' || (tagName === 'h3' && !$current.text().toLowerCase().includes('gallery'))) {
      break;
    }
    
    // Look for images in gallery structures
    const images = $current.find('img, .gallery img, .wikia-gallery-item img');
    
    if (images.length > 0) {
      // Convert Cheerio collection to array and process async
      const imageElements = Array.from(images);
      for (const imgEl of imageElements) {
        const $img = $(imgEl);
        let imgUrl = $img.attr('data-src') || $img.attr('src') || null;
        
        if (!imgUrl) continue;
        
        // Skip placeholder images
        if (imgUrl.includes('Image_Not_Available') || 
            imgUrl.includes('Image%5FNot%5FAvailable') ||
            imgUrl.includes('placeholder')) {
          continue;
        }
        
        imgUrl = cleanImageUrl(imgUrl);
        
        // Get image name from caption or alt text
        let imageName = $img.attr('alt') || '';
        
        // Try to find caption in parent elements
        const $parent = $img.closest('.gallery-item, .wikia-gallery-item, figure, .thumb');
        if ($parent.length > 0) {
          const caption = $parent.find('.gallery-text, figcaption, .thumbcaption').text().trim();
          if (caption) {
            imageName = caption;
          }
        }
        
        // If no name found, try to extract from filename
        if (!imageName) {
          const urlObj = new (globalThis.URL || require('url').URL)(imgUrl);
          const pathParts = urlObj.pathname.split('/');
          const filename = pathParts[pathParts.length - 1];
          imageName = filename.replace(/\.(jpg|jpeg|png|gif)$/i, '').replace(/[-_]/g, ' ');
        }
        
        if (!imageName) {
          imageName = 'Elite 64 Gallery Image';
        }
        
        imagesFound++;
        
        // Download image
        const urlObj = new (globalThis.URL || require('url').URL)(imgUrl);
        const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
        const ext = extMatch ? extMatch[1] : 'jpg';
        const fileName = `${slugify(imageName)}.${ext}`;
        const destPath = path.join(galleryDir, fileName);
        const relativePath = `/images/hotwheels/elite64/gallery/${fileName}`;
        
        // Check if image already exists (by path)
        // Gallery images are in /elite64/gallery/ path
        const existingImage = await prisma.image.findFirst({
          where: {
            OR: [
              { path: relativePath },
              { path: { contains: `/elite64/gallery/${fileName}` } },
              { path: { contains: `/gallery/elite64/${fileName}` } }, // Fallback for old path
            ],
          },
        });
        
        if (existingImage) {
          console.log(`  Skipping existing image: ${imageName}`);
          continue;
        }
        
        if (!fs.existsSync(destPath)) {
          try {
            await downloadImage(imgUrl, destPath);
            imagesDownloaded++;
            console.log(`  Downloaded: ${imageName} → ${fileName}`);
          } catch (err) {
            console.error(`  Error downloading ${imageName}:`, err);
            continue;
          }
        }
        
        // Create image record (gallery images don't need to be linked to a model initially)
        // Gallery images are identified by /gallery/ path and name field
        try {
          await prisma.image.create({
            data: {
              path: relativePath,
              alt: imageName,
              name: imageName,
              // isGalleryImage field will be set via migration, but we identify by path/name
              // Don't connect to model or variant - these are standalone gallery images
              // They can be linked later via the Gallery UI
            },
          });
          imagesCreated++;
        } catch (err: any) {
          if (err.code !== 'P2002') {
            console.error(`  Error creating image record for ${imageName}:`, err);
          }
        }
        
        // Small delay
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    depth++;
  }

  console.log(`\n=== Gallery Download Summary ===`);
  console.log(`Images found: ${imagesFound}`);
  console.log(`Images downloaded: ${imagesDownloaded}`);
  console.log(`Image records created: ${imagesCreated}`);
  console.log('\nGallery download completed!');
}

main()
  .catch((err) => {
    console.error('Error during gallery download:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

