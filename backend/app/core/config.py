from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://postgres:password@localhost:5432/smart_waste_db"
    
    # Application
    DEBUG: bool = True
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    API_V1_STR: str = "/api/v1"
    
<<<<<<< HEAD
=======
    # IoT
    IOT_API_KEY: str = "smartbin-iot-2026"

    # Road anomaly uploads
    ANOMALY_UPLOAD_DIR: str = "uploads/anomaly_sessions"
    ANOMALY_MODEL_PATH: str = "road-anomaly-detection/best.pt"
    ANOMALY_CONFIDENCE_THRESHOLD: float = 0.5
    ANOMALY_SAVE_ANNOTATED_VIDEO: bool = True
    
>>>>>>> origin/main
    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost:5173", "http://localhost:3000"]
    
    # PostgreSQL Individual Settings (fallback)
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "password"
    POSTGRES_DB: str = "smart_waste_db"

    class Config:
        env_file = ".env"
        case_sensitive = True


<<<<<<< HEAD
settings = Settings()
=======
settings = Settings()
>>>>>>> origin/main
