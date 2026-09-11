from datetime import datetime
from decimal import Decimal
from typing import List, Optional, Any, Dict
from pydantic import BaseModel, Field, field_validator, model_validator



class ProductImageBase(BaseModel):
    image_path: str
    image_type: str  # front, back, side, angled, additional

class ProductImageCreate(ProductImageBase):
    pass

class ProductImage(ProductImageBase):
    id: str
    product_id: str
    created_at: datetime

    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    barcode: str = Field(..., min_length=1, max_length=100, description="Product barcode (must be unique)")
    name: str = Field(..., min_length=1, max_length=255, description="Product name (required)")
    price: Decimal = Field(..., gt=0, decimal_places=2, description="Product price (must be positive)")
    weight: float = Field(..., gt=0, description="Product weight in kg (must be positive)")
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    keywords: Optional[Any] = Field(None, description="Packaging keywords (list or comma-separated string)")
    ocr_text: Optional[str] = Field(None, description="Reference packaging text for OCR matching")
    indexing_status: Optional[str] = Field("PENDING", description="AI visual indexing status: PENDING, INDEXING, READY, FAILED")
    indexing_error: Optional[str] = Field(None, description="Error message if indexing failed")

    @field_validator('name', 'barcode')
    @classmethod
    def check_non_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Value cannot be empty or whitespace only")
        return v.strip()

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    barcode: Optional[str] = Field(None, min_length=1, max_length=100)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    price: Optional[Decimal] = Field(None, gt=0, decimal_places=2)
    weight: Optional[float] = Field(None, gt=0)
    category: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=2000)
    keywords: Optional[Any] = Field(None)
    ocr_text: Optional[str] = Field(None)
    indexing_status: Optional[str] = Field(None)
    indexing_error: Optional[str] = Field(None)

    @field_validator('name', 'barcode')
    @classmethod
    def check_non_empty(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and not v.strip():
            raise ValueError("Value cannot be empty or whitespace only")
        return v.strip() if v is not None else None

class Product(ProductBase):
    id: str
    created_at: datetime
    updated_at: datetime
    images: List[ProductImage] = []
    
    image_count: Optional[int] = None
    needs_more_images: Optional[bool] = None

    class Config:
        from_attributes = True

    @model_validator(mode='after')
    def compute_image_metrics(self) -> 'Product':
        if self.image_count is None:
            self.image_count = len(self.images)
        if self.needs_more_images is None:
            self.needs_more_images = self.image_count < 5
        return self

# Wrapped response models for frontend compatibility
class SuccessResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None
    error: Optional[str] = None
    is_duplicate: Optional[bool] = None

class ProductResponse(SuccessResponse):
    product: Optional[Product] = None

class ProductsResponse(SuccessResponse):
    products: List[Product] = []

class ProductImageResponse(SuccessResponse):
    image: Optional[ProductImage] = None
    total_images: Optional[int] = None
    needs_more_images: Optional[bool] = None

class ProductImagesResponse(SuccessResponse):
    images: List[ProductImage]
    image_count: int
    needs_more_images: bool

class DeleteImageResponse(SuccessResponse):
    total_images: int
    needs_more_images: bool

class ProductIndexStatusResponse(SuccessResponse):
    model_config = {"protected_namespaces": ()}
    product_id: str
    status: str  # PENDING, INDEXING, READY, FAILED
    error: Optional[str] = None
    total_images: int = 0
    indexed_images: int = 0
    embeddings_created: int = 0
    faiss_updated: bool = False
    model_name: Optional[str] = None
    embedding_dimension: Optional[int] = None

class ProductIndexResponse(SuccessResponse):
    product_id: str
    status: str
    images_indexed: int = 0
    embeddings_created: int = 0
    faiss_updated: bool = False
    details: Optional[Dict[str, Any]] = None

class BatchImageUploadResponse(SuccessResponse):
    product_id: str
    uploaded_count: int = 0
    failed_count: int = 0
    total_images: int = 0
    indexing_status: str = "PENDING"
    images: List[ProductImage] = []
    errors: List[str] = []

class IndexConsistencyReport(SuccessResponse):
    is_consistent: bool = True
    postgres_active_products: int = 0
    total_reference_images: int = 0
    indexed_images_count: int = 0
    faiss_vector_count: int = 0
    stale_vectors: int = 0
    missing_vectors: int = 0
    duplicate_vectors: int = 0
    missing_image_files: int = 0
    deleted_product_vectors: int = 0
    embedding_model: str = ""
    embedding_dimension: int = 0
    issues: List[str] = []


class MockWeightRequest(BaseModel):
    expected_weight: float = Field(..., ge=0, description="Expected product weight in kg")
    actual_weight: float = Field(..., ge=0, description="Actual measured weight in kg")


class MockWeightResponse(BaseModel):
    expected_weight: float
    actual_weight: float
    difference: float
    within_tolerance: Optional[bool] = True
    tolerance_kg: Optional[float] = 0.05
    status: Optional[str] = "MATCH"


# Verification Engine Schemas
class VerificationChecks(BaseModel):
    session: bool = True
    barcode: bool = True
    vision: bool = True
    product: bool = True
    quantity: bool = True
    amount: bool = True
    weight: bool = True



class ExpectedSummary(BaseModel):
    weight: float
    amount: float


class ActualSummary(BaseModel):
    weight: float
    amount: float


class DifferencesSummary(BaseModel):
    weight: float
    amount: float


class VerificationRequest(BaseModel):
    session_id: str
    actual_weight: float
    detected_products: List[Any] = []
    barcode_results: List[Any] = []


class AIVerificationOutput(BaseModel):
    analysis: str
    confidence: float
    risk_score: float
    recommendation: str
    reason: str


class VerificationResponse(BaseModel):
    status: str  # PASS, REVIEW, FAIL
    risk_score: float
    checks: VerificationChecks
    expected: ExpectedSummary
    actual: ActualSummary
    differences: DifferencesSummary
    reasons: List[str] = []
    ai_analysis: Optional[AIVerificationOutput] = None


class SessionItemCreate(BaseModel):
    product_id: str
    quantity: int = 1


class ShoppingSessionCreate(BaseModel):
    session_id: Optional[str] = None
    items: List[SessionItemCreate] = []


# Step 14 Visual Recognition & Evaluation Schemas

class VisualMatchCandidate(BaseModel):
    rank: int
    product_id: str
    product_name: str
    similarity: float
    reference_image_id: Optional[str] = None


class VisualMatchDetail(BaseModel):
    similarity: float
    top2_similarity: Optional[float] = None
    margin: Optional[float] = None
    decision: str  # MATCH, REVIEW, UNKNOWN, MISMATCH
    decision_level: str  # HIGH, MEDIUM, LOW
    best_reference_image_id: Optional[str] = None


class VisualEvaluationRunCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None


class VisualEvaluationRunOut(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    total_tests: int = 0
    correct_predictions: int = 0
    incorrect_predictions: int = 0
    unknown_predictions: int = 0
    review_predictions: int = 0
    false_positives: int = 0
    false_negatives: int = 0
    accuracy: float = 0.0
    top1_accuracy: float = 0.0
    top3_accuracy: float = 0.0
    created_at: datetime

    class Config:
        from_attributes = True


class VisualEvaluationResultOut(BaseModel):
    id: str
    test_run_id: Optional[str] = None
    image_path: Optional[str] = None
    expected_product_id: Optional[str] = None
    predicted_product_id: Optional[str] = None
    top1_similarity: Optional[float] = None
    top2_similarity: Optional[float] = None
    margin: Optional[float] = None
    decision: Optional[str] = None
    is_correct: bool = False
    is_unknown: bool = False
    is_review: bool = False
    is_false_positive: bool = False
    is_false_negative: bool = False
    condition: Optional[str] = None
    lighting: Optional[str] = None
    angle: Optional[str] = None
    distance: Optional[str] = None
    occlusion: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class HardExampleCreate(BaseModel):
    test_run_id: Optional[str] = None
    image_path: Optional[str] = None
    expected_product_id: Optional[str] = None
    predicted_product_id: Optional[str] = None
    top1_similarity: Optional[float] = None
    top2_similarity: Optional[float] = None
    margin: Optional[float] = None
    condition: Optional[str] = None
    angle: Optional[str] = None
    notes: Optional[str] = None


# Step 16 Dataset & Training Schemas

class BBoxAnnotation(BaseModel):
    class_id: int
    product_id: str
    center_x: float
    center_y: float
    width: float
    height: float

class AnnotationSaveRequest(BaseModel):
    image_id: str
    product_id: str
    annotations: List[BBoxAnnotation]

class DatasetValidationResponse(BaseModel):
    valid: bool
    images: int
    annotations: int
    errors: List[str] = []
    warnings: List[str] = []

class DatasetCoverageResponse(BaseModel):
    product: str
    product_id: str
    image_count: int
    recommended_minimum: int = 20
    coverage: Dict[str, int]
    status: str

class TrainingStartRequest(BaseModel):
    model_config = {"protected_namespaces": ()}
    dataset_version: str = "v1"
    model_size: str = "yolo11n.pt"
    epochs: int = 50
    image_size: int = 640
    batch_size: int = 16
    device: str = "cpu"

class TrainingRunStatus(BaseModel):
    training_run_id: str
    status: str
    epoch: int = 0
    total_epochs: int = 50
    progress: int = 0
    loss: float = 0.0
    validation_metric: float = 0.0
    metrics: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None

class ModelVersionItem(BaseModel):
    version: str
    status: str
    classes: int
    created_at: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None
    is_active: bool = False


# Multi-Signal AI Verification Schemas

class OCRDataUpdateRequest(BaseModel):
    keywords: Optional[List[str]] = None
    ocr_text: Optional[str] = None


class MultiSignalWeightsConfig(BaseModel):
    barcode_weight: float = Field(0.40, ge=0.0, le=1.0)
    vision_weight: float = Field(0.25, ge=0.0, le=1.0)
    ocr_weight: float = Field(0.20, ge=0.0, le=1.0)
    similarity_weight: float = Field(0.15, ge=0.0, le=1.0)
    match_threshold: float = Field(0.70, ge=0.0, le=1.0)
    review_threshold: float = Field(0.45, ge=0.0, le=1.0)


class BarcodeSignalResult(BaseModel):
    detected: bool = False
    barcode: Optional[str] = None
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    match: bool = False
    score: float = 0.0


class VisionSignalResult(BaseModel):
    detected: bool = False
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    confidence: float = 0.0
    bbox: Optional[List[float]] = None
    match: bool = False
    score: float = 0.0


class OCRSignalResult(BaseModel):
    detected: bool = False
    extracted_text: Optional[str] = None
    normalized_text: Optional[str] = None
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    matched_keywords: List[str] = []
    match: bool = False
    score: float = 0.0


class SimilaritySignalResult(BaseModel):
    detected: bool = False
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    similarity: float = 0.0
    top2_similarity: Optional[float] = None
    margin: Optional[float] = None
    match: bool = False
    score: float = 0.0


class SignalsBreakdown(BaseModel):
    barcode: BarcodeSignalResult
    vision: VisionSignalResult
    ocr: OCRSignalResult
    similarity: SimilaritySignalResult


class MultiSignalDecisionOutput(BaseModel):
    status: str  # MATCH, REVIEW, MISMATCH, UNKNOWN
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    confidence: float = 0.0
    signals: SignalsBreakdown
    reason: str
    recommended_action: str  # ADD_TO_CART, MANUAL_REVIEW, REJECT, SCAN_AGAIN
    product: Optional[Dict[str, Any]] = None


class CartAddRequest(BaseModel):
    session_id: str = Field(..., min_length=1)
    product_id: str = Field(..., min_length=1)
    quantity: int = Field(1, ge=1)
    verification_status: Optional[str] = "MATCH"
    barcode: Optional[str] = None


class CartAddResponse(BaseModel):
    success: bool
    message: str
    session_id: str
    product_id: str
    quantity: int
    cart_items_count: int
    cart_total_price: float
    cart_expected_weight: float


class CombinedVerificationRequest(BaseModel):
    session_id: Optional[str] = "default_session"
    barcode: Optional[str] = None
    detections: Optional[List[Dict[str, Any]]] = None
    ocr_text: Optional[str] = None
    visual_matches: Optional[List[Dict[str, Any]]] = None






