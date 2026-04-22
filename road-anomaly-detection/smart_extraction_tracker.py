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
VID_DIR = Path("test_videos/videos")
OUTPUT_DIR = VID_DIR / "detected_output"
EXTRACT_DIR = VID_DIR / "extracted_anomalies"
TEST_DIR = VID_DIR / ".." / "testing_side_by_side"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
EXTRACT_DIR.mkdir(parents=True, exist_ok=True)
if SAVE_SIDE_BY_SIDE_TEST:
    TEST_DIR.mkdir(parents=True, exist_ok=True)

# Get Videos
videos = glob.glob(f"{VID_DIR}/*.mp4")

# keeps track of saved track IDs, we include video names in case we restart the tracking per video.
# tuple (vid_name, track_id) ensures uniqueness across different videos
saved_anomalies = set()

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
                    class_name = model.names[class_id]
                    
                    # Create a unique key for the anomaly
                    anomaly_key = (vid_name, track_id)
                    
                    if anomaly_key not in saved_anomalies:
                        x1, y1, x2, y2 = map(int, box.xyxy[0])
                        
                        h, w, _ = frame.shape
                        x1, y1 = max(0, x1), max(0, y1)
                        x2, y2 = min(w, x2), min(h, y2)
                        
                        # Crop the bounding box from the original frame
                        crop = frame[y1:y2, x1:x2]
                        
                        if crop.size > 0:
                            img_name = f"{vid_name}_{class_name}_id_{track_id}.jpg".replace(" ", "_")
                            img_path = EXTRACT_DIR / img_name
                            cv2.imwrite(str(img_path), crop)
                            print(f"Extracted {class_name}: {img_name}")
                            
                            # Cache the key so we never save this specific tracked anomaly again
                            saved_anomalies.add(anomaly_key)

                            if SAVE_SIDE_BY_SIDE_TEST:
                                test_img_path = TEST_DIR / img_name
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

                                print(f"Registered {class_name} [{track_id}] in {test_img_path}")


            
            wrt.write(annotated_frame)

    capture.release()
    wrt.release()
    print(f"Saved Annotated Video: {vid_output}")

print(f"All tracking finished. Check {EXTRACT_DIR} for extracted anomalies.")

if SAVE_SIDE_BY_SIDE_TEST:
    print(f"Side by side tests stored in: {TEST_DIR}")