import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

# Base directories
BASE_DIR = Path(__file__).resolve().parent.parent

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres@localhost:5432/kartmitra")

# Upload configurations
UPLOAD_DIR = BASE_DIR / "static" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Image validations
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

SUPPORTED_IMAGE_TYPES = {
    "front", "back", "side", "left", "right", "angled", "45_degree", "45-degree",
    "45-degree angle", "45_degree_angle", "different lighting", "different_lighting",
    "varying distances", "varying_distances", "slight rotation", "slight_rotation",
    "additional", "custom", "top", "bottom", "rotation", "lighting", "distance", "close_up"
}

# YOLO Vision Model configurations
_raw_model_path = os.getenv("MODEL_PATH", "models/yolo/yolo_v1/best.pt")
_model_path_obj = Path(_raw_model_path)
MODEL_PATH = str(_model_path_obj if _model_path_obj.is_absolute() else (BASE_DIR / _model_path_obj))
if not Path(MODEL_PATH).exists():
    MODEL_PATH = str(BASE_DIR / "yolov8n.pt")
CONFIDENCE_THRESHOLD = float(os.getenv("CONFIDENCE_THRESHOLD", "0.15"))
IOU_THRESHOLD = float(os.getenv("IOU_THRESHOLD", "0.45"))

# Weight verification configurations
WEIGHT_TOLERANCE_KG = float(os.getenv("WEIGHT_TOLERANCE_KG", "0.05"))

# Registered Product Visual Matching (DINOv2 + FAISS) configurations
ENABLE_VISUAL_MATCHING = os.getenv("ENABLE_VISUAL_MATCHING", "true").lower() in ("true", "1", "yes")
VISUAL_INDEX_DIR = Path(os.getenv("VISUAL_INDEX_DIR", str(BASE_DIR / "data" / "visual_index")))
VISUAL_INDEX_DIR.mkdir(parents=True, exist_ok=True)
VISUAL_EMBEDDING_MODEL = os.getenv("VISUAL_EMBEDDING_MODEL", "facebook/dinov2-small")
VISUAL_TOP_K = int(os.getenv("VISUAL_TOP_K", "5"))
VISUAL_MATCH_THRESHOLD = float(os.getenv("VISUAL_MATCH_THRESHOLD", "0.75"))
VISUAL_REVIEW_THRESHOLD = float(os.getenv("VISUAL_REVIEW_THRESHOLD", "0.55"))
VISUAL_MARGIN_THRESHOLD = float(os.getenv("VISUAL_MARGIN_THRESHOLD", "0.05"))
VISUAL_DEVICE = os.getenv("VISUAL_DEVICE", "cpu")


# Multi-Product Detection Configurations
VISION_BBOX_PADDING = float(os.getenv("VISION_BBOX_PADDING", "0.05"))
MAX_MULTI_DETECTIONS = int(os.getenv("MAX_MULTI_DETECTIONS", "20"))
BARCODE_ASSOCIATION_DISTANCE_PX = float(os.getenv("BARCODE_ASSOCIATION_DISTANCE_PX", "150.0"))
MIN_CROP_WIDTH = int(os.getenv("MIN_CROP_WIDTH", "10"))
MIN_CROP_HEIGHT = int(os.getenv("MIN_CROP_HEIGHT", "10"))

# Step 16 Dataset Builder & YOLO Fine-Tuning Configurations
DATASET_BASE_DIR = Path(os.getenv("DATASET_BASE_DIR", str(BASE_DIR / "data" / "kartmitra")))
DATASET_BASE_DIR.mkdir(parents=True, exist_ok=True)

MODELS_BASE_DIR = Path(os.getenv("MODELS_BASE_DIR", str(BASE_DIR / "models" / "kartmitra")))
MODELS_BASE_DIR.mkdir(parents=True, exist_ok=True)

ACTIVE_MODEL_VERSION_FILE = MODELS_BASE_DIR / "active_version.txt"
VISION_MODEL_MODE = os.getenv("VISION_MODEL_MODE", "BASE").upper()




