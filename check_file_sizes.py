import os
import glob

def check_file_sizes():
    patterns = [
        'packages/**/src/**/*.ts',
        'apps/**/src/**/*.ts'
    ]
    
    all_files = []
    for pattern in patterns:
        all_files.extend(glob.glob(pattern, recursive=True))
    
    # Filter out test files, declaration files, and build artifacts
    source_files = [
        f for f in all_files 
        if not any(x in f for x in ['.test.ts', '.spec.ts', '.d.ts', 'node_modules', 'dist', 'build'])
    ]
    
    oversized = []
    for file_path in source_files:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                line_count = len(f.readlines())
                if line_count > 300:
                    oversized.append((file_path, line_count))
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    
    if not oversized:
        print("PASS: All source files are under 300 lines")
    else:
        print("FAIL: Files exceeding 300 lines:")
        for file_path, count in oversized:
            print(f"  {file_path}: {count} lines")
    
    return len(oversized) == 0

if __name__ == '__main__':
    success = check_file_sizes()
    exit(0 if success else 1)
