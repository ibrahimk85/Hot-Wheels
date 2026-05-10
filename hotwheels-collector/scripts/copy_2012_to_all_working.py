#!/usr/bin/env python3
"""Copy fixed 2012 to all other years - WORKING VERSION"""

from pathlib import Path
import sys

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

source_file = tools_dir / "download_and_sync_images_2012_boulevard.ts"
print(f"Reading: {source_file}", file=sys.stderr)
source_content = source_file.read_text(encoding='utf-8')

years = [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]

print("=== Copying 2012 to all years ===")
print(f"Years: {years}")

for year in years:
    target_file = tools_dir / f"download_and_sync_images_{year}_boulevard.ts"
    
    content = source_content.replace('const targetYear = 2012;', f'const targetYear = {year};')
    content = content.replace('2012_Hot_Wheels_Boulevard', f'{year}_Hot_Wheels_Boulevard')
    
    target_file.write_text(content, encoding='utf-8')
    print(f"Fixed: {year}")

print("COMPLETE")







