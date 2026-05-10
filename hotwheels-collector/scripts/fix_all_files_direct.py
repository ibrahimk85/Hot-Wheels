#!/usr/bin/env python3
"""Fix all files directly by reading 2012 and copying to all years"""

from pathlib import Path
import shutil

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

source_file = tools_dir / "download_and_sync_images_2012_boulevard.ts"
print(f"Reading source: {source_file}")
source_content = source_file.read_text(encoding='utf-8')

years = [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2026]

print(f"\n=== Fixing all files ===\n")

fixed = 0

for year in years:
    target_file = tools_dir / f"download_and_sync_images_{year}_boulevard.ts"
    
    # Replace year in content
    content = source_content.replace('const targetYear = 2012;', f'const targetYear = {year};')
    content = content.replace('2012_Hot_Wheels_Boulevard', f'{year}_Hot_Wheels_Boulevard')
    
    # Write file
    target_file.write_text(content, encoding='utf-8')
    print(f"  Fixed: {year}")
    fixed += 1

print(f"\n=== COMPLETE ===")
print(f"Fixed {fixed} files")







