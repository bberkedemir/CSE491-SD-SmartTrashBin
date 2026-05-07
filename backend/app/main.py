import asyncio
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.core.database import engine
from app.models import user, bin, log, token_blacklist, anomaly_upload, road_anomaly, truck
from app.api import bins, routes, auth, logs, iot, anomalies, users, tracking, trucks
from app.api.tracking import cleanup_stale_sessions

# Create database tables
user.Base.metadata.create_all(bind=engine)
bin.Base.metadata.create_all(bind=engine)
log.Base.metadata.create_all(bind=engine)
token_blacklist.Base.metadata.create_all(bind=engine)
anomaly_upload.Base.metadata.create_all(bind=engine)
road_anomaly.Base.metadata.create_all(bind=engine)
truck.Base.metadata.create_all(bind=engine)

BACKEND_ROOT = Path(__file__).resolve().parents[1]
UPLOADS_DIR = BACKEND_ROOT / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


def _run_migrations() -> None:
    from sqlalchemy import text, inspect
    with engine.connect() as conn:
        cols = [c["name"] for c in inspect(engine).get_columns("collection_logs")]
        if "performed_by" not in cols:
            conn.execute(text("ALTER TABLE collection_logs ADD COLUMN performed_by VARCHAR"))
            conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_migrations()
    asyncio.create_task(cleanup_stale_sessions())
    yield


app = FastAPI(
    title="Smart Waste Bin API",
    description="API for managing smart waste bin locations and fill levels",
    version="1.0.0",
    debug=settings.DEBUG,
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routers
app.include_router(bins.router, prefix=f"{settings.API_V1_STR}/bins", tags=["bins"])
app.include_router(routes.router, prefix=f"{settings.API_V1_STR}/routes", tags=["routes"])
app.include_router(auth.router, prefix=f"{settings.API_V1_STR}/auth", tags=["auth"])
app.include_router(logs.router, prefix=f"{settings.API_V1_STR}/logs", tags=["logs"])
app.include_router(iot.router, prefix=f"{settings.API_V1_STR}/iot", tags=["iot"])
app.include_router(users.router, prefix=f"{settings.API_V1_STR}/users", tags=["users"])
app.include_router(tracking.router, prefix=f"{settings.API_V1_STR}/tracking", tags=["tracking"])
app.include_router(anomalies.router, prefix=f"{settings.API_V1_STR}/anomalies", tags=["anomalies"])
app.include_router(trucks.router, prefix=f"{settings.API_V1_STR}/trucks", tags=["trucks"])
app.mount("/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")

@app.get("/")
def root():
    return {"message": "Smart Waste Bin API", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
