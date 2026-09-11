from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import products, dataset, recognition, verification, visual_registry, evaluation, training

from app.db import Base, engine, SessionLocal, seed_default_products_if_empty
import app.models

# Create all database tables on app initialization
Base.metadata.create_all(bind=engine)
try:
    with SessionLocal() as _init_db:
        seed_default_products_if_empty(_init_db)
except Exception:
    pass

app = FastAPI(
    title="KartMitra Product Registration & Verification API",
    description="APIs for KartMitra Product Registration & AI Verification System",
    version="1.0.0",
)


# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount the static directory to serve uploaded images (pointing to root backend/uploads)
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Include routers under /api/v1 and direct routes for backward/forward compatibility
app.include_router(products.router, prefix="/api/v1")
app.include_router(dataset.router, prefix="/api/v1")
app.include_router(training.router, prefix="/api/v1")
app.include_router(training.models_router, prefix="/api/v1")
app.include_router(recognition.router, prefix="/api/v1")
app.include_router(verification.router, prefix="/api/v1")
app.include_router(visual_registry.router, prefix="/api/v1")
app.include_router(evaluation.router)

# Also mount without prefix to support direct endpoint calls (/recognition/visual-match, /verification/scan, /cart/add, /products/:barcode)
app.include_router(verification.router)
app.include_router(products.router)
app.include_router(recognition.router)
app.include_router(visual_registry.router)
app.include_router(training.router)
app.include_router(training.models_router)




@app.get("/")
def read_root():
    return {
        "message": "Welcome to KartMitra Product Registration & Verification API",
        "docs_url": "/docs"
    }

@app.get("/health")
def health_check():
    from app.db import engine
    db_status = "connected"
    db_type = "sqlite"
    try:
        if "sqlite" not in str(engine.url):
            db_type = "postgresql"
        with engine.connect() as conn:
            pass
    except Exception:
        db_status = "disconnected"

    ai_readiness = {}
    try:
        from app.vision_service import is_yolo_model_ready
        ai_readiness["yolo"] = "READY" if is_yolo_model_ready() else "AI_NOT_READY"
    except Exception:
        ai_readiness["yolo"] = "AI_NOT_READY"

    try:
        from app.ocr_service import is_ocr_ready
        ai_readiness["ocr"] = "READY" if is_ocr_ready() else "AI_NOT_READY"
    except Exception:
        ai_readiness["ocr"] = "AI_NOT_READY"

    try:
        from app.visual_embedding_service import is_embedding_model_ready
        ai_readiness["visual_embedding"] = "READY" if is_embedding_model_ready() else "AI_NOT_READY"
    except Exception:
        ai_readiness["visual_embedding"] = "AI_NOT_READY"

    try:
        from app.visual_index_service import is_index_ready
        ai_readiness["visual_index"] = "READY" if is_index_ready() else "AI_NOT_READY"
    except Exception:
        ai_readiness["visual_index"] = "AI_NOT_READY"

    all_ai_ready = all(v == "READY" for v in ai_readiness.values())

    return {
        "status": "ok",
        "database": "connected" if db_status == "connected" else "disconnected",
        "database_type": db_type,
        "info": "Active SQLite fallback database" if db_type == "sqlite" else "PostgreSQL database",
        "ai_status": "READY" if all_ai_ready else "AI_NOT_READY",
        "ai_readiness": ai_readiness
    }
