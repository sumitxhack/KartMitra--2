from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db import get_db
from app import schemas
from app.visual_registry_service import build_product_visual_registry
from app.visual_index_service import get_index_stats, validate_index_consistency

router = APIRouter(prefix="/visual-registry", tags=["visual-registry"])

@router.post("/rebuild")
def rebuild_visual_registry_endpoint(db: Session = Depends(get_db)):
    """Triggers complete rebuild of the DINOv2 FAISS visual index from PostgreSQL ProductImages."""
    stats = build_product_visual_registry(db)
    return stats

@router.get("/stats")
def get_visual_registry_stats_endpoint(db: Session = Depends(get_db)):
    """Returns visual index status, model metadata, and total indexed embeddings."""
    stats = get_index_stats()
    return stats

@router.get("/validate", response_model=schemas.IndexConsistencyReport)
@router.get("/consistency", response_model=schemas.IndexConsistencyReport)
def validate_visual_registry_endpoint(db: Session = Depends(get_db)):
    """Validates visual index consistency against PostgreSQL products and disk files (Prompt 20)."""
    return validate_index_consistency(db)

@router.post("/repair", response_model=schemas.IndexConsistencyReport)
def repair_visual_registry_endpoint(db: Session = Depends(get_db)):
    """Re-syncs and repairs the visual index from current database records."""
    build_product_visual_registry(db)
    return validate_index_consistency(db)
