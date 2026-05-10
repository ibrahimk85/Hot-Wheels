#!/usr/bin/env python3
"""Final final fix: Use type assertion 'as string' for URL constructor"""

from pathlib import Path

scripts_dir = Path(__file__).parent
tools_dir = scripts_dir / "tools"

print("=== Final Final Fix: Add 'as string' Type Assertion ===\n")

files = sorted([f for f in tools_dir.glob("download_and_sync_images_*_boulevard.ts") if 'template' not in f.name])
print(f"Found {len(files)} files\n")

fixed = 0

for file_path in files:
    try:
        content = file_path.read_text(encoding='utf-8')
        original = content
        
        # Pattern 1: Fix carded URL
        # Replace the entire block
        old_pattern1 = """if (cardedImgUrl) {
          cardedImgUrl = String(cardedImgUrl);
          if (cardedImgUrl.startsWith('//')) {
            cardedImgUrl = 'https:' + cardedImgUrl;
          }
          
          const fullCardedUrl = cardedImgUrl
            .replace(/\\/scale-to-width-down\\/\\d+/g, '')
            .replace(/\\/thumbnail\\/width\\/\\d+\\/height\\/\\d+/g, '');

          const urlObj = new URL(fullCardedUrl);"""
        
        new_pattern1 = """if (cardedImgUrl) {
          const cardedImgUrlStr = String(cardedImgUrl);
          const processedUrl = cardedImgUrlStr.startsWith('//') 
            ? 'https:' + cardedImgUrlStr 
            : cardedImgUrlStr;
          
          const fullCardedUrl: string = processedUrl
            .replace(/\\/scale-to-width-down\\/\\d+/g, '')
            .replace(/\\/thumbnail\\/width\\/\\d+\\/height\\/\\d+/g, '') as string;

          const urlObj = new URL(fullCardedUrl);"""
        
        content = content.replace(old_pattern1, new_pattern1)
        
        # Pattern 2: Fix loose URL
        old_pattern2 = """if (looseImgUrl) {
          looseImgUrl = String(looseImgUrl);
          if (looseImgUrl.startsWith('//')) {
            looseImgUrl = 'https:' + looseImgUrl;
          }
          
          const fullLooseUrl = looseImgUrl
            .replace(/\\/scale-to-width-down\\/\\d+/g, '')
            .replace(/\\/thumbnail\\/width\\/\\d+\\/height\\/\\d+/g, '');

          const urlObj = new URL(fullLooseUrl);"""
        
        new_pattern2 = """if (looseImgUrl) {
          const looseImgUrlStr = String(looseImgUrl);
          const processedUrl = looseImgUrlStr.startsWith('//') 
            ? 'https:' + looseImgUrlStr 
            : looseImgUrlStr;
          
          const fullLooseUrl: string = processedUrl
            .replace(/\\/scale-to-width-down\\/\\d+/g, '')
            .replace(/\\/thumbnail\\/width\\/\\d+\\/height\\/\\d+/g, '') as string;

          const urlObj = new URL(fullLooseUrl);"""
        
        content = content.replace(old_pattern2, new_pattern2)
        
        if content != original:
            file_path.write_text(content, encoding='utf-8')
            print(f"  ✓ Fixed: {file_path.name}")
            fixed += 1
        else:
            print(f"  - OK: {file_path.name}")
    except Exception as e:
        print(f"  ✗ Error in {file_path.name}: {e}")
        import traceback
        traceback.print_exc()

print(f"\n=== COMPLETE ===")
print(f"Fixed: {fixed} files")







