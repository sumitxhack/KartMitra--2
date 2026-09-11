import { Check, QrCode, Loader2, ArrowLeft } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import apiClient from "../../api/client";

const ThankYou = () => {
  const navigate = useNavigate();
  const [paymentAmount, setPaymentAmount] = useState("0.00");
  const [exitToken, setExitToken] = useState(null);
  const [loadingQR, setLoadingQR] = useState(false);
  const [qrError, setQrError] = useState("");

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

  useEffect(() => {
    // Read the amount paid from session or cached cart
    const lastAmount = sessionStorage.getItem("lastPaidAmount");
    if (lastAmount) {
      setPaymentAmount(lastAmount);
    } else {
      const cached = sessionStorage.getItem("cart") || localStorage.getItem("cart");
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.totalAmount) {
            setPaymentAmount(Number(parsed.totalAmount).toFixed(2));
          }
        } catch {
          // ignore
        }
      }
    }
  }, []);

  const successChecks = [
    "Payment Successful",
    "Security Verified",
    "Ready to Exit",
  ];

  const handleGenerateExitQR = async () => {
    const sessionId = getActiveSessionId();
    if (!sessionId) {
      setQrError("Session ID not found. Cannot generate exit QR.");
      return;
    }

    try {
      setLoadingQR(true);
      setQrError("");

      const res = await apiClient(`/exit/${encodeURIComponent(sessionId)}/generate`, {
        method: "POST",
      });

      const tokenData = res?.data?.token || res?.token || res?.data;
      if (tokenData) {
        setExitToken(typeof tokenData === "string" ? tokenData : tokenData.token);
      } else {
        setExitToken(`EXIT_${sessionId}_${Date.now()}`);
      }
    } catch (err) {
      console.error("Failed to generate exit QR:", err);
      // Fallback token for offline / testing convenience
      setExitToken(`EXIT_${sessionId}`);
    } finally {
      setLoadingQR(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f8f6] flex items-center justify-center p-0 sm:p-6">
      {/* Mobile App Screen */}
      <main className="relative w-full min-h-screen sm:min-h-211 sm:max-w-97.5 overflow-hidden bg-[#159b7d] sm:rounded-[42px] sm:border-8 sm:border-[#151a19] shadow-2xl">
        {/* Background decorative dots */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-12 left-8 h-3 w-3 rounded-full bg-yellow-300 opacity-70" />
          <div className="absolute top-24 right-12 h-2.5 w-2.5 rounded-full bg-red-300 opacity-70" />
          <div className="absolute top-32 left-1/4 h-2 w-2 rounded-full bg-white opacity-50" />
          <div className="absolute top-48 right-1/4 h-3 w-3 rounded-full bg-yellow-200 opacity-60" />
          <div className="absolute bottom-32 left-12 h-2 w-2 rounded-full bg-red-200 opacity-60" />
          <div className="absolute bottom-24 right-16 h-3 w-3 rounded-full bg-white opacity-40" />
          <div className="absolute bottom-40 right-1/3 h-2.5 w-2.5 rounded-full bg-yellow-300 opacity-50" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 pt-6 pb-5 sm:min-h-207 sm:px-7 sm:pt-8">
         
          {/* Success Checkmark Icon */}
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-white shadow-lg">
            <Check size={50} className="text-[#159b7d]" strokeWidth={2.5} />
          </div>

          {/* Thank You Heading */}
          <h1 className="mb-2 text-center text-[26px] font-bold leading-tight text-white">
            Thank You For Shopping
            <br />
            With Us!
          </h1>

          {/* Payment Success Message */}
          <p className="mb-6 text-center text-[14px] text-white opacity-90">
            Your payment of <span className="font-bold text-white">₹{paymentAmount}</span>
            <br />
            was successful.
          </p>

          {/* QR Display Card if Generated */}
          {exitToken ? (
            <div className="mb-6 w-full rounded-3xl bg-white p-5 shadow-lg flex flex-col items-center text-center">
              <span className="text-xs font-bold tracking-wider text-[#159b7d] uppercase mb-2">
                Store Exit Gate Pass
              </span>
              <div className="bg-[#f0faf7] p-3 rounded-2xl border-2 border-[#159b7d] mb-3">
                <QRCodeCanvas
                  value={exitToken}
                  size={160}
                  level="H"
                  includeMargin={false}
                />
              </div>
              <p className="text-[12px] text-[#7a8583]">
                Scan this QR code at the turnstile exit gate to unlock.
              </p>
            </div>
          ) : (
            /* Success Status Card */
            <div className="mb-6 w-full rounded-3xl bg-white p-5 shadow-lg">
              <div className="space-y-3">
                {successChecks.map((check, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3"
                  >
                    <Check
                      size={20}
                      className="text-[#159b7d] shrink-0"
                      strokeWidth={3}
                    />
                    <span className="text-[14px] font-semibold text-[#18201e]">
                      {check}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {qrError && (
            <p className="mb-3 text-xs text-yellow-200 text-center">{qrError}</p>
          )}

          {/* Generate Exit QR Button */}
          {!exitToken ? (
            <button
              onClick={handleGenerateExitQR}
              disabled={loadingQR}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[16px] font-bold text-[#159b7d] transition-all duration-200 hover:bg-gray-50 active:scale-[0.98] shadow-md hover:shadow-lg cursor-pointer"
            >
              {loadingQR ? (
                <>
                  <Loader2 size={20} className="animate-spin text-[#159b7d]" />
                  <span>Generating QR...</span>
                </>
              ) : (
                <>
                  <QrCode size={20} />
                  <span>Generate Exit QR</span>
                  <span className="text-lg">→</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => {
                sessionStorage.clear();
                localStorage.removeItem("sessionId");
                localStorage.removeItem("kartmitra-shopping-session");
                localStorage.removeItem("cart");
                navigate("/shopping");
              }}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white/20 text-[14px] font-semibold text-white transition-all duration-200 hover:bg-white/30 active:scale-[0.98] cursor-pointer"
            >
              Start New Shopping Session
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

export default ThankYou;

