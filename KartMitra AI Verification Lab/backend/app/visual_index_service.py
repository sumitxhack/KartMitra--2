import os
import json
import faiss
import numpy as np
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple

from app.config import VISUAL_INDEX_DIR, VISUAL_EMBEDDING_MODEL

INDEX_FILE_PATH = VISUAL_INDEX_DIR / "faiss_index.bin"
METADATA_FILE_PATH = VISUAL_INDEX_DIR / "faiss_metadata.json"

_faiss_index: Optional[faiss.IndexFlatIP] = None
_index_metadata: List[Dict[str, Any]] = []

def is_index_ready() -> bool:
    """Returns True if FAISS index is loaded and available."""
    try:
        idx, _ = get_visual_index()
        return idx is not None
    except Exception:
        return False

def get_visual_index(dim: int = 384) -> Tuple[faiss.IndexFlatIP, List[Dict[str, Any]]]:
    """
    Singleton getter for FAISS index and metadata. Loads from disk if available.
    """
    global _faiss_index, _index_metadata
    if _faiss_index is None:
        load_visual_index(dim=dim)
    return _faiss_index, _index_metadata


def load_visual_index(dim: int = 384) -> Tuple[faiss.IndexFlatIP, List[Dict[str, Any]]]:
    """Loads FAISS index and metadata from disk."""
    global _faiss_index, _index_metadata
    VISUAL_INDEX_DIR.mkdir(parents=True, exist_ok=True)

    if INDEX_FILE_PATH.exists() and METADATA_FILE_PATH.exists():
        try:
            _faiss_index = faiss.read_index(str(INDEX_FILE_PATH))
            with open(METADATA_FILE_PATH, "r", encoding="utf-8") as f:
                _index_metadata = json.load(f)
            print(f"[Visual Index Service] Loaded {_faiss_index.ntotal} vectors from FAISS index disk file.", flush=True)
            return _faiss_index, _index_metadata
        except Exception as e:
            print(f"[Visual Index Service] Failed to load index from disk: {e}. Initializing fresh index.", flush=True)

    _faiss_index = faiss.IndexFlatIP(dim)
    _index_metadata = []
    return _faiss_index, _index_metadata


def save_visual_index() -> bool:
    """Saves current FAISS index and metadata to disk."""
    global _faiss_index, _index_metadata
    if _faiss_index is None:
        return False

    try:
        VISUAL_INDEX_DIR.mkdir(parents=True, exist_ok=True)
        faiss.write_index(_faiss_index, str(INDEX_FILE_PATH))
        with open(METADATA_FILE_PATH, "w", encoding="utf-8") as f:
            json.dump(_index_metadata, f, indent=2)
        print(f"[Visual Index Service] Index saved to disk ({_faiss_index.ntotal} vectors).", flush=True)
        return True
    except Exception as e:
        print(f"[Visual Index Service] Error saving index to disk: {e}", flush=True)
        return False


def add_embedding(
    vector: np.ndarray,
    product_id: str,
    product_image_id: str,
    image_path: Optional[str] = None,
    model_name: str = VISUAL_EMBEDDING_MODEL
) -> int:
    """
    Adds a single normalized 1D embedding vector to FAISS index and stores metadata mapping.
    Idempotent: If product_image_id already exists in metadata, returns existing index without duplicating.
    Returns assigned faiss_index_id.
    """
    global _faiss_index, _index_metadata
    dim = len(vector)
    index, metadata = get_visual_index(dim=dim)

    # Idempotency check: don't add duplicate vector for same image ID
    for meta in metadata:
        if meta.get("product_image_id") == product_image_id:
            return meta.get("faiss_index_id", 0)

    # Reshape float32 vector to shape (1, dim)
    vec_2d = np.ascontiguousarray(vector.reshape(1, -1), dtype=np.float32)

    assigned_id = index.ntotal
    index.add(vec_2d)

    meta_entry = {
        "faiss_index_id": assigned_id,
        "product_id": product_id,
        "product_image_id": product_image_id,
        "image_path": image_path,
        "model_name": model_name,
        "embedding_dimension": dim
    }
    metadata.append(meta_entry)
    save_visual_index()
    return assigned_id


def add_embeddings_batch(records: List[Dict[str, Any]], dim: int = 384) -> List[int]:
    """
    Incrementally adds a batch of new embeddings to the existing FAISS index (Step 13).
    Idempotent: skips any record whose product_image_id already exists in metadata.
    Returns list of assigned faiss_index_ids.
    """
    global _faiss_index, _index_metadata
    if not records:
        return []

    index, metadata = get_visual_index(dim=dim)
    existing_image_ids = {m.get("product_image_id") for m in metadata if "product_image_id" in m}

    to_add_records = []
    vectors = []
    assigned_ids: List[int] = []

    for r in records:
        img_id = r["product_image_id"]
        if img_id in existing_image_ids:
            # Already indexed: retrieve existing id
            for m in metadata:
                if m.get("product_image_id") == img_id:
                    assigned_ids.append(m.get("faiss_index_id", 0))
                    break
            continue

        vec = np.ascontiguousarray(r["vector"], dtype=np.float32).flatten()
        vectors.append(vec)
        to_add_records.append(r)

    if not to_add_records:
        return assigned_ids

    # Append all new vectors in single FAISS call
    start_id = index.ntotal
    vec_mat = np.ascontiguousarray(np.vstack(vectors), dtype=np.float32)
    index.add(vec_mat)

    for i, r in enumerate(to_add_records):
        new_id = start_id + i
        meta_entry = {
            "faiss_index_id": new_id,
            "product_id": r["product_id"],
            "product_image_id": r["product_image_id"],
            "image_path": r.get("image_path"),
            "model_name": r.get("model_name", VISUAL_EMBEDDING_MODEL),
            "embedding_dimension": dim
        }
        metadata.append(meta_entry)
        assigned_ids.append(new_id)

    save_visual_index()
    print(f"[Visual Index Service] Incrementally added {len(to_add_records)} vectors. Total FAISS vectors: {index.ntotal}", flush=True)
    return assigned_ids


def remove_product_embeddings(product_id: str) -> int:
    """
    Safely removes all vectors and metadata belonging to a product from FAISS index.
    Maintains 100% index-to-metadata alignment.
    Returns count of removed vectors.
    """
    global _faiss_index, _index_metadata
    index, metadata = get_visual_index()
    if index.ntotal == 0 or not metadata:
        return 0

    indices_to_remove = [
        idx for idx, m in enumerate(metadata)
        if m.get("product_id") == product_id
    ]

    if not indices_to_remove:
        return 0

    ids_array = np.array(indices_to_remove, dtype=np.int64)
    removed_count = index.remove_ids(ids_array)

    set_removed = set(indices_to_remove)
    new_metadata = [m for idx, m in enumerate(metadata) if idx not in set_removed]
    # Re-number faiss_index_id to match compacted array positions
    for new_idx, m in enumerate(new_metadata):
        m["faiss_index_id"] = new_idx

    _index_metadata = new_metadata
    save_visual_index()
    print(f"[Visual Index Service] Removed {removed_count} vectors for product {product_id}. Remaining vectors: {index.ntotal}", flush=True)
    return removed_count


def remove_single_image_embedding(product_image_id: str) -> bool:
    """
    Safely removes vector and metadata for a single image ID from FAISS index.
    Returns True if removed, False if not found.
    """
    global _faiss_index, _index_metadata
    index, metadata = get_visual_index()
    if index.ntotal == 0 or not metadata:
        return False

    target_idx = None
    for idx, m in enumerate(metadata):
        if m.get("product_image_id") == product_image_id:
            target_idx = idx
            break

    if target_idx is None:
        return False

    ids_array = np.array([target_idx], dtype=np.int64)
    index.remove_ids(ids_array)

    new_metadata = [m for idx, m in enumerate(metadata) if idx != target_idx]
    for new_idx, m in enumerate(new_metadata):
        m["faiss_index_id"] = new_idx

    _index_metadata = new_metadata
    save_visual_index()
    print(f"[Visual Index Service] Removed single vector for image {product_image_id}. Remaining: {index.ntotal}", flush=True)
    return True


def search_similar(query_vector: np.ndarray, top_k: int = 5) -> List[Dict[str, Any]]:
    """
    Searches FAISS index for top-K nearest neighbors using inner product (cosine similarity).
    Returns list of matched dict items with similarity score, product_id, product_image_id, etc.
    """
    global _faiss_index, _index_metadata
    dim = len(query_vector)
    index, metadata = get_visual_index(dim=dim)

    if index.ntotal == 0:
        return []

    actual_k = min(top_k, index.ntotal)
    query_2d = np.ascontiguousarray(query_vector.reshape(1, -1), dtype=np.float32)

    # Search returns distances (inner products) and indices
    similarities, indices = index.search(query_2d, actual_k)

    results: List[Dict[str, Any]] = []
    if len(indices) == 0:
        return results

    sim_row = similarities[0]
    idx_row = indices[0]

    for sim, idx in zip(sim_row, idx_row):
        if idx < 0 or idx >= len(metadata):
            continue
        meta = metadata[idx]
        sim_val = round(float(sim), 4)
        results.append({
            "product_id": meta.get("product_id"),
            "product_image_id": meta.get("product_image_id"),
            "image_path": meta.get("image_path"),
            "similarity": sim_val,
            "faiss_index_id": int(idx)
        })

    return results


def rebuild_visual_index(records: List[Dict[str, Any]], dim: int = 384) -> bool:
    """
    Rebuilds the entire FAISS index from scratch using a list of record dicts.
    Each record must contain 'vector', 'product_id', 'product_image_id', 'image_path'.
    """
    global _faiss_index, _index_metadata
    VISUAL_INDEX_DIR.mkdir(parents=True, exist_ok=True)

    new_index = faiss.IndexFlatIP(dim)
    new_metadata: List[Dict[str, Any]] = []

    if records:
        vectors = []
        for i, rec in enumerate(records):
            vec = rec["vector"]
            vectors.append(vec)
            new_metadata.append({
                "faiss_index_id": i,
                "product_id": rec["product_id"],
                "product_image_id": rec["product_image_id"],
                "image_path": rec.get("image_path"),
                "model_name": rec.get("model_name", VISUAL_EMBEDDING_MODEL),
                "embedding_dimension": dim
            })

        vec_mat = np.ascontiguousarray(np.vstack(vectors), dtype=np.float32)
        new_index.add(vec_mat)

    _faiss_index = new_index
    _index_metadata = new_metadata
    return save_visual_index()


def get_index_stats() -> Dict[str, Any]:
    """Returns statistics about the current FAISS visual index."""
    index, metadata = get_visual_index()
    unique_products = len(set(m["product_id"] for m in metadata if "product_id" in m))
    return {
        "index_loaded": True,
        "indexed_embeddings": index.ntotal,
        "registered_products": unique_products,
        "registered_images": len(metadata),
        "embedding_model": VISUAL_EMBEDDING_MODEL,
        "embedding_dimension": index.d
    }


def validate_index_consistency(db: Any) -> Dict[str, Any]:
    """
    Validates consistency between PostgreSQL database, filesystem images, and FAISS visual index (Prompt 20).
    """
    from app import models
    from app.feature_matcher import resolve_image_path

    index, metadata = get_visual_index()
    active_products = {str(p.id): p for p in db.query(models.Product).all()}
    db_images = db.query(models.ProductImage).all()
    db_image_ids = {str(img.id): img for img in db_images}

    faiss_vector_count = index.ntotal
    metadata_count = len(metadata)

    issues: List[str] = []

    # 1. Check index vector count vs metadata length
    if faiss_vector_count != metadata_count:
        issues.append(f"FAISS index vector count ({faiss_vector_count}) does not match metadata entries ({metadata_count}).")

    # 2. Check duplicates in metadata
    seen_image_ids = set()
    duplicate_vectors = 0
    for m in metadata:
        img_id = str(m.get("product_image_id"))
        if img_id in seen_image_ids:
            duplicate_vectors += 1
        seen_image_ids.add(img_id)
    if duplicate_vectors > 0:
        issues.append(f"Found {duplicate_vectors} duplicate image vector entries in FAISS metadata.")

    # 3. Check for deleted product vectors
    deleted_product_vectors = 0
    for m in metadata:
        pid = str(m.get("product_id"))
        if pid not in active_products:
            deleted_product_vectors += 1
    if deleted_product_vectors > 0:
        issues.append(f"Found {deleted_product_vectors} vectors referencing deleted products not in database.")

    # 4. Check for stale image vectors
    stale_vectors = 0
    for m in metadata:
        img_id = str(m.get("product_image_id"))
        if img_id not in db_image_ids:
            stale_vectors += 1
    if stale_vectors > 0:
        issues.append(f"Found {stale_vectors} vectors referencing images not in database.")

    # 5. Check for missing vectors
    meta_image_ids = {str(m.get("product_image_id")) for m in metadata if "product_image_id" in m}
    missing_vectors = 0
    for img in db_images:
        if str(img.id) not in meta_image_ids:
            missing_vectors += 1
    if missing_vectors > 0:
        issues.append(f"Found {missing_vectors} active reference images missing from FAISS index.")

    # 6. Check for missing image files on disk
    missing_image_files = 0
    for m in metadata:
        img_path = m.get("image_path")
        if not img_path:
            missing_image_files += 1
            continue
        p = resolve_image_path(img_path)
        if not p or not p.exists():
            missing_image_files += 1
    if missing_image_files > 0:
        issues.append(f"Found {missing_image_files} metadata entries whose image files are missing on disk.")

    # 7. Model and dimension check
    if index.d != 384:
        issues.append(f"FAISS index dimension {index.d} does not match expected DINOv2 dimension 384.")

    is_consistent = (len(issues) == 0)

    return {
        "success": True,
        "is_consistent": is_consistent,
        "postgres_active_products": len(active_products),
        "total_reference_images": len(db_images),
        "indexed_images_count": metadata_count,
        "faiss_vector_count": faiss_vector_count,
        "stale_vectors": stale_vectors,
        "missing_vectors": missing_vectors,
        "duplicate_vectors": duplicate_vectors,
        "missing_image_files": missing_image_files,
        "deleted_product_vectors": deleted_product_vectors,
        "embedding_model": VISUAL_EMBEDDING_MODEL,
        "embedding_dimension": index.d,
        "issues": issues
    }
