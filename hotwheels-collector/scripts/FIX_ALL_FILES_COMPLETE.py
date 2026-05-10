#!/usr/bin/env python3
"""Fix ALL files - complete fix with explicit type annotations"""

from pathlib import Path
import re

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

years = [2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]

print("=== Fixing ALL files ===\n")

fixed = 0

for year in years:
    target_file = tools_dir / f"download_and_sync_images_{year}_boulevard.ts"
    
    if not target_file.exists():
        print(f"  Skipped (not found): {year}")
        continue
    
    content = target_file.read_text(encoding='utf-8')
    original = content
    
    # Pattern 1: Fix carded image (without type annotation)
    pattern1 = r"(const cardedImgUrlStr = String\(cardedImgUrl\);)"
    replacement1 = r"const cardedImgUrlStr: string = String(cardedImgUrl) as string;"
    content = re.sub(pattern1, replacement1, content)
    
    # Pattern 2: Fix processedUrl for carded (without type annotation)
    pattern2 = r"(const processedUrl = cardedImgUrlStr\.startsWith\('//'\))"
    replacement2 = r"const processedUrl: string = cardedImgUrlStr.startsWith('//')"
    content = re.sub(pattern2, replacement2, content)
    
    # Pattern 3: Remove 'as string' from fullCardedUrl (already typed)
    pattern3 = r"(const fullCardedUrl: string = processedUrl.*?) as string;"
    replacement3 = r"\1;"
    content = re.sub(pattern3, replacement3, content, flags=re.DOTALL)
    
    # Pattern 4: Fix loose image (without type annotation)
    pattern4 = r"(const looseImgUrlStr = String\(looseImgUrl\);)"
    replacement4 = r"const looseImgUrlStr: string = String(looseImgUrl) as string;"
    content = re.sub(pattern4, replacement4, content)
    
    # Pattern 5: Fix processedUrl for loose (without type annotation)
    pattern5 = r"(const processedUrl = looseImgUrlStr\.startsWith\('//'\))"
    replacement5 = r"const processedUrl: string = looseImgUrlStr.startsWith('//')"
    content = re.sub(pattern5, replacement5, content)
    
    # Pattern 6: Remove 'as string' from fullLooseUrl (already typed)
    pattern6 = r"(const fullLooseUrl: string = processedUrl.*?) as string;"
    replacement6 = r"\1;"
    content = re.sub(pattern6, replacement6, content, flags=re.DOTALL)
    
    if content != original:
        target_file.write_text(content, encoding='utf-8')
        print(f"  Fixed: {year}")
        fixed += 1
    else:
        print(f"  Already OK: {year}")

print(f"\n=== COMPLETE ===")
print(f"Fixed {fixed} files")







