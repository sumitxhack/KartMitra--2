import os
import urllib.request
import cv2
import zxingcpp
import httpx
import time
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
TEST_IMG_PATH = BASE_DIR / "test_barcode.png"
BARCODE_URL = "https://barcode.tec-it.com/barcode.ashx?data=8901234567890&code=EAN13"

def download_test_image():
    if TEST_IMG_PATH.exists():
        print("Test barcode image already exists.")
        return True
    
    print(f"Downloading test barcode image from {BARCODE_URL}...")
    try:
        # Add User-Agent to avoid HTTP 403 block from tec-it API
        req = urllib.request.Request(
            BARCODE_URL,
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req) as response:
            with open(TEST_IMG_PATH, 'wb') as f:
                f.write(response.read())
        print("Download complete.")
        return True
    except Exception as e:
        print(f"Failed to download test image: {e}")
        return False

def test_local_decode():
    print("\n--- Testing Local Decode ---")
    if not TEST_IMG_PATH.exists():
        print("No test image found.")
        return False
    
    img = cv2.imread(str(TEST_IMG_PATH))
    if img is None:
        print("Failed to read image using OpenCV.")
        return False
        
    results = zxingcpp.read_barcodes(img)
    if not results:
        print("No barcode detected locally.")
        return False
        
    for res in results:
        print(f"Detected Format: {res.format}")
        print(f"Decoded Value:   {res.text}")
        if res.text == "8901234567890":
            print("Local decode test: PASSED")
            return True
            
    print("Local decode test: FAILED (Value mismatch)")
    return False

def test_api_endpoint():
    print("\n--- Testing API Endpoint ---")
    if not TEST_IMG_PATH.exists():
        print("No test image found.")
        return False
        
    # Test POST request to FastAPI endpoint
    url = "http://127.0.0.1:8000/api/v1/recognition/barcode"
    print(f"Sending POST to {url}...")
    
    try:
        with open(TEST_IMG_PATH, 'rb') as f:
            files = {'file': ('test_barcode.png', f, 'image/png')}
            
            # Using httpx (or requests) to send multipart form data
            # Let's import it locally inside the function
            import httpx
            
            response = httpx.post(url, files=files, timeout=10.0)
            print(f"Response Status Code: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                print("Response JSON:")
                import json
                print(json.dumps(result, indent=2))
                
                if result.get("success") and result.get("barcode") == "8901234567890" and result.get("found"):
                    print("API Endpoint test: PASSED")
                    return True
            
            print("API Endpoint test: FAILED")
            return False
    except Exception as e:
        print(f"API Request failed: {e}")
        return False

def main():
    if not download_test_image():
        print("Could not retrieve test image. Aborting.")
        return
        
    test_local_decode()
    
    # We only run the API test if we can import httpx and the server is running
    try:
        import httpx
    except ImportError:
        print("\nNote: 'httpx' is not installed, install it in virtual env to run API test: pip install httpx")
        return
        
    # We can check if the API is running before testing
    try:
        res = httpx.get("http://127.0.0.1:8000/health", timeout=2.0)
        if res.status_code == 200:
            test_api_endpoint()
        else:
            print("\nAPI server is not healthy. Start the server first with 'uvicorn main:app --reload'")
    except Exception as e:
        print(f"\nAPI server check failed: {e}")

if __name__ == "__main__":
    main()
