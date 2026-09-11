import os
import io
import torch
import numpy as np
from PIL import Image
from pathlib import Path
from typing import Union, Tuple, Optional, Any, List
from app.config import VISUAL_EMBEDDING_MODEL, VISUAL_DEVICE

_embedding_processor: Optional[Any] = None
_embedding_model: Optional[Any] = None
_embedding_error: Optional[str] = None

class DummyEmbeddingModel:
    """Fallback synthetic embedding generator if HuggingFace/network is offline or unavailable."""
    def __init__(self, dim: int = 384, error: Optional[str] = None):
        self.dim = dim
        self.error = error or "DINOv2 model not loaded"
        self.is_ready = False

    def generate(self, img: Image.Image) -> np.ndarray:
        # Create deterministic pseudo-embedding from image resized pixels
        resized = img.convert("RGB").resize((16, 24))
        pixels = np.array(resized, dtype=np.float32).flatten()
        # Expand/trim to dimension
        if len(pixels) < self.dim:
            padded = np.pad(pixels, (0, self.dim - len(pixels)), mode="wrap")
        else:
            padded = pixels[:self.dim]
        # Normalize
        norm = np.linalg.norm(padded)
        if norm > 0:
            padded = padded / norm
        return padded.astype(np.float32)

def is_embedding_model_ready() -> bool:
    """Returns True if a real DINOv2 model instance is loaded and ready."""
    processor, model = get_embedding_model()
    return processor is not None and model is not None and not isinstance(model, DummyEmbeddingModel)

def require_real_dinov2_model():
    """Validates that real DINOv2 model is loaded and ready. Raises RuntimeError otherwise."""
    processor, model = get_embedding_model()
    if processor is None or model is None or isinstance(model, DummyEmbeddingModel):
        err = get_embedding_error() or "DINOv2 model not loaded or is fallback dummy generator"
        raise RuntimeError(f"Real DINOv2 embedding model required for production registration: {err}")

def get_embedding_error() -> Optional[str]:
    """Returns the last embedding model loading error if any."""
    return _embedding_error

def get_embedding_model() -> Tuple[Any, Any]:
    """
    Lazy singleton loader for DINOv2 visual embedding model & processor.
    Returns (processor, model).
    """
    global _embedding_processor, _embedding_model, _embedding_error
    if _embedding_model is None:
        device = VISUAL_DEVICE if torch.cuda.is_available() and VISUAL_DEVICE == "cuda" else "cpu"
        model_name = VISUAL_EMBEDDING_MODEL
        print(f"[Visual Embedding Service] Loading DINOv2 model '{model_name}' on device '{device}'...", flush=True)

        try:
            from transformers import AutoImageProcessor, AutoModel
            processor = AutoImageProcessor.from_pretrained(model_name)
            model = AutoModel.from_pretrained(model_name).to(device)
            model.eval()
            _embedding_processor = processor
            _embedding_model = model
            _embedding_error = None
            print(f"[Visual Embedding Service] Model '{model_name}' loaded successfully.", flush=True)
        except Exception as e:
            _embedding_error = str(e)
            print(f"[Visual Embedding Service] Failed to load transformers model '{model_name}': {e}. Using fallback embedding model.", flush=True)
            _embedding_processor = None
            _embedding_model = DummyEmbeddingModel(dim=384, error=str(e))

    return _embedding_processor, _embedding_model


def normalize_embedding(vec: np.ndarray) -> np.ndarray:
    """Normalizes vector using L2 norm so inner product equals cosine similarity."""
    vec = vec.astype(np.float32).flatten()
    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    return vec


def generate_embedding_from_image(img: Union[Image.Image, np.ndarray]) -> np.ndarray:
    """
    Generates a normalized float32 embedding vector for PIL Image or OpenCV BGR numpy array.
    """
    if isinstance(img, np.ndarray):
        import cv2
        if len(img.shape) == 3 and img.shape[2] == 3:
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb)
        else:
            pil_img = Image.fromarray(img).convert("RGB")
    elif isinstance(img, Image.Image):
        pil_img = img.convert("RGB")
    else:
        raise ValueError("Unsupported image format for embedding generation")

    processor, model = get_embedding_model()

    if isinstance(model, DummyEmbeddingModel):
        return model.generate(pil_img)

    device = VISUAL_DEVICE if torch.cuda.is_available() and VISUAL_DEVICE == "cuda" else "cpu"

    try:
        inputs = processor(images=pil_img, return_tensors="pt").to(device)
        with torch.no_grad():
            outputs = model(**inputs)
            # Use mean pooled representation or pooler_output / last_hidden_state[:, 0]
            if hasattr(outputs, "pooler_output") and outputs.pooler_output is not None:
                embedding = outputs.pooler_output.cpu().numpy()[0]
            elif hasattr(outputs, "last_hidden_state") and outputs.last_hidden_state is not None:
                embedding = outputs.last_hidden_state.mean(dim=1).cpu().numpy()[0]
            else:
                embedding = outputs[0].mean(dim=1).cpu().numpy()[0]

        return normalize_embedding(embedding)
    except Exception as e:
        print(f"[Visual Embedding Service] Inference exception: {e}. Falling back to dummy generator.", flush=True)
        dummy = DummyEmbeddingModel(dim=384)
        return dummy.generate(pil_img)


def generate_embedding_from_bytes(image_bytes: bytes) -> np.ndarray:
    """Decodes image bytes and generates a normalized DINOv2 embedding vector."""
    if not image_bytes:
        raise ValueError("Empty image bytes provided")
    img = Image.open(io.BytesIO(image_bytes))
    return generate_embedding_from_image(img)


def generate_embedding_from_path(image_path: Union[str, Path]) -> np.ndarray:
    """Reads image file from disk path and generates a normalized DINOv2 embedding vector."""
    p = Path(image_path)
    if not p.exists() or not p.is_file():
        raise FileNotFoundError(f"Reference image file not found: {image_path}")
    img = Image.open(p)
    return generate_embedding_from_image(img)


def generate_real_embedding_from_image(img: Union[Image.Image, np.ndarray]) -> np.ndarray:
    """
    Strictly generates normalized DINOv2 embedding using REAL model.
    Raises RuntimeError if model is not loaded or inference fails.
    """
    require_real_dinov2_model()
    if isinstance(img, np.ndarray):
        import cv2
        if len(img.shape) == 3 and img.shape[2] == 3:
            rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(rgb)
        else:
            pil_img = Image.fromarray(img).convert("RGB")
    elif isinstance(img, Image.Image):
        pil_img = img.convert("RGB")
    else:
        raise ValueError("Unsupported image format for embedding generation")

    processor, model = get_embedding_model()
    device = VISUAL_DEVICE if torch.cuda.is_available() and VISUAL_DEVICE == "cuda" else "cpu"
    try:
        inputs = processor(images=pil_img, return_tensors="pt").to(device)
        with torch.no_grad():
            outputs = model(**inputs)
            if hasattr(outputs, "pooler_output") and outputs.pooler_output is not None:
                embedding = outputs.pooler_output.cpu().numpy()[0]
            elif hasattr(outputs, "last_hidden_state") and outputs.last_hidden_state is not None:
                embedding = outputs.last_hidden_state.mean(dim=1).cpu().numpy()[0]
            else:
                embedding = outputs[0].mean(dim=1).cpu().numpy()[0]
        return normalize_embedding(embedding)
    except Exception as e:
        raise RuntimeError(f"DINOv2 real embedding generation failed: {e}")


def generate_real_embedding_from_path(image_path: Union[str, Path]) -> np.ndarray:
    """Reads image file from disk and strictly generates real DINOv2 embedding."""
    p = Path(image_path)
    if not p.exists() or not p.is_file():
        raise FileNotFoundError(f"Reference image file not found: {image_path}")
    img = Image.open(p)
    return generate_real_embedding_from_image(img)


def generate_embeddings_from_images(images: List[Union[Image.Image, np.ndarray]]) -> List[np.ndarray]:
    """
    Batches N product crop images into a single DINOv2 model inference call (Step 15U).
    Returns list of normalized float32 1D embedding vectors.
    """
    if not images:
        return []

    pil_images = []
    for img in images:
        if isinstance(img, np.ndarray):
            import cv2
            if len(img.shape) == 3 and img.shape[2] == 3:
                rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(rgb)
            else:
                pil_img = Image.fromarray(img).convert("RGB")
        elif isinstance(img, Image.Image):
            pil_img = img.convert("RGB")
        else:
            raise ValueError("Unsupported image format for embedding generation")
        pil_images.append(pil_img)

    processor, model = get_embedding_model()

    if isinstance(model, DummyEmbeddingModel):
        return [model.generate(p) for p in pil_images]

    device = VISUAL_DEVICE if torch.cuda.is_available() and VISUAL_DEVICE == "cuda" else "cpu"

    try:
        inputs = processor(images=pil_images, return_tensors="pt").to(device)
        with torch.no_grad():
            outputs = model(**inputs)
            if hasattr(outputs, "pooler_output") and outputs.pooler_output is not None:
                embeddings = outputs.pooler_output.cpu().numpy()
            elif hasattr(outputs, "last_hidden_state") and outputs.last_hidden_state is not None:
                embeddings = outputs.last_hidden_state.mean(dim=1).cpu().numpy()
            else:
                embeddings = outputs[0].mean(dim=1).cpu().numpy()

        return [normalize_embedding(embeddings[i]) for i in range(len(pil_images))]
    except Exception as e:
        print(f"[Visual Embedding Service] Batch inference exception: {e}. Falling back to single/dummy generator.", flush=True)
        dummy = DummyEmbeddingModel(dim=384)
        return [dummy.generate(p) for p in pil_images]

