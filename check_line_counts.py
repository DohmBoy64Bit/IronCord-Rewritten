#!/usr/bin/env python3
"""
Check line counts for TypeScript source files.
Verifies that no file exceeds 300 lines of significant code.

Features:
- Ignores whitespace and comments (// and /* ... */).
- Can scan the whole project OR accept a specific dictionary of files to check.
"""

import os
import re
import sys
import json
from pathlib import Path
from typing import List, Tuple, Set, Dict, Optional

# --- Configuration ---
MAX_LINES = 300
EXCLUDED_DIRS = {'node_modules', 'dist', 'build', '.git', 'out', 'coverage'}
EXCLUDED_PATTERNS = {'.test.ts', '.spec.ts', '.d.ts'}


def remove_comments(text: str) -> str:
    """
    Remove C-style comments (// and /* */) from text.
    """
    # Regex for single line comments (//...)
    # and multi-line comments (/* ... */)
    pattern = r'(\".*?\"|\'.*?\')|(/\*.*?\*/|//[^\r\n]*$)'
    
    # Flags: DOTALL makes '.' match newlines (for multi-line comments)
    #        MULTILINE makes '^' and '$' match start/end of lines
    regex = re.compile(pattern, re.DOTALL | re.MULTILINE)

    def _replacer(match):
        # If the match is a quoted string, return it unchanged
        if match.group(1):
            return match.group(1)
        # Otherwise, it's a comment, return empty string
        return ""

    return regex.sub(_replacer, text)


def count_significant_lines(file_path: Path) -> int:
    """
    Count non-empty, non-comment lines in a file.
    """
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # 1. Remove comments
        clean_content = remove_comments(content)
        
        # 2. Split into lines and count only non-whitespace lines
        count = 0
        for line in clean_content.splitlines():
            if line.strip():
                count += 1
                
        return count
    except Exception as e:
        # If file doesn't exist or can't be read, return 0 or handle accordingly
        # Printing to stderr so it doesn't mess up JSON output if used
        print(f"Error reading {file_path}: {e}", file=sys.stderr)
        return 0


def should_check_file(file_path: Path) -> bool:
    """Check if file should be included in line count check."""
    # Convert to string for easier checking
    path_str = str(file_path)
    name = file_path.name
    
    if not name.endswith('.ts'):
        return False
        
    # Check exclusions
    if any(excluded in file_path.parts for excluded in EXCLUDED_DIRS):
        return False
    
    if any(name.endswith(pattern) for pattern in EXCLUDED_PATTERNS):
        return False
    
    return True


def check_line_counts(
    root_dir: str = '.', 
    target_files: Optional[List[str]] = None
) -> Tuple[List[Tuple[Path, int]], List[Tuple[Path, int]]]:
    """
    Check line counts.
    
    Args:
        root_dir: Where to start scanning (default '.')
        target_files: Optional list/dict of specific file paths to check. 
                      If provided, 'root_dir' scanning is skipped.
    """
    root = Path(root_dir)
    passing = []
    failing = []
    
    # Determine which files to process
    files_to_process = []
    
    if target_files:
        # Use provided list (resolving paths relative to CWD)
        for f in target_files:
            path = Path(f)
            if path.exists() and should_check_file(path):
                files_to_process.append(path)
    else:
        # Scan directory
        for ts_file in root.rglob('*.ts'):
            if should_check_file(ts_file):
                files_to_process.append(ts_file)

    # Process files
    for ts_file in files_to_process:
        line_count = count_significant_lines(ts_file)
        
        # Try to get relative path for cleaner output, else use absolute
        try:
            relative_path = ts_file.relative_to(root)
        except ValueError:
            relative_path = ts_file

        if line_count > MAX_LINES:
            failing.append((relative_path, line_count))
        else:
            passing.append((relative_path, line_count))
    
    return passing, failing


def print_report(passing, failing):
    """Print human-readable CLI report."""
    print("=" * 80)
    print(f"TypeScript Significant Line Count Check (max {MAX_LINES})")
    print("  * Excluding comments and whitespace")
    print("=" * 80)
    print()
    
    if failing:
        print(f"[FAIL] FAILING FILES ({len(failing)}):")
        print()
        for path, lines in sorted(failing, key=lambda x: x[1], reverse=True):
            print(f"  {lines:4d} lines  {path}")
        print()
    
    print(f"[PASS] PASSING FILES ({len(passing)}):")
    
    # Group by directory for readability
    by_package = {}
    for path, lines in passing:
        parts = path.parts
        if len(parts) >= 2:
            package = f"{parts[0]}/{parts[1]}"
        else:
            package = "root"
        
        if package not in by_package:
            by_package[package] = []
        by_package[package].append((path, lines))
    
    for package in sorted(by_package.keys()):
        files = by_package[package]
        print(f"\n  {package}/ ({len(files)} files)")
        for path, lines in sorted(files, key=lambda x: x[1], reverse=True):
            print(f"    {lines:3d}  {path}")
            
    print()
    print("=" * 80)
    print(f"Total checked: {len(passing) + len(failing)}")
    print(f"Result: {len(passing)} passing, {len(failing)} failing")


def main():
    # support passing a JSON string as the first argument for specific files
    # Usage: ./check_lines.py '["src/file1.ts", "src/file2.ts"]'
    target_files = None
    
    if len(sys.argv) > 1:
        arg = sys.argv[1]
        # Check if argument looks like a JSON list/dict
        if arg.strip().startswith(('[', '{')):
            try:
                data = json.loads(arg)
                # If it's a dict, we just want the keys (filenames)
                if isinstance(data, dict):
                    target_files = list(data.keys())
                elif isinstance(data, list):
                    target_files = data
                print(f"Checking {len(target_files)} specific files provided via arguments...")
            except json.JSONDecodeError:
                print("Invalid JSON argument. Scanning directory instead.")
        else:
            # Assume it's a single file path
            target_files = [arg]

    passing, failing = check_line_counts(target_files=target_files)
    
    print_report(passing, failing)
    
    if failing:
        return 1
    return 0


if __name__ == '__main__':
    exit(main())