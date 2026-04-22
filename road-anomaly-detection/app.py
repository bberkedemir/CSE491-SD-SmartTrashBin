from ultralytics import YOLO
import torch

def main(): 

    print(torch.cuda.is_available())
    DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {DEVICE}")

    """ model = YOLO("yolov8n.pt") """
    model = YOLO("runs/detect/train5/weights/last.pt")

    # Start Training
    """ results = model.train(
        data="data.yaml", 
        epochs=50, 
        imgsz=640,
        device=DEVICE
    ) """
    results = model.train(resume=True)

    print("\nTraining completed!")


if __name__ == "__main__":
    main()

