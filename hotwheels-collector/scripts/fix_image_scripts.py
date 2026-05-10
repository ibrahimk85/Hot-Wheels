#!/usr/bin/env python3
"""
Fix errors in all Boulevard image download scripts
"""

from pathlib import Path

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("Fixing image download scripts...\n")

# Fix all image scripts
count = 0
for file_path in tools_dir.glob("download_and_sync_images_*_boulevard.ts"):
    content = file_path.read_text(encoding='utf-8')
    original_content = content
    
    # Fix 1: table.find() -> $(table).find()
    content = content.replace("table.find('tbody tr')", "$(table).find('tbody tr')")
    
    # Fix 2: Add type annotations to filter parameters
    content = content.replace(
        ".filter((_, row) => {",
        ".filter((_: any, row: any) => {"
    )
    
    # Fix 3: Fix URL constructor (add type assertion)
    content = content.replace(
        "const urlObj = new URL(fullCardedUrl);",
        "const urlObj = new URL(fullCardedUrl as string);"
    )
    content = content.replace(
        "const urlObj = new URL(fullLooseUrl);",
        "const urlObj = new URL(fullLooseUrl as string);"
    )
    
    if content != original_content:
        file_path.write_text(content, encoding='utf-8')
        print(f"  ✓ Fixed {file_path.name}")
        count += 1

print(f"\nFixed {count} image scripts")







