from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import engine
from app.models import user
from app.models import bin
from app.models import token_blacklist
from app.api import bins, routes, auth

# Create database tables
bin.Base.metadata.create_all(bind=engine)

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

@app.get("/")
def root():
    return {"message": "Smart Waste Bin API", "version": "1.0.0"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}