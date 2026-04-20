import cv2
import glob
from ultralytics import YOLO
from pathlib import Path

# Load Model
model = YOLO("best.pt")

# Folders
VID_DIR = Path("test_videos")
OUTPUT_DIR = VID_DIR / "detected_output"
EXTRACT_DIR = VID_DIR / "extracted_anomalies"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
EXTRACT_DIR.mkdir(parents=True, exist_ok=True)

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
            
            wrt.write(annotated_frame)

    capture.release()
    wrt.release()
    print(f"Saved Annotated Video: {vid_output}")

print(f"All tracking finished. Check {EXTRACT_DIR} for extracted anomalies.")
