import os
import io
import hashlib
from pathlib import Path
from PIL import Image, ImageOps

UPLOAD_DIR = Path(__file__).parent / "uploads"

def ensure_upload_dirs(product_id: str) -> Path:
    product_dir = UPLOAD_DIR / "products" / product_id
    product_dir.mkdir(parents=True, exist_ok=True)
    return product_dir

def validate_image_bytes(image_bytes: bytes):
    """
    Validates image bytes for corruption and non-empty size.
    Returns (is_valid: bool, error_message: str | None, image_obj: Image | None)
    """
    if not image_bytes or len(image_bytes) < 10:
        return False, "File content is empty or incomplete.", None

    try:
        img_file = io.BytesIO(image_bytes)
        img = Image.open(img_file)
        img.load()  # Force decoding of image data to detect corruption
        
        width, height = img.size
        if width <= 0 or height <= 0:
            return False, "Invalid image dimensions (0x0).", None

        return True, None, img
    except Exception as e:
        return False, f"Invalid or corrupt image format: {str(e)}", None

def compute_image_hashes(image_bytes: bytes, img: Image.Image) -> tuple[str, str]:
    """
    Computes exact MD5 hash and a 64-bit perceptual difference hash (dHash).
    """
    md5_hash = hashlib.md5(image_bytes).hexdigest()

    # Calculate dHash (difference hash)
    try:
        gray_img = img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
        pixels = list(gray_img.getdata())

        difference = []
        for row in range(8):
            for col in range(8):
                pixel_left = pixels[row * 9 + col]
                pixel_right = pixels[row * 9 + col + 1]
                difference.append(pixel_left > pixel_right)

        decimal_val = 0
        for index, val in enumerate(difference):
            if val:
                decimal_val |= 1 << (63 - index)
        dhash = f"{decimal_val:016x}"
    except Exception:
        dhash = md5_hash[:16]

    return md5_hash, dhash

def hamming_distance(hex1: str, hex2: str) -> int:
    """Calculates Hamming distance between two hex strings."""
    try:
        val1 = int(hex1, 16)
        val2 = int(hex2, 16)
        return bin(val1 ^ val2).count("1")
    except Exception:
        return 64

def check_duplicate(new_md5: str, new_dhash: str, existing_records: list[dict]) -> tuple[bool, str | None]:
    """
    Checks if new image is duplicate against existing image records for the product.
    Returns (is_duplicate: bool, warning_message: str | None)
    """
    for record in existing_records:
        existing_hash = record.get("file_hash", "")
        if new_md5 == existing_hash:
            return True, f"Exact duplicate image already exists (Image ID: {record.get('id')})."

        if len(existing_hash) >= 16 and len(new_dhash) == 16:
            dist = hamming_distance(new_dhash, existing_hash[:16])
            if dist <= 3:  # Threshold <= 3 indicates perceptual near-duplicate
                return True, f"Perceptually duplicate image detected (Image ID: {record.get('id')})."

    return False, None

def process_and_save_image(img: Image.Image, product_id: str, image_id: str) -> tuple[str, str, int, int, int]:
    """
    Normalizes color space, resizes to max 1024x1024, generates thumbnail (200x200 max),
    and saves main image & thumbnail to disk.
    Returns (relative_image_path, relative_thumbnail_path, width, height, file_size)
    """
    product_dir = ensure_upload_dirs(product_id)

    # Normalize image to RGB mode
    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
        background = Image.new("RGB", img.size, (255, 255, 255))
        converted = img.convert("RGBA")
        background.paste(converted, mask=converted.split()[3])
        img = background
    else:
        img = img.convert("RGB")

    # Auto-orient based on EXIF tag if available
    img = ImageOps.exif_transpose(img)

    # Preprocessing: Resize to max 1024x1024 preserving aspect ratio
    max_dim = 1024
    w, h = img.size
    if max(w, h) > max_dim:
        scale = max_dim / float(max(w, h))
        new_w = max(1, int(w * scale))
        new_h = max(1, int(h * scale))
        main_img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    else:
        main_img = img

    final_w, final_h = main_img.size

    # Generate Thumbnail (max 200x200)
    thumb_img = main_img.copy()
    thumb_img.thumbnail((200, 200), Image.Resampling.LANCZOS)

    # File paths
    main_filename = f"{image_id}.jpg"
    thumb_filename = f"{image_id}_thumb.jpg"

    main_filepath = product_dir / main_filename
    thumb_filepath = product_dir / thumb_filename

    # Save main JPEG
    main_img.save(main_filepath, "JPEG", quality=88, optimize=True)

    # Save thumbnail JPEG
    thumb_img.save(thumb_filepath, "JPEG", quality=85, optimize=True)

    file_size = main_filepath.stat().st_size

    # Relative paths for frontend serving
    rel_image_path = f"/uploads/products/{product_id}/{main_filename}"
    rel_thumb_path = f"/uploads/products/{product_id}/{thumb_filename}"

    return rel_image_path, rel_thumb_path, final_w, final_h, file_size

def delete_image_files(image_path: str, thumbnail_path: str):
    """Deletes image files from uploads directory."""
    try:
        if image_path.startswith("/uploads/"):
            rel_main = image_path.replace("/uploads/", "")
            full_main = UPLOAD_DIR / rel_main
            if full_main.exists():
                os.remove(full_main)

        if thumbnail_path.startswith("/uploads/"):
            rel_thumb = thumbnail_path.replace("/uploads/", "")
            full_thumb = UPLOAD_DIR / rel_thumb
            if full_thumb.exists():
                os.remove(full_thumb)
    except Exception as e:
        print(f"Error deleting image files: {e}", flush=True)
