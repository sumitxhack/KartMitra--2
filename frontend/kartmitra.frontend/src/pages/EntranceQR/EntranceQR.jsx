import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import { generateEntranceQR } from "../../api/entranceApi";

const EntranceQR = () => {
  const [qrToken, setQrToken] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const generateQR = async () => {
    try {
      setLoading(true);
      setError("");

      // Call our frontend API layer
      const data = await generateEntranceQR();

      if (!data.success) {
        throw new Error(
          data.message || "Failed to generate entrance QR"
        );
      }

      setQrToken(data.qrToken);
      setExpiresAt(data.expiresAt);
    } catch (err) {
      console.error("Entrance QR error:", err);

      setError(
        err.message || "Unable to generate QR"
      );
    } finally {
      setLoading(false);
    }
  };

  // Generate QR when page loads
  useEffect(() => {
    generateQR();
  }, []);

  // Automatically generate a new QR
  // 10 seconds before the current QR expires
  useEffect(() => {
    if (!expiresAt) return;

    const expiryTime = new Date(expiresAt).getTime();
    const currentTime = Date.now();

    const refreshTime =
      expiryTime - currentTime - 10000;

    if (refreshTime <= 0) {
      generateQR();
      return;
    }

    const timer = setTimeout(() => {
      generateQR();
    }, refreshTime);

    return () => clearTimeout(timer);
  }, [expiresAt]);

  return (
    <div className="min-h-screen bg-white text-[#18201e] flex flex-col">

      {/* Header */}
      <header className="w-full border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-center">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Kart
            <span className="text-[#159b7d]">
              Mitra
            </span>
          </h1>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg text-center">

          {/* Heading */}
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">
            Welcome to KartMitra
          </h2>

          <p className="text-slate-400 text-sm sm:text-base mb-8">
            Scan the QR code to start your shopping session
          </p>

          {/* QR Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-2xl mx-auto w-fit">

            {loading ? (
              <div className="w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />

                  <p className="text-slate-600 text-sm">
                    Generating QR...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="w-64 h-64 sm:w-80 sm:h-80 flex flex-col items-center justify-center px-5">

                <div className="w-12 h-12 rounded-full bg-red-100 text-red-500 flex items-center justify-center text-xl font-bold mb-4">
                  !
                </div>

                <p className="text-slate-700 font-semibold">
                  Unable to load QR
                </p>

                <p className="text-red-500 text-sm mt-2">
                  {error}
                </p>

                <button
                  type="button"
                  onClick={generateQR}
                  className="mt-5 px-5 py-2.5 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-700 transition"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <QRCodeCanvas
                value={qrToken}
                size={320}
                bgColor="#ffffff"
                fgColor="#0f172a"
                level="H"
                includeMargin
                className="w-64 h-64 sm:w-80 sm:h-80"
              />
            )}

          </div>

          {/* Active Status */}
          {!loading && !error && (
            <>
              <div className="mt-8">
                <p className="text-lg sm:text-xl font-semibold">
                  Scan to Enter
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Login in to KartMitra and scan this QR code
                </p>
              </div>

              {expiresAt && (
                <p className="mt-5 text-xs text-slate-500">
                  QR expires at{" "}
                  <span className="text-slate-400">
                    {new Date(
                      expiresAt
                    ).toLocaleTimeString()}
                  </span>
                </p>
              )}
            </>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="py-5 text-center text-xs text-slate-500 flex items-center justify-center gap-3">
        <span>Secure self-checkout powered by KartMitra</span>
        <span className="text-slate-300">•</span>
        <Link
          to="/admin"
          className="text-slate-400 hover:text-slate-600 transition"
        >
          Admin Portal
        </Link>
      </footer>

    </div>
  );
};

export default EntranceQR;