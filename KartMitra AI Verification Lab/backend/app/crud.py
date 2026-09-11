from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app import models, schemas

def get_product(db: Session, product_id: str) -> Optional[models.Product]:
    p = db.query(models.Product).filter(models.Product.id == product_id).first()
    if not p:
        p = db.query(models.Product).filter(models.Product.barcode == product_id).first()
    return p

def get_product_by_barcode(db: Session, barcode: str) -> Optional[models.Product]:
    return db.query(models.Product).filter(models.Product.barcode == barcode).first()

def get_products(db: Session, skip: int = 0, limit: int = 100, search: Optional[str] = None) -> List[models.Product]:
    query = db.query(models.Product)
    if search:
        query = query.filter(
            or_(
                models.Product.name.ilike(f"%{search}%"),
                models.Product.barcode.ilike(f"%{search}%"),
                models.Product.category.ilike(f"%{search}%")
            )
        )
    return query.order_by(models.Product.name.asc()).offset(skip).limit(limit).all()

def create_product(db: Session, product: schemas.ProductCreate) -> models.Product:
    keywords_val = product.keywords
    if isinstance(keywords_val, (list, dict)):
        keywords_val = json.dumps(keywords_val)

    db_product = models.Product(
        barcode=product.barcode,
        name=product.name,
        price=product.price,
        weight=float(product.weight),
        category=product.category,
        description=product.description,
        keywords=keywords_val,
        ocr_text=product.ocr_text,
        indexing_status=getattr(product, "indexing_status", "PENDING") or "PENDING",
        indexing_error=getattr(product, "indexing_error", None),
    )
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

def update_product_indexing_status(
    db: Session,
    product_id: str,
    status: str,
    error: Optional[str] = None
) -> Optional[models.Product]:
    db_product = get_product(db, product_id)
    if not db_product:
        return None
    db_product.indexing_status = status
    db_product.indexing_error = error
    db.commit()
    db.refresh(db_product)
    return db_product

def update_product(db: Session, product_id: str, product_update: schemas.ProductUpdate) -> Optional[models.Product]:
    db_product = get_product(db, product_id)
    if not db_product:
        return None
    
    update_data = product_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if key == "weight" and value is not None:
            setattr(db_product, key, float(value))
        elif key == "keywords" and value is not None:
            if isinstance(value, (list, dict)):
                setattr(db_product, key, json.dumps(value))
            else:
                setattr(db_product, key, str(value))
        else:
            setattr(db_product, key, value)
        
    db.commit()
    db.refresh(db_product)
    return db_product

def delete_product(db: Session, product_id: str) -> bool:
    db_product = get_product(db, product_id)
    if not db_product:
        return False
    db.delete(db_product)
    db.commit()
    return True

def create_product_image(
    db: Session,
    product_id: str,
    image_path: str,
    image_type: str,
    thumbnail_path: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    file_size: Optional[int] = None,
    file_hash: Optional[str] = None
) -> models.ProductImage:
    db_image = models.ProductImage(
        product_id=product_id,
        image_path=image_path,
        image_type=image_type,
        thumbnail_path=thumbnail_path,
        width=width,
        height=height,
        file_size=file_size,
        file_hash=file_hash
    )
    db.add(db_image)
    db.commit()
    db.refresh(db_image)
    return db_image

def get_product_image(db: Session, image_id: str) -> Optional[models.ProductImage]:
    return db.query(models.ProductImage).filter(models.ProductImage.id == image_id).first()

def delete_product_image(db: Session, image_id: str) -> bool:
    db_image = get_product_image(db, image_id)
    if not db_image:
        return False
    db.delete(db_image)
    db.commit()
    return True

def find_registered_product_for_class(db: Session, class_name: str) -> Optional[models.Product]:
    """
    Finds a registered PostgreSQL product matching the detected object class_name.
    Searches product name, category, or mapping rules.
    """
    clean_class = class_name.strip().lower()
    
    # 1. Search by name or category matching class_name
    match = db.query(models.Product).filter(
        or_(
            models.Product.name.ilike(f"%{clean_class}%"),
            models.Product.category.ilike(f"%{clean_class}%")
        )
    ).first()
    if match:
        return match

    # 2. Category / keyword mapping rules for standard COCO classes
    category_map = {
        "bottle": ["milk", "beverage", "drink", "water", "juice", "bottle"],
        "cup": ["beverage", "tea", "coffee", "cup"],
        "box": ["carton", "cereal", "box", "biscuit"],
        "banana": ["fruit", "banana"],
        "apple": ["fruit", "apple"],
        "cell phone": ["electronics", "mobile", "phone"]
    }
    
    keywords = category_map.get(clean_class, [])
    for kw in keywords:
        match = db.query(models.Product).filter(
            or_(
                models.Product.name.ilike(f"%{kw}%"),
                models.Product.category.ilike(f"%{kw}%")
            )
        ).first()
        if match:
            return match

    # 3. Fallback: if there is only 1 or a few products registered in PostgreSQL or exact match
    return None


import json


def get_shopping_session(db: Session, session_id: str) -> Optional[models.ShoppingSession]:
    return db.query(models.ShoppingSession).filter(models.ShoppingSession.id == session_id).first()


def get_session_data_dict(db: Session, session_id: str) -> Optional[dict]:
    session_obj = get_shopping_session(db, session_id)
    if not session_obj:
        return None

    items_list = []
    for item in session_obj.items:
        prod = item.product
        if prod:
            items_list.append({
                "item_id": item.id,
                "product_id": prod.id,
                "barcode": prod.barcode,
                "name": prod.name,
                "price": float(prod.price),
                "weight": float(prod.weight),
                "quantity": item.quantity,
            })

    return {
        "id": session_obj.id,
        "status": session_obj.status,
        "items": items_list,
    }


def create_shopping_session(
    db: Session,
    session_id: Optional[str] = None,
    items: List[schemas.SessionItemCreate] = []
) -> models.ShoppingSession:
    db_session = models.ShoppingSession(
        id=session_id if session_id else models.generate_uuid_str(),
        status="ACTIVE"
    )
    db.add(db_session)
    db.flush()

    for item_data in items:
        prod = get_product(db, item_data.product_id) or get_product_by_barcode(db, item_data.product_id)
        if prod:
            db_item = models.SessionItem(
                session_id=db_session.id,
                product_id=prod.id,
                quantity=item_data.quantity
            )
            db.add(db_item)

    db.commit()
    db.refresh(db_session)
    return db_session


def log_verification_attempt(
    db: Session,
    session_id: Optional[str],
    verification_result: dict,
    request_payload: dict
) -> models.VerificationLog:
    ai_analysis_data = verification_result.get("ai_analysis")
    db_log = models.VerificationLog(
        session_id=session_id,
        status=verification_result.get("status", "UNKNOWN"),
        risk_score=float(verification_result.get("risk_score", 0.0)),
        checks_json=json.dumps(verification_result.get("checks", {})),
        expected_json=json.dumps(verification_result.get("expected", {})),
        actual_json=json.dumps(verification_result.get("actual", {})),
        differences_json=json.dumps(verification_result.get("differences", {})),
        reasons_json=json.dumps(verification_result.get("reasons", [])),
        ai_analysis_json=json.dumps(ai_analysis_data) if ai_analysis_data else None,
        request_payload=json.dumps(request_payload)
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log


# --- Product Image Embedding CRUD ---

def create_product_image_embedding(
    db: Session,
    product_id: str,
    product_image_id: str,
    faiss_index_id: int,
    embedding_path: Optional[str] = None,
    model_name: str = "facebook/dinov2-small",
    embedding_dimension: int = 384
) -> models.ProductImageEmbedding:
    # Delete existing embedding for this image if present
    existing = db.query(models.ProductImageEmbedding).filter(
        models.ProductImageEmbedding.product_image_id == product_image_id
    ).first()
    if existing:
        db.delete(existing)
        db.commit()

    db_emb = models.ProductImageEmbedding(
        product_id=product_id,
        product_image_id=product_image_id,
        faiss_index_id=faiss_index_id,
        embedding_path=embedding_path,
        model_name=model_name,
        embedding_dimension=embedding_dimension
    )
    db.add(db_emb)
    db.commit()
    db.refresh(db_emb)
    return db_emb


def get_embedding_by_image_id(db: Session, product_image_id: str) -> Optional[models.ProductImageEmbedding]:
    return db.query(models.ProductImageEmbedding).filter(
        models.ProductImageEmbedding.product_image_id == product_image_id
    ).first()


def get_all_embeddings(db: Session) -> List[models.ProductImageEmbedding]:
    return db.query(models.ProductImageEmbedding).all()


def delete_embedding_by_image_id(db: Session, product_image_id: str) -> bool:
    db_emb = get_embedding_by_image_id(db, product_image_id)
    if db_emb:
        db.delete(db_emb)
        db.commit()
        return True
    return False


def clear_all_embeddings(db: Session) -> int:
    deleted = db.query(models.ProductImageEmbedding).delete()
    db.commit()
    return deleted


def get_embeddings_for_product(db: Session, product_id: str) -> List[models.ProductImageEmbedding]:
    return db.query(models.ProductImageEmbedding).filter(
        models.ProductImageEmbedding.product_id == product_id
    ).all()


def delete_embeddings_by_product_id(db: Session, product_id: str) -> int:
    deleted = db.query(models.ProductImageEmbedding).filter(
        models.ProductImageEmbedding.product_id == product_id
    ).delete()
    db.commit()
    return deleted


# --- Step 14 Evaluation & Quality CRUD ---

def ensure_evaluation_tables_exist(db: Optional[Session] = None):
    try:
        from app.db import Base, engine
        bind_engine = db.get_bind() if db is not None else engine
        Base.metadata.create_all(bind=bind_engine)
    except Exception as e:
        print(f"[CRUD Warning] create_all error: {e}", flush=True)


def create_evaluation_run(
    db: Session,
    name: str,
    description: Optional[str] = None
) -> models.VisualEvaluationRun:
    ensure_evaluation_tables_exist(db)
    db_run = models.VisualEvaluationRun(
        name=name,
        description=description
    )
    db.add(db_run)
    db.commit()
    db.refresh(db_run)
    return db_run


def get_evaluation_run(db: Session, run_id: str) -> Optional[models.VisualEvaluationRun]:
    ensure_evaluation_tables_exist(db)
    return db.query(models.VisualEvaluationRun).filter(models.VisualEvaluationRun.id == run_id).first()


def get_evaluation_runs(db: Session, skip: int = 0, limit: int = 100) -> List[models.VisualEvaluationRun]:
    ensure_evaluation_tables_exist(db)
    return db.query(models.VisualEvaluationRun).order_by(models.VisualEvaluationRun.created_at.desc()).offset(skip).limit(limit).all()


def create_evaluation_record(
    db: Session,
    eval_data: dict
) -> models.VisualEvaluation:
    ensure_evaluation_tables_exist(db)
    db_eval = models.VisualEvaluation(**eval_data)
    db.add(db_eval)
    db.commit()
    db.refresh(db_eval)

    # Automatically update parent run metrics if test_run_id is set
    if db_eval.test_run_id:
        update_evaluation_run_stats(db, db_eval.test_run_id)

    return db_eval


def get_evaluation_records_by_run(db: Session, run_id: str) -> List[models.VisualEvaluation]:
    ensure_evaluation_tables_exist(db)
    return db.query(models.VisualEvaluation).filter(models.VisualEvaluation.test_run_id == run_id).order_by(models.VisualEvaluation.created_at.asc()).all()


def update_evaluation_run_stats(db: Session, run_id: str) -> Optional[models.VisualEvaluationRun]:
    ensure_evaluation_tables_exist(db)
    db_run = get_evaluation_run(db, run_id)
    if not db_run:
        return None

    records = get_evaluation_records_by_run(db, run_id)
    total = len(records)
    if total == 0:
        return db_run

    correct = sum(1 for r in records if r.is_correct)
    incorrect = sum(1 for r in records if not r.is_correct and not r.is_unknown and not r.is_review)
    unknowns = sum(1 for r in records if r.is_unknown)
    reviews = sum(1 for r in records if r.is_review)
    fps = sum(1 for r in records if r.is_false_positive)
    fns = sum(1 for r in records if r.is_false_negative)

    acc = round(correct / total, 4) if total > 0 else 0.0
    top1_acc = round(correct / total, 4) if total > 0 else 0.0
    top3_acc = round((correct + reviews) / total, 4) if total > 0 else 0.0

    db_run.total_tests = total
    db_run.correct_predictions = correct
    db_run.incorrect_predictions = incorrect
    db_run.unknown_predictions = unknowns
    db_run.review_predictions = reviews
    db_run.false_positives = fps
    db_run.false_negatives = fns
    db_run.accuracy = acc
    db_run.top1_accuracy = top1_acc
    db_run.top3_accuracy = top3_acc

    db.commit()
    db.refresh(db_run)
    return db_run


def create_hard_example(db: Session, hard_data: dict) -> models.HardExample:
    ensure_evaluation_tables_exist(db)
    db_hard = models.HardExample(**hard_data)
    db.add(db_hard)
    db.commit()
    db.refresh(db_hard)
    return db_hard


def get_hard_examples(db: Session, skip: int = 0, limit: int = 100) -> List[models.HardExample]:
    ensure_evaluation_tables_exist(db)
    return db.query(models.HardExample).order_by(models.HardExample.created_at.desc()).offset(skip).limit(limit).all()


def get_dataset_quality_report(db: Session) -> List[dict]:
    """
    Audits registered products for reference image & embedding counts.
    Flags < 5 images as LOW_REFERENCE_COUNT and < 10 images as RECOMMENDED_MORE_IMAGES.
    """
    ensure_evaluation_tables_exist(db)
    products = db.query(models.Product).all()
    report = []



    for p in products:
        img_count = db.query(models.ProductImage).filter(models.ProductImage.product_id == p.id).count()
        emb_count = db.query(models.ProductImageEmbedding).filter(models.ProductImageEmbedding.product_id == p.id).count()

        if img_count < 5:
            status = "LOW_REFERENCE_COUNT"
        elif img_count < 10:
            status = "RECOMMENDED_MORE_IMAGES"
        else:
            status = "HEALTHY"

        report.append({
            "product_id": p.id,
            "product_name": p.name,
            "registered_image_count": img_count,
            "valid_image_count": img_count,
            "invalid_image_count": 0,
            "embedding_count": emb_count,
            "status": status
        })

    return report


def update_product_ocr_data(
    db: Session,
    product_id: str,
    keywords: Optional[List[str]] = None,
    ocr_text: Optional[str] = None
) -> Optional[models.Product]:
    db_product = get_product(db, product_id)
    if not db_product:
        return None
    if keywords is not None:
        db_product.keywords = json.dumps(keywords) if isinstance(keywords, list) else str(keywords)
    if ocr_text is not None:
        db_product.ocr_text = ocr_text
    db.commit()
    db.refresh(db_product)
    return db_product


def get_all_products_dict(db: Session) -> List[dict]:
    products = db.query(models.Product).all()
    result = []
    for p in products:
        kws = []
        if p.keywords:
            try:
                kws = json.loads(p.keywords) if p.keywords.startswith("[") else [k.strip() for k in p.keywords.split(",") if k.strip()]
            except Exception:
                kws = [k.strip() for k in p.keywords.split(",") if k.strip()]
        result.append({
            "id": p.id,
            "barcode": p.barcode,
            "name": p.name,
            "price": float(p.price),
            "weight": float(p.weight),
            "category": p.category,
            "description": p.description,
            "keywords": kws,
            "ocr_text": p.ocr_text,
            "image_count": len(p.images) if p.images else 0
        })
    return result


def add_product_to_cart_session(
    db: Session,
    session_id: str,
    product_id: str,
    quantity: int = 1
) -> dict:
    session_obj = get_shopping_session(db, session_id)
    if not session_obj:
        session_obj = create_shopping_session(db, session_id=session_id)

    prod = get_product(db, product_id) or get_product_by_barcode(db, product_id)
    if not prod:
        raise ValueError(f"Product '{product_id}' not found.")

    # Check if item already in session
    existing_item = db.query(models.SessionItem).filter(
        models.SessionItem.session_id == session_obj.id,
        models.SessionItem.product_id == prod.id
    ).first()

    if existing_item:
        existing_item.quantity += quantity
    else:
        new_item = models.SessionItem(
            session_id=session_obj.id,
            product_id=prod.id,
            quantity=quantity
        )
        db.add(new_item)

    db.commit()
    db.refresh(session_obj)

    # Compute cart totals
    total_qty = 0
    total_price = 0.0
    expected_weight = 0.0

    for item in session_obj.items:
        p = item.product
        if p:
            total_qty += item.quantity
            total_price += float(p.price) * item.quantity
            expected_weight += float(p.weight) * item.quantity

    return {
        "session_id": session_obj.id,
        "product_id": prod.id,
        "quantity": quantity,
        "cart_items_count": total_qty,
        "cart_total_price": round(total_price, 2),
        "cart_expected_weight": round(expected_weight, 4)
    }


def get_verification_log(db: Session, log_id: str) -> Optional[models.VerificationLog]:
    return db.query(models.VerificationLog).filter(models.VerificationLog.id == log_id).first()





