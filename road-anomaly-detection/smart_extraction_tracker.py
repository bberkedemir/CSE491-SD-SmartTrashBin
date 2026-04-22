import cv2
import glob
from ultralytics import YOLO
from pathlib import Path
import numpy as np

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

    while True:
        ret, frame = capture.read()
        if not ret:
            break
        
        # get timestamp of frame
        timestamp = capture.get(cv2.CAP_PROP_POS_MSEC) / 1000

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
                    
                    # New or better frame
                    if anomaly_key not in best_anomalies or conf > best_anomalies[anomaly_key]['conf']:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        
                        h, w, _ = frame.shape
                        x1, y1 = max(0, x1), max(0, y1)
                        x2, y2 = min(w, x2), min(h, y2)
                        
                        # Crop the bounding box from the original frame
                        crop = frame[y1:y2, x1:x2]
                        
                        if crop.size > 0:
                            img_name = f"{vid_name}_{class_name}_id_{track_id}.jpg".replace(" ", "_")
                            img_path = EXTRACT_DIR / img_name

                            if anomaly_key not in best_anomalies:
                                print(f"Extracted {class_name}: {img_name}")
                            elif conf > best_anomalies[anomaly_key]['conf']:
                                print(f"Overwriting {class_name}: {img_name}. Old conf: {round(best_anomalies[anomaly_key]['conf'], 3)}, New conf: {round(conf, 3)}")

                            # overwrite if better conf
                            cv2.imwrite(str(img_path), crop)

                            # Update best record
                            best_anomalies[anomaly_key] = {
                                'conf': conf,
                                'class_name': class_name,
                                'timestamp': timestamp,
                                'path': str(img_path)
                            }

                            
                            if SAVE_SIDE_BY_SIDE_TEST:
                                test_img_path = COMPARE_DIR / img_name
                                # scale both images
                                target_h = 720

                                # full frame
                                s_frame = target_h / max(1, annotated_frame.shape[0])
                                resized_frame = cv2.resize(annotated_frame, (int(annotated_frame.shape[1] * s_frame), target_h))


                                # box crop
                                s_crop = target_h / max(1, crop.shape[0])
                                resized_crop = cv2.resize(crop, (int(crop.shape[1] * s_crop), target_h))

                                side_by_side = np.hstack((resized_frame, resized_crop))

                                # debugging data on merged image
                                cv2.putText(side_by_side, f"ID: {track_id}", (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (0, 0, 255), 3)
                                cv2.imwrite(str(test_img_path), side_by_side)



            
            wrt.write(annotated_frame)

    capture.release()
    wrt.release()
    print(f"Saved Annotated Video: {vid_output}")

print(f"All tracking finished. Check {EXTRACT_DIR} for extracted anomalies.")

if SAVE_SIDE_BY_SIDE_TEST:
    print(f"Side by side tests stored in: {COMPARE_DIR}")