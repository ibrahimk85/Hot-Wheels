/**
 * Script to download Red Line Club (RLC) Gallery images from the wiki
 * 
 * This script downloads gallery images for a specific year:
 * 1. Fetches the RLC year wiki page (e.g., 2025_HWC/RLC_Releases)
 * 2. Finds the Gallery section
 * 3. Downloads all gallery images
 * 4. Creates Image records with isGalleryImage=true
 * 5. Stores images with their names from the gallery
 * 
 * Usage:
 *   npx ts-node scripts/tools/download_rlc_gallery.ts 2025
 *   npx ts-node scripts/tools/download_rlc_gallery.ts 2024
 *   etc.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// Get year from command line argument
const TARGET_YEAR = process.argv[2] ? parseInt(process.argv[2]) : 2025;
const RLC_URL = `https://hotwheels.fandom.com/wiki/${TARGET_YEAR}_HWC/RLC_Releases`;
const COLLECTION_NAME = 'Red Line Club';

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
  console.log(`\n=== Downloading RLC Gallery Images for ${TARGET_YEAR} ===\n`);
  console.log(`Fetching RLC ${TARGET_YEAR} page for Gallery section...`);
  
  const response = await fetch(RLC_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${RLC_URL}: ${response.status} ${response.statusText}`);
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

  // Get RLC collection for this year
  const yearRecord = await prisma.year.findFirst({
    where: { year: TARGET_YEAR },
  });

  if (!yearRecord) {
    console.log(`Year ${TARGET_YEAR} not found. Please run import scripts first.`);
    return;
  }

  const rlcCollection = await prisma.collection.findFirst({
    where: {
      name: COLLECTION_NAME,
      yearId: yearRecord.id,
    },
  });

  if (!rlcCollection) {
    console.log(`RLC collection for year ${TARGET_YEAR} not found. Please run import scripts first.`);
    return;
  }

  // Create gallery directory
  // Gallery images are stored in: public/images/hotwheels/{year}/rlc/gallery
  const yearFolder = TARGET_YEAR.toString();
  const galleryDir = path.join(process.cwd(), 'public', 'images', 'hotwheels', yearFolder, 'rlc', 'gallery');
  await fs.promises.mkdir(galleryDir, { recursive: true });

  // Find gallery images after the header
  let current: any = galleryHeader;
  let depth = 0;
  const maxDepth = 200; // RLC galleries might be longer
  let imagesFound = 0;
  let imagesDownloaded = 0;
  let imagesCreated = 0;

  // Look for gallery structure - could be in a gallery div, or images with captions
  while (depth < maxDepth && current) {
    current = current.nextSibling;
    if (!current) break;
    
    const $current = $(current);
    const tagName = current.tagName?.toLowerCase();
    
    // Stop at next major section (h2 or h3 that's not gallery-related)
    if (tagName === 'h2' || (tagName === 'h3' && !$current.text().toLowerCase().includes('gallery'))) {
      break;
    }
    
    // Look for images in gallery structures
    const images = $current.find('img, .gallery img, .wikia-gallery-item img, .thumb img');
    
    if (images.length > 0) {
      // Use for loop instead of each to support async/await
      for (let i = 0; i < images.length; i++) {
        const imgEl = images[i];
        const $img = $(imgEl);
        let imgUrl = $img.attr('data-src') || $img.attr('src') || null;
        
        if (!imgUrl) continue;
        
        // Skip placeholder images
        if (imgUrl.includes('Image_Not_Available') || 
            imgUrl.includes('Image%5FNot%5FAvailable') ||
            imgUrl.includes('placeholder') ||
            imgUrl.includes('data:image')) {
          continue;
        }
        
        imgUrl = cleanImageUrl(imgUrl);
        
        // Get image name from caption or alt text
        let imageName = $img.attr('alt') || '';
        
        // Try to find caption in parent elements
        const $parent = $img.closest('.gallery-item, .wikia-gallery-item, figure, .thumb, .thumbinner');
        if ($parent.length > 0) {
          const caption = $parent.find('.gallery-text, figcaption, .thumbcaption, .thumbcaption').text().trim();
          if (caption) {
            imageName = caption;
          }
        }
        
        // If no name found, try to extract from filename
        if (!imageName || imageName.length < 3) {
          try {
            const urlObj = new URL(imgUrl);
            const pathParts = urlObj.pathname.split('/');
            const filename = pathParts[pathParts.length - 1];
            imageName = filename.replace(/\.(jpg|jpeg|png|gif)$/i, '').replace(/[-_]/g, ' ');
          } catch (e) {
            // URL parsing failed, use default
          }
        }
        
        if (!imageName || imageName.length < 3) {
          imageName = `RLC ${TARGET_YEAR} Gallery Image ${imagesFound + 1}`;
        }
        
        imagesFound++;
        
        // Download image
        let ext = 'jpg';
        try {
          const urlObj = new URL(imgUrl);
          const extMatch = urlObj.pathname.match(/\.([a-zA-Z0-9]+)$/);
          if (extMatch) {
            ext = extMatch[1].toLowerCase();
          }
        } catch (e) {
          // Use default jpg
        }
        
        // Create unique filename with year prefix to avoid conflicts
        const baseFileName = slugify(imageName);
        // Add year prefix to avoid conflicts with same-named images from different years
        let fileName = `${TARGET_YEAR}-${baseFileName}.${ext}`;
        let counter = 1;
        
        // Ensure unique filename (in case same image name exists in same year)
        while (fs.existsSync(path.join(galleryDir, fileName))) {
          fileName = `${TARGET_YEAR}-${baseFileName}-${counter}.${ext}`;
          counter++;
        }
        
        const destPath = path.join(galleryDir, fileName);
        const relativePath = `/images/hotwheels/${yearFolder}/rlc/gallery/${fileName}`;
        
        // Check if image already exists (by path)
        const existingImage = await prisma.image.findFirst({
          where: {
            OR: [
              { path: relativePath },
              { path: { contains: `/rlc/gallery/${fileName}` } },
              { path: { contains: `/gallery/rlc/${fileName}` } }, // Fallback for old path
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
          } catch (err: any) {
            console.error(`  Error downloading ${imageName}:`, err.message);
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
              isGalleryImage: true,
              // Don't connect to model or variant - these are standalone gallery images
              // They can be linked later via the Gallery UI
            },
          });
          imagesCreated++;
        } catch (err: any) {
          if (err.code !== 'P2002') {
            console.error(`  Error creating image record for ${imageName}:`, err.message);
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    depth++;
  }

  console.log(`\n=== Gallery Download Summary for ${TARGET_YEAR} ===`);
  console.log(`Images found: ${imagesFound}`);
  console.log(`Images downloaded: ${imagesDownloaded}`);
  console.log(`Image records created: ${imagesCreated}`);
  console.log(`\nGallery download completed for ${TARGET_YEAR}!`);
}

main()
  .catch((err) => {
    console.error('Error during gallery download:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

