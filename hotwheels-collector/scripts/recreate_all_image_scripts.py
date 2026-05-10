#!/usr/bin/env python3
"""Recreate all image scripts from template"""

from pathlib import Path
import re

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("=== Recreating All Image Scripts from Template ===\n")

template_path = tools_dir / "download_and_sync_images_boulevard_template.ts"
template = template_path.read_text(encoding='utf-8')

years = list(range(2012, 2027))
recreated = 0

for year in years:
    content = template.replace('2020', str(year))
    content = re.sub(r'2020_Hot_Wheels_Boulevard', f'{year}_Hot_Wheels_Boulevard', content)
    
    filename = f"download_and_sync_images_{year}_boulevard.ts"
    filepath = tools_dir / filename
    
    filepath.write_text(content, encoding='utf-8')
    print(f"  ✓ Recreated: {filename}")
    recreated += 1

print(f"\n=== COMPLETE ===")
print(f"Recreated: {recreated} files from template")







