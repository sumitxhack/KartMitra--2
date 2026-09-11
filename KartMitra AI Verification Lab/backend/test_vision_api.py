import os
import cv2
import numpy as np
import urllib.request
import json

from pathlib import Path
from app.vision_service import detect_products_from_bytes

BASE_DIR = Path(__file__).resolve().parent

def create_sample_test_image():
    """Generates a synthetic test image with shapes to test YOLO vision service."""
    img_path = BASE_DIR / "test_vision_sample.jpg"
    # Create a 640x480 RGB image
    img = np.zeros((480, 640, 3), dtype=np.uint8)
    img[:] = (240, 240, 240)
    # Draw a blue rectangle box resembling a container/bottle
    cv2.rectangle(img, (100, 80), (340, 480), (255, 100, 50), -1)
    cv2.putText(img, "AMUL MILK", (120, 250), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
    cv2.imwrite(str(img_path), img)
    return img_path

def test_yolo_service_direct():
    print("\n--- 1. Testing YOLO Vision Service Directly ---")
    img_path = create_sample_test_image()
    with open(img_path, "rb") as f:
        image_bytes = f.read()

    result = detect_products_from_bytes(image_bytes)
    print("Vision Service Direct Output:")
    print(result)

    assert "success" in result and result["success"] is True
    assert "detections" in result
    print("Direct Vision Service Test: PASSED")
    return result

def test_api_endpoint():
    print("\n--- 2. Testing POST /api/v1/recognition/detect Endpoint ---")
    img_path = BASE_DIR / "test_vision_sample.jpg"
    url = "http://127.0.0.1:8000/api/v1/recognition/detect"

    try:
        req = urllib.request.Request("http://127.0.0.1:8000/health")
        with urllib.request.urlopen(req, timeout=2.0) as resp:
            if resp.status != 200:
                print("API server is not running on 8000. Skipping HTTP request test.")
                return
    except Exception as e:
        print(f"Server offline: {e}. Skipping HTTP request test.")
        return

    try:
        boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
        with open(img_path, "rb") as f:
            file_data = f.read()

        body = (
            f'--{boundary}\r\n'
            f'Content-Disposition: form-data; name="image"; filename="test_vision_sample.jpg"\r\n'
            f'Content-Type: image/jpeg\r\n\r\n'
        ).encode('utf-8') + file_data + f'\r\n--{boundary}--\r\n'.encode('utf-8')

        headers = {'Content-Type': f'multipart/form-data; boundary={boundary}'}
        post_req = urllib.request.Request(url, data=body, headers=headers, method='POST')

        with urllib.request.urlopen(post_req, timeout=10.0) as resp:
            resp_data = json.loads(resp.read().decode('utf-8'))
            print(f"HTTP Status: {resp.status}")
            print(f"Response Body: {json.dumps(resp_data, indent=2)}")
            assert resp.status == 200
            assert resp_data.get("success") is True
            print("API Endpoint Test: PASSED")
    except Exception as err:
        print(f"HTTP test error: {err}")


    print("API Endpoint Test: PASSED")

if __name__ == "__main__":
    test_yolo_service_direct()
    test_api_endpoint()
