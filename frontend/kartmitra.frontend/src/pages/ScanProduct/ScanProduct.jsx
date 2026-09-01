import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Zap, ZapOff } from "lucide-react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";

import apiClient from "../../api/client";

const SCANNER_ID = "product-scanner";

const SCAN_CONFIG = {
  fps: 10,
  qrbox: {
    width: 280,
    height: 180,
  },
  aspectRatio: 1.777778,
};

const ScanProduct = () => {
  const scannerRef = useRef(null);

  // Prevent duplicate scanner starts.
  const startingRef = useRef(false);

  // Prevent the same barcode from creating multiple requests.
  const scannedRef = useRef(false);

  // Prevent state updates after component unmount.
  const mountedRef = useRef(true);

  // Used for torch control.
  const videoTrackRef = useRef(null);
  const torchFeatureRef = useRef(null);

  const [cameraError, setCameraError] = useState("");
  const [message, setMessage] = useState(
    "Point your camera at the product barcode"
  );

  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  /*
   * ============================================================
   * GET CURRENT CAMERA TRACK
   * ============================================================
   */
  const getCameraTrack = (scanner) => {
    try {
      /*
       * First try html5-qrcode's camera capabilities.
       */
      const capabilities =
        scanner?.getRunningTrackCameraCapabilities?.();

      if (capabilities) {
        torchFeatureRef.current =
          capabilities.torchFeature || null;
      }

      /*
       * Find the actual video element created by html5-qrcode.
       */
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
   * CHECK FLASHLIGHT SUPPORT
   * ============================================================
   */
  const detectTorchSupport = (scanner) => {
    try {
      const track = getCameraTrack(scanner);

      /*
       * Modern browser method.
       *
       * Chrome/Android commonly exposes:
       *
       * track.getCapabilities().torch
       */
      if (track?.getCapabilities) {
        const capabilities =
          track.getCapabilities();

        if (capabilities?.torch === true) {
          setTorchSupported(true);
          return true;
        }
      }

      /*
       * html5-qrcode fallback.
       */
      const torchFeature =
        torchFeatureRef.current;

      if (torchFeature) {
        try {
          const supported =
            torchFeature().isSupported();

          if (supported) {
            setTorchSupported(true);
            return true;
          }
        } catch (error) {
          console.warn(
            "html5-qrcode torch detection failed:",
            error
          );
        }
      }

      setTorchSupported(false);
      return false;
    } catch (error) {
      console.warn(
        "Torch support detection failed:",
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

    try {
      /*
       * Turn flashlight off before stopping camera.
       */
      if (torchOn) {
        try {
          const track = videoTrackRef.current;

          if (track?.applyConstraints) {
            await track.applyConstraints({
              advanced: [{ torch: false }],
            });
          }
        } catch {
          // Ignore torch cleanup errors.
        }

        setTorchOn(false);
      }
    } catch {
      // Ignore cleanup errors.
    }

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

    try {
      scanner.clear();
    } catch (error) {
      console.warn(
        "Scanner clear warning:",
        error
      );
    }

    scannerRef.current = null;
    videoTrackRef.current = null;
    torchFeatureRef.current = null;
    startingRef.current = false;
  };

  /*
   * ============================================================
   * GET PRODUCT
   * ============================================================
   */
  const getProduct = async (barcode) => {
    try {
      setMessage("Finding product...");

      const response = await apiClient(
        `/products/barcode/${encodeURIComponent(
          barcode
        )}`
      );

      console.log("Product found:", response);

      /*
       * Support either:
       *
       * response.data
       *
       * or
       *
       * response.product
       *
       * depending on your apiClient.
       */
      const product =
        response?.data ||
        response?.product ||
        response;

      if (!product) {
        throw new Error(
          "Product not found"
        );
      }

      /*
       * Save product temporarily for ProductDetail.
       */
      sessionStorage.setItem(
        "scannedProduct",
        JSON.stringify(product)
      );

      /*
       * Stop camera before redirecting.
       */
      await stopScanner();

      /*
       * Redirect to product detail.
       */
      window.location.href =
        `/product/${encodeURIComponent(
          barcode
        )}`;
    } catch (error) {
      console.error(
        "Product lookup failed:",
        error
      );

      scannedRef.current = false;

      if (!mountedRef.current) {
        return;
      }

      setMessage(
        error?.message ||
          "Product not found"
      );

      /*
       * Allow another scan after 2 seconds.
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
   * BARCODE SCANNED
   * ============================================================
   */
  const handleScanSuccess = async (
    decodedText
  ) => {
    /*
     * html5-qrcode can detect the same barcode
     * multiple times very quickly.
     */
    if (scannedRef.current) {
      return;
    }

    const barcode =
      decodedText?.trim();

    if (!barcode) {
      return;
    }

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
      /*
       * Important:
       *
       * Do not start two cameras simultaneously.
       */
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
        setMessage("Opening camera...");

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
         * ======================================================
         * FIRST ATTEMPT
         * ======================================================
         *
         * Ask the browser for the rear camera.
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
            "Environment camera failed. Trying camera list:",
            environmentError
          );

          /*
           * ====================================================
           * FALLBACK
           * ====================================================
           *
           * Some browsers/devices don't accept the
           * facingMode constraint.
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
           * Try to find the rear camera.
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
            rearCamera.label,
            rearCamera.id
          );

          await scanner.start(
            rearCamera.id,
            SCAN_CONFIG,
            handleScanSuccess,
            () => {}
          );
        }

        /*
         * Component may have been unmounted while
         * camera was starting.
         */
        if (!mountedRef.current) {
          try {
            if (scanner.isScanning) {
              await scanner.stop();
            }
          } catch {}

          try {
            scanner.clear();
          } catch {}

          return;
        }

        /*
         * Camera is now running.
         */
        setMessage(
          "Point your camera at the product barcode"
        );

        /*
         * Give the browser a moment to create
         * the video element and attach MediaStream.
         */
        await new Promise((resolve) =>
          setTimeout(resolve, 150)
        );

        /*
         * ======================================================
         * GET CAMERA TRACK
         * ======================================================
         */
        const track =
          getCameraTrack(scanner);

        if (track) {
          console.log(
            "Camera track:",
            track.getSettings?.()
          );

          console.log(
            "Camera capabilities:",
            track.getCapabilities?.()
          );
        }

        /*
         * ======================================================
         * DETECT TORCH
         * ======================================================
         */
        detectTorchSupport(scanner);
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
        torchFeatureRef.current = null;
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
      /*
       * Get the latest active camera track.
       */
      let track =
        videoTrackRef.current;

      if (!track) {
        track = getCameraTrack(
          scanner
        );
      }

      if (!track) {
        console.warn(
          "No active camera track available for torch."
        );

        return;
      }

      /*
       * ========================================================
       * METHOD 1 — DIRECT MEDIA TRACK
       * ========================================================
       *
       * This is the preferred method.
       *
       * Chrome on Android and many other mobile
       * browsers expose torch through:
       *
       * track.getCapabilities().torch
       */
      if (track.applyConstraints) {
        const capabilities =
          track.getCapabilities?.();

        if (
          capabilities?.torch === true
        ) {
          const newState =
            !torchOn;

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
              newState
                ? "ON"
                : "OFF"
            }`
          );

          return;
        }
      }

      /*
       * ========================================================
       * METHOD 2 — HTML5-QRCODE TORCH
       * ========================================================
       *
       * Some versions of html5-qrcode expose
       * a dedicated torch feature.
       */
      const capabilities =
        scanner.getRunningTrackCameraCapabilities?.();

      const torchFeature =
        capabilities?.torchFeature;

      if (torchFeature) {
        try {
          const feature =
            torchFeature();

          if (
            feature?.isSupported?.()
          ) {
            const newState =
              !torchOn;

            await feature.apply(
              newState
            );

            setTorchOn(newState);

            console.log(
              `Flashlight ${
                newState
                  ? "ON"
                  : "OFF"
              }`
            );

            return;
          }
        } catch (error) {
          console.warn(
            "html5-qrcode torch failed:",
            error
          );
        }
      }

      /*
       * If we reach here, the browser has a camera,
       * but the browser did not expose torch control.
       */
      console.warn(
        "This browser/device does not expose torch control."
      );

      setTorchSupported(false);
      setTorchOn(false);
    } catch (error) {
      console.error(
        "Unable to toggle flashlight:",
        error
      );

      /*
       * Don't stop the barcode scanner if
       * flashlight control fails.
       */
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

    window.history.back();
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
        {/* =====================================================
            HEADER
        ====================================================== */}
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

        {/* =====================================================
            SCANNER
        ====================================================== */}
        <section className="relative flex-1 overflow-hidden bg-black">
          {/* Camera */}
          <div
            id={SCANNER_ID}
            className="
              absolute
              inset-0
              h-full
              w-full
              overflow-hidden
              [&_video]:h-full
              [&_video]:w-full
              [&_video]:object-cover
            "
          />

          {/* Dark overlay */}
          <div
            className="
              pointer-events-none
              absolute
              inset-0
              z-[5]
              bg-black/20
            "
          />

          {/* ===================================================
              SCANNER FRAME
          ==================================================== */}
          <div
            className="
              pointer-events-none
              absolute
              left-1/2
              top-1/2
              z-10
              h-[180px]
              w-[280px]
              -translate-x-1/2
              -translate-y-1/2
            "
          >
            {/* Top left */}
            <span className="absolute left-0 top-0 h-[20px] w-[3px] bg-[#0b806d]" />
            <span className="absolute left-0 top-0 h-[3px] w-[20px] bg-[#0b806d]" />

            {/* Top right */}
            <span className="absolute right-0 top-0 h-[20px] w-[3px] bg-[#0b806d]" />
            <span className="absolute right-0 top-0 h-[3px] w-[20px] bg-[#0b806d]" />

            {/* Bottom left */}
            <span className="absolute bottom-0 left-0 h-[20px] w-[3px] bg-[#0b806d]" />
            <span className="absolute bottom-0 left-0 h-[3px] w-[20px] bg-[#0b806d]" />

            {/* Bottom right */}
            <span className="absolute bottom-0 right-0 h-[20px] w-[3px] bg-[#0b806d]" />
            <span className="absolute bottom-0 right-0 h-[3px] w-[20px] bg-[#0b806d]" />
          </div>

          {/* ===================================================
              MESSAGE
          ==================================================== */}
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

          {/* ===================================================
              FLASHLIGHT
          ==================================================== */}
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

          {/* ===================================================
              TORCH MESSAGE
          ==================================================== */}
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