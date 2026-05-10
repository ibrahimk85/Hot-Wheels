#!/usr/bin/env python3
"""Apply template fixes to all image scripts"""

from pathlib import Path
import re

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("=== Applying Template Fixes to All Image Scripts ===\n")

# Read template to get correct patterns
template_path = tools_dir / "download_and_sync_images_boulevard_template.ts"
template = template_path.read_text(encoding='utf-8')

# Extract the correct code blocks from template
carded_block_match = re.search(
    r'(if \(cardedImgUrl\) \{[\s\S]*?const urlObj = new URL\(String\(fullCardedUrl\)\);)',
    template
)
loose_block_match = re.search(
    r'(if \(looseImgUrl\) \{[\s\S]*?const urlObj = new URL\(String\(fullLooseUrl\)\);)',
    template
)

if not carded_block_match or not loose_block_match:
    print("ERROR: Could not find correct patterns in template")
    exit(1)

correct_carded = carded_block_match.group(1)
correct_loose = loose_block_match.group(1)

# Find old patterns
old_carded_pattern = r'if \(cardedImgUrl\) \{[\s\S]*?const urlObj = new URL\(fullCardedUrl\);'
old_loose_pattern = r'if \(looseImgUrl\) \{[\s\S]*?const urlObj = new URL\(fullLooseUrl\);'

files = list(tools_dir.glob("download_and_sync_images_*_boulevard.ts"))
files = [f for f in files if 'template' not in f.name]

print(f"Found {len(files)} files\n")

fixed_count = 0

for file_path in sorted(files):
    content = file_path.read_text(encoding='utf-8')
    original = content
    
    # Fix carded block
    if 'cardedImgUrl = String(cardedImgUrl);' not in content:
        content = re.sub(old_carded_pattern, correct_carded, content, flags=re.DOTALL)
    
    # Fix loose block  
    if 'looseImgUrl = String(looseImgUrl);' not in content:
        content = re.sub(old_loose_pattern, correct_loose, content, flags=re.DOTALL)
    
    if content != original:
        file_path.write_text(content, encoding='utf-8')
        print(f"  ✓ Fixed: {file_path.name}")
        fixed_count += 1
    else:
        print(f"  - OK: {file_path.name}")

print(f"\n=== COMPLETE ===")
print(f"Fixed: {fixed_count} files")







