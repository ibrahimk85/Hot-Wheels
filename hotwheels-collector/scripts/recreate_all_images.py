#!/usr/bin/env python3
"""Recreate all image scripts from template"""

from pathlib import Path
import sys

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

template_path = tools_dir / "download_and_sync_images_boulevard_template.ts"
if not template_path.exists():
    print(f"ERROR: Template not found: {template_path}", file=sys.stderr)
    sys.exit(1)

template_content = template_path.read_text(encoding='utf-8')

years = list(range(2012, 2027))
recreated = 0

for year in years:
    content = template_content.replace('2020', str(year))
    content = content.replace('2020_Hot_Wheels_Boulevard', f'{year}_Hot_Wheels_Boulevard')
    
    filename = f"download_and_sync_images_{year}_boulevard.ts"
    filepath = tools_dir / filename
    
    filepath.write_text(content, encoding='utf-8')
    print(f"✓ Recreated: {filename}", flush=True)
    recreated += 1

print(f"\nCOMPLETE: Recreated {recreated} files", flush=True)







