import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import ForeignKey, String, Numeric, DateTime, func, Integer, Text, Float
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base

def generate_uuid_str():
    return str(uuid.uuid4())

class Product(Base):
    __tablename__ = "products"
    
    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=generate_uuid_str, index=True)
    barcode: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    weight: Mapped[float] = mapped_column(Float, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    keywords: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON-encoded array or comma-separated keywords
    ocr_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # Reference packaging text for OCR matching
    indexing_status: Mapped[str] = mapped_column(String(50), default="PENDING", server_default="PENDING", nullable=True)  # PENDING, INDEXING, READY, FAILED
    indexing_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    images: Mapped[List["ProductImage"]] = relationship("ProductImage", back_populates="product", cascade="all, delete-orphan")

class ProductImage(Base):
    __tablename__ = "product_images"
    
    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=generate_uuid_str, index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    image_path: Mapped[str] = mapped_column(String(500), nullable=False)
    image_type: Mapped[str] = mapped_column(String(50), nullable=False)  # front, back, side, angled, additional
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    # Optional columns to maintain compatibility with existing database rows/tables
    thumbnail_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    file_hash: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    product: Mapped["Product"] = relationship("Product", back_populates="images")
    embeddings: Mapped[List["ProductImageEmbedding"]] = relationship("ProductImageEmbedding", back_populates="product_image", cascade="all, delete-orphan")


class ProductImageEmbedding(Base):
    __tablename__ = "product_image_embeddings"

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=generate_uuid_str, index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    product_image_id: Mapped[str] = mapped_column(ForeignKey("product_images.id", ondelete="CASCADE"), nullable=False, index=True)
    faiss_index_id: Mapped[int] = mapped_column(Integer, nullable=False, default=-1)
    embedding_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    model_name: Mapped[str] = mapped_column(String(100), default="facebook/dinov2-small", nullable=False)
    embedding_dimension: Mapped[int] = mapped_column(Integer, default=384, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    product_image: Mapped["ProductImage"] = relationship("ProductImage", back_populates="embeddings")
    product: Mapped["Product"] = relationship("Product")


class ShoppingSession(Base):
    __tablename__ = "shopping_sessions"

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=generate_uuid_str, index=True)
    status: Mapped[str] = mapped_column(String(50), default="ACTIVE", nullable=False)  # ACTIVE, COMPLETED, CANCELLED
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    items: Mapped[List["SessionItem"]] = relationship("SessionItem", back_populates="session", cascade="all, delete-orphan")


class SessionItem(Base):
    __tablename__ = "session_items"

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=generate_uuid_str, index=True)
    session_id: Mapped[str] = mapped_column(ForeignKey("shopping_sessions.id", ondelete="CASCADE"), nullable=False)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    session: Mapped["ShoppingSession"] = relationship("ShoppingSession", back_populates="items")
    product: Mapped["Product"] = relationship("Product")


class VerificationLog(Base):
    __tablename__ = "verification_logs"

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=generate_uuid_str, index=True)
    session_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)  # PASS, REVIEW, FAIL
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    checks_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    expected_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    actual_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    differences_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reasons_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    ai_analysis_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    multi_signal_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    request_payload: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class VisualEvaluationRun(Base):
    __tablename__ = "visual_evaluation_runs"

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=generate_uuid_str, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    total_tests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    correct_predictions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    incorrect_predictions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    unknown_predictions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    review_predictions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    false_positives: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    false_negatives: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    accuracy: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    top1_accuracy: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    top3_accuracy: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    evaluations: Mapped[List["VisualEvaluation"]] = relationship("VisualEvaluation", back_populates="test_run", cascade="all, delete-orphan")


class VisualEvaluation(Base):
    __tablename__ = "visual_evaluations"

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=generate_uuid_str, index=True)
    test_run_id: Mapped[Optional[str]] = mapped_column(ForeignKey("visual_evaluation_runs.id", ondelete="CASCADE"), nullable=True, index=True)
    image_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    expected_product_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    predicted_product_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    top1_similarity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    top2_similarity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    margin: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    decision: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)  # MATCH, REVIEW, UNKNOWN, MISMATCH
    is_correct: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_unknown: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_review: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_false_positive: Mapped[bool] = mapped_column(default=False, nullable=False)
    is_false_negative: Mapped[bool] = mapped_column(default=False, nullable=False)
    condition: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    lighting: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    angle: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    distance: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    occlusion: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    test_run: Mapped[Optional["VisualEvaluationRun"]] = relationship("VisualEvaluationRun", back_populates="evaluations")


class HardExample(Base):
    __tablename__ = "hard_examples"

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=generate_uuid_str, index=True)
    test_run_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    image_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    expected_product_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    predicted_product_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    top1_similarity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    top2_similarity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    margin: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    condition: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    angle: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ProductDatasetMetadata(Base):
    __tablename__ = "product_dataset_metadata"

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=generate_uuid_str, index=True)
    product_id: Mapped[str] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    dataset_status: Mapped[str] = mapped_column(String(50), default="EMPTY", nullable=False)  # EMPTY, COLLECTING, READY_FOR_ANNOTATION, ANNOTATED, READY_FOR_TRAINING, TRAINING, TRAINED, FAILED
    image_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    annotated_image_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    training_image_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    validation_image_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    test_image_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    product: Mapped["Product"] = relationship("Product")


class TrainingRun(Base):
    __tablename__ = "training_runs"

    id: Mapped[str] = mapped_column(String(255), primary_key=True, default=generate_uuid_str, index=True)
    dataset_version: Mapped[str] = mapped_column(String(100), default="v1", nullable=False)
    model_name: Mapped[str] = mapped_column(String(100), default="yolo11n.pt", nullable=False)
    epochs: Mapped[int] = mapped_column(Integer, default=50, nullable=False)
    image_size: Mapped[int] = mapped_column(Integer, default=640, nullable=False)
    batch_size: Mapped[int] = mapped_column(Integer, default=16, nullable=False)
    device: Mapped[str] = mapped_column(String(50), default="cpu", nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="QUEUED", nullable=False)  # QUEUED, RUNNING, COMPLETED, FAILED, CANCELLED
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    model_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    best_model_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    training_logs: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metrics_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())




