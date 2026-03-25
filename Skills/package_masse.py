#!/usr/bin/env python3
"""Package masse-batiment-3d skill into a .skill file"""
import zipfile, re, yaml, sys, os
from pathlib import Path

script_dir = Path(__file__).parent
skill_path = script_dir / "masse-batiment-3d"
output_file = script_dir / "masse-batiment-3d.skill"

# Validate
skill_md = skill_path / "SKILL.md"
content = skill_md.read_text()
match = re.match(r'^---\n(.*?)\n---', content, re.DOTALL)
if not match:
    print("ERROR: No frontmatter found")
    sys.exit(1)

fm = yaml.safe_load(match.group(1))
desc = fm.get('description', '')
print(f"Name: {fm.get('name')}")
print(f"Description length: {len(desc)} chars (max 1024)")

if len(desc) > 1024:
    print(f"ERROR: Description too long! ({len(desc)} > 1024)")
    print("Run with --fix to auto-truncate")
    if "--fix" not in sys.argv:
        sys.exit(1)

# Package
with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for file_path in skill_path.rglob('*'):
        if not file_path.is_file():
            continue
        if file_path.name == '.DS_Store':
            continue
        arcname = file_path.relative_to(skill_path.parent)
        zipf.write(file_path, arcname)
        print(f"  Added: {arcname}")

print(f"\nDone! Packaged to: {output_file}")
print(f"File size: {output_file.stat().st_size} bytes")
