import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { useNavigate } from "react-router-dom";

import { scanEntranceQR } from "../../api/entranceApi";

const EntryScanner = () => {
  const navigate = useNavigate();

  const scannerRef = useRef(null);
  const processingRef = useRef(false);
  const mountedRef = useRef(false);

  const [cameraStarted, setCameraStarted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    mountedRef.current = true;

    const startScanner = async () => {
      try {
        setError("");
        setCameraStarted(false);

        const scanner = new Html5Qrcode(
          "entry-qr-reader"
        );

        scannerRef.current = scanner;

        /*
         * Get available cameras.
         */
        const cameras =
          await Html5Qrcode.getCameras();

        if (!cameras || cameras.length === 0) {
          throw new Error(
            "No camera was found on this device."
          );
        }

        /*
         * Prefer the rear/environment camera.
         */
        const rearCamera =
          cameras.find((camera) =>
            /back|rear|environment/i.test(
              camera.label
            )
          ) || cameras[0];

        /*
         * Start camera automatically.
         *
         * IMPORTANT:
         * Do not set aspectRatio here.
         * Forcing a 1:1 aspect ratio can distort
         * the camera preview on mobile devices.
         */
        await scanner.start(
          rearCamera.id,
          {
            fps: 10,

            qrbox: {
              width: 250,
              height: 250,
            },

            /*
             * No aspectRatio.
             */
          },

          async (decodedText) => {
            /*
             * QR scanners can detect the same QR
             * several times per second.
             *
             * This prevents multiple API requests.
             */
            if (processingRef.current) {
              return;
            }

            processingRef.current = true;

            try {
              setCameraStarted(false);

              /*
               * Stop camera before making the API
               * request and navigating away.
               */
              if (scannerRef.current) {
                try {
                  await scannerRef.current.stop();
                } catch (stopError) {
                  console.warn(
                    "Camera stop warning:",
                    stopError
                  );
                }
              }

              /*
               * Send the scanned QR token
               * to the backend.
               */
              const data =
                await scanEntranceQR(
                  decodedText
                );

              /*
               * Backend should return:
               *
               * {
               *   success: true,
               *   sessionId: "..."
               * }
               */
              if (!data?.sessionId) {
                throw new Error(
                  "Shopping session was not created."
                );
              }

              /*
               * Store shopping session.
               */
              localStorage.setItem(
                "sessionId",
                data.sessionId
              );

              /*
               * Go directly to Shopping.
               */
              navigate("/shopping", {
                replace: true,
              });
            } catch (scanError) {
              console.error(
                "Entrance QR processing error:",
                scanError
              );

              processingRef.current = false;

              if (mountedRef.current) {
                setError(
                  scanError?.message ||
                    "Unable to process the QR code."
                );

                setCameraStarted(false);
              }
            }
          },

          /*
           * QR scan failure callback.
           *
           * This runs continuously when there is
           * no valid QR in the camera frame.
           *
           * We intentionally do nothing here.
           */
          () => {}
        );

        if (mountedRef.current) {
          setCameraStarted(true);
        }
      } catch (cameraError) {
        console.error(
          "Camera initialization error:",
          cameraError
        );

        if (!mountedRef.current) {
          return;
        }

        let message =
          "Unable to access the camera.";

        if (
          cameraError?.name ===
          "NotAllowedError"
        ) {
          message =
            "Camera permission was denied. Please allow camera access and reload the page.";
        } else if (
          cameraError?.name ===
          "NotFoundError"
        ) {
          message =
            "No camera was found on this device.";
        } else if (
          cameraError?.name ===
          "NotReadableError"
        ) {
          message =
            "The camera is already being used by another application.";
        } else if (
          cameraError?.message
        ) {
          message = cameraError.message;
        }

        setError(message);
      }
    };

    /*
     * Automatically start camera
     * when EntryScanner opens.
     */
    startScanner();

    /*
     * Cleanup when leaving EntryScanner.
     */
    return () => {
      mountedRef.current = false;

      const cleanupScanner = async () => {
        const scanner =
          scannerRef.current;

        if (!scanner) {
          return;
        }

        try {
          await scanner.stop();
        } catch (stopError) {
          console.warn(
            "Scanner stop warning:",
            stopError
          );
        }

        try {
          scanner.clear();
        } catch (clearError) {
          console.warn(
            "Scanner clear warning:",
            clearError
          );
        }

        scannerRef.current = null;
      };

      cleanupScanner();
    };
  }, [navigate]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <main className="min-h-screen bg-[#151e1b] text-white">
      <div
        className="
          relative
          mx-auto
          min-h-screen
          w-full
          max-w-md
          overflow-hidden
          bg-[#151e1b]
        "
      >
        {/* --------------------------------
            HEADER
        -------------------------------- */}
        <header
          className="
            relative
            z-40
            flex
            h-13
            items-center
            bg-[#151e1b]
            px-5
          "
        >
          <button
            type="button"
            onClick={handleBack}
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-full
              text-white
              transition
              hover:bg-white/10
              active:scale-90
            "
            aria-label="Go back"
          >
            <ArrowLeft
              size={19}
              strokeWidth={1.7}
            />
          </button>

          <h1
            className="
              absolute
              left-1/2
              -translate-x-1/2
              text-[13px]
              font-medium
            "
          >
            Scan to Enter
          </h1>
        </header>

        {/* --------------------------------
            SCANNER AREA
        -------------------------------- */}
        <section
          className="
            relative
            min-h-[calc(100vh-52px)]
            overflow-hidden
            bg-[#111816]
          "
        >
          {/* Camera */}
          <div
            id="entry-qr-reader"
            className="
              absolute
              inset-0
              z-10
              h-full
              w-full
              overflow-hidden
            "
          />

          
          <style>
            {`
              #entry-qr-reader video {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                object-position: center center !important;
              }

              #entry-qr-reader {
                border: none !important;
              }

              #entry-qr-reader img {
                display: none !important;
              }

              #entry-qr-reader__dashboard {
                display: none !important;
              }

              #entry-qr-reader__dashboard_section {
                display: none !important;
              }

              #entry-qr-reader__header_message {
                display: none !important;
              }

              #entry-qr-reader__scan_region {
                border: none !important;
              }

              #entry-qr-reader__scan_region > img {
                display: none !important;
              }
            `}
          </style>

          {/* Dark overlay */}
          <div
            className="
              pointer-events-none
              absolute
              inset-0
              z-20
              bg-black/25
            "
          />

        
          {/* --------------------------------
              INSTRUCTIONS
          -------------------------------- */}
          <div
            className="
              absolute
              left-0
              right-0
              top-[calc(50%+150px)]
              z-30
              px-6
              text-center
            "
          >
            <p
              className="
                text-sm
                font-medium
                text-white
              "
            >
              {cameraStarted
                ? "Align the KartMitra QR inside the frame"
                : error
                  ? "Camera unavailable"
                  : "Starting camera..."}
            </p>

            <p
              className="
                mt-2
                text-xs
                text-[#929b98]
              "
            >
              Scan the QR displayed at the entrance
            </p>
          </div>

          {/* --------------------------------
              ERROR
          -------------------------------- */}
          {error && (
            <div
              className="
                absolute
                bottom-8
                left-5
                right-5
                z-50
                rounded-2xl
                border
                border-red-400/20
                bg-black/75
                p-4
                text-center
                backdrop-blur-md
              "
            >
              <p
                className="
                  text-sm
                  font-medium
                  text-red-300
                "
              >
                Camera Error
              </p>

              <p
                className="
                  mt-2
                  text-xs
                  leading-relaxed
                  text-slate-300
                "
              >
                {error}
              </p>

              <button
                type="button"
                onClick={handleRetry}
                className="
                  mt-4
                  rounded-xl
                  bg-[#159b7d]
                  px-5
                  py-2.5
                  text-xs
                  font-semibold
                  text-white
                  transition
                  hover:bg-[#12886e]
                  active:scale-95
                "
              >
                Try Again
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default EntryScanner;