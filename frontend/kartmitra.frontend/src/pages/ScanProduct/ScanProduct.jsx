import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Zap, CameraOff } from "lucide-react";

const ScanProduct = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraStatus, setCameraStatus] = useState("starting");
  const [flashOn, setFlashOn] = useState(false);

  // ==========================================
  // START CAMERA
  // ==========================================

  const startCamera = async () => {
    try {
      setCameraStatus("starting");

      // Stop previous stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment",
          },
          width: {
            ideal: 1280,
          },
          height: {
            ideal: 720,
          },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraStatus("active");
    } catch (error) {
      console.error("Camera error:", error);
      setCameraStatus("denied");
    }
  };

  // ==========================================
  // INITIALIZE CAMERA
  // ==========================================

  useEffect(() => {
    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, []);

  // ==========================================
  // FLASHLIGHT
  // ==========================================

  const toggleFlash = async () => {
    const stream = streamRef.current;

    if (!stream) return;

    const track = stream.getVideoTracks()[0];

    if (!track) return;

    const capabilities = track.getCapabilities();

    if (!capabilities.torch) {
      console.log("Flashlight not supported");
      return;
    }

    try {
      await track.applyConstraints({
        advanced: [
          {
            torch: !flashOn,
          },
        ],
      });

      setFlashOn(!flashOn);
    } catch (error) {
      console.error("Flash error:", error);
    }
  };

  // ==========================================
  // BACK
  // ==========================================

  const handleBack = () => {
    window.history.back();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e9edeb] sm:p-6">

      {/* ======================================
          PHONE CONTAINER
      ====================================== */}

      <div
        className="
          relative
          flex
          h-screen
          w-full
          flex-col
          overflow-hidden
          bg-[#0d1311]

          sm:h-[844px]
          sm:w-[390px]
          sm:rounded-[40px]
          sm:border-[7px]
          sm:border-[#151a19]
          sm:shadow-2xl
        "
      >

        {/* ======================================
            STATUS BAR
        ====================================== */}

        <div
          className="
            relative
            z-30
            flex
            h-[27px]
            shrink-0
            items-center
            justify-between
            bg-[#111815]
            px-5
          "
        >
          {/* Time */}

          <span
            className="
              text-[11px]
              font-semibold
              tracking-[0.1px]
              text-white
            "
          >
            9:41
          </span>

          {/* Status icons */}

          <div className="flex items-center gap-[7px]">

            {/* Signal */}

            <div className="flex items-end gap-[1px]">
              <span className="h-[4px] w-[2px] rounded-sm bg-[#8b9692]" />
              <span className="h-[6px] w-[2px] rounded-sm bg-[#8b9692]" />
              <span className="h-[8px] w-[2px] rounded-sm bg-[#8b9692]" />
            </div>

            {/* Network */}

            <span className="text-[10px] text-[#a1aaa7]">
              ◢
            </span>

            {/* Battery */}

            <div
              className="
                flex
                h-[9px]
                w-[14px]
                items-center
                rounded-[2px]
                border
                border-[#707b77]
                p-[1px]
              "
            >
              <div className="h-full w-[65%] rounded-[1px] bg-[#4eae74]" />
            </div>

          </div>
        </div>

        {/* ======================================
            HEADER
        ====================================== */}

        <header
          className="
            relative
            z-30
            flex
            h-[39px]
            shrink-0
            items-center
            justify-center
            bg-[#111815]
          "
        >

          {/* Back button */}

          <button
            onClick={handleBack}
            type="button"
            className="
              absolute
              left-3
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
              size={18}
              strokeWidth={1.6}
            />
          </button>

          {/* Title */}

          <h1
            className="
              text-[12px]
              font-semibold
              tracking-[-0.1px]
              text-white
            "
          >
            Scan Product
          </h1>

        </header>

        {/* ======================================
            CAMERA AREA
        ====================================== */}

        <section
          className="
            relative
            flex-1
            overflow-hidden
            bg-[#0d1311]
          "
        >

          {/* ====================================
              REAL CAMERA
          ==================================== */}

          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="
              absolute
              inset-0
              h-full
              w-full
              object-cover
            "
          />

          {/* Very subtle dark overlay */}

          <div
            className="
              pointer-events-none
              absolute
              inset-0
              bg-black/20
            "
          />

          {/* ====================================
              CAMERA PERMISSION ERROR
          ==================================== */}

          {cameraStatus === "denied" && (
            <div
              className="
                absolute
                inset-0
                z-20
                flex
                flex-col
                items-center
                justify-center
                bg-[#0d1311]
                px-8
                text-center
              "
            >
              <CameraOff
                size={28}
                strokeWidth={1.4}
                className="mb-3 text-[#159779]"
              />

              <p className="text-[12px] font-semibold text-white">
                Camera access required
              </p>

              <p className="mt-2 text-[9px] leading-4 text-[#8d9894]">
                Allow camera access to scan your product barcode.
              </p>

              <button
                onClick={startCamera}
                className="
                  mt-4
                  rounded-lg
                  bg-[#159779]
                  px-5
                  py-2
                  text-[9px]
                  font-semibold
                  text-white
                "
              >
                Enable Camera
              </button>
            </div>
          )}

          {/* ====================================
              SCANNER FRAME
          ==================================== */}

          <div
            className="
              pointer-events-none
              absolute
              left-1/2
              top-[72px]
              z-10
              h-[142px]
              w-[164px]
              -translate-x-1/2
            "
          >

            {/* Top Left */}

            <span
              className="
                absolute
                left-0
                top-0
                h-[20px]
                w-[3px]
                bg-[#138b74]
              "
            />

            <span
              className="
                absolute
                left-0
                top-0
                h-[3px]
                w-[20px]
                bg-[#138b74]
              "
            />

            {/* Top Right */}

            <span
              className="
                absolute
                right-0
                top-0
                h-[20px]
                w-[3px]
                bg-[#138b74]
              "
            />

            <span
              className="
                absolute
                right-0
                top-0
                h-[3px]
                w-[20px]
                bg-[#138b74]
              "
            />

            {/* Bottom Left */}

            <span
              className="
                absolute
                bottom-0
                left-0
                h-[20px]
                w-[3px]
                bg-[#138b74]
              "
            />

            <span
              className="
                absolute
                bottom-0
                left-0
                h-[3px]
                w-[20px]
                bg-[#138b74]
              "
            />

            {/* Bottom Right */}

            <span
              className="
                absolute
                bottom-0
                right-0
                h-[20px]
                w-[3px]
                bg-[#138b74]
              "
            />

            <span
              className="
                absolute
                bottom-0
                right-0
                h-[3px]
                w-[20px]
                bg-[#138b74]
              "
            />

          </div>

          {/* ====================================
              DEMO BARCODE
          ==================================== */}

          <div
            className="
              pointer-events-none
              absolute
              left-1/2
              top-[121px]
              z-10
              flex
              h-[54px]
              w-[138px]
              -translate-x-1/2
              flex-col
              items-center
              justify-center
              rounded-[4px]
              bg-[#f5f5f4]
              shadow-[0_2px_8px_rgba(0,0,0,0.15)]
            "
          >

            {/* Barcode */}

            <div className="flex h-[29px] items-stretch">

              <span className="w-[2px] bg-[#171717]" />
              <span className="ml-[2px] w-[1px] bg-[#171717]" />
              <span className="ml-[2px] w-[3px] bg-[#171717]" />
              <span className="ml-[1px] w-[1px] bg-[#171717]" />
              <span className="ml-[2px] w-[2px] bg-[#171717]" />
              <span className="ml-[1px] w-[4px] bg-[#171717]" />
              <span className="ml-[2px] w-[1px] bg-[#171717]" />
              <span className="ml-[2px] w-[3px] bg-[#171717]" />
              <span className="ml-[1px] w-[1px] bg-[#171717]" />
              <span className="ml-[2px] w-[2px] bg-[#171717]" />
              <span className="ml-[2px] w-[1px] bg-[#171717]" />
              <span className="ml-[1px] w-[3px] bg-[#171717]" />
              <span className="ml-[2px] w-[1px] bg-[#171717]" />
              <span className="ml-[2px] w-[3px] bg-[#171717]" />
              <span className="ml-[1px] w-[2px] bg-[#171717]" />
              <span className="ml-[2px] w-[1px] bg-[#171717]" />
              <span className="ml-[1px] w-[4px] bg-[#171717]" />
              <span className="ml-[2px] w-[1px] bg-[#171717]" />
              <span className="ml-[2px] w-[2px] bg-[#171717]" />
              <span className="ml-[1px] w-[3px] bg-[#171717]" />

            </div>

            {/* Barcode number */}

            <div className="-mt-[1px] flex items-center gap-[3px]">
              <span className="font-mono text-[5px] tracking-[1px] text-[#202020]">
                8 901234 567892
              </span>

              <span className="text-[7px] text-[#252525]">
                &gt;
              </span>
            </div>

          </div>

          {/* ====================================
              INSTRUCTION
          ==================================== */}

          <p
            className="
              pointer-events-none
              absolute
              left-0
              right-0
              top-[266px]
              z-10
              text-center
              text-[9px]
              font-medium
              text-[#a1aaa6]
            "
          >
            Align barcode inside the frame
          </p>

          {/* ====================================
              FLASHLIGHT BUTTON
          ==================================== */}

          <button
            onClick={toggleFlash}
            type="button"
            className={`
              absolute
              bottom-[57px]
              left-1/2
              z-20
              flex
              h-[25px]
              w-[25px]
              -translate-x-1/2
              items-center
              justify-center
              rounded-full
              transition
              active:scale-90
              ${
                flashOn
                  ? "bg-[#159779] text-white"
                  : "bg-[#2a312e] text-[#c2cac7]"
              }
            `}
            aria-label="Toggle flashlight"
          >
            <Zap
              size={12}
              strokeWidth={1.8}
            />
          </button>

        </section>

      </div>
    </main>
  );
};

export default ScanProduct;