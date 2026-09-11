import sys
import os
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from app import models, crud
from app.config import VISUAL_EMBEDDING_MODEL
from app.feature_matcher import resolve_image_path
from app.visual_embedding_service import generate_embedding_from_path
from app import visual_index_service

def build_product_visual_registry(db: Session) -> Dict[str, Any]:
    """
    Reads all registered products and ProductImages, generates DINOv2 embeddings,
    stores ProductImageEmbedding records in DB, rebuilds FAISS index, and saves to disk.
    """
    from app.visual_embedding_service import is_embedding_model_ready, get_embedding_error
    if not is_embedding_model_ready():
        err = get_embedding_error() or "DINOv2 model not loaded or is fallback dummy generator"
        raise RuntimeError(f"Cannot build production visual registry: {err}")

    products = db.query(models.Product).all()
    
    total_products = len(products)
    total_images_processed = 0
    embeddings_created = 0
    failed_images = 0

    # Clear existing embedding rows in DB
    crud.clear_all_embeddings(db)

    index_records: List[Dict[str, Any]] = []

    for product in products:
        images = product.images
        for prod_img in images:
            total_images_processed += 1
            file_path = resolve_image_path(prod_img.image_path)
            
            if not file_path or not file_path.exists():
                print(f"[Visual Registry] Warning: Reference image file not found: '{prod_img.image_path}' for product '{product.name}' ({product.id})", flush=True)
                failed_images += 1
                continue

            try:
                emb_vec = generate_embedding_from_path(file_path)
                faiss_id = len(index_records)
                
                # Create DB embedding row
                crud.create_product_image_embedding(
                    db=db,
                    product_id=product.id,
                    product_image_id=prod_img.id,
                    faiss_index_id=faiss_id,
                    embedding_path=prod_img.image_path,
                    model_name=VISUAL_EMBEDDING_MODEL,
                    embedding_dimension=len(emb_vec)
                )

                index_records.append({
                    "vector": emb_vec,
                    "product_id": product.id,
                    "product_image_id": prod_img.id,
                    "image_path": prod_img.image_path,
                    "model_name": VISUAL_EMBEDDING_MODEL
                })
                embeddings_created += 1
            except Exception as e:
                print(f"[Visual Registry] Error processing image {prod_img.id} ({prod_img.image_path}): {e}", flush=True)
                failed_images += 1

    # Rebuild FAISS index
    dim = index_records[0]["vector"].shape[0] if index_records else 384
    visual_index_service.rebuild_visual_index(index_records, dim=dim)

    # Update indexing_status for all products
    for p in products:
        if p.images and len(p.images) > 0:
            crud.update_product_indexing_status(db, p.id, "READY", None)
        else:
            crud.update_product_indexing_status(db, p.id, "PENDING", None)

    return {
        "success": True,
        "products_processed": total_products,
        "images_processed": total_images_processed,
        "embeddings_created": embeddings_created,
        "failed_images": failed_images,
        "index_size": len(index_records),
        "model": VISUAL_EMBEDDING_MODEL
    }


def index_product_images(product_id: str, db: Session) -> Dict[str, Any]:
    """
    Incrementally generates real DINOv2 embeddings for unindexed images of a product,
    adds them to FAISS visual index without full rebuild, and updates product status (Step 13).
    Idempotent: Safe to call repeatedly.
    """
    from app.visual_embedding_service import require_real_dinov2_model, generate_real_embedding_from_path

    product = crud.get_product(db, product_id)
    if not product:
        raise ValueError(f"Product '{product_id}' not found.")

    images = product.images
    if not images:
        crud.update_product_indexing_status(db, product_id, "PENDING", "No reference images uploaded yet.")
        return {
            "success": True,
            "product_id": product_id,
            "status": "PENDING",
            "total_images": 0,
            "images_indexed": 0,
            "embeddings_created": 0,
            "faiss_updated": False,
            "message": "Product has no reference images yet."
        }

    # Set status to INDEXING
    crud.update_product_indexing_status(db, product_id, "INDEXING", None)

    try:
        # Require real DINOv2 model (strictly forbid fallback dummy generator for production registration)
        require_real_dinov2_model()
    except Exception as me:
        crud.update_product_indexing_status(db, product_id, "FAILED", str(me))
        raise RuntimeError(f"Cannot index product visual embeddings: {me}")

    # Check which images are already indexed
    existing_embs = crud.get_embeddings_for_product(db, product_id)
    indexed_img_ids = {e.product_image_id for e in existing_embs}

    unindexed_images = [img for img in images if img.id not in indexed_img_ids]

    if not unindexed_images:
        crud.update_product_indexing_status(db, product_id, "READY", None)
        return {
            "success": True,
            "product_id": product_id,
            "status": "READY",
            "total_images": len(images),
            "images_indexed": len(images),
            "embeddings_created": 0,
            "faiss_updated": False,
            "message": "All product reference images are already indexed."
        }

    records_to_add: List[Dict[str, Any]] = []
    failed_count = 0
    errors: List[str] = []

    for prod_img in unindexed_images:
        file_path = resolve_image_path(prod_img.image_path)
        if not file_path or not file_path.exists():
            failed_count += 1
            errors.append(f"Image file not found on disk: {prod_img.image_path}")
            continue

        try:
            vec = generate_real_embedding_from_path(file_path)
            records_to_add.append({
                "vector": vec,
                "product_id": product_id,
                "product_image_id": prod_img.id,
                "image_path": prod_img.image_path,
                "model_name": VISUAL_EMBEDDING_MODEL
            })
        except Exception as e:
            failed_count += 1
            errors.append(f"Embedding error for {prod_img.id}: {str(e)}")

    if not records_to_add and failed_count > 0:
        err_msg = "; ".join(errors)
        crud.update_product_indexing_status(db, product_id, "FAILED", err_msg)
        return {
            "success": False,
            "product_id": product_id,
            "status": "FAILED",
            "total_images": len(images),
            "images_indexed": len(indexed_img_ids),
            "embeddings_created": 0,
            "faiss_updated": False,
            "error": err_msg
        }

    # Incrementally add to FAISS
    assigned_ids = visual_index_service.add_embeddings_batch(records_to_add)

    # Record in DB
    for rec, faiss_id in zip(records_to_add, assigned_ids):
        crud.create_product_image_embedding(
            db=db,
            product_id=product_id,
            product_image_id=rec["product_image_id"],
            faiss_index_id=faiss_id,
            embedding_path=rec["image_path"],
            model_name=VISUAL_EMBEDDING_MODEL,
            embedding_dimension=len(rec["vector"])
        )

    crud.update_product_indexing_status(db, product_id, "READY", None)

    return {
        "success": True,
        "product_id": product_id,
        "status": "READY",
        "total_images": len(images),
        "images_indexed": len(indexed_img_ids) + len(records_to_add),
        "embeddings_created": len(records_to_add),
        "faiss_updated": True,
        "failed_images": failed_count
    }


def remove_product_from_index(product_id: str, db: Session) -> int:
    """
    Removes all visual embeddings for a product from FAISS index and PostgreSQL.
    """
    removed_from_faiss = visual_index_service.remove_product_embeddings(product_id)
    crud.delete_embeddings_by_product_id(db, product_id)
    return removed_from_faiss


def remove_image_from_index(product_image_id: str, db: Session) -> bool:
    """
    Removes a single image embedding from FAISS index and PostgreSQL.
    """
    removed_from_faiss = visual_index_service.remove_single_image_embedding(product_image_id)
    crud.delete_embedding_by_image_id(db, product_image_id)
    return removed_from_faiss
