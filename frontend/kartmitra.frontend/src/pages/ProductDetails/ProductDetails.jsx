import {
  ChevronLeft,
  ShoppingCart,
  CheckCircle2,
  Barcode as BarcodeIcon,
  Package,
  ArrowRight,
  Sparkles,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import apiClient from "../../api/client";

const ProductDetails = () => {
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [addedQuantity, setAddedQuantity] = useState(1);

  const [error, setError] = useState("");

  /*
   * ==========================================================
   * LOAD SCANNED PRODUCT
   * ==========================================================
   */
  useEffect(() => {
    try {
      const storedProduct =
        sessionStorage.getItem("scannedProduct");

      if (!storedProduct) {
        setError("No scanned product was found.");
        setLoading(false);
        return;
      }

      const parsedProduct = JSON.parse(storedProduct);
      setProduct(parsedProduct);
    } catch (err) {
      console.error("Failed to load scanned product:", err);
      setError("Unable to load product details.");
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * ==========================================================
   * QUANTITY
   * ==========================================================
   */
  const handleQuantityChange = (change) => {
    setQuantity((previousQuantity) =>
      Math.max(1, previousQuantity + change)
    );
  };

  /*
   * ==========================================================
   * SESSION ID RESOLVER
   * ==========================================================
   */
  const getSessionId = () => {
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
      // Ignore parse error
    }

    return null;
  };

  /*
   * ==========================================================
   * ADD TO CART (POST /api/carts/:sessionId/items)
   * ==========================================================
   */
  const handleAddToCart = async () => {
    if (!product) {
      return;
    }

    const sessionId = getSessionId();

    if (!sessionId) {
      setError(
        "Shopping session not found. Please scan the store Entry QR to start your cart."
      );
      return;
    }

    const barcode = product.barcode;

    if (!barcode) {
      setError("Product barcode is missing.");
      return;
    }

    try {
      setAddingToCart(true);
      setError("");

      /*
       * Requirement 6 & 7: Connect Add To Cart to EXISTING endpoint:
       * POST /api/carts/:sessionId/items
       * Body: { barcode, quantity }
       */
      const response = await apiClient(
        `/carts/${encodeURIComponent(sessionId)}/items`,
        {
          method: "POST",
          body: JSON.stringify({
            barcode: barcode.trim(),
            quantity,
          }),
        }
      );

      console.log("Product added to cart response:", response);

      const updatedCart = response?.data;

      if (updatedCart) {
        sessionStorage.setItem("cart", JSON.stringify(updatedCart));
        localStorage.setItem("cart", JSON.stringify(updatedCart));
      }

      // Record added quantity and display success view
      setAddedQuantity(quantity);
      setAddedSuccess(true);
    } catch (err) {
      console.error("Add to cart failed:", err);

      setError(
        err?.message ||
          "Unable to add product to cart. Please check your session and try again."
      );
    } finally {
      setAddingToCart(false);
    }
  };

  /*
   * ==========================================================
   * LOADING STATE
   * ==========================================================
   */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f8f6]">
        <p className="text-[#7a8583]">Loading product...</p>
      </div>
    );
  }

  /*
   * ==========================================================
   * ERROR STATE (NO PRODUCT)
   * ==========================================================
   */
  if (error && !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f8f6] p-6">
        <div className="text-center max-w-sm">
          <p className="mb-5 text-sm text-red-500">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="rounded-xl bg-[#159b7d] px-6 py-3 text-sm font-semibold text-white shadow hover:bg-[#128a6f] transition"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  /*
   * ==========================================================
   * PRODUCT FIELDS
   * ==========================================================
   */
  const productImage =
    product.image ||
    product.imageUrl ||
    product.imageURL ||
    product.thumbnail ||
    "";

  const unitPrice = Number(product.price) || 0;
  const selectedTotal = unitPrice * quantity;

  // Weight display string if available
  const weightDisplay =
    product.weight && product.weightUnit
      ? `${product.weight} ${product.weightUnit}`
      : product.weight
      ? `${product.weight} g`
      : product.size || "";

  // Check if verified by AI
  const isAiVerified = Boolean(
    product.aiVerified || product.aiStatus === "MATCH"
  );
  const aiConfidenceText =
    typeof product.aiConfidence === "number"
      ? `${Math.round(
          product.aiConfidence > 1
            ? product.aiConfidence
            : product.aiConfidence * 100
        )}%`
      : null;

  return (
    <div className="min-h-screen bg-[#f4f8f6] flex items-center justify-center p-0 sm:p-6">
      <main
        className="
          relative
          w-full
          min-h-screen
          sm:min-h-[844px]
          sm:max-w-[390px]
          overflow-hidden
          bg-white
          sm:rounded-[42px]
          sm:border-8
          sm:border-[#151a19]
          shadow-2xl
          flex
          flex-col
        "
      >
        <div
          className="
            relative
            z-10
            flex
            min-h-screen
            sm:min-h-[844px]
            flex-col
            px-5
            pt-6
            pb-5
            sm:px-6
            sm:pt-7
          "
        >
          {/* =================================================
              HEADER
          ================================================== */}
          <div className="mb-4 flex items-center gap-3">
            <button
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-full
                bg-[#f0f4f2]
                transition-all
                duration-200
                hover:bg-[#e5f0eb]
                active:scale-95
                cursor-pointer
              "
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <ChevronLeft size={22} className="text-[#18201e]" />
            </button>

            <h1
              className="
                flex-1
                text-center
                text-[18px]
                font-bold
                text-[#111716]
              "
            >
              Product Details
            </h1>

            <div className="w-9" />
          </div>

          {/* =================================================
              SUCCESS VIEW (ADDED TO CART)
          ================================================== */}
          {addedSuccess ? (
            <div className="flex-1 flex flex-col justify-between py-6 animate-fade-in">
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                {/* Success Icon */}
                <div className="h-20 w-20 rounded-full bg-[#e8f5ef] border-4 border-[#159b7d]/20 flex items-center justify-center mb-4 shadow-sm">
                  <CheckCircle2 size={44} className="text-[#159b7d]" />
                </div>

                <h2 className="text-xl font-extrabold text-[#111716] mb-1">
                  ✓ Added to cart
                </h2>
                <p className="text-xs text-[#7a8583] mb-6">
                  Item successfully added to your shopping session
                </p>

                {/* Added Product Summary Card */}
                <div className="w-full rounded-2xl bg-[#f8faf9] border border-[#e2e8e5] p-4 text-left mb-6 shadow-xs">
                  <div className="flex gap-3 items-center">
                    <div className="h-16 w-16 rounded-xl bg-white border border-[#e8eeeb] flex items-center justify-center overflow-hidden shrink-0">
                      {productImage ? (
                        <img
                          src={productImage}
                          alt={product.name}
                          className="h-full w-full object-contain p-1.5"
                        />
                      ) : (
                        <Package size={28} className="text-[#7a8583]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] uppercase font-bold text-[#159b7d]">
                        {product.category || "Grocery"}
                      </span>
                      <h3 className="text-sm font-bold text-[#111716] truncate">
                        {product.name}
                      </h3>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-xs text-[#7a8583]">
                          Qty: <strong className="text-[#111716]">{addedQuantity}</strong>
                        </span>
                        <span className="text-xs font-bold text-[#159b7d]">
                          ₹{(unitPrice * addedQuantity).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons as requested in Requirement 8 */}
              <div className="flex flex-col gap-3 mt-auto">
                <button
                  type="button"
                  onClick={() => navigate("/product-summary")}
                  className="
                    w-full
                    py-4
                    px-4
                    rounded-2xl
                    bg-[#159b7d]
                    hover:bg-[#128a6f]
                    text-white
                    text-sm
                    font-bold
                    transition-all
                    duration-200
                    cursor-pointer
                    flex
                    items-center
                    justify-center
                    gap-2
                    shadow-md
                    active:scale-98
                  "
                >
                  <ShoppingCart size={18} />
                  <span>View Cart</span>
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/shopping")}
                  className="
                    w-full
                    py-3.5
                    px-4
                    rounded-2xl
                    bg-[#f0f4f2]
                    hover:bg-[#e4ece8]
                    text-[#111716]
                    text-sm
                    font-semibold
                    transition-all
                    duration-200
                    cursor-pointer
                    flex
                    items-center
                    justify-center
                    gap-2
                  "
                >
                  <span>Continue Shopping</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ) : (
            /* =================================================
               DEFAULT PRODUCT DETAILS VIEW
            ================================================== */
            <div className="flex-1 flex flex-col justify-between overflow-y-auto">
              <div className="flex-1">
                {/* AI VERIFICATION STATUS & CONFIDENCE BADGE (Requirement 5) */}
                {isAiVerified && (
                  <div className="mb-4 flex items-center justify-between rounded-xl bg-[#e8f5ef] border border-[#159b7d]/30 px-3.5 py-2.5">
                    <div className="flex items-center gap-2 text-[#159b7d] font-bold text-xs">
                      <CheckCircle2 size={16} className="text-[#159b7d] shrink-0" />
                      <span>✓ AI Verified</span>
                    </div>

                    {aiConfidenceText && (
                      <span className="text-[11px] font-semibold text-[#159b7d] bg-white px-2.5 py-0.5 rounded-full border border-[#159b7d]/20 shadow-xs">
                        AI Confidence: {aiConfidenceText}
                      </span>
                    )}
                  </div>
                )}

                {/* PRODUCT IMAGE HERO */}
                <div
                  className="
                    mb-4
                    flex
                    h-56
                    items-center
                    justify-center
                    overflow-hidden
                    rounded-2xl
                    bg-[#e8f5ef]
                    relative
                  "
                >
                  {productImage ? (
                    <img
                      src={productImage}
                      alt={product.name}
                      className="h-full w-full object-contain p-4"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center text-[#8b9693]">
                      <Package size={40} className="mb-2 opacity-50" />
                      <span className="text-xs">Product image unavailable</span>
                    </div>
                  )}

                  {product.category && (
                    <span className="absolute top-3 left-3 rounded-full bg-white/90 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-bold text-[#159b7d] uppercase tracking-wider shadow-xs">
                      {product.category}
                    </span>
                  )}
                </div>

                {/* DETAILS */}
                <div className="space-y-3 mb-4">
                  {/* Name & Weight */}
                  <div>
                    <h2 className="text-[18px] font-bold text-[#111716] leading-tight">
                      {product.name}
                    </h2>
                    {weightDisplay && (
                      <p className="mt-0.5 text-[13px] font-medium text-[#7a8583]">
                        {weightDisplay}
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div>
                    <p className="text-[26px] font-bold text-[#159b7d]">
                      ₹{unitPrice.toFixed(2)}
                    </p>
                  </div>

                  {/* Barcode Tag */}
                  {product.barcode && (
                    <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#f0f4f2] px-2.5 py-1 text-[11px] font-mono text-[#54625e]">
                      <BarcodeIcon size={14} className="text-[#7a8583]" />
                      <span>{product.barcode}</span>
                    </div>
                  )}

                  {/* Description if available */}
                  {product.description && (
                    <div className="pt-2">
                      <h4 className="text-[11px] font-bold uppercase tracking-wide text-[#7a8583] mb-1">
                        Description
                      </h4>
                      <p className="text-xs text-[#54625e] leading-relaxed">
                        {product.description}
                      </p>
                    </div>
                  )}

                  {/* Quantity Selector */}
                  <div className="pt-2 flex items-center justify-between border-t border-[#f0f4f2]">
                    <span className="text-[14px] font-semibold text-[#7a8583]">
                      Quantity
                    </span>

                    <div className="flex items-center gap-3 rounded-lg border border-[#e2e7e5] bg-white px-3 py-1.5 shadow-xs">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(-1)}
                        disabled={quantity === 1}
                        className="
                          flex
                          h-6
                          w-6
                          items-center
                          justify-center
                          text-[16px]
                          text-[#7a8583]
                          transition-all
                          duration-200
                          hover:text-[#18201e]
                          active:scale-90
                          disabled:opacity-30
                          cursor-pointer
                        "
                      >
                        −
                      </button>

                      <span className="w-6 text-center text-[14px] font-bold text-[#18201e]">
                        {quantity}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleQuantityChange(1)}
                        className="
                          flex
                          h-6
                          w-6
                          items-center
                          justify-center
                          text-[16px]
                          text-[#7a8583]
                          transition-all
                          duration-200
                          hover:text-[#18201e]
                          active:scale-90
                          cursor-pointer
                        "
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Total summary */}
                  <div className="flex items-center justify-between rounded-xl bg-[#f4f8f6] px-4 py-2.5">
                    <span className="text-[13px] font-medium text-[#7a8583]">
                      Total ({quantity} {quantity === 1 ? "item" : "items"})
                    </span>
                    <span className="text-[17px] font-bold text-[#159b7d]">
                      ₹{selectedTotal.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Error Banner */}
                {error && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-center">
                    <p className="text-xs text-red-600">{error}</p>
                  </div>
                )}
              </div>

              {/* ADD TO CART BUTTON (Requirement 5, 6, 7) */}
              <div className="pt-2 mt-auto">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={addingToCart}
                  className="
                    flex
                    h-14
                    w-full
                    items-center
                    justify-center
                    gap-2
                    rounded-2xl
                    bg-[#159b7d]
                    text-[15px]
                    font-bold
                    text-white
                    shadow-md
                    transition-all
                    duration-200
                    active:scale-[0.98]
                    active:bg-[#0a8d71]
                    hover:bg-[#128a6f]
                    disabled:cursor-not-allowed
                    disabled:opacity-60
                    cursor-pointer
                  "
                >
                  <ShoppingCart size={18} />
                  {addingToCart
                    ? "Adding to Cart..."
                    : `Add ${quantity} to Cart • ₹${selectedTotal.toFixed(2)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ProductDetails;