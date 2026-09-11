import pytest

def test_fastapi_app_import():
    """Verify FastAPI app module can be imported and initialized."""
    from app.main import app
    assert app is not None
    assert app.title == "KartMitra Product Registration & Verification API"

def test_barcode_service_import():
    """Verify barcode library (zxing-cpp) and recognition service can be imported."""
    import zxingcpp
    assert hasattr(zxingcpp, "read_barcodes")
    from app.recognition_service import associate_barcode_with_product
    assert callable(associate_barcode_with_product)

def test_ocr_service_import():
    """Verify RapidOCR & rapidfuzz OCR service module can be imported."""
    from app.ocr_service import run_ocr, normalize_text, get_ocr_engine, is_ocr_ready
    assert callable(run_ocr)
    assert callable(normalize_text)
    assert callable(get_ocr_engine)
    assert callable(is_ocr_ready)

def test_dinov2_embedding_service_import():
    """Verify DINOv2 visual embedding service and transformers can be imported."""
    from app.visual_embedding_service import (
        generate_embedding_from_image,
        generate_embedding_from_bytes,
        get_embedding_model,
        is_embedding_model_ready,
    )
    assert callable(generate_embedding_from_image)
    assert callable(generate_embedding_from_bytes)
    assert callable(get_embedding_model)
    assert callable(is_embedding_model_ready)

def test_faiss_index_service_import():
    """Verify FAISS vector index service module can be imported."""
    import faiss
    assert hasattr(faiss, "IndexFlatIP")
    from app.visual_index_service import get_visual_index, search_similar, is_index_ready
    assert callable(get_visual_index)
    assert callable(search_similar)
    assert callable(is_index_ready)

def test_yolo_vision_service_import():
    """Verify YOLO vision service and ultralytics can be imported."""
    from app.vision_service import (
        detect_products_from_bytes,
        get_yolo_model,
        extract_crops_and_detections,
        is_yolo_model_ready,
    )
    assert callable(detect_products_from_bytes)
    assert callable(get_yolo_model)
    assert callable(extract_crops_and_detections)
    assert callable(is_yolo_model_ready)

def test_recognition_service_import():
    """Verify recognition service and decision logic can be imported."""
    from app.recognition_service import (
        identify_product_from_bytes,
        perform_visual_matching,
        perform_multi_product_recognition,
        aggregate_detected_products,
    )
    assert callable(identify_product_from_bytes)
    assert callable(perform_visual_matching)
    assert callable(perform_multi_product_recognition)
    assert callable(aggregate_detected_products)

def test_verification_engine_import():
    """Verify deterministic verification engine can be imported."""
    from app.verification_engine import VerificationEngine
    engine = VerificationEngine(weight_tolerance_kg=0.05)
    assert engine is not None
    assert callable(engine.verify)

def test_multi_signal_engine_import():
    """Verify multi-signal fusion engine can be imported."""
    from app.multi_signal_engine import fuse_multi_signals, process_full_frame_multi_signal
    assert callable(fuse_multi_signals)
    assert callable(process_full_frame_multi_signal)
