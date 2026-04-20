from pathlib import Path

ann_dir = Path("rdd2022-DatasetNinja/train/ann")
if not ann_dir.exists():
    print(f"Directory {ann_dir} does not exist.")
    exit()

files = list(ann_dir.glob("*.json"))

for f in files:
    if f.stat().st_size > 1600:  # Look for a decent size file
        print(f"File: {f.name} ({f.stat().st_size} bytes)")
        print(f.read_text())
        break
