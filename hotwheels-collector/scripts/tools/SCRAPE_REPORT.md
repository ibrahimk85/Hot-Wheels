# 2025 Mainline Wiki Scraper - Final Report

## Script Created: `scrape_2025_mainline_complete.ts`

### Features Implemented

✅ **Wiki Table Parsing**
- Extracts Toy#, Col#, Model Name, Series, Series# from main table
- Detects TH/STH information from Series column
- Extracts image URLs and model detail page links
- Handles color variants (2nd Color, 3rd Color)

✅ **Model Detail Page Scraping**
- Fetches Debut Series, Produced, Designer, Number, Description
- Stores details as JSON in Model.description field
- Rate limited (500ms between requests)

✅ **Image Download & Management**
- Downloads images in full resolution
- Removes thumbnail parameters from URLs
- Organizes images by model slug: `public/images/hotwheels/2025/mainline/{modelSlug}/`
- File naming: `{Toy#}_{Col#}.{ext}`
- Associates images with Variant records

✅ **Database Integration**
- Creates/updates Year, Collection, SubSeries, Model, Variant records
- Properly links TH/STH flags to variants
- Prevents duplicates using cache and database checks
- Updates existing records if TH/STH status changes

✅ **Error Handling & Rate Limiting**
- 500ms delay between model detail page requests
- 300ms delay between image downloads
- Comprehensive error logging
- Continues processing even if individual items fail

### Usage

```bash
npx ts-node scripts/tools/scrape_2025_mainline_complete.ts
```

### Expected Runtime

- **Table parsing**: ~5 seconds
- **Model detail fetching**: ~2-3 minutes (250 models × 500ms)
- **Image downloading**: ~2-3 minutes (250+ images × 300ms)
- **Total**: Approximately 5-10 minutes

### Output Structure

```
public/images/hotwheels/2025/mainline/
├── mazda-mx-5-miata/
│   ├── HYW18_001.jpg
│   └── HYX57_001.jpg
├── batman-and-robin-batmobile/
│   └── HYW60_002.jpg
└── ...
```

### Database Schema

- **Model.description**: JSON string containing:
  ```json
  {
    "debutSeries": "...",
    "produced": "...",
    "designer": "...",
    "number": "...",
    "description": "..."
  }
  ```

- **Variant.isTreasureHunt**: Boolean flag
- **Variant.isSuperTreasureHunt**: Boolean flag
- **Image.path**: Relative path from public folder
- **Image.variantId**: Links image to variant

### Notes

- Script is idempotent - safe to run multiple times
- Skips existing variants (checks by modelId, cardNumber, color)
- Updates TH/STH status if changed
- Model details are only fetched once per unique model (cached)

### Progress Tracking

The script outputs progress every 10 rows and provides a final summary:
- Rows processed
- Models created
- Variants created
- Images downloaded
- Images associated
- Model details fetched
- Errors encountered










