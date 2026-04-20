from pathlib import Path

ann_dir = Path("rdd2022-DatasetNinja/test/ann")
if not ann_dir.exists():
    print(f"Directory {ann_dir} does not exist.")
    exit()

files = list(ann_dir.glob("*.json"))
total = len(files)

sizes = [f.stat().st_size for f in files]
max_size = max(sizes) if sizes else 0
min_size = min(sizes) if sizes else 0

non_empty = [s for s in sizes if s > 428]

print(f"Total files: {total}")
print(f"Min size: {min_size} bytes")
print(f"Max size: {max_size} bytes")
print(f"Files > 428 bytes (non-empty): {len(non_empty)}")

if non_empty:
    print("\nExample larger files:")
    for f in files:
        if f.stat().st_size > 428:
            print(f"  {f.name} ({f.stat().st_size} bytes)")
            break
