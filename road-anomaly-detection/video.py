import cv2
import glob
from ultralytics import YOLO
from pathlib import Path

# Load Model
model = YOLO("best.pt")

# Folders
VID_DIR = Path("test_videos")
OUTPUT_DIR = VID_DIR / "detected_output"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Get Videos
videos = glob.glob(f"{VID_DIR}/*.mp4")

for video in videos:
    capture = cv2.VideoCapture(video)

    width=int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height=int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = capture.get(cv2.CAP_PROP_FPS)
    
    vid_name = (VID_DIR / video).stem
    vid_output = OUTPUT_DIR / f"{vid_name}_out.mp4"

    wrt = cv2.VideoWriter(vid_output, cv2.VideoWriter_fourcc(*'mp4v'), fps, (width, height))

    print(f"Processing {video}")

    while True:
        ret, frame = capture.read()
        if not ret:
            break
        results = model(frame, stream=True, conf=0.4)
        for r in results:
            annotated_frame = r.plot()
            wrt.write(annotated_frame)

    capture.release()
    wrt.release()
    print(f"Saved: {OUTPUT_DIR}")


