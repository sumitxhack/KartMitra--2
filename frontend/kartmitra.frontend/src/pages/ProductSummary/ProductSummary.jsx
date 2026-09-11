import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  Trash2,
  ShoppingCart,
  Package,
  ScanLine,
  AlertCircle,
  ArrowRight,
  Loader2,
  Barcode as BarcodeIcon,
  Scale,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import apiClient from "../../api/client";

const ProductSummary = () => {
  const navigate = useNavigate();

  const [cart, setCart] = useState(null);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingBarcode, setDeletingBarcode] = useState(null);

  /*
   * ==========================================================
   * RESOLVE ACTIVE SESSION ID
   * ==========================================================
   */
  const getActiveSessionId = () => {
    const fromSession = sessionStorage.getItem("sessionId");
    if (fromSession && fromSession.trim()) return fromSession.trim();

    const fromLocal = localStorage.getItem("sessionId");
    if (fromLocal && fromLocal.trim()) return fromLocal.trim();

    try {
      const parsed = JSON.parse(
        localStorage.getItem("kartmitra-shopping-session") || "{}"
      );
      if (parsed.sessionId) return parsed.sessionId.trim();
    } catch {
      // Ignore parse errors
    }

    return null;
  };

  /*
   * ==========================================================
   * LOAD CART FROM BACKEND (GET /api/carts/:sessionId)
   * ==========================================================
   */
  const loadCart = useCallback(async () => {
    const sessionId = getActiveSessionId();

    if (!sessionId) {
      setError(
        "Shopping session not found. Please scan the store Entry QR to start your cart."
      );
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const res = await apiClient(`/carts/${encodeURIComponent(sessionId)}`);
      const cartData = res?.data || res;

      setCart(cartData);
      setCartItems(cartData?.items || []);

      // Cache updated cart in session and local storage
      if (cartData) {
        sessionStorage.setItem("cart", JSON.stringify(cartData));
        localStorage.setItem("cart", JSON.stringify(cartData));
      }
    } catch (err) {
      console.error("Failed to load cart from backend:", err);
      setError(
        err?.message || "Failed to retrieve cart details. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  /*
   * ==========================================================
   * REMOVE ONE ITEM (DELETE /api/carts/:sessionId/items/:barcode)
   * ==========================================================
   */
  const handleRemoveItem = async (barcode) => {
    if (!barcode) return;

    const sessionId = getActiveSessionId();
    if (!sessionId) return;

    try {
      setDeletingBarcode(barcode);
      setError("");

      const res = await apiClient(
        `/carts/${encodeURIComponent(sessionId)}/items/${encodeURIComponent(
          barcode.trim()
        )}`,
        {
          method: "DELETE",
        }
      );

      const updatedCart = res?.data || res;
      setCart(updatedCart);
      setCartItems(updatedCart?.items || []);

      if (updatedCart) {
        sessionStorage.setItem("cart", JSON.stringify(updatedCart));
        localStorage.setItem("cart", JSON.stringify(updatedCart));
      }
    } catch (err) {
      console.error("Failed to remove item from cart:", err);
      setError(err?.message || "Failed to remove item. Please try again.");
    } finally {
      setDeletingBarcode(null);
    }
  };

  /*
   * ==========================================================
   * FORMATTERS & TOTALS
   * ==========================================================
   */
  const formatWeight = (grams) => {
    const g = Number(grams);
    if (!Number.isFinite(g) || g <= 0) return null;
    if (g >= 1000) {
      const kg = (g / 1000).toFixed(g % 1000 === 0 ? 0 : 2);
      return `${kg} kg (${g} g)`;
    }
    return `${g} g`;
  };

  const totalItemCount = cartItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 1),
    0
  );

  const calculateTotal = () => {
    if (cart?.totalAmount !== undefined && cart?.totalAmount !== null) {
      return Number(cart.totalAmount).toFixed(2);
    }

    return cartItems
      .reduce((sum, item) => {
        const itemTotal =
          Number(item.totalPrice) ||
          Number(item.unitPrice || 0) * (Number(item.quantity) || 1);
        return sum + itemTotal;
      }, 0)
      .toFixed(2);
  };

  const calculateExpectedWeight = () => {
    if (cart?.expectedWeight !== undefined && cart?.expectedWeight !== null) {
      return formatWeight(cart.expectedWeight);
    }

    const sumGrams = cartItems.reduce(
      (sum, item) => sum + (Number(item.totalWeight) || Number(item.unitWeight || 0) * (Number(item.quantity) || 1)),
      0
    );
    return formatWeight(sumGrams);
  };

  /*
   * ==========================================================
   * PROCEED TO PAYMENT (Preserves existing checkout routing)
   * ==========================================================
   */
  const handleProceedToPay = () => {
    console.log("Proceeding to payment with cart items:", cartItems);
    navigate("/payment");
  };

  /*
   * ==========================================================
   * 1. LOADING STATE
   * ==========================================================
   */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f8f6] flex items-center justify-center p-0 sm:p-6">
        <main className="relative w-full min-h-screen sm:min-h-[844px] sm:max-w-[390px] overflow-hidden bg-white sm:rounded-[42px] sm:border-8 sm:border-[#151a19] shadow-2xl flex flex-col items-center justify-center p-6 text-center">
          <Loader2 size={40} className="text-[#159b7d] animate-spin mb-4" />
          <h2 className="text-base font-bold text-[#111716] mb-1">
            Loading your cart...
          </h2>
          <p className="text-xs text-[#7a8583]">
            Fetching verified items from your shopping session
          </p>
        </main>
      </div>
    );
  }

  /*
   * ==========================================================
   * 2. API ERROR STATE
   * ==========================================================
   */
  if (error && cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#f4f8f6] flex items-center justify-center p-0 sm:p-6">
        <main className="relative w-full min-h-screen sm:min-h-[844px] sm:max-w-[390px] overflow-hidden bg-white sm:rounded-[42px] sm:border-8 sm:border-[#151a19] shadow-2xl flex flex-col">
          {/* Header */}
          <div className="h-16 shrink-0 bg-white px-5 flex items-center gap-3 border-b border-[#f0f4f2]">
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0f4f2] hover:bg-[#e5f0eb] transition cursor-pointer"
              aria-label="Go back"
            >
              <ChevronLeft size={22} className="text-[#18201e]" />
            </button>
            <h1 className="flex-1 text-center text-[18px] font-bold text-[#111716]">
              My Cart
            </h1>
            <div className="w-9" />
          </div>

          {/* Error Message */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center text-red-500 mb-4">
              <AlertCircle size={32} />
            </div>
            <h2 className="text-base font-bold text-[#111716] mb-1.5">
              Unable to Load Cart
            </h2>
            <p className="text-xs text-red-600 mb-6 max-w-[260px] leading-relaxed">
              {error}
            </p>
            <div className="flex gap-2.5 w-full max-w-[260px]">
              <button
                type="button"
                onClick={loadCart}
                className="flex-1 py-3 px-4 rounded-xl bg-[#159b7d] hover:bg-[#128a6f] text-white text-xs font-bold shadow transition cursor-pointer"
              >
                Retry
              </button>
              <button
                type="button"
                onClick={() => navigate("/shopping")}
                className="flex-1 py-3 px-4 rounded-xl bg-[#f0f4f2] hover:bg-[#e5f0eb] text-[#111716] text-xs font-semibold transition cursor-pointer"
              >
                Go Back
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  /*
   * ==========================================================
   * 3. EMPTY CART STATE
   * ==========================================================
   */
  if (!loading && cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#f4f8f6] flex items-center justify-center p-0 sm:p-6">
        <main className="relative w-full min-h-screen sm:min-h-[844px] sm:max-w-[390px] overflow-hidden bg-white sm:rounded-[42px] sm:border-8 sm:border-[#151a19] shadow-2xl flex flex-col">
          {/* Header */}
          <div className="h-16 shrink-0 bg-white px-5 flex items-center gap-3 border-b border-[#f0f4f2]">
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0f4f2] hover:bg-[#e5f0eb] transition cursor-pointer"
              aria-label="Go back"
            >
              <ChevronLeft size={22} className="text-[#18201e]" />
            </button>
            <h1 className="flex-1 text-center text-[18px] font-bold text-[#111716]">
              My Cart
            </h1>
            <div className="w-9" />
          </div>

          {/* Empty Body */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="h-20 w-20 rounded-full bg-[#f0f4f2] flex items-center justify-center text-[#7a8583] mb-4">
              <ShoppingCart size={38} />
            </div>
            <h2 className="text-lg font-bold text-[#111716] mb-1">
              Your cart is empty
            </h2>
            <p className="text-xs text-[#7a8583] max-w-[240px] mb-6 leading-relaxed">
              Use the barcode scanner or AI Camera verification to add products.
            </p>

            <button
              type="button"
              onClick={() => navigate("/scan-product")}
              className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-[#159b7d] hover:bg-[#128a6f] text-white text-sm font-bold shadow-md transition cursor-pointer"
            >
              <ScanLine size={18} />
              <span>Scan a Product</span>
            </button>
          </div>
        </main>
      </div>
    );
  }

  /*
   * ==========================================================
   * 4. POPULATED CART VIEW (REAL DATA FROM API)
   * ==========================================================
   */
  return (
    <div className="min-h-screen bg-[#f4f8f6] flex items-center justify-center p-0 sm:p-6">
      <main className="relative w-full min-h-screen sm:min-h-[844px] sm:max-w-[390px] overflow-hidden bg-white sm:rounded-[42px] sm:border-8 sm:border-[#151a19] shadow-2xl flex flex-col">
        {/* Header with Back Button and Title */}
        <header className="h-16 shrink-0 bg-white px-5 sm:px-6 flex items-center gap-3 border-b border-[#f0f4f2] z-20">
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0f4f2] transition-all duration-200 hover:bg-[#e5f0eb] active:scale-95 cursor-pointer"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <ChevronLeft size={22} className="text-[#18201e]" />
          </button>
          <h1 className="flex-1 text-center text-[20px] font-bold text-[#111716]">
            My Cart
          </h1>
          <div className="w-9" />
        </header>

        {/* Transient Error Alert (e.g. during item deletion) */}
        {error && (
          <div className="bg-red-50 px-4 py-2 border-b border-red-100 flex items-center gap-2 text-xs text-red-600">
            <AlertCircle size={14} className="shrink-0" />
            <span className="flex-1 truncate">{error}</span>
          </div>
        )}

        {/* Scrollable Cart Items Container */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-4">
          <div className="space-y-3">
            {cartItems.map((item, index) => {
              const productName = item.name || "Product";
              const barcode = item.barcode || "";
              const quantity = Number(item.quantity) || 1;
              const unitPrice = Number(item.unitPrice) || 0;
              const subtotal = Number(item.totalPrice) || unitPrice * quantity;
              const weightDisplay = formatWeight(item.unitWeight);
              const totalWeightDisplay = formatWeight(item.totalWeight);

              const isDeletingThis = deletingBarcode === barcode;

              return (
                <div
                  key={item._id || item.id || barcode || index}
                  className="rounded-2xl bg-[#f7f9f8] p-3.5 transition-all duration-200 hover:bg-[#f0f4f2] border border-[#eff3f1]"
                >
                  <div className="flex items-start gap-3.5">
                    {/* Product Icon */}
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-white border border-[#e8eeeb] overflow-hidden text-[#159b7d]">
                      <Package size={26} />
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      {/* Product Name */}
                      <h3 className="text-[14px] font-bold text-[#18201e] leading-snug truncate">
                        {productName}
                      </h3>

                      {/* Barcode Badge */}
                      {barcode && (
                        <div className="mt-1 inline-flex items-center gap-1 rounded bg-[#f0f4f2] px-1.5 py-0.5 text-[10px] font-mono text-[#54625e]">
                          <BarcodeIcon size={12} className="text-[#7a8583]" />
                          <span className="truncate max-w-[140px]">{barcode}</span>
                        </div>
                      )}

                      {/* Weight Display */}
                      {weightDisplay && (
                        <div className="mt-1 flex items-center gap-1 text-[11px] text-[#7a8583]">
                          <Scale size={12} className="text-[#8e9c97]" />
                          <span>Weight: {weightDisplay}</span>
                          {quantity > 1 && totalWeightDisplay && (
                            <span className="text-[#6d7974]">
                              (Total: {totalWeightDisplay})
                            </span>
                          )}
                        </div>
                      )}

                      {/* Quantity, Unit Price & Subtotal */}
                      <div className="mt-2 flex items-baseline justify-between pt-1 border-t border-[#edf2ef]">
                        <div className="text-[12px] text-[#7a8583]">
                          <span>Qty: </span>
                          <strong className="text-[#18201e] font-bold">{quantity}</strong>
                          <span className="text-[11px] text-[#8e9c97] ml-1.5">
                            (₹{unitPrice.toFixed(2)} each)
                          </span>
                        </div>

                        {/* Subtotal */}
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-[#8e9c97] block">
                            Subtotal
                          </span>
                          <span className="text-[15px] font-extrabold text-[#159b7d]">
                            ₹{subtotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Delete / Remove Button */}
                    <div className="shrink-0 pl-1">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(barcode)}
                        disabled={isDeletingThis}
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 hover:bg-red-100 transition-all duration-200 active:scale-95 disabled:opacity-40 cursor-pointer"
                        aria-label={`Remove ${productName} from cart`}
                        title="Remove one unit"
                      >
                        {isDeletingThis ? (
                          <Loader2 size={13} className="text-red-500 animate-spin" />
                        ) : (
                          <Trash2 size={14} className="text-red-500" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer: Subtotal, Total, Expected Weight, and Proceed To Pay */}
        <footer className="shrink-0 bg-white border-t border-[#e2e7e5] px-5 sm:px-6 py-4 space-y-3 z-20">
          <div className="flex items-center justify-between text-[13px] text-[#7a8583]">
            <span>
              Total Items ({totalItemCount} {totalItemCount === 1 ? "unit" : "units"})
            </span>
            {calculateExpectedWeight() && (
              <span className="flex items-center gap-1 font-medium text-[#54625e]">
                <Scale size={13} className="text-[#8e9c97]" />
                <span>Est. Weight: {calculateExpectedWeight()}</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[#f0f4f2] pt-2">
            <span className="text-[16px] font-bold text-[#111716]">
              Total Amount
            </span>
            <span className="text-[22px] font-extrabold text-[#159b7d]">
              ₹{calculateTotal()}
            </span>
          </div>

          {/* Proceed to Pay Button (Preserved) */}
          <button
            type="button"
            onClick={handleProceedToPay}
            disabled={cartItems.length === 0}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#159b7d] hover:bg-[#128a6f] text-[16px] font-bold text-white transition-all duration-200 active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span>Proceed To Pay</span>
            <ArrowRight size={18} />
          </button>
        </footer>
      </main>
    </div>
  );
};

export default ProductSummary;
