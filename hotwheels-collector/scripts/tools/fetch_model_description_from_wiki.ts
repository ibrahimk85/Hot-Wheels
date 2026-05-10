/**
 * Script to fetch model descriptions from Hot Wheels Wiki and update the database.
 *
 * This script searches for models by casting name on the Hot Wheels Fandom wiki,
 * extracts the description/info section, and updates the Model.description field.
 *
 * Usage:
 *   1. Install cheerio if you haven't already:
 *        npm install cheerio
 *
 *   2. Run with ts-node:
 *        npx ts-node scripts/tools/fetch_model_description_from_wiki.ts [modelId]
 *
 *   3. Or to update all models without descriptions:
 *        npx ts-node scripts/tools/fetch_model_description_from_wiki.ts --all
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as cheerio from 'cheerio';

const prisma = new PrismaClient();

// Helper function to slugify a name for URL
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Helper function to search for model page on wiki
async function searchWikiPage(castingName: string): Promise<string | null> {
  try {
    // Try direct page URL first (most common format)
    const slug = slugify(castingName);
    const directUrl = `https://hotwheels.fandom.com/wiki/${slug}`;
    
    const response = await fetch(directUrl);
    if (response.ok) {
      const html = await response.text();
      const $ = cheerio.load(html);
      
      // Check if this is a valid model page (has casting info)
      const pageTitle = $('h1.page-header__title').text().trim();
      if (pageTitle && pageTitle.toLowerCase().includes(castingName.toLowerCase())) {
        return directUrl;
      }
    }
    
    // If direct URL doesn't work, try searching
    const searchUrl = `https://hotwheels.fandom.com/wiki/Special:Search?query=${encodeURIComponent(castingName)}`;
    const searchResponse = await fetch(searchUrl);
    
    if (searchResponse.ok) {
      const html = await searchResponse.text();
      const $ = cheerio.load(html);
      
      // Find first result link
      const firstResult = $('.unified-search__result a').first();
      if (firstResult.length > 0) {
        const href = firstResult.attr('href');
        if (href) {
          return href.startsWith('http') ? href : `https://hotwheels.fandom.com${href}`;
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error searching for ${castingName}:`, error);
    return null;
  }
}

// Extract description from wiki page
async function extractDescription(url: string): Promise<string | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Try to find description in various common locations
    let description = '';
    
    // Method 1: Look for infobox description
    const infoboxDesc = $('.infobox .infobox-data').first().text().trim();
    if (infoboxDesc) {
      description = infoboxDesc;
    }
    
    // Method 2: Look for first paragraph after infobox
    if (!description) {
      const firstPara = $('.mw-parser-output > p').first().text().trim();
      if (firstPara && firstPara.length > 50) {
        description = firstPara;
      }
    }
    
    // Method 3: Look for "Description" or "Info" section
    if (!description) {
      $('.mw-heading, h2').each((_, el) => {
        const heading = $(el).text().toLowerCase();
        if (heading.includes('description') || heading.includes('info') || heading.includes('about')) {
          const nextPara = $(el).next('p').text().trim();
          if (nextPara) {
            description = nextPara;
            return false; // break
          }
        }
      });
    }
    
    // Clean up description
    if (description) {
      description = description
        .replace(/\s+/g, ' ')
        .trim()
        .substring(0, 2000); // Limit to 2000 chars
    }
    
    return description || null;
  } catch (error) {
    console.error(`Error extracting description from ${url}:`, error);
    return null;
  }
}

// Update a single model
async function updateModelDescription(modelId: number): Promise<boolean> {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
  });
  
  if (!model) {
    console.error(`Model with ID ${modelId} not found`);
    return false;
  }
  
  if (model.description) {
    console.log(`Model ${model.castingName} already has a description, skipping...`);
    return false;
  }
  
  console.log(`Fetching description for: ${model.castingName}`);
  
  const wikiUrl = await searchWikiPage(model.castingName);
  if (!wikiUrl) {
    console.log(`  Could not find wiki page for ${model.castingName}`);
    return false;
  }
  
  console.log(`  Found wiki page: ${wikiUrl}`);
  const description = await extractDescription(wikiUrl);
  
  if (!description) {
    console.log(`  Could not extract description from ${wikiUrl}`);
    return false;
  }
  
  await prisma.model.update({
    where: { id: modelId },
    data: { description },
  });
  
  console.log(`  ✓ Updated description for ${model.castingName}`);
  return true;
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage:');
    console.log('  npx ts-node fetch_model_description_from_wiki.ts [modelId]');
    console.log('  npx ts-node fetch_model_description_from_wiki.ts --all');
    process.exit(1);
  }
  
  if (args[0] === '--all') {
    // Update all models without descriptions
    const models = await prisma.model.findMany({
      where: {
        OR: [
          { description: null },
          { description: '' },
        ],
      },
      take: 100, // Limit to 100 at a time to avoid rate limiting
    });
    
    console.log(`Found ${models.length} models without descriptions`);
    
    let updated = 0;
    for (const model of models) {
      const success = await updateModelDescription(model.id);
      if (success) updated++;
      
      // Rate limiting: wait 1 second between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\nUpdated ${updated} out of ${models.length} models`);
  } else {
    // Update specific model
    const modelId = Number(args[0]);
    if (Number.isNaN(modelId)) {
      console.error('Invalid model ID');
      process.exit(1);
    }
    
    await updateModelDescription(modelId);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });




