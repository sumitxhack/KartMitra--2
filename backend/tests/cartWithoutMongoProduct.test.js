import { test, describe, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import app from "../src/app.js";
import Cart from "../src/models/Cart.js";
import Product from "../src/models/Product.js";
import {
  createCart,
  getCartBySessionId,
  addProductToCart,
  removeProductFromCart,
  calculateCartTotals,
} from "../src/services/cartService.js";

describe("Cart Without MongoDB Product Document Test Suite", () => {
  let server;
  let baseUrl;
  let originalFetch;

  before(async () => {
    process.env.NODE_ENV = "test";

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
    // Clean up test carts created during test run
    try {
      await Cart.deleteMany({ sessionId: { $regex: /^test-session-/ } });
    } catch (_) {}
    await mongoose.disconnect();
  });

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  // -------------------------------------------------------------
  // Test 1: Cart Item Schema does not require MongoDB Product
  // -------------------------------------------------------------
  test("1. Cart item schema does not require ObjectId ref to MongoDB Product", () => {
    const itemPath = Cart.schema.path("items");
    assert.ok(itemPath, "items array must exist on Cart schema");

    const subschema = itemPath.schema;
    assert.ok(subschema, "items subschema must exist");

    // Verify snapshot fields exist
    assert.ok(subschema.path("productId"), "productId field exists");
    assert.ok(subschema.path("name"), "name field exists");
    assert.ok(subschema.path("barcode"), "barcode field exists");
    assert.ok(subschema.path("quantity"), "quantity field exists");
    assert.ok(subschema.path("unitPrice"), "unitPrice field exists");
    assert.ok(subschema.path("unitWeight"), "unitWeight field exists");
    assert.ok(subschema.path("totalPrice"), "totalPrice field exists");
    assert.ok(subschema.path("totalWeight"), "totalWeight field exists");

    // Verify product is NOT required as an ObjectId ref to Product
    const productField = subschema.path("product");
    if (productField) {
      assert.notEqual(
        productField.options?.ref,
        "Product",
        "product field must not have ref: 'Product'"
      );
      assert.notEqual(
        productField.isRequired,
        true,
        "product field must not be required"
      );
    }
  });

  // -------------------------------------------------------------
  // Test 2: Add item without MongoDB Product document
  // -------------------------------------------------------------
  test("2. Add item: Successfully adds item snapshot without any MongoDB Product document", async () => {
    const sessionId = `test-session-${Date.now()}-1`;
    const testBarcode = `TEST-BARCODE-${Date.now()}`;

    // Confirm that NO Product document exists in MongoDB for this barcode
    const mongoProd = await Product.findOne({ barcode: testBarcode });
    assert.equal(mongoProd, null, "Precondition: No MongoDB product exists");

    // Create active cart
    await Cart.create({
      sessionId,
      items: [],
      totalAmount: 0,
      expectedWeight: 0,
      status: "ACTIVE",
    });

    // Add item with verified snapshot data
    const updatedCart = await addProductToCart(sessionId, {
      productId: "pg-product-uuid-101",
      barcode: testBarcode,
      name: "Organic Honey 500g",
      price: 249.5,
      weight: 500,
      quantity: 2,
    });

    assert.equal(updatedCart.items.length, 1);
    const item = updatedCart.items[0];
    assert.equal(item.barcode, testBarcode);
    assert.equal(item.name, "Organic Honey 500g");
    assert.equal(item.productId, "pg-product-uuid-101");
    assert.equal(item.quantity, 2);
    assert.equal(item.unitPrice, 249.5);
    assert.equal(item.unitWeight, 500);
    assert.equal(item.totalPrice, 499.0);
    assert.equal(item.totalWeight, 1000);

    assert.equal(updatedCart.totalAmount, 499.0);
    assert.equal(updatedCart.expectedWeight, 1000);

    // Confirm MongoDB still has no Product document
    const mongoProdAfter = await Product.findOne({ barcode: testBarcode });
    assert.equal(mongoProdAfter, null, "Postcondition: MongoDB Product was NOT created");
  });

  // -------------------------------------------------------------
  // Test 3: Duplicate item increases quantity and updates totals
  // -------------------------------------------------------------
  test("3. Duplicate item: Adding same barcode increments quantity and recalculates totals", async () => {
    const sessionId = `test-session-${Date.now()}-2`;
    const barcode = `TEST-DUP-${Date.now()}`;

    await Cart.create({
      sessionId,
      items: [],
      totalAmount: 0,
      expectedWeight: 0,
      status: "ACTIVE",
    });

    // Add 1 unit
    await addProductToCart(sessionId, {
      productId: "pg-uuid-202",
      barcode,
      name: "Tata Salt 1kg",
      price: 28,
      weight: 1000,
      quantity: 1,
    });

    // Add 2 more units of the same product
    const updatedCart = await addProductToCart(sessionId, {
      productId: "pg-uuid-202",
      barcode,
      name: "Tata Salt 1kg",
      price: 28,
      weight: 1000,
      quantity: 2,
    });

    assert.equal(updatedCart.items.length, 1, "Should still have 1 distinct item entry");
    const item = updatedCart.items[0];
    assert.equal(item.quantity, 3, "Quantity should be 1 + 2 = 3");
    assert.equal(item.totalPrice, 84.0, "totalPrice = 28 * 3 = 84");
    assert.equal(item.totalWeight, 3000, "totalWeight = 1000 * 3 = 3000");

    assert.equal(updatedCart.totalAmount, 84.0);
    assert.equal(updatedCart.expectedWeight, 3000);
  });

  // -------------------------------------------------------------
  // Test 4: Totals calculation across multiple products
  // -------------------------------------------------------------
  test("4. Totals: Accurate cumulative calculation of totalAmount and expectedWeight", async () => {
    const sessionId = `test-session-${Date.now()}-3`;

    await Cart.create({
      sessionId,
      items: [],
      totalAmount: 0,
      expectedWeight: 0,
      status: "ACTIVE",
    });

    // Product 1: 2 x Amul Milk @ 62.00, 1000g each
    await addProductToCart(sessionId, {
      productId: "pg-milk-1",
      barcode: `MILK-${Date.now()}`,
      name: "Amul Taaza Milk 1L",
      price: 62.0,
      weight: 1000,
      quantity: 2,
    });

    // Product 2: 3 x Maggi Noodles @ 14.50, 70g each
    const finalCart = await addProductToCart(sessionId, {
      productId: "pg-maggi-1",
      barcode: `MAGGI-${Date.now()}`,
      name: "Maggi 2-Minute Noodles",
      price: 14.5,
      weight: 70,
      quantity: 3,
    });

    assert.equal(finalCart.items.length, 2);
    // 2 * 62.00 = 124.00, 3 * 14.50 = 43.50 => totalAmount = 167.50
    assert.equal(finalCart.totalAmount, 167.5);
    // 2 * 1000g = 2000g, 3 * 70g = 210g => expectedWeight = 2210g
    assert.equal(finalCart.expectedWeight, 2210);
  });

  // -------------------------------------------------------------
  // Test 5: Remove item (decrement quantity vs complete removal)
  // -------------------------------------------------------------
  test("5. Remove item: Decrements quantity when > 1, removes completely when quantity === 1", async () => {
    const sessionId = `test-session-${Date.now()}-4`;
    const barcode = `TEST-REMOVE-${Date.now()}`;

    await Cart.create({
      sessionId,
      items: [],
      totalAmount: 0,
      expectedWeight: 0,
      status: "ACTIVE",
    });

    // Add 2 units
    await addProductToCart(sessionId, {
      productId: "pg-remove-1",
      barcode,
      name: "Parle-G 250g",
      price: 30,
      weight: 250,
      quantity: 2,
    });

    // Step A: Remove 1 unit (quantity was 2 -> becomes 1)
    const decrementedCart = await removeProductFromCart(sessionId, barcode);
    assert.equal(decrementedCart.items.length, 1);
    assert.equal(decrementedCart.items[0].quantity, 1);
    assert.equal(decrementedCart.items[0].totalPrice, 30);
    assert.equal(decrementedCart.items[0].totalWeight, 250);
    assert.equal(decrementedCart.totalAmount, 30);
    assert.equal(decrementedCart.expectedWeight, 250);

    // Step B: Remove again (quantity was 1 -> item completely removed)
    const emptyCart = await removeProductFromCart(sessionId, barcode);
    assert.equal(emptyCart.items.length, 0);
    assert.equal(emptyCart.totalAmount, 0);
    assert.equal(emptyCart.expectedWeight, 0);

    // Step C: Attempting to remove item not in cart throws 404
    await assert.rejects(
      async () => {
        await removeProductFromCart(sessionId, barcode);
      },
      (err) => {
        assert.equal(err.statusCode, 404);
        return true;
      }
    );
  });

  // -------------------------------------------------------------
  // Test 6: Missing product data validation
  // -------------------------------------------------------------
  test("6. Missing product data: Rejects with 400 when required fields are missing", async () => {
    const sessionId = `test-session-${Date.now()}-5`;
    const barcode = `TEST-MISSING-${Date.now()}`;

    await Cart.create({
      sessionId,
      items: [],
      totalAmount: 0,
      expectedWeight: 0,
      status: "ACTIVE",
    });

    // Missing price
    await assert.rejects(
      async () => {
        await addProductToCart(sessionId, {
          barcode,
          name: "Item Without Price",
          weight: 500,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // Missing weight
    await assert.rejects(
      async () => {
        await addProductToCart(sessionId, {
          barcode,
          name: "Item Without Weight",
          price: 50,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // Missing name
    await assert.rejects(
      async () => {
        await addProductToCart(sessionId, {
          barcode,
          price: 50,
          weight: 200,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // Missing barcode
    await assert.rejects(
      async () => {
        await addProductToCart(sessionId, {
          name: "Item Without Barcode",
          price: 50,
          weight: 200,
        });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  // -------------------------------------------------------------
  // Test 7: Invalid quantity validation
  // -------------------------------------------------------------
  test("7. Invalid quantity: Rejects with 400 for negative, zero, float, or NaN quantity", async () => {
    const sessionId = `test-session-${Date.now()}-6`;
    const barcode = `TEST-QTY-${Date.now()}`;

    await Cart.create({
      sessionId,
      items: [],
      totalAmount: 0,
      expectedWeight: 0,
      status: "ACTIVE",
    });

    const basePayload = {
      barcode,
      name: "Test Item",
      price: 100,
      weight: 500,
    };

    // Zero quantity
    await assert.rejects(
      async () => {
        await addProductToCart(sessionId, { ...basePayload, quantity: 0 });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // Negative quantity
    await assert.rejects(
      async () => {
        await addProductToCart(sessionId, { ...basePayload, quantity: -2 });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );

    // Fractional quantity
    await assert.rejects(
      async () => {
        await addProductToCart(sessionId, { ...basePayload, quantity: 1.5 });
      },
      (err) => {
        assert.equal(err.statusCode, 400);
        return true;
      }
    );
  });

  // -------------------------------------------------------------
  // Test 8: HTTP Route POST /api/carts/:sessionId/items
  // -------------------------------------------------------------
  test("8. HTTP Route: POST /items accepts product snapshot and returns updated cart", async () => {
    const sessionId = `test-session-${Date.now()}-7`;
    const barcode = `HTTP-TEST-${Date.now()}`;

    await Cart.create({
      sessionId,
      items: [],
      totalAmount: 0,
      expectedWeight: 0,
      status: "ACTIVE",
    });

    const payload = {
      productId: "pg-http-1",
      barcode,
      name: "Basmati Rice 1kg",
      price: 110,
      weight: 1000,
      quantity: 1,
    };

    const res = await originalFetch(`${baseUrl}/api/carts/${sessionId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.items.length, 1);
    assert.equal(body.data.items[0].barcode, barcode);
    assert.equal(body.data.items[0].unitPrice, 110);
    assert.equal(body.data.totalAmount, 110);
    assert.equal(body.data.expectedWeight, 1000);
  });

  // -------------------------------------------------------------
  // Test 9: Price protection against arbitrary frontend price tampering
  // -------------------------------------------------------------
  test("9. Price Protection: Uses authoritative price from AI Lab over arbitrary frontend price", async () => {
    const sessionId = `test-session-${Date.now()}-8`;
    const barcode = "8901262010053"; // Amul Milk

    await Cart.create({
      sessionId,
      items: [],
      totalAmount: 0,
      expectedWeight: 0,
      status: "ACTIVE",
    });

    // Mock AI Lab PostgreSQL response for Amul Milk (authoritative price: 62.0)
    globalThis.fetch = async (url, options) => {
      const urlStr = url.toString();
      if (urlStr.includes("/api/v1/products/barcode/")) {
        return new Response(
          JSON.stringify({
            success: true,
            product: {
              id: "pg-authoritative-milk",
              barcode: "8901262010053",
              name: "Amul Taaza Milk 1L",
              price: 62.0,
              weight: 1.0, // 1.0 kg -> 1000g
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return originalFetch(url, options);
    };

    // Attacker sends forged price: 1.00 (attempting 1 rupee for milk)
    const forgedPayload = {
      productId: "attacker-id",
      barcode,
      name: "Amul Taaza Milk 1L",
      price: 1.0, // FORGED PRICE!
      weight: 1000,
      quantity: 1,
    };

    const res = await originalFetch(`${baseUrl}/api/carts/${sessionId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(forgedPayload),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    const item = body.data.items[0];

    // Verified: Authoritative price 62.0 was enforced, NOT 1.00!
    assert.equal(item.unitPrice, 62.0, "Authoritative price 62.0 must override forged price 1.0");
    assert.equal(body.data.totalAmount, 62.0, "Total amount reflects authoritative price 62.0");
    assert.equal(body.data.expectedWeight, 1000, "Expected weight converted from 1.0kg to 1000g");
  });

  // -------------------------------------------------------------
  // Test 10: GET cart returns snapshot items without populate errors
  // -------------------------------------------------------------
  test("10. GET /api/carts/:sessionId returns cart without requiring Product populate", async () => {
    const sessionId = `test-session-${Date.now()}-9`;
    const barcode = `GET-TEST-${Date.now()}`;

    await Cart.create({
      sessionId,
      items: [
        {
          productId: "pg-get-1",
          name: "Casio Calculator",
          barcode,
          quantity: 1,
          unitPrice: 595,
          unitWeight: 150,
          totalPrice: 595,
          totalWeight: 150,
        },
      ],
      totalAmount: 595,
      expectedWeight: 150,
      status: "ACTIVE",
    });

    const res = await originalFetch(`${baseUrl}/api/carts/${sessionId}`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.sessionId, sessionId);
    assert.equal(body.data.items.length, 1);
    assert.equal(body.data.items[0].barcode, barcode);
    assert.equal(body.data.items[0].unitPrice, 595);
  });

  // -------------------------------------------------------------
  // Test 11: DELETE /api/carts/:sessionId/items/:barcode route
  // -------------------------------------------------------------
  test("11. DELETE /items/:barcode successfully removes item from cart", async () => {
    const sessionId = `test-session-${Date.now()}-10`;
    const barcode = `DEL-TEST-${Date.now()}`;

    await Cart.create({
      sessionId,
      items: [
        {
          productId: "pg-del-1",
          name: "Delete Me",
          barcode,
          quantity: 1,
          unitPrice: 20,
          unitWeight: 100,
          totalPrice: 20,
          totalWeight: 100,
        },
      ],
      totalAmount: 20,
      expectedWeight: 100,
      status: "ACTIVE",
    });

    const res = await originalFetch(`${baseUrl}/api/carts/${sessionId}/items/${barcode}`, {
      method: "DELETE",
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.data.items.length, 0);
    assert.equal(body.data.totalAmount, 0);
  });

  // -------------------------------------------------------------
  // Test 12: Preserves Weight Verification & Checkout Flow
  // -------------------------------------------------------------
  test("12. Checkout & Weight verification: Preserves weight verification calculations", async () => {
    const sessionId = `test-session-${Date.now()}-11`;

    await Cart.create({
      sessionId,
      items: [
        {
          productId: "pg-weight-1",
          name: "Pack of Coffee 500g",
          barcode: `COFFEE-${Date.now()}`,
          quantity: 2,
          unitPrice: 250,
          unitWeight: 500,
          totalPrice: 500,
          totalWeight: 1000,
        },
      ],
      totalAmount: 500,
      expectedWeight: 1000,
      status: "ACTIVE",
    });

    // Start checkout
    const checkoutRes = await originalFetch(`${baseUrl}/api/carts/${sessionId}/checkout`, {
      method: "POST",
    });
    assert.equal(checkoutRes.status, 200);
    const checkoutData = await checkoutRes.json();
    assert.equal(checkoutData.data.cart.status, "CHECKOUT_PENDING");

    // Scale measures 1010g (within 20g tolerance of 1000g)
    const weightRes = await originalFetch(`${baseUrl}/api/carts/${sessionId}/weight`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actualWeight: 1010 }),
    });

    assert.equal(weightRes.status, 200);
    const weightData = await weightRes.json();
    assert.equal(weightData.data.weightVerified, true);
    assert.equal(weightData.data.canPay, true);
    assert.equal(weightData.data.cart.status, "PAYMENT_PENDING");
  });
});
