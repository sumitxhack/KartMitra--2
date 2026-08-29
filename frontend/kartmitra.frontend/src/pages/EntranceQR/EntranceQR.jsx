import { useEffect, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";

const API_URL = "http://localhost:5000";

const EntranceQR = () => {
  const [qrToken, setQrToken] = useState("");
  const [expiresAt, setExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const generateQR = async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        `${API_URL}/api/entrance/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to generate entrance QR"
        );
      }

      setQrToken(data.qrToken);
      setExpiresAt(data.expiresAt);
    } catch (err) {
      console.error("Entrance QR error:", err);
      setError(err.message || "Unable to generate QR");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generateQR();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      
      {/* Header */}
      <header className="w-full border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-5 flex items-center justify-center">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            Kart<span className="text-blue-400">Mitra</span>
          </h1>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-lg text-center">

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
                <div className="text-slate-600">
                  Generating QR...
                </div>
              </div>
            ) : error ? (
              <div className="w-64 h-64 sm:w-80 sm:h-80 flex flex-col items-center justify-center">
                <p className="text-red-500 mb-5">
                  {error}
                </p>

                <button
                  onClick={generateQR}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white hover:bg-slate-700 transition"
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
                className="w-64 h-64 sm:w-80 sm:h-80"
              />
            )}
          </div>

          {/* Instructions */}
          {!loading && !error && (
            <>
              <div className="mt-8">
                <p className="text-lg sm:text-xl font-semibold">
                  Scan to Enter
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Open your phone camera and scan this QR code
                </p>
              </div>

              {expiresAt && (
                <p className="mt-5 text-xs text-slate-500">
                  QR expires at{" "}
                  {new Date(expiresAt).toLocaleTimeString()}
                </p>
              )}
            </>
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="py-5 text-center text-xs text-slate-500">
        Secure self-checkout powered by KartMitra
      </footer>
    </div>
  );
};

export default EntranceQR;