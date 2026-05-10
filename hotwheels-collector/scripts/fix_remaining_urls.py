#!/usr/bin/env python3
"""Fix remaining image scripts"""

from pathlib import Path

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("=== Fixing Remaining Image Scripts ===\n")

# Years that still need fixing (excluding 2012, 2013, 2020, 2021, 2026 which are already fixed)
years_to_fix = [2014, 2015, 2016, 2017, 2018, 2019, 2022, 2023, 2024, 2025]

fixed = 0

for year in years_to_fix:
    file_path = tools_dir / f"download_and_sync_images_{year}_boulevard.ts"
    
    if not file_path.exists():
        print(f"  ⚠ Not found: {file_path.name}")
        continue
    
    try:
        content = file_path.read_text(encoding='utf-8')
        original = content
        
        # Remove type annotation
        content = content.replace('const fullCardedUrl: string = cardedImgUrl', 'const fullCardedUrl = cardedImgUrl')
        content = content.replace('const fullLooseUrl: string = looseImgUrl', 'const fullLooseUrl = looseImgUrl')
        
        # Add toString() to URL constructor
        content = content.replace('new URL(fullCardedUrl);', 'new URL(fullCardedUrl.toString());')
        content = content.replace('new URL(fullLooseUrl);', 'new URL(fullLooseUrl.toString());')
        
        if content != original:
            file_path.write_text(content, encoding='utf-8')
            print(f"  ✓ Fixed: {file_path.name}")
            fixed += 1
        else:
            print(f"  - OK: {file_path.name}")
    except Exception as e:
        print(f"  ✗ Error in {file_path.name}: {e}")

print(f"\n=== COMPLETE ===")
print(f"Fixed: {fixed} files")







