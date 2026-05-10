/**
 * Wiki Analysis Script: Themed Assortment
 * 
 * This script:
 *   1. Fetches the Themed assortment Wiki page
 *   2. Analyzes all segments (Current and Past)
 *   3. Extracts all collection links
 *   4. Identifies collections without links (empty SubSeries will be created)
 *   5. Analyzes table structure for each linked collection:
 *      - Column count
 *      - Column names
 *      - Image columns (Loose, Carded, Blacklight, etc.)
 *      - Year information
 *   6. Saves results to JSON file: scripts/data/themed_assortment_analysis.json
 * 
 * Usage:
 *   npx ts-node scripts/tools/analyze_themed_assortment_wiki.ts
 */

import 'dotenv/config';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';

const WIKI_URL = 'https://hotwheels.fandom.com/wiki/Themed_assortment';
const OUTPUT_FILE = path.join(process.cwd(), 'scripts', 'data', 'themed_assortment_analysis.json');

interface TableStructure {
  columns: number;
  columnNames: string[];
  imageColumns: number[];
  imageTypes: string[];
  toyNumberColumn?: number;
  castingNameColumn?: number;
  yearColumn?: number;
}

interface CollectionInfo {
  name: string;
  segment: string;
  years: number[];
  wikiUrl: string | null;
  hasLink: boolean;
  tableStructure?: TableStructure;
  notes?: string;
}

interface AnalysisResult {
  timestamp: string;
  totalCollections: number;
  collectionsWithLinks: number;
  collectionsWithoutLinks: number;
  segments: {
    [key: string]: {
      current: CollectionInfo[];
      past: CollectionInfo[];
    };
  };
  collections: CollectionInfo[];
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry mechanism to handle bot challenges
 */
async function fetchWithRetry(url: string, retries = 5, delay = 10000): Promise<string> {
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
      
      // Check if we got a bot challenge page
      if (html.includes('Client Challenge') || html.includes('title>Client Challenge') || html.length < 5000) {
        throw new Error('Received bot challenge page (HTML too short or contains "Client Challenge")');
      }

      console.log(`Successfully fetched ${url} (${html.length} characters)`);
      return html;
    } catch (error) {
      console.warn(`Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
      
      if (attempt < retries) {
        console.log(`Waiting ${delay}ms (${Math.round(delay/1000)}s) before retry…`);
        await sleep(delay);
        delay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }

  throw new Error('All retry attempts failed');
}

/**
 * Analyze table structure from a Wiki page
 */
async function analyzeTableStructure(wikiUrl: string): Promise<TableStructure | null> {
  try {
    console.log(`  Analyzing table structure for: ${wikiUrl}`);
    const html = await fetchWithRetry(wikiUrl);
    const $ = cheerio.load(html);

    // Find the first wikitable
    const table = $('table.wikitable').first();
    
    if (table.length === 0) {
      console.log(`  No table found on ${wikiUrl}`);
      return null;
    }

    // Get header row
    const headerRow = table.find('thead tr, tbody tr').first();
    const headers: string[] = [];
    headerRow.find('th, td').each((_, el) => {
      const text = $(el).text().trim();
      headers.push(text);
    });

    // If no headers in first row, try to infer from content
    if (headers.length === 0 || headers.every(h => !h)) {
      // Try to get column count from first data row
      const firstDataRow = table.find('tbody tr').first();
      const cellCount = firstDataRow.find('td').length;
      return {
        columns: cellCount,
        columnNames: [],
        imageColumns: [],
        imageTypes: [],
      };
    }

    // Identify image columns
    const imageColumns: number[] = [];
    const imageTypes: string[] = [];
    
    headers.forEach((header, index) => {
      const headerLower = header.toLowerCase();
      if (headerLower.includes('photo') || headerLower.includes('image') || headerLower.includes('img')) {
        imageColumns.push(index);
        
        // Determine image type
        if (headerLower.includes('loose')) {
          imageTypes.push('loose');
        } else if (headerLower.includes('carded') || headerLower.includes('card')) {
          imageTypes.push('carded');
        } else if (headerLower.includes('blacklight') || headerLower.includes('black light')) {
          imageTypes.push('blacklight');
        } else {
          imageTypes.push('other');
        }
      }
    });

    // Identify key columns
    let toyNumberColumn: number | undefined;
    let castingNameColumn: number | undefined;
    let yearColumn: number | undefined;

    headers.forEach((header, index) => {
      const headerLower = header.toLowerCase();
      if (headerLower.includes('toy') && headerLower.includes('#') || headerLower.includes('toy number')) {
        toyNumberColumn = index;
      }
      if (headerLower.includes('casting') || headerLower.includes('name') || headerLower.includes('model')) {
        castingNameColumn = index;
      }
      if (headerLower.includes('year')) {
        yearColumn = index;
      }
    });

    return {
      columns: headers.length,
      columnNames: headers,
      imageColumns,
      imageTypes,
      toyNumberColumn,
      castingNameColumn,
      yearColumn,
    };
  } catch (error) {
    console.error(`  Error analyzing ${wikiUrl}:`, error);
    return null;
  }
}

/**
 * Extract year from text or URL
 */
function extractYear(text: string): number | null {
  // Try to find 4-digit year
  const yearMatch = text.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) {
    return parseInt(yearMatch[0], 10);
  }
  return null;
}

/**
 * Extract collection name from link text or URL
 */
function extractCollectionName(linkText: string, url: string): string {
  // Clean up link text
  let name = linkText.trim();
  
  // Remove year suffixes like "(2018)", "(2023)"
  name = name.replace(/\s*\(\d{4}\)\s*$/, '');
  
  // Remove "Series" suffix if present
  name = name.replace(/\s+Series\s*$/, '');
  
  return name;
}

/**
 * Parse the Themed assortment Wiki page
 */
async function parseWikiPage(): Promise<AnalysisResult> {
  console.log('Fetching Themed assortment Wiki page...');
  const html = await fetchWithRetry(WIKI_URL);
  const $ = cheerio.load(html);

  const result: AnalysisResult = {
    timestamp: new Date().toISOString(),
    totalCollections: 0,
    collectionsWithLinks: 0,
    collectionsWithoutLinks: 0,
    segments: {},
    collections: [],
  };

  // Define segments
  const segments = [
    'Anniversary',
    'Automotive',
    'Entertainment',
    'Celebrations',
    'Vintage',
    'Seasonal',
    'Other',
  ];

  // Initialize segments
  for (const segment of segments) {
    result.segments[segment] = {
      current: [],
      past: [],
    };
  }

  // Debug: Print all h2 headings
  console.log('\n=== DEBUG: All h2 headings ===');
  $('h2').each((_, el) => {
    const text = $(el).text().trim();
    console.log(`  h2: "${text}"`);
  });

  // Find "Current segments" h2 heading
  const currentSegmentsHeading = $('h2').filter((_, el) => {
    const text = $(el).text().trim();
    return text.toLowerCase().includes('current segments') || text.toLowerCase().includes('current segment');
  }).first();

  // Find "Past segments" h2 heading
  const pastSegmentsHeading = $('h2').filter((_, el) => {
    const text = $(el).text().trim();
    return text.toLowerCase().includes('past segments') || text.toLowerCase().includes('past segment');
  }).first();
  
  console.log(`Current segments heading found: ${currentSegmentsHeading.length > 0}`);
  console.log(`Past segments heading found: ${pastSegmentsHeading.length > 0}`);

  // Process Current segments
  if (currentSegmentsHeading.length > 0) {
    console.log('Found Current segments heading');
    // Find all h3 headings on the page and determine which are in Current section
    const allH3s = $('h3');
    console.log(`Found ${allH3s.length} total h3 headings on page`);
    
    let segmentCount = 0;
    let inCurrentSection = false;
    let foundCurrentHeading = false;
    
    allH3s.each((_, h3El) => {
      const $h3 = $(h3El);
      const h3Text = $h3.text().trim();
      
      // Check if we've reached Past segments h2 (h3'lerden önce h2 gelir)
      const prevH2 = $h3.prevAll('h2').first();
      if (prevH2.length > 0 && prevH2.text().toLowerCase().includes('past segments')) {
        inCurrentSection = false;
        return;
      }
      
      // Check if we've passed Current segments h2
      if (currentSegmentsHeading.length > 0) {
        const h3Position = $h3.index();
        const currentH2Position = currentSegmentsHeading.index();
        const pastH2Position = pastSegmentsHeading.length > 0 ? pastSegmentsHeading.index() : Infinity;
        
        if (h3Position > currentH2Position && h3Position < pastH2Position) {
          inCurrentSection = true;
        } else {
          inCurrentSection = false;
        }
      }
      
      // If we're in Current section, process this h3
      if (inCurrentSection) {
        const segmentName = h3Text.replace(/\[\]/g, '').trim();
        
        console.log(`  Checking h3: "${segmentName}"`);
        
        if (segments.includes(segmentName)) {
          console.log(`  ✓ Processing segment: ${segmentName}`);
          segmentCount++;
          
          // Find all content under this h3 until next h3 or h2
          let nextElement = $h3.next();
          const links: any[] = [];
          let elementCount = 0;
          
          while (nextElement.length > 0 && !nextElement.is('h3') && !nextElement.is('h2') && elementCount < 100) {
            // Find all links in this element
            nextElement.find('a[href*="/wiki/"]').each((_, linkEl) => {
              const $link = $(linkEl);
              const href = $link.attr('href');
              const linkText = $link.text().trim();
              
              if (href && linkText && !href.includes('Category:') && !href.includes('File:') && !href.includes('Special:')) {
                links.push({ href, text: linkText });
                console.log(`      Link: ${linkText} -> ${href}`);
              }
            });
            
            // Also check for text without links (like "Audi" in Celebrations)
            if (nextElement.is('li') || nextElement.find('li').length > 0) {
              const listItems = nextElement.is('li') ? nextElement : nextElement.find('li');
              listItems.each((_, liEl) => {
                const $li = $(liEl);
                const text = $li.text().trim();
                const hasLink = $li.find('a[href*="/wiki/"]').length > 0;
                
                if (!hasLink && text && text.length > 1 && !text.match(/^\d+$/)) {
                  const collectionName = extractCollectionName(text, '');
                  if (collectionName && collectionName.length > 1) {
                    console.log(`      Text without link: "${text}" -> "${collectionName}"`);
                    const year = extractYear(text);
                    result.segments[segmentName].current.push({
                      name: collectionName,
                      segment: segmentName,
                      years: year ? [year] : [],
                      wikiUrl: null,
                      hasLink: false,
                      notes: 'No link available - will create empty SubSeries',
                    });
                  }
                }
              });
            }
            
            nextElement = nextElement.next();
            elementCount++;
          }
          
          console.log(`    Total found: ${links.length} links`);
          
          // Process links
          links.forEach(({ href, text: linkText }) => {
            const fullUrl = href.startsWith('http') ? href : `https://hotwheels.fandom.com${href}`;
            const collectionName = extractCollectionName(linkText, fullUrl);
            const year = extractYear(linkText + ' ' + fullUrl);
            
            result.segments[segmentName].current.push({
              name: collectionName,
              segment: segmentName,
              years: year ? [year] : [],
              wikiUrl: fullUrl,
              hasLink: true,
            });
          });
        } else {
          console.log(`  ✗ Skipping "${segmentName}" (not in segments list)`);
        }
      }
    });
    
    console.log(`\nProcessed ${segmentCount} segments in Current section`);
  } else {
    console.log('Current segments heading not found');
  }

  // Process Past segments
  if (pastSegmentsHeading.length > 0) {
    console.log('\nFound Past segments heading');
    // Find all h3 headings on the page and determine which are in Past section
    const allH3s = $('h3');
    
    let pastSegmentCount = 0;
    let inPastSection = false;
    
    allH3s.each((_, h3El) => {
      const $h3 = $(h3El);
      const h3Text = $h3.text().trim();
      
      // Check if we've reached Past segments h2
      const prevH2 = $h3.prevAll('h2').first();
      if (prevH2.length > 0 && prevH2.text().toLowerCase().includes('past segments')) {
        inPastSection = true;
      }
      
      // Check if we've passed Past segments h2
      if (pastSegmentsHeading.length > 0) {
        const h3Position = $h3.index();
        const pastH2Position = pastSegmentsHeading.index();
        
        if (h3Position > pastH2Position) {
          inPastSection = true;
        } else {
          inPastSection = false;
        }
      }
      
      // If we're in Past section, process this h3
      if (inPastSection) {
        const segmentName = h3Text.replace(/\[\]/g, '').trim();
        
        console.log(`  Checking h3: "${segmentName}"`);
        
        if (segments.includes(segmentName)) {
          console.log(`  ✓ Processing segment: ${segmentName}`);
          pastSegmentCount++;
          
          // Find all content under this h3 until next h3 or h2
          let nextElement = $h3.next();
          const links: any[] = [];
          let elementCount = 0;
          
          while (nextElement.length > 0 && !nextElement.is('h3') && !nextElement.is('h2') && elementCount < 200) {
            // Check for year subheadings (h4)
            if (nextElement.is('h4')) {
              const $h4 = nextElement;
              const headingText = $h4.text().trim();
              const year = extractYear(headingText);
              console.log(`    Found year heading: "${headingText}" (year: ${year || 'none'})`);
              
              // Find links under this h4 until next h4 or h3
              let yearElement = $h4.next();
              while (yearElement.length > 0 && !yearElement.is('h4') && !yearElement.is('h3') && !yearElement.is('h2')) {
                yearElement.find('a[href*="/wiki/"]').each((_, linkEl) => {
                  const $link = $(linkEl);
                  const href = $link.attr('href');
                  const linkText = $link.text().trim();
                  
                  if (href && linkText && !href.includes('Category:') && !href.includes('File:') && !href.includes('Special:')) {
                    links.push({ href, text: linkText, year });
                    console.log(`        Link: ${linkText} -> ${href} (year: ${year || 'from link'})`);
                  }
                });
                yearElement = yearElement.next();
              }
            } else {
              // Regular links
              nextElement.find('a[href*="/wiki/"]').each((_, linkEl) => {
                const $link = $(linkEl);
                const href = $link.attr('href');
                const linkText = $link.text().trim();
                
                if (href && linkText && !href.includes('Category:') && !href.includes('File:') && !href.includes('Special:') && !href.includes('Help:')) {
                  links.push({ href, text: linkText });
                  console.log(`      Link: ${linkText} -> ${href}`);
                }
              });
              
              // Also check for text without links (like "Audi" in Celebrations)
              if (nextElement.is('li') || nextElement.find('li').length > 0) {
                const listItems = nextElement.is('li') ? nextElement : nextElement.find('li');
                listItems.each((_, liEl) => {
                  const $li = $(liEl);
                  const text = $li.text().trim();
                  const hasLink = $li.find('a[href*="/wiki/"]').length > 0;
                  
                  if (!hasLink && text && text.length > 1 && !text.match(/^\d+$/)) {
                    const collectionName = extractCollectionName(text, '');
                    if (collectionName && collectionName.length > 1) {
                      console.log(`      Text without link: "${text}" -> "${collectionName}"`);
                      const year = extractYear(text);
                      result.segments[segmentName].past.push({
                        name: collectionName,
                        segment: segmentName,
                        years: year ? [year] : [],
                        wikiUrl: null,
                        hasLink: false,
                        notes: 'No link available - will create empty SubSeries',
                      });
                    }
                  }
                });
              }
            }
            
            nextElement = nextElement.next();
            elementCount++;
          }
          
          console.log(`    Total found: ${links.length} links`);
          
          // Process links
          links.forEach(({ href, text: linkText, year: linkYear }) => {
            const fullUrl = href.startsWith('http') ? href : `https://hotwheels.fandom.com${href}`;
            const collectionName = extractCollectionName(linkText, fullUrl);
            const year = linkYear || extractYear(linkText + ' ' + fullUrl);
            
            // Check if this collection already exists in past
            const existing = result.segments[segmentName].past.find(c => c.name === collectionName);
            if (existing) {
              // Add year if not already present
              if (year && !existing.years.includes(year)) {
                existing.years.push(year);
                existing.years.sort();
              }
            } else {
              result.segments[segmentName].past.push({
                name: collectionName,
                segment: segmentName,
                years: year ? [year] : [],
                wikiUrl: fullUrl,
                hasLink: true,
              });
            }
          });
        } else {
          console.log(`  ✗ Skipping "${segmentName}" (not in segments list)`);
        }
      }
    });
    
    console.log(`\nProcessed ${pastSegmentCount} segments in Past section`);
  } else {
    console.log('Past segments heading not found');
  }

  // Initialize segments if not already done
  for (const segment of segments) {
    if (!result.segments[segment]) {
      result.segments[segment] = {
        current: [],
        past: [],
      };
    }

    // Find Past segments section
    const pastHeading = $(`h2, h3, h4`).filter((_, el) => {
      const text = $(el).text().trim();
      return text.includes(segment) && (text.includes('Past') || $(el).prevAll('h2, h3').first().text().includes('Past'));
    }).first();

    if (pastHeading.length > 0) {
      // Process past segments - they may have year groupings
      const pastSection = pastHeading.nextUntil('h2, h3, h4').addBack();
      
      // Look for year headings and links under them
      pastSection.find('h3, h4, h5').each((_, headingEl) => {
        const $heading = $(headingEl);
        const headingText = $heading.text().trim();
        const year = extractYear(headingText);
        
        // Find links under this heading
        $heading.nextUntil('h3, h4, h5, h2').find('a[href*="/wiki/"]').each((_, el) => {
          const $link = $(el);
          const href = $link.attr('href');
          const text = $link.text().trim();
          
          if (href && text) {
            const fullUrl = href.startsWith('http') ? href : `https://hotwheels.fandom.com${href}`;
            const collectionName = extractCollectionName(text, fullUrl);
            const linkYear = extractYear(text + ' ' + fullUrl) || year;
            
            // Check if this collection already exists in past
            const existing = result.segments[segment].past.find(c => c.name === collectionName);
            if (existing) {
              // Add year if not already present
              if (linkYear && !existing.years.includes(linkYear)) {
                existing.years.push(linkYear);
                existing.years.sort();
              }
            } else {
              result.segments[segment].past.push({
                name: collectionName,
                segment,
                years: linkYear ? [linkYear] : [],
                wikiUrl: fullUrl,
                hasLink: true,
              });
            }
          }
        });
      });
    }
  }

  // Flatten all collections
  for (const segment of segments) {
    result.collections.push(...result.segments[segment].current);
    result.collections.push(...result.segments[segment].past);
  }

  // Remove duplicates (same name, merge years)
  const collectionMap = new Map<string, CollectionInfo>();
  for (const collection of result.collections) {
    const existing = collectionMap.get(collection.name);
    if (existing) {
      // Merge years
      existing.years.push(...collection.years);
      existing.years = [...new Set(existing.years)].sort();
      // Keep link if available
      if (!existing.hasLink && collection.hasLink) {
        existing.wikiUrl = collection.wikiUrl;
        existing.hasLink = true;
      }
    } else {
      collectionMap.set(collection.name, { ...collection });
    }
  }

  result.collections = Array.from(collectionMap.values());
  result.totalCollections = result.collections.length;
  result.collectionsWithLinks = result.collections.filter(c => c.hasLink).length;
  result.collectionsWithoutLinks = result.collections.filter(c => !c.hasLink).length;

  // Analyze table structures for collections with links
  console.log(`\nAnalyzing table structures for ${result.collectionsWithLinks} collections with links...`);
  for (const collection of result.collections) {
    if (collection.hasLink && collection.wikiUrl) {
      const tableStructure = await analyzeTableStructure(collection.wikiUrl);
      if (tableStructure) {
        collection.tableStructure = tableStructure;
      }
      // Small delay to avoid rate limiting
      await sleep(2000);
    }
  }

  return result;
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('=== THEMED ASSORTMENT WIKI ANALYSIS ===\n');

    const result = await parseWikiPage();

    // Ensure output directory exists
    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save results
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(result, null, 2));
    console.log(`\n✓ Analysis complete!`);
    console.log(`  - Total collections: ${result.totalCollections}`);
    console.log(`  - Collections with links: ${result.collectionsWithLinks}`);
    console.log(`  - Collections without links: ${result.collectionsWithoutLinks}`);
    console.log(`\nResults saved to: ${OUTPUT_FILE}`);

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }
}

main();
