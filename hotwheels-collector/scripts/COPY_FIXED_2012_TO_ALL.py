#!/usr/bin/env python3
"""Copy fixed 2012 file to all other years"""

from pathlib import Path

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

source_file = tools_dir / "download_and_sync_images_2012_boulevard.ts"
source_content = source_file.read_text(encoding='utf-8')

years = [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2024, 2025, 2026]

print("=== Copying fixed 2012 to all years ===\n")

for year in years:
    target_file = tools_dir / f"download_and_sync_images_{year}_boulevard.ts"
    
    content = source_content.replace('const targetYear = 2012;', f'const targetYear = {year};')
    content = content.replace('2012_Hot_Wheels_Boulevard', f'{year}_Hot_Wheels_Boulevard')
    
    target_file.write_text(content, encoding='utf-8')
    print(f"  Fixed: {year}")

print(f"\n=== COMPLETE ===")
print(f"Fixed {len(years)} files")







