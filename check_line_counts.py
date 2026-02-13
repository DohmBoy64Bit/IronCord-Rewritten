#!/usr/bin/env python3
"""
Check line counts for all TypeScript source files.
Verifies that no file exceeds 300 lines (Industrial Grade constraint).
"""

import os
from pathlib import Path
from typing import List, Tuple

MAX_LINES = 300
EXCLUDED_DIRS = {'node_modules', 'dist', 'build', '.git', 'out', 'coverage'}
EXCLUDED_PATTERNS = {'.test.ts', '.spec.ts', '.d.ts'}


def should_check_file(file_path: Path) -> bool:
    """Check if file should be included in line count check."""
    if not file_path.suffix == '.ts':
        return False
    
    if any(excluded in file_path.parts for excluded in EXCLUDED_DIRS):
        return False
    
    if any(file_path.name.endswith(pattern) for pattern in EXCLUDED_PATTERNS):
        return False
    
    return True


def count_lines(file_path: Path) -> int:
    """Count non-empty lines in a file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return sum(1 for line in f)
    except Exception as e:
        print(f"Error reading {file_path}: {e}")
        return 0


def check_line_counts(root_dir: str = '.') -> Tuple[List[Tuple[Path, int]], List[Tuple[Path, int]]]:
    """
    Check line counts for all TypeScript files.
    Returns (passing_files, failing_files).
    """
    root = Path(root_dir)
    passing = []
    failing = []
    
    for ts_file in root.rglob('*.ts'):
        if not should_check_file(ts_file):
            continue
        
        line_count = count_lines(ts_file)
        relative_path = ts_file.relative_to(root)
        
        if line_count > MAX_LINES:
            failing.append((relative_path, line_count))
        else:
            passing.append((relative_path, line_count))
    
    return passing, failing


def main():
    print("=" * 80)
    print("TypeScript Line Count Check (max 300 lines per file)")
    print("=" * 80)
    print()
    
    passing, failing = check_line_counts()
    
    if failing:
        print(f"[FAIL] FAILING FILES ({len(failing)}):")
        print()
        for path, lines in sorted(failing, key=lambda x: x[1], reverse=True):
            print(f"  {lines:4d} lines  {path}")
        print()
    
    print(f"[PASS] PASSING FILES ({len(passing)}):")
    print()
    
    # Group by directory
    by_package = {}
    for path, lines in passing:
        if len(path.parts) >= 2:
            package = f"{path.parts[0]}/{path.parts[1]}"
        else:
            package = "root"
        
        if package not in by_package:
            by_package[package] = []
        by_package[package].append((path, lines))
    
    for package in sorted(by_package.keys()):
        files = by_package[package]
        total_lines = sum(lines for _, lines in files)
        max_file_lines = max(lines for _, lines in files)
        
        print(f"\n  {package}/ ({len(files)} files, {total_lines} total lines, max {max_file_lines})")
        for path, lines in sorted(files, key=lambda x: x[1], reverse=True):
            print(f"    {lines:3d}  {path}")
    
    print()
    print("=" * 80)
    print(f"Total: {len(passing)} passing, {len(failing)} failing")
    
    if failing:
        print("[FAIL] Some files exceed 300 lines")
        return 1
    else:
        print("[PASS] All files under 300 lines")
        return 0


if __name__ == '__main__':
    exit(main())
