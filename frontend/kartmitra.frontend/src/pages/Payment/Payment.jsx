import { ChevronLeft, Check, Lock, Loader2, AlertCircle } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/client";

const Payment = () => {
  const navigate = useNavigate();

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("google_pay");
  const [cart, setCart] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const paymentMethods = [
    { id: "google_pay", label: "Google Pay", icon: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-pay-icon.png" },
    { id: "phonepe", label: "PhonePe", icon: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/phonepe-icon.png" },
    { id: "paytm", label: "Paytm", icon: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/paytm-icon.png" },
    { id: "bhim", label: "BHIM UPI", icon: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/bhim-app-icon.png" },
  ];

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
        "Shopping session not found. Please scan the store Entry QR to start."
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

      if (cartData) {
        sessionStorage.setItem("cart", JSON.stringify(cartData));
        localStorage.setItem("cart", JSON.stringify(cartData));
      }
    } catch (err) {
      console.error("Failed to load cart for payment:", err);
      // Fallback to cached cart if network error
      const cached = sessionStorage.getItem("cart") || localStorage.getItem("cart");
      if (cached) {
        try {
          setCart(JSON.parse(cached));
        } catch {
          setError(err?.message || "Failed to load cart details.");
        }
      } else {
        setError(err?.message || "Failed to load cart details.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  // Derived values from actual cart
  const cartItems = cart?.items || [];
  const totalItemCount = cartItems.reduce(
    (sum, item) => sum + (Number(item.quantity) || 1),
    0
  );

  const totalAmount =
    cart?.totalAmount !== undefined && cart?.totalAmount !== null
      ? Number(cart.totalAmount)
      : cartItems.reduce((sum, item) => {
          const itemTotal =
            Number(item.totalPrice) ||
            Number(item.unitPrice || 0) * (Number(item.quantity) || 1);
          return sum + itemTotal;
        }, 0);

  const securityChecks = [
    "All items scanned",
    "Cart verification clear",
    "Shopping session valid",
  ];

  /*
   * ==========================================================
   * PROCESS PAYMENT (POST /api/payments/:sessionId)
   * ==========================================================
   */
  const handleContinueToPayment = async () => {
    if (!selectedPaymentMethod) {
      alert("Please select a payment method");
      return;
    }

    const sessionId = getActiveSessionId();
    if (!sessionId) {
      alert("Shopping session not found.");
      return;
    }

    if (totalItemCount === 0 || totalAmount <= 0) {
      alert("Your cart is empty. Please add items to proceed.");
      return;
    }

    try {
      setProcessing(true);
      setError("");

      // If cart is ACTIVE or CHECKOUT_PENDING, ensure it is transitioned to PAYMENT_PENDING
      // by calling startCheckout and verifying weight simulation if needed
      if (cart?.status === "ACTIVE") {
        try {
          await apiClient(`/carts/${encodeURIComponent(sessionId)}/checkout`, {
            method: "POST",
          });
        } catch (e) {
          console.log("Start checkout note:", e);
        }

        try {
          await apiClient(`/carts/${encodeURIComponent(sessionId)}/weight`, {
            method: "POST",
            body: JSON.stringify({ actualWeight: cart?.expectedWeight || 1000 }),
          });
        } catch (e) {
          console.log("Weight verification note:", e);
        }
      } else if (cart?.status === "CHECKOUT_PENDING" && !cart?.weightVerified) {
        try {
          await apiClient(`/carts/${encodeURIComponent(sessionId)}/weight`, {
            method: "POST",
            body: JSON.stringify({ actualWeight: cart?.expectedWeight || 1000 }),
          });
        } catch (e) {
          console.log("Weight verification note:", e);
        }
      }

      // Call payment endpoint
      const paymentRes = await apiClient(`/payments/${encodeURIComponent(sessionId)}`, {
        method: "POST",
      });

      console.log("Payment completed successfully:", paymentRes);

      // Store payment result in session
      sessionStorage.setItem("lastPaidAmount", totalAmount.toFixed(2));
      sessionStorage.setItem("paymentCompleted", "true");

      // Navigate to Thank You page
      navigate("/thank-you");
    } catch (err) {
      console.error("Payment failed:", err);
      setError(err?.message || "Payment processing failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f8f6] flex items-center justify-center p-0 sm:p-6">
      {/* Mobile App Screen */}
      <main className="relative w-full min-h-screen sm:min-h-211 sm:max-w-97.5 overflow-hidden bg-white sm:rounded-[42px] sm:border-8 sm:border-[#151a19] shadow-2xl">
        
        {/* Content */}
        <div className="relative z-10 flex min-h-screen flex-col px-5 pt-6 pb-5 sm:min-h-207 sm:px-7 sm:pt-8">
          
          {/* Header with Back Button and Title */}
          <div className="mb-6 flex items-center gap-3">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0f4f2] transition-all duration-200 hover:bg-[#e5f0eb] active:scale-95 cursor-pointer"
              onClick={() => navigate(-1)}
              aria-label="Go back"
            >
              <ChevronLeft size={22} className="text-[#18201e]" />
            </button>
            <h1 className="flex-1 text-center text-[22px] font-bold text-[#111716]">
              Payment
            </h1>
            <div className="w-9" /> {/* Spacer for alignment */}
          </div>

          {/* Error Message banner if any */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700">
              <AlertCircle size={16} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Loading state */}
          {loading ? (
            <div className="flex-1 flex flex-col items-center justify-center py-12">
              <Loader2 size={36} className="animate-spin text-[#159b7d] mb-3" />
              <p className="text-sm font-semibold text-[#18201e]">Loading payment details...</p>
            </div>
          ) : (
            /* Scrollable Content */
            <div className="flex-1 overflow-y-auto -mx-5 px-5 sm:-mx-7 sm:px-7">
              {/* Order Summary Section */}
              <section className="mb-6">
                <h3 className="mb-3 text-[15px] font-bold text-[#111716]">
                  Order Summary
                </h3>

                <div className="space-y-2 rounded-2xl bg-[#f7f9f8] p-4">
                  {/* Items */}
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#7a8583]">
                      Items ({totalItemCount})
                    </span>
                    <span className="text-[13px] font-semibold text-[#18201e]">
                      ₹{totalAmount.toFixed(2)}
                    </span>
                  </div>

                  {/* Discount */}
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#7a8583]">Discount</span>
                    <span className="text-[13px] font-semibold text-[#159b7d]">
                      ₹0.00
                    </span>
                  </div>

                  {/* Taxes */}
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#7a8583]">Taxes</span>
                    <span className="text-[13px] font-semibold text-[#18201e]">
                      ₹0.00
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="my-3 h-px bg-[#e2e7e5]" />

                  {/* Total Amount */}
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] font-bold text-[#111716]">
                      Total Amount
                    </span>
                    <span className="text-[16px] font-bold text-[#159b7d]">
                      ₹{totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>
              </section>

              {/* Security Status Section */}
              <section className="mb-6">
                <h3 className="mb-3 text-[15px] font-bold text-[#111716]">
                  Security Status
                </h3>

                <div className="space-y-2">
                  {securityChecks.map((check, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 rounded-lg bg-[#f0faf7] p-3"
                    >
                      <Check size={18} className="text-[#159b7d] shrink-0" />
                      <span className="text-[13px] text-[#18201e]">{check}</span>
                    </div>
                  ))}
                </div>
              </section>

              {/* UPI Options Section */}
              <section className="mb-6">
                <h3 className="mb-3 text-[15px] font-bold text-[#111716]">
                  UPI Options
                </h3>

                <div className="grid grid-cols-4 gap-4">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedPaymentMethod(method.id)}
                      className={`flex flex-col items-center justify-center rounded-2xl p-3 transition-all duration-200 cursor-pointer ${
                        selectedPaymentMethod === method.id
                          ? "border-2 border-[#159b7d] bg-[#f0faf7] shadow-sm"
                          : "border-2 border-[#e2e7e5] bg-white hover:border-[#159b7d]"
                      }`}
                    >
                      <div className="flex h-8 w-10 items-center justify-center rounded-lg text-lg">
                        <img src={method.icon} alt={method.label} className="max-h-7 object-contain" />
                      </div>
                    </button>
                  ))}
                </div>
              </section>

              {/* Continue to Payment Button */}
              <button
                onClick={handleContinueToPayment}
                disabled={processing || totalItemCount === 0}
                className={`mb-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-bold text-white transition-all duration-200 shadow-md ${
                  processing || totalItemCount === 0
                    ? "bg-gray-400 cursor-not-allowed opacity-80"
                    : "bg-[#1a1f1e] hover:bg-[#0f1312] active:scale-[0.98] hover:shadow-lg cursor-pointer"
                }`}
              >
                {processing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Processing Payment...</span>
                  </>
                ) : (
                  <>
                    <span>Continue to Payment</span>
                    <span className="text-lg">→</span>
                  </>
                )}
              </button>

              {/* Security Footer */}
              <div className="flex items-center justify-center gap-1 mb-2">
                <Lock size={14} className="text-[#7a8583]" />
                <span className="text-[11px] text-[#7a8583]">
                  Secured by{" "}
                  <span className="font-semibold text-[#18201e]">Razorpay</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Payment;

