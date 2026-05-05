from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine
from app.models import user, bin, log, token_blacklist, anomaly_upload, road_anomaly
from app.api import bins, routes, auth, logs, iot, anomalies


# Create database tables
user.Base.metadata.create_all(bind=engine)
bin.Base.metadata.create_all(bind=engine)
log.Base.metadata.create_all(bind=engine)
token_blacklist.Base.metadata.create_all(bind=engine)
anomaly_upload.Base.metadata.create_all(bind=engine)
road_anomaly.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Waste Bin API",
    description="API for managing smart waste bin locations and fill levels",
    version="1.0.0",
    debug=settings.DEBUG
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
app.include_router(anomalies.router, prefix=f"{settings.API_V1_STR}/anomalies", tags=["anomalies"])

@app.get("/")
def root():
    return {"message": "Smart Waste Bin API", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}
