import cv2
import glob
from ultralytics import YOLO
from pathlib import Path
import numpy as np
import csv

# Flag for testing anomalies side by side with original image
SAVE_SIDE_BY_SIDE_TEST = True

# Load Model
model = YOLO("best.pt")

# Folders
TEST_DIR = Path("test_videos")
VID_DIR = TEST_DIR / "videos"
OUTPUT_DIR = TEST_DIR / "detected_output"
EXTRACT_DIR = TEST_DIR / "extracted_anomalies"
COMPARE_DIR = TEST_DIR / "testing_side_by_side"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
EXTRACT_DIR.mkdir(parents=True, exist_ok=True)
if SAVE_SIDE_BY_SIDE_TEST:
    COMPARE_DIR.mkdir(parents=True, exist_ok=True)

# Get Videos
videos = glob.glob(f"{VID_DIR}/*.mp4")

# Dictionary to hold the highest confidence data for anomalies.
# Key: (vid_name, track_id), Value: { 'conf': float, 'class_name': str, 'timestamp': float, 'path': str }
best_anomalies = {}

for video in videos:
    capture = cv2.VideoCapture(video)

    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = capture.get(cv2.CAP_PROP_FPS)
    
    vid_name = Path(video).stem
    vid_output = OUTPUT_DIR / f"{vid_name}_tracked.mp4"

    wrt = cv2.VideoWriter(str(vid_output), cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))

    print(f"Processing {video} for Tracking and Extraction...")
    
    # Dictionary for live counting in the video
    seen_in_vid = {}

    while True:
        ret, frame = capture.read()
        if not ret:
            break
        
        # Get timestamp of frame in seconds
        timestamp_sec = capture.get(cv2.CAP_PROP_POS_MSEC) / 1000.0

        # Enable tracking with ByteTrack
        results = model.track(frame, persist=True, tracker="bytetrack.yaml", conf=0.5, verbose=False)
        
        for r in results:
            annotated_frame = r.plot()
            
            # Access boxes to check for extractions
            boxes = r.boxes
            
            for box in boxes:
                # yolo might not assign a track_id immediately depending on the algorithm's confidence
                if box.id is not None:
                    track_id = int(box.id[0])
                    class_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    class_name = model.names[class_id]
                    
                    # Create a unique key for the anomaly
                    anomaly_key = (vid_name, track_id)

                    # Update live tracking counter logic
                    if class_name not in seen_in_vid:
                        seen_in_vid[class_name] = set()
                    seen_in_vid[class_name].add(track_id)
                    
                    # New or better frame
                    if anomaly_key not in best_anomalies or conf > best_anomalies[anomaly_key]['conf']:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        
                        h, w, _ = frame.shape
                        x1, y1 = max(0, x1), max(0, y1)
                        x2, y2 = min(w, x2), min(h, y2)
                        
                        # Crop the bounding box from the original frame
                        crop = frame[y1:y2, x1:x2]
                        
                        if crop.size > 0:

                            # 1. Dynamic class folders
                            safe_class_name = class_name.replace(" ", "_")
                            class_dir = EXTRACT_DIR / safe_class_name
                            class_dir.mkdir(parents=True, exist_ok=True)

                            img_name = f"{vid_name}_{safe_class_name}_id_{track_id}.jpg"
                            img_path = class_dir / img_name

                            # Print if new or better confidence
                            if anomaly_key not in best_anomalies:
                                print(f"Extracted {class_name}: {img_name}")
                            elif conf > best_anomalies[anomaly_key]['conf']:
                                print(f"Overwriting {class_name}: {img_name}. Old conf: {round(best_anomalies[anomaly_key]['conf'], 3)}, New conf: {round(conf, 3)}")

                            # 2. Main Extract Save: Overwrite crop iteratively if confidence is higher
                            cv2.imwrite(str(img_path), crop)

                            # Update best record
                            best_anomalies[anomaly_key] = {
                                'conf': conf,
                                'class_name': class_name,
                                'timestamp': timestamp_sec,
                                'path': str(img_path)
                            }

                            # 3. Side-by-Side Testing Save
                            if SAVE_SIDE_BY_SIDE_TEST:
                                test_class_dir = COMPARE_DIR / safe_class_name
                                test_class_dir.mkdir(parents=True, exist_ok=True)
                                test_img_path = test_class_dir / img_name

                                # scale both images
                                target_h = 720

                                # full frame
                                s_frame = target_h / max(1, annotated_frame.shape[0])
                                resized_frame = cv2.resize(annotated_frame, (int(annotated_frame.shape[1] * s_frame), target_h))


                                # Bounding box crop
                                s_crop = target_h / max(1, crop.shape[0])
                                resized_crop = cv2.resize(crop, (int(crop.shape[1] * s_crop), target_h))

                                side_by_side = np.hstack((resized_frame, resized_crop))

                                # Debugging data on merged image
                                cv2.putText(side_by_side, f"ID: {track_id} | Conf: {conf:.2f} | Time: {timestamp_sec:.2f}s", (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)
                                cv2.imwrite(str(test_img_path), side_by_side)
                                print(f"Registered {class_name} [{track_id}] @ {timestamp_sec:.1f}s with Conf {conf:.2f}")
            
        # 4. On-Screen Live Counting Rendering
        y_offset = 40
        cv2.putText(annotated_frame, "Detected Anomalies:", (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
        y_offset += 40
        for cls_nm, items in seen_in_vid.items():
            cv2.putText(annotated_frame, f"{cls_nm}: {len(items)}", (20, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            y_offset += 40

        # Write annotated frame to video
        wrt.write(annotated_frame)

    capture.release()
    wrt.release()
    print(f"Saved Annotated Video: {vid_output}")

# 5. Detection Logging
csv_path = OUTPUT_DIR / "detections_report.csv"
print(f"Generating CSV log report at {csv_path}...")

with open(csv_path, mode="w", newline="", encoding="utf-8") as file:
    writer = csv.writer(file)
    writer.writerow(["Video Name", "Track ID", "Class Name", "Max Confidence", "Timestamp (s)", "Saved Image Path"])
    
    # Sort keys for nicely ordered CSV output (alphabetically by video name, then numerically sequentially by track ID)
    for key in sorted(best_anomalies.keys(), key=lambda x: (x[0], x[1])):
        vid_n, trk_id = key
        data = best_anomalies[key]
        writer.writerow([vid_n, trk_id, data['class_name'], f"{data['conf']:.2f}", f"{data['timestamp']:.2f}", data['path']])


print(f"All processing complete!")
print(f"Crops stored in: {EXTRACT_DIR}")

if SAVE_SIDE_BY_SIDE_TEST:
    print(f"Side by side tests stored in: {COMPARE_DIR}")