#!/usr/bin/env python3
"""Fix all files - SIMPLE version without String() constructor"""

from pathlib import Path

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

years = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]

print("=== Fixing all files (removing String() constructor) ===\n")

fixed = 0

for year in years:
    target_file = tools_dir / f"download_and_sync_images_{year}_boulevard.ts"
    
    if not target_file.exists():
        print(f"  Skipped (not found): {year}")
        continue
    
    content = target_file.read_text(encoding='utf-8')
    original = content
    
    # Fix carded image - remove String() constructor
    old_carded = """        if (cardedImgUrl) {
          const cardedImgUrlStr: string = String(cardedImgUrl) as string;
          const processedUrl: string = cardedImgUrlStr.startsWith('//') 
            ? 'https:' + cardedImgUrlStr 
            : cardedImgUrlStr;
          
          const fullCardedUrl: string = processedUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

          const urlObj = new URL(fullCardedUrl);"""
    
    new_carded = """        if (cardedImgUrl) {
          let fullCardedUrl: string = cardedImgUrl;
          if (fullCardedUrl.startsWith('//')) {
            fullCardedUrl = 'https:' + fullCardedUrl;
          }
          fullCardedUrl = fullCardedUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

          const urlObj = new URL(fullCardedUrl);"""
    
    # Fix loose image - remove String() constructor
    old_loose = """        if (looseImgUrl) {
          const looseImgUrlStr: string = String(looseImgUrl) as string;
          const processedUrl: string = looseImgUrlStr.startsWith('//') 
            ? 'https:' + looseImgUrlStr 
            : looseImgUrlStr;
          
          const fullLooseUrl: string = processedUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

          const urlObj = new URL(fullLooseUrl);"""
    
    new_loose = """        if (looseImgUrl) {
          let fullLooseUrl: string = looseImgUrl;
          if (fullLooseUrl.startsWith('//')) {
            fullLooseUrl = 'https:' + fullLooseUrl;
          }
          fullLooseUrl = fullLooseUrl
            .replace(/\/scale-to-width-down\/\d+/g, '')
            .replace(/\/thumbnail\/width\/\d+\/height\/\d+/g, '');

          const urlObj = new URL(fullLooseUrl);"""
    
    content = content.replace(old_carded, new_carded)
    content = content.replace(old_loose, new_loose)
    
    if content != original:
        target_file.write_text(content, encoding='utf-8')
        print(f"  Fixed: {year}")
        fixed += 1
    else:
        print(f"  Already OK: {year}")

print(f"\n=== COMPLETE ===")
print(f"Fixed {fixed} files")







