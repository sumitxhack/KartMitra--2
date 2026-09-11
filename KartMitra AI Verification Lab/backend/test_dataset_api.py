import io
import time
import requests
from PIL import Image, ImageDraw

BASE_URL = "http://127.0.0.1:8000"

def create_sample_image_bytes(color=(255, 0, 0), size=(600, 400), text_mark=0):
    img = Image.new("RGB", size, color=color)
    draw = ImageDraw.Draw(img)
    # Draw distinct geometric shapes based on text_mark
    draw.rectangle([10 * text_mark, 10 * text_mark, 100 + 30 * text_mark, 100 + 40 * text_mark], fill=(255 - 40 * text_mark, 50 * text_mark % 255, 200))
    draw.ellipse([50 + 20 * text_mark, 50 + 10 * text_mark, 200 + 10 * text_mark, 250 + 5 * text_mark], fill=(100, 200 - 30 * text_mark, 50 * text_mark % 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    return buf.getvalue()

def run_tests():
    print("--- 1. Testing GET /health ---")
    r = requests.get(f"{BASE_URL}/health")
    print(r.status_code, r.json())
    assert r.status_code == 200

    print("\n--- 2. Testing Registering a New Product POST /api/v1/products ---")
    unique_bc = f"TEST{int(time.time())}"
    prod_payload = {
        "barcode": unique_bc,
        "name": f"Test Juice {unique_bc}",
        "price": 120,
        "weight": 0.75,
        "category": "Beverages"
    }
    r_prod = requests.post(f"{BASE_URL}/api/v1/products", json=prod_payload)
    print(r_prod.status_code, r_prod.json())
    assert r_prod.status_code == 200
    pid = r_prod.json()["product"]["id"]
    assert r_prod.json()["product"]["needs_more_images"] is True
    print(f"Created Test Product ID: {pid}")

    print("\n--- 3. Testing POST /api/v1/products/{product_id}/images/upload (Valid Image) ---")
    img_bytes1 = create_sample_image_bytes(color=(200, 50, 50), size=(1200, 800), text_mark=1)
    files = {"file": ("test_front.jpg", img_bytes1, "image/jpeg")}
    data = {"image_type": "front"}
    r = requests.post(f"{BASE_URL}/api/v1/products/{pid}/images/upload", files=files, data=data)
    print(r.status_code, r.json())
    assert r.status_code == 200
    res_data = r.json()
    assert res_data["success"] is True
    img_id1 = res_data["image"]["id"]

    print("\n--- 4. Testing Duplicate Image Upload Rejection ---")
    files_dup = {"file": ("test_front_dup.jpg", img_bytes1, "image/jpeg")}
    data_dup = {"image_type": "front"}
    r_dup = requests.post(f"{BASE_URL}/api/v1/products/{pid}/images/upload", files=files_dup, data=data_dup)
    print(r_dup.status_code, r_dup.json())
    assert r_dup.json()["success"] is False
    assert "Duplicate image" in r_dup.json()["error"]

    print("\n--- 5. Testing Corrupt Image Upload Rejection ---")
    corrupt_bytes = b"NOT_AN_IMAGE_DATA_1234567890"
    files_corrupt = {"file": ("corrupt.jpg", corrupt_bytes, "image/jpeg")}
    r_corrupt = requests.post(f"{BASE_URL}/api/v1/products/{pid}/images/upload", files=files_corrupt, data={"image_type": "back"})
    print(r_corrupt.status_code, r_corrupt.json())
    assert r_corrupt.json()["success"] is False

    print("\n--- 6. Uploading 4 Additional Varied Images for Product ---")
    variations = [
        ("back", (50, 200, 50), 2),
        ("left", (50, 50, 200), 3),
        ("right", (200, 200, 50), 4),
        ("45_degree", (200, 50, 200), 5),
    ]
    for label, col, mark in variations:
        ibytes = create_sample_image_bytes(color=col, size=(800, 800), text_mark=mark)
        rf = requests.post(
            f"{BASE_URL}/api/v1/products/{pid}/images/upload",
            files={"file": (f"{label}.jpg", ibytes, "image/jpeg")},
            data={"image_type": label}
        )
        print(f"Uploaded {label}:", rf.json()["success"], "Total images:", rf.json().get("total_images"))
        assert rf.json()["success"] is True

    print("\n--- 7. Testing GET /api/v1/products/{product_id}/images ---")
    r_imgs = requests.get(f"{BASE_URL}/api/v1/products/{pid}/images")
    print(r_imgs.status_code, "Images count:", len(r_imgs.json()["images"]))
    assert len(r_imgs.json()["images"]) == 5
    assert r_imgs.json()["needs_more_images"] is False  # 5 images threshold reached!

    print("\n--- 8. Testing Image Deletion DELETE /api/v1/products/{product_id}/images/{image_id} ---")
    r_del = requests.delete(f"{BASE_URL}/api/v1/products/{pid}/images/{img_id1}")
    print(r_del.status_code, r_del.json())
    assert r_del.status_code == 200
    assert r_del.json()["total_images"] == 4
    assert r_del.json()["needs_more_images"] is True  # Dropped back below 5 images (< 5 flagged!)

    print("\n--- 9. Testing GET /api/v1/dataset/stats ---")
    r_stats = requests.get(f"{BASE_URL}/api/v1/dataset/stats")
    print(r_stats.status_code, r_stats.json())
    stats = r_stats.json()["stats"]
    print("Total Products:", stats["total_products"])
    print("Total Images:", stats["total_images"])
    print("Avg Images / Product:", stats["avg_images_per_product"])
    print("Products Without Enough Images (<5):", stats["products_without_enough_images"])
    assert stats["products_without_enough_images"] >= 1

    print("\n--- ALL BACKEND TESTS PASSED SUCCESSFULLY! ---")

if __name__ == "__main__":
    run_tests()
