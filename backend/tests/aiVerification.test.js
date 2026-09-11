import { test, describe, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/app.js";
import {
  verifyImageWithAi,
  checkAiHealth,
  AiVerificationError,
} from "../src/services/aiVerificationService.js";

// Sample valid 1x1 GIF / JPEG buffer for testing
const SAMPLE_IMAGE_BUFFER = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
);

describe("KartMitra <-> AI Verification Lab Integration Tests", () => {
  let originalFetch;
  let server;
  let baseUrl;

  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.AI_VERIFICATION_URL = "http://localhost:8000";

    // Start in-process test server for endpoint testing
    await new Promise((resolve) => {
      server = app.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
  });

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // -------------------------------------------------------------
  // Test 1: Successful AI Response
  // -------------------------------------------------------------
  test("1. Successful AI Response - processes image and returns normalized structure", async () => {
    const mockAiResponse = {
      success: true,
      status: "MATCH",
      product_id: "prod_123_pg",
      product_name: "Amul Pasteurised Butter 500g",
      confidence: 0.965,
      signals: {
        barcode: { detected: true, barcode: "8901262010052", match: true, score: 1.0 },
        vision: { detected: true, confidence: 0.94, score: 0.94 },
        ocr: { detected: true, score: 0.88 },
        similarity: { detected: true, similarity: 0.91, score: 0.91 },
      },
      reason: "Verified with high confidence: Barcode and Vision agree.",
      recommended_action: "ADD_TO_CART",
      product: {
        id: "prod_123_pg",
        barcode: "8901262010052",
        name: "Amul Pasteurised Butter 500g",
        price: 275.0,
        category: "Dairy & Eggs",
      },
      detections: [
        {
          detection_id: "det_1",
          status: "MATCH",
          confidence: 0.965,
          product_name: "Amul Pasteurised Butter 500g",
        },
      ],
    };

    globalThis.fetch = async (url, options) => {
      if (url.toString().startsWith(baseUrl)) {
        return originalFetch(url, options);
      }
      assert.ok(url.toString().includes("/api/v1/verification/scan"));
      assert.equal(options.method, "POST");
      return new Response(JSON.stringify(mockAiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await verifyImageWithAi({
      imageBuffer: SAMPLE_IMAGE_BUFFER,
      scannedBarcode: "8901262010052",
    });

    assert.equal(result.status, "MATCH");
    assert.equal(result.confidence, 0.965);
    assert.equal(result.product.barcode, "8901262010052");
    assert.equal(result.product.name, "Amul Pasteurised Butter 500g");
    assert.equal(result.recommended_action, "ADD_TO_CART");
    assert.ok(Array.isArray(result.detections));
    assert.equal(result.detections.length, 1);
  });

  // -------------------------------------------------------------
  // Test 2: AI Unavailable (503)
  // -------------------------------------------------------------
  test("2. AI Unavailable - handles network/connection refused without crashing Express", async () => {
    globalThis.fetch = async (url, options) => {
      if (url.toString().startsWith(baseUrl)) {
        return originalFetch(url, options);
      }
      const err = new TypeError("fetch failed");
      err.cause = { code: "ECONNREFUSED" };
      throw err;
    };

    // Service call throws AiVerificationError with 503
    await assert.rejects(
      async () => {
        await verifyImageWithAi({
          imageBuffer: SAMPLE_IMAGE_BUFFER,
        });
      },
      (err) => {
        assert.ok(err instanceof AiVerificationError);
        assert.equal(err.statusCode, 503);
        assert.ok(err.message.includes("unavailable"));
        return true;
      }
    );

    // Endpoint call returns HTTP 503
    const formData = new FormData();
    formData.append("image", new Blob([SAMPLE_IMAGE_BUFFER]), "test.jpg");

    const res = await fetch(`${baseUrl}/api/camera/ai-verify`, {
      method: "POST",
      body: formData,
    });

    assert.equal(res.status, 503);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes("unavailable"));
  });

  // -------------------------------------------------------------
  // Test 3: Timeout (503)
  // -------------------------------------------------------------
  test("3. Timeout - aborts request when AI Lab takes too long", async () => {
    globalThis.fetch = async (url, options) => {
      if (url.toString().startsWith(baseUrl)) {
        return originalFetch(url, options);
      }
      return new Promise((_, reject) => {
        options.signal.addEventListener("abort", () => {
          const err = new Error("The operation was aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    };

    await assert.rejects(
      async () => {
        await verifyImageWithAi({
          imageBuffer: SAMPLE_IMAGE_BUFFER,
          timeoutMs: 50, // Short timeout for test
        });
      },
      (err) => {
        assert.ok(err instanceof AiVerificationError);
        assert.equal(err.statusCode, 503);
        assert.ok(err.message.includes("timed out"));
        return true;
      }
    );
  });

  // -------------------------------------------------------------
  // Test 4: Malformed Response (502)
  // -------------------------------------------------------------
  test("4. Malformed Response - returns 502 when AI Lab sends corrupt or non-JSON output", async () => {
    globalThis.fetch = async (url, options) => {
      if (url.toString().startsWith(baseUrl)) {
        return originalFetch(url, options);
      }
      return new Response("<html><body>502 Bad Gateway from Proxy</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    };

    await assert.rejects(
      async () => {
        await verifyImageWithAi({
          imageBuffer: SAMPLE_IMAGE_BUFFER,
        });
      },
      (err) => {
        assert.ok(err instanceof AiVerificationError);
        assert.equal(err.statusCode, 502);
        assert.ok(err.message.includes("Malformed"));
        return true;
      }
    );

    // Test HTTP endpoint response returns 502
    const formData = new FormData();
    formData.append("image", new Blob([SAMPLE_IMAGE_BUFFER]), "test.jpg");

    const res = await fetch(`${baseUrl}/api/camera/ai-verify`, {
      method: "POST",
      body: formData,
    });

    assert.equal(res.status, 502);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes("Malformed"));
  });

  // -------------------------------------------------------------
  // Test 5: Missing Image (400)
  // -------------------------------------------------------------
  test("5. Missing Image - rejects requests without valid image buffer with 400", async () => {
    await assert.rejects(
      async () => {
        await verifyImageWithAi({
          imageBuffer: null,
        });
      },
      (err) => {
        assert.ok(err instanceof AiVerificationError);
        assert.equal(err.statusCode, 400);
        assert.ok(err.message.includes("Image file is required"));
        return true;
      }
    );

    // Test HTTP endpoint without image field returns 400
    const emptyFormData = new FormData();
    emptyFormData.append("sessionId", "sess_123");

    const res = await fetch(`${baseUrl}/api/camera/ai-verify`, {
      method: "POST",
      body: emptyFormData,
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
    assert.ok(body.message.includes("Image file is required"));
  });

  // -------------------------------------------------------------
  // Test 6: MATCH Status Verification
  // -------------------------------------------------------------
  test("6. MATCH - correctly identifies product and confirms match", async () => {
    const mockAiMatch = {
      success: true,
      status: "MATCH",
      product_id: "pg_prod_tata_salt",
      product_name: "Tata Salt Iodized 1kg",
      confidence: 0.98,
      signals: {
        barcode: { detected: true, barcode: "8901058000078", match: true, score: 1.0 },
      },
      reason: "Identified via registered barcode (8901058000078).",
      recommended_action: "ADD_TO_CART",
      product: {
        barcode: "8901058000078",
        name: "Tata Salt Iodized 1kg",
        price: 28.0,
        category: "Grocery Essentials",
      },
    };

    globalThis.fetch = async (url, options) => {
      if (url.toString().startsWith(baseUrl)) {
        return originalFetch(url, options);
      }
      return new Response(JSON.stringify(mockAiMatch), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await verifyImageWithAi({
      imageBuffer: SAMPLE_IMAGE_BUFFER,
      scannedBarcode: "8901058000078",
    });

    assert.equal(result.status, "MATCH");
    assert.equal(result.product.barcode, "8901058000078");
    assert.equal(result.recommended_action, "ADD_TO_CART");
  });

  // -------------------------------------------------------------
  // Test 7: MISMATCH Status Verification
  // -------------------------------------------------------------
  test("7. MISMATCH - detects mismatch between scanned barcode and visual AI detected item", async () => {
    const mockAiDetectedTataSalt = {
      success: true,
      status: "MATCH",
      product_id: "pg_prod_tata_salt",
      product_name: "Tata Salt Iodized 1kg",
      confidence: 0.95,
      signals: {
        barcode: { detected: true, barcode: "8901058000078", match: true, score: 1.0 },
      },
      reason: "Identified via registered barcode.",
      recommended_action: "ADD_TO_CART",
      product: {
        barcode: "8901058000078",
        name: "Tata Salt Iodized 1kg",
        price: 28.0,
        category: "Grocery Essentials",
      },
    };

    globalThis.fetch = async (url, options) => {
      if (url.toString().startsWith(baseUrl)) {
        return originalFetch(url, options);
      }
      return new Response(JSON.stringify(mockAiDetectedTataSalt), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    // User scanned Amul Butter (8901262010052), but camera detected Tata Salt (8901058000078)!
    const result = await verifyImageWithAi({
      imageBuffer: SAMPLE_IMAGE_BUFFER,
      scannedBarcode: "8901262010052",
    });

    assert.equal(result.status, "MISMATCH");
    assert.ok(result.reason.includes("Barcode mismatch"));
    assert.equal(result.recommended_action, "MANUAL_REVIEW");
    assert.equal(result.product.barcode, "8901058000078");
  });

  // -------------------------------------------------------------
  // Test 8: REVIEW Status Verification
  // -------------------------------------------------------------
  test("8. REVIEW - flags ambiguous signals for manual staff inspection", async () => {
    const mockAiReview = {
      success: true,
      status: "REVIEW",
      product_id: "pg_prod_maggi",
      product_name: "Maggi 2-Minute Noodles 280g",
      confidence: 0.62,
      signals: {
        barcode: { detected: false, barcode: null },
        vision: { detected: true, confidence: 0.62 },
        ocr: { detected: true, score: 0.55 },
      },
      reason: "Moderate recognition signals. Reposition recommended.",
      recommended_action: "MANUAL_REVIEW",
      product: {
        barcode: "8901058852318",
        name: "Maggi 2-Minute Noodles 280g",
        price: 52.0,
        category: "Instant Food",
      },
    };

    globalThis.fetch = async (url, options) => {
      if (url.toString().startsWith(baseUrl)) {
        return originalFetch(url, options);
      }
      return new Response(JSON.stringify(mockAiReview), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await verifyImageWithAi({
      imageBuffer: SAMPLE_IMAGE_BUFFER,
      sessionId: "sess_test_123",
    });

    assert.equal(result.status, "REVIEW");
    assert.equal(result.confidence, 0.62);
    assert.equal(result.recommended_action, "MANUAL_REVIEW");
    assert.equal(result.product.barcode, "8901058852318");
  });

  // -------------------------------------------------------------
  // Test 9: GET /api/camera/ai-health
  // -------------------------------------------------------------
  test("9. GET /api/camera/ai-health - reports availability accurately", async () => {
    // When healthy
    globalThis.fetch = async (url, options) => {
      if (url.toString().startsWith(baseUrl)) {
        return originalFetch(url, options);
      }
      assert.ok(url.toString().includes("/health"));
      return new Response(JSON.stringify({ status: "ok", ai_status: "READY" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const healthRes = await fetch(`${baseUrl}/api/camera/ai-health`);
    assert.equal(healthRes.status, 200);
    const healthBody = await healthRes.json();
    assert.equal(healthBody.available, true);
    assert.equal(healthBody.service, "ai-verification");

    // When unreachable
    globalThis.fetch = async (url, options) => {
      if (url.toString().startsWith(baseUrl)) {
        return originalFetch(url, options);
      }
      throw new Error("Connection refused");
    };

    const downRes = await fetch(`${baseUrl}/api/camera/ai-health`);
    assert.equal(downRes.status, 200);
    const downBody = await downRes.json();
    assert.equal(downBody.available, false);
    assert.equal(downBody.service, "ai-verification");
  });

  // -------------------------------------------------------------
  // Test 10: Product Without Barcode (Requirement 8)
  // -------------------------------------------------------------
  test("10. Product without barcode - marks mapping as unresolved safely", async () => {
    const mockAiNoBarcode = {
      success: true,
      status: "REVIEW",
      product_id: "unknown_item_01",
      product_name: "Generic Apple Fruit",
      confidence: 0.55,
      signals: {
        barcode: { detected: false, barcode: null },
        vision: { detected: true, confidence: 0.55 },
      },
      reason: "Visual detection without barcode identifier.",
      recommended_action: "MANUAL_REVIEW",
      product: {
        name: "Generic Apple Fruit",
        price: 30.0,
      },
    };

    globalThis.fetch = async (url, options) => {
      if (url.toString().startsWith(baseUrl)) {
        return originalFetch(url, options);
      }
      return new Response(JSON.stringify(mockAiNoBarcode), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };

    const result = await verifyImageWithAi({
      imageBuffer: SAMPLE_IMAGE_BUFFER,
    });

    assert.equal(result.product.barcode, null);
    assert.equal(result.product.mapping, "unresolved");
    assert.equal(result.status, "REVIEW");
  });

  // -------------------------------------------------------------
  // Test 11: Preserved POST /api/camera/verify
  // -------------------------------------------------------------
  test("11. Preserved POST /api/camera/verify - still responds as expected", async () => {
    const res = await fetch(`${baseUrl}/api/camera/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    // Validates that the endpoint is mounted and responds (400 for missing body params)
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.success, false);
  });
});
