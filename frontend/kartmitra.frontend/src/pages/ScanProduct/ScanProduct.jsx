import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Zap, ZapOff } from "lucide-react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import { useNavigate } from "react-router-dom";

import apiClient from "../../api/client";

const SCANNER_ID = "product-scanner";

const SCAN_CONFIG = {
  fps: 30,
  qrbox: {
    width: 280,
    height: 280,
  },
  aspectRatio: 1.0,
};

const ScanProduct = () => {
  const navigate = useNavigate();

  const scannerRef = useRef(null);
  const startingRef = useRef(false);
  const scannedRef = useRef(false);
  const mountedRef = useRef(true);
  const videoTrackRef = useRef(null);

  const [cameraError, setCameraError] = useState("");
  const [message, setMessage] = useState(
    "Point your camera at the product barcode"
  );

  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  /*
   * ============================================================
   * GET CAMERA TRACK
   * ============================================================
   */
  const getCameraTrack = () => {
    try {
      const videoElement = document.querySelector(
        `#${SCANNER_ID} video`
      );

      const stream = videoElement?.srcObject;

      if (stream instanceof MediaStream) {
        const tracks = stream.getVideoTracks();

        if (tracks.length > 0) {
          videoTrackRef.current = tracks[0];

          return tracks[0];
        }
      }
    } catch (error) {
      console.warn(
        "Unable to get camera track:",
        error
      );
    }

    return null;
  };

  /*
   * ============================================================
   * DETECT TORCH SUPPORT
   * ============================================================
   */
  const detectTorchSupport = () => {
    try {
      const track = getCameraTrack();

      if (!track) {
        setTorchSupported(false);
        return false;
      }

      const capabilities =
        track.getCapabilities?.();

      if (capabilities?.torch === true) {
        setTorchSupported(true);
        return true;
      }

      setTorchSupported(false);

      return false;
    } catch (error) {
      console.warn(
        "Torch detection failed:",
        error
      );

      setTorchSupported(false);

      return false;
    }
  };

  /*
   * ============================================================
   * STOP SCANNER
   * ============================================================
   */
  const stopScanner = async () => {
    const scanner = scannerRef.current;

    if (!scanner) {
      return;
    }

    /*
     * Turn flashlight off before stopping camera.
     */
    try {
      const track = videoTrackRef.current;

      if (track?.applyConstraints) {
        try {
          await track.applyConstraints({
            advanced: [
              {
                torch: false,
              },
            ],
          });
        } catch {
          // Torch cleanup can fail on unsupported browsers.
        }
      }

      setTorchOn(false);
    } catch {
      // Ignore torch cleanup errors.
    }

    /*
     * Stop html5-qrcode.
     */
    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (error) {
      console.warn(
        "Scanner stop warning:",
        error
      );
    }

    /*
     * Clear scanner DOM.
     */
    try {
      scanner.clear();
    } catch (error) {
      console.warn(
        "Scanner clear warning:",
        error
      );
    }

    /*
     * Reset refs.
     */
    if (scannerRef.current === scanner) {
      scannerRef.current = null;
    }

    videoTrackRef.current = null;
    startingRef.current = false;
  };

  /*
   * ============================================================
   * GET PRODUCT FROM DATABASE
   * ============================================================
   */
  const getProduct = async (barcode) => {
    try {
      setMessage("Finding product...");

      console.log(
        "Looking up barcode:",
        barcode
      );

      const response = await apiClient(
        `/products/barcode/${encodeURIComponent(
          barcode
        )}`
      );

      console.log(
        "Product API response:",
        response
      );

      /*
       * Handle common API response formats:
       *
       * {
       *   success: true,
       *   data: product
       * }
       *
       * OR
       *
       * {
       *   data: product
       * }
       *
       * OR
       *
       * product
       */
      const product =
        response?.data?.data ||
        response?.data?.product ||
        response?.data ||
        response?.product ||
        null;

      console.log(
        "Resolved product:",
        product
      );

      if (!product) {
        throw new Error(
          "Product not found"
        );
      }

      /*
       * Save complete product.
       *
       * ProductDetails will read this.
       */
      sessionStorage.setItem(
        "scannedProduct",
        JSON.stringify(product)
      );

      console.log(
        "Product saved to sessionStorage:",
        product
      );

      /*
       * IMPORTANT:
       *
       * We now navigate directly to:
       *
       * /product-details
       *
       * NOT:
       *
       * /product/:barcode
       */
      setMessage(
        "Product found. Opening details..."
      );

      console.log(
        "Navigating to /product-details"
      );

      /*
       * Stop scanner in the background.
       *
       * We intentionally DO NOT await this.
       *
       * This prevents scanner cleanup from
       * blocking navigation.
       */
      stopScanner().catch((error) => {
        console.warn(
          "Scanner cleanup warning:",
          error
        );
      });

      /*
       * Navigate immediately.
       */
      navigate("/product-details", {
        replace: true,
      });
    } catch (error) {
      console.error(
        "Product lookup failed:",
        error
      );

      /*
       * Allow scanning again after failure.
       */
      scannedRef.current = false;

      if (!mountedRef.current) {
        return;
      }

      setMessage(
        error?.message ||
          "Product not found"
      );

      /*
       * Reset message after 2 seconds.
       */
      setTimeout(() => {
        if (mountedRef.current) {
          setMessage(
            "Point your camera at the product barcode"
          );
        }
      }, 2000);
    }
  };

  /*
   * ============================================================
   * BARCODE SUCCESS
   * ============================================================
   */
  const handleScanSuccess = async (
    decodedText
  ) => {
    /*
     * Prevent multiple scans while
     * product lookup is running.
     */
    if (scannedRef.current) {
      return;
    }

    const barcode =
      decodedText?.trim();

    if (!barcode) {
      return;
    }

    /*
     * Lock scanner.
     */
    scannedRef.current = true;

    console.log(
      "Product barcode scanned:",
      barcode
    );

    await getProduct(barcode);
  };

  /*
   * ============================================================
   * START SCANNER
   * ============================================================
   */
  useEffect(() => {
    mountedRef.current = true;

    const startScanner = async () => {
      if (
        startingRef.current ||
        scannerRef.current
      ) {
        return;
      }

      startingRef.current = true;

      let scanner = null;

      try {
        setCameraError("");

        setMessage(
          "Opening camera..."
        );

        /*
         * Create scanner.
         */
        scanner = new Html5Qrcode(
          SCANNER_ID,
          {
            verbose: false,

            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,

              Html5QrcodeSupportedFormats.CODE_128,

              Html5QrcodeSupportedFormats.CODE_39,

              Html5QrcodeSupportedFormats.CODE_93,

              Html5QrcodeSupportedFormats.EAN_13,

              Html5QrcodeSupportedFormats.EAN_8,

              Html5QrcodeSupportedFormats.UPC_A,

              Html5QrcodeSupportedFormats.UPC_E,

              Html5QrcodeSupportedFormats.ITF,
            ],
          }
        );

        scannerRef.current = scanner;

        /*
         * ========================================================
         * TRY REAR CAMERA FIRST
         * ========================================================
         */
        try {
          await scanner.start(
            {
              facingMode: {
                exact: "environment",
              },
            },

            SCAN_CONFIG,

            handleScanSuccess,

            () => {}
          );
        } catch (environmentError) {
          console.warn(
            "Environment camera failed:",
            environmentError
          );

          /*
           * Fallback:
           * Get all available cameras.
           */
          const cameras =
            await Html5Qrcode.getCameras();

          if (
            !cameras ||
            cameras.length === 0
          ) {
            throw new Error(
              "No camera was found on this device."
            );
          }

          /*
           * Find rear camera.
           */
          const rearCamera =
            cameras.find((camera) => {
              const label =
                camera.label?.toLowerCase() ||
                "";

              return (
                label.includes("back") ||
                label.includes("rear") ||
                label.includes("environment")
              );
            }) || cameras[0];

          console.log(
            "Using camera:",
            rearCamera.label
          );

          await scanner.start(
            rearCamera.id,

            SCAN_CONFIG,

            handleScanSuccess,

            () => {}
          );
        }

        /*
         * Component may have unmounted
         * while camera was starting.
         */
        if (!mountedRef.current) {
          await stopScanner();
          return;
        }

        setMessage(
          "Point your camera at the product barcode"
        );

        /*
         * Wait for video element.
         */
        await new Promise((resolve) => {
          setTimeout(resolve, 300);
        });

        /*
         * Detect flashlight support.
         */
        detectTorchSupport();
      } catch (error) {
        console.error(
          "Unable to start product scanner:",
          error
        );

        if (!mountedRef.current) {
          return;
        }

        setCameraError(
          "Unable to access the camera. Please allow camera permission and try again."
        );

        setMessage("");
      } finally {
        startingRef.current = false;
      }
    };

    startScanner();

    /*
     * ==========================================================
     * CLEANUP
     * ==========================================================
     */
    return () => {
      mountedRef.current = false;

      const scanner =
        scannerRef.current;

      if (!scanner) {
        return;
      }

      const cleanup = async () => {
        /*
         * Turn flashlight off.
         */
        try {
          const track =
            videoTrackRef.current;

          if (
            track?.applyConstraints
          ) {
            try {
              await track.applyConstraints(
                {
                  advanced: [
                    {
                      torch: false,
                    },
                  ],
                }
              );
            } catch {
              // Ignore.
            }
          }
        } catch {
          // Ignore.
        }

        /*
         * Stop scanner.
         */
        try {
          if (scanner.isScanning) {
            await scanner.stop();
          }
        } catch (error) {
          console.warn(
            "Scanner cleanup warning:",
            error
          );
        }

        /*
         * Clear scanner.
         */
        try {
          scanner.clear();
        } catch (error) {
          console.warn(
            "Scanner clear warning:",
            error
          );
        }

        if (
          scannerRef.current === scanner
        ) {
          scannerRef.current = null;
        }

        videoTrackRef.current = null;
        startingRef.current = false;
      };

      cleanup();
    };
  }, []);

  /*
   * ============================================================
   * FLASHLIGHT
   * ============================================================
   */
  const toggleTorch = async () => {
    const scanner =
      scannerRef.current;

    if (!scanner) {
      return;
    }

    try {
      let track =
        videoTrackRef.current;

      /*
       * If track is missing,
       * find it again.
       */
      if (!track) {
        track = getCameraTrack();
      }

      if (!track) {
        console.warn(
          "No active camera track."
        );

        return;
      }

      const capabilities =
        track.getCapabilities?.();

      /*
       * Browser/device doesn't support torch.
       */
      if (
        capabilities?.torch !== true
      ) {
        setTorchSupported(false);

        return;
      }

      const newState = !torchOn;

      /*
       * Turn flashlight on/off.
       */
      await track.applyConstraints({
        advanced: [
          {
            torch: newState,
          },
        ],
      });

      setTorchOn(newState);

      console.log(
        `Flashlight ${
          newState ? "ON" : "OFF"
        }`
      );
    } catch (error) {
      console.error(
        "Unable to toggle flashlight:",
        error
      );

      setTorchOn(false);
    }
  };

  /*
   * ============================================================
   * BACK
   * ============================================================
   */
  const handleBack = async () => {
    await stopScanner();

    navigate(-1);
  };

  /*
   * ============================================================
   * UI
   * ============================================================
   */
  return (
    <main className="min-h-screen bg-[#e9eceb] flex items-center justify-center sm:p-6">
      <div
        className="
          relative
          flex
          h-screen
          w-full
          flex-col
          overflow-hidden
          bg-[#0c1210]
          sm:h-[844px]
          sm:w-[390px]
          sm:rounded-[40px]
          sm:border-[7px]
          sm:border-[#171c1a]
          sm:shadow-2xl
        "
      >
        {/* ======================================================
            HEADER
        ======================================================= */}
        <header
          className="
            relative
            z-30
            flex
            h-13
            shrink-0
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
              text-white
            "
          >
            Scan Product
          </h1>
        </header>

        {/* ======================================================
            CAMERA
        ======================================================= */}
        <section className="relative flex-1 overflow-hidden bg-black">
          <div
            id={SCANNER_ID}
            className="
              absolute
              inset-0
              w-full
              overflow-hidden
              [&_video]:h-full
              [&_video]:w-full
              [&_video]:object-cover
            "
          />

          {/* Camera overlay */}
          <div
            className="
              pointer-events-none
              absolute
              inset-0
              z-[5]
              bg-black/20
            "
          />

          {/* Message */}
          {cameraError ? (
            <p
              className="
                absolute
                left-1/2
                top-1/2
                z-20
                w-[80%]
                -translate-x-1/2
                -translate-y-1/2
                text-center
                text-[11px]
                leading-5
                text-[#ff8f8f]
              "
            >
              {cameraError}
            </p>
          ) : (
            <p
              className="
                absolute
                left-1/2
                top-[calc(50%+120px)]
                z-20
                w-[90%]
                -translate-x-1/2
                text-center
                text-[11px]
                font-normal
                text-[#d0d7d4]
              "
            >
              {message}
            </p>
          )}

          {/* ====================================================
              FLASHLIGHT BUTTON
          ===================================================== */}
          <button
            type="button"
            onClick={toggleTorch}
            disabled={!torchSupported}
            aria-label={
              torchOn
                ? "Turn flashlight off"
                : "Turn flashlight on"
            }
            className="
              absolute
              bottom-12
              left-1/2
              z-20
              flex
              h-[50px]
              w-[50px]
              -translate-x-1/2
              items-center
              justify-center
              rounded-full
              bg-[#28312e]
              text-white
              shadow-md
              transition
              hover:bg-[#34403c]
              active:scale-90
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            {torchOn ? (
              <ZapOff
                size={22}
                strokeWidth={1.7}
              />
            ) : (
              <Zap
                size={22}
                strokeWidth={1.7}
              />
            )}
          </button>

          {/* Torch unsupported message */}
          {!torchSupported && (
            <p
              className="
                pointer-events-none
                absolute
                bottom-5
                left-1/2
                z-20
                w-full
                -translate-x-1/2
                text-center
                text-[8px]
                text-[#7d8783]
              "
            >
              Flashlight control is not supported by this browser
            </p>
          )}
        </section>
      </div>
    </main>
  );
};

export default ScanProduct;