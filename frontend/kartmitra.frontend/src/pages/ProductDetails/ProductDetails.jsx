import {
  ChevronLeft,
  ShoppingCart,
  CheckCircle2,
  Barcode as BarcodeIcon,
  Package,
  ArrowRight,
  Sparkles,
  Loader2,
  AlertCircle,
} from "lucide-react";

import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import apiClient from "../../api/client";

const ProductDetails = () => {
  const navigate = useNavigate();
  const location = useLocation();

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
      const stateProduct = location.state?.product;
      const storedProductStr = sessionStorage.getItem("scannedProduct");
      const storedProduct = storedProductStr ? JSON.parse(storedProductStr) : null;

      const resolvedProduct = stateProduct || storedProduct;

      if (!resolvedProduct) {
        setError("No scanned product was found. Please scan a product first.");
        setLoading(false);
        return;
      }

      // Preserve AI verification flags from route navigation state if available
      if (location.state?.aiVerified !== undefined) {
        resolvedProduct.aiVerified = location.state.aiVerified;
      }
      if (location.state?.confidence !== undefined) {
        resolvedProduct.aiConfidence = location.state.confidence;
      }

      setProduct(resolvedProduct);
    } catch (err) {
      console.error("Failed to load scanned product:", err);
      setError("Unable to load product details.");
    } finally {
      setLoading(false);
    }
  }, [location.state]);

  /*
   * ==========================================================
   * QUANTITY
   * ==========================================================
   */
  const handleQuantityChange = (change) => {
    setQuantity((previousQuantity) => Math.max(1, previousQuantity + change));
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

    // Do not automatically or manually add unverified products
    const isVerified = Boolean(
      product.aiVerified === true ||
      product.aiStatus === "MATCH" ||
      location.state?.aiVerified === true
    );

    if (!isVerified) {
      setError(
        "Cannot add unverified product to cart. Please verify the product with AI camera."
      );
      return;
    }

    const sessionId = getSessionId();

    if (!sessionId) {
      setError(
        "Shopping session not found. Please scan the store Entry QR to start your cart."
      );
      return;
    }

    const barcode = product.barcode?.trim();

    if (!barcode) {
      setError("Product barcode is missing.");
      return;
    }

    // Convert weight to grams for authoritative cart storage
    let resolvedWeight = Number(product.weight) || 0;
    if (
      product.weightUnit === "kg" ||
      (resolvedWeight > 0 && resolvedWeight <= 20)
    ) {
      resolvedWeight = resolvedWeight * 1000;
    }

    const payload = {
      productId: product.id
        ? String(product.id)
        : product._id
        ? String(product._id)
        : product.productId
        ? String(product.productId)
        : undefined,
      barcode,
      name: product.name,
      price: Number(product.price) || 0,
      weight: resolvedWeight,
      quantity,
    };

    try {
      setAddingToCart(true);
      setError("");

      const response = await apiClient(
        `/carts/${encodeURIComponent(sessionId)}/items`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );

      console.log("Product added to cart response:", response);

      const updatedCart = response?.data || response?.cart || response;

      if (updatedCart) {
        sessionStorage.setItem("cart", JSON.stringify(updatedCart));
        localStorage.setItem("cart", JSON.stringify(updatedCart));
      }

      setAddedQuantity(quantity);
      setAddedSuccess(true);
    } catch (err) {
      console.error("Add to cart failed:", err);
      setError(
        err?.message ||
          "Unable to add product to cart. Please check your connection and try again."
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f4f8f6] gap-3">
        <Loader2 size={32} className="text-[#159b7d] animate-spin" />
        <p className="text-sm font-medium text-[#7a8583]">Loading product details...</p>
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
        <div className="text-center max-w-sm rounded-3xl bg-white p-6 shadow-xl border border-[#e2e8e5]">
          <AlertCircle size={40} className="text-red-500 mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#111716] mb-1">Notice</h3>
          <p className="mb-5 text-xs text-red-600 leading-relaxed">{error}</p>
          <button
            type="button"
            onClick={() => navigate("/scan-product")}
            className="w-full rounded-xl bg-[#159b7d] px-6 py-3 text-xs font-bold text-white shadow hover:bg-[#128a6f] transition cursor-pointer"
          >
            Scan Product Again
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
  const rawImage =
    product.image ||
    product.imageUrl ||
    product.imageURL ||
    product.thumbnail ||
    product.images?.[0]?.image_path ||
    "";

  const productImage = (() => {
    if (!rawImage) return "";
    let img = rawImage;
    if (typeof window !== "undefined" && window.location?.hostname) {
      if (img.startsWith("http://localhost:8000")) {
        img = img.replace("http://localhost:8000", `http://${window.location.hostname}:8000`);
      } else if (img.startsWith("http://127.0.0.1:8000")) {
        img = img.replace("http://127.0.0.1:8000", `http://${window.location.hostname}:8000`);
      } else if (img.startsWith("/")) {
        img = `http://${window.location.hostname}:8000${img}`;
      }
    }
    return img;
  })();

  const unitPrice = Number(product.price) || 0;
  const selectedTotal = unitPrice * quantity;

  // Weight display calculation
  const weightDisplay = (() => {
    if (product.weight && product.weightUnit) {
      return `${product.weight} ${product.weightUnit}`;
    }
    if (product.weight !== undefined && product.weight !== null) {
      const w = Number(product.weight);
      if (w > 0 && w <= 20) {
        return `${w * 1000} g (${w} kg)`;
      }
      return `${w} g`;
    }
    return product.size || "Standard Packaging";
  })();

  // Verification status and confidence
  const isAiVerified = Boolean(
    product.aiVerified === true ||
    product.aiStatus === "MATCH" ||
    location.state?.aiVerified === true
  );

  const aiConfidenceText = (() => {
    const conf = product.aiConfidence ?? location.state?.confidence;
    if (typeof conf === "number") {
      const val = conf > 1 ? conf : conf * 100;
      return `${Math.round(val)}%`;
    }
    if (typeof conf === "string" && conf.trim()) {
      return conf.includes("%") ? conf : `${conf}%`;
    }
    return isAiVerified ? "High (Verified)" : null;
  })();

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
                  ✓ Added to Cart
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

              {/* Action Buttons as requested: [ Continue Shopping ] [ View Cart ] */}
              <div className="flex flex-col gap-3 mt-auto">
                <button
                  type="button"
                  onClick={() => navigate("/shopping")}
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
                  <span>Continue Shopping</span>
                  <ArrowRight size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => navigate("/product-summary")}
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
                  <ShoppingCart size={18} />
                  <span>View Cart</span>
                </button>
              </div>
            </div>
          ) : (
            /* =================================================
               DEFAULT PRODUCT DETAILS VIEW
            ================================================== */
            <div className="flex-1 flex flex-col justify-between overflow-y-auto">
              <div className="flex-1">
                {/* AI VERIFICATION STATUS & CONFIDENCE BADGE (Requirement 1 & 2) */}
                {isAiVerified ? (
                  <div className="mb-4 flex items-center justify-between rounded-xl bg-[#e8f5ef] border border-[#159b7d]/30 px-3.5 py-2.5 shadow-xs">
                    <div className="flex items-center gap-2 text-[#159b7d] font-bold text-xs">
                      <CheckCircle2 size={16} className="text-[#159b7d] shrink-0" />
                      <span className="tracking-wide">✓ AI VERIFIED</span>
                    </div>

                    {aiConfidenceText && (
                      <span className="text-[11px] font-semibold text-[#159b7d] bg-white px-2.5 py-0.5 rounded-full border border-[#159b7d]/20 shadow-xs">
                        Confidence: {aiConfidenceText}
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-300 px-3.5 py-2.5 text-amber-800 text-xs">
                    <Sparkles size={16} className="text-amber-600 shrink-0" />
                    <span>AI verification required before adding to cart.</span>
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
                  {/* Name & Category */}
                  <div>
                    <h2 className="text-[18px] font-bold text-[#111716] leading-tight">
                      {product.name}
                    </h2>
                    {product.category && (
                      <p className="mt-0.5 text-xs font-medium text-[#159b7d]">
                        Category: {product.category}
                      </p>
                    )}
                  </div>

                  {/* Price */}
                  <div>
                    <p className="text-[26px] font-bold text-[#159b7d]">
                      ₹{unitPrice.toFixed(2)}
                    </p>
                  </div>

                  {/* Barcode Tag & Weight */}
                  <div className="flex flex-wrap items-center gap-2">
                    {product.barcode && (
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#f0f4f2] px-2.5 py-1 text-[11px] font-mono text-[#54625e]">
                        <BarcodeIcon size={14} className="text-[#7a8583]" />
                        <span>{product.barcode}</span>
                      </div>
                    )}

                    {weightDisplay && (
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-[#f0f4f2] px-2.5 py-1 text-[11px] font-medium text-[#54625e]">
                        <span className="text-[#7a8583]">Weight:</span>
                        <span className="font-semibold">{weightDisplay}</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div className="pt-2 border-t border-[#f0f4f2]">
                    <h4 className="text-[11px] font-bold uppercase tracking-wide text-[#7a8583] mb-1">
                      Description
                    </h4>
                    <p className="text-xs text-[#54625e] leading-relaxed">
                      {product.description ||
                        "Packaged retail item verified through AI Verification Lab authoritative catalogue."}
                    </p>
                  </div>

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

              {/* ADD TO CART BUTTON (Requirement 3, 4, 5, 6) */}
              <div className="pt-2 mt-auto">
                <button
                  type="button"
                  onClick={handleAddToCart}
                  disabled={addingToCart || !isAiVerified}
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
                  {addingToCart ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>Adding to Cart...</span>
                    </>
                  ) : (
                    <>
                      <ShoppingCart size={18} />
                      <span>ADD TO CART</span>
                    </>
                  )}
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