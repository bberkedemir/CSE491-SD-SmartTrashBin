import json
import random
import shutil
from pathlib import Path

# --- CONFIG ---
CLASSES = ['repair', 'pothole', 'transverse crack', 'other corruption', 'alligator crack', 'block crack', 'longitudinal crack']
TRAIN_RATIO = 0.8  # %80 Train, %20 Val 
OUTPUT_DIR = Path("dataset")

IMG_DIR = Path("rdd2022-DatasetNinja/train/img")
ANN_DIR = Path("rdd2022-DatasetNinja/train/ann")
# --------------

class_to_idx = {name: i for i, name in enumerate(CLASSES)}

def convert_dim(size, box):
    """Supervisely [[x1,y1], [x2,y2]] -> YOLO normalized [x_center, y_center, w, h]"""
    dw = 1.0 / size['width']
    dh = 1.0 / size['height']
    x = (box[0][0] + box[1][0]) / 2.0
    y = (box[0][1] + box[1][1]) / 2.0
    w = box[1][0] - box[0][0]
    h = box[1][1] - box[0][1]
    return x * dw, y * dh, w * dw, h * dh

def main():
    print("Dataset Split and Convert")
    
    # Create directories
    for split in ['train', 'val']:
        (OUTPUT_DIR / split / 'images').mkdir(parents=True, exist_ok=True)
        (OUTPUT_DIR / split / 'labels').mkdir(parents=True, exist_ok=True)

    # List images
    images = list(IMG_DIR.glob("*.jpg"))
    if not images:
        print(f"Err: cannot find image in {IMG_DIR}")
        return

    random.shuffle(images)

    # Split oranları
    train_count = int(len(images) * TRAIN_RATIO)
    train_imgs = images[:train_count]
    val_imgs = images[train_count:]

    splits = {
        'train': train_imgs,
        'val': val_imgs
    }

    print(f"Total image: {len(images)}")
    print(f"Train: {len(train_imgs)}")
    print(f"Val: {len(val_imgs)}")

    for split_name, img_list in splits.items():
        print(f"\nProcessing {split_name}...")
        for img_path in img_list:
            # 1. copy image
            dest_img = OUTPUT_DIR / split_name / 'images' / img_path.name
            shutil.copy2(img_path, dest_img)

            # 2. convert json to yolo
            ann_path = ANN_DIR / f"{img_path.name}.json"
            if not ann_path.exists():
                continue

            try:
                with open(ann_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)

                size = data.get('size', {})
                if not size or 'width' not in size:
                    continue

                yolo_lines = []
                for obj in data.get('objects', []):
                    cls_title = obj.get('classTitle')
                    if cls_title not in class_to_idx:
                        continue

                    cls_id = class_to_idx[cls_title]
                    points = obj.get('points', {}).get('exterior', [])
                    
                    if len(points) == 2:  # Bounding box
                        x, y, w, h = convert_dim(size, points)
                        # Sınırları sınırla (0-1 arası)
                        x, y = min(max(x, 0), 1), min(max(y, 0), 1)
                        w, h = min(max(w, 0), 1), min(max(h, 0), 1)
                        yolo_lines.append(f"{cls_id} {x:.6f} {y:.6f} {w:.6f} {h:.6f}")

                # 3. .txt Dosyası Yaz
                if yolo_lines:
                    dest_lbl = OUTPUT_DIR / split_name / 'labels' / f"{img_path.stem}.txt"
                    with open(dest_lbl, 'w') as f:
                        f.write("\n".join(yolo_lines) + "\n")

            except Exception as e:
                print(f"Hata {img_path.name}: {e}")

    print("\nSplit done, ready to train.")

if __name__ == "__main__":
    main()
