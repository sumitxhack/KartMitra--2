
import { ArrowLeft, Zap } from "lucide-react";

const ScanProduct = () => {
  const handleBack = () => {
    window.history.back();
  };

  const handleScanner = () => {
    // Later:
    // 1. Open device camera
    // 2. Scan entrance QR
    // 3. Send QR/session information to backend
    console.log("Opening QR scanner...");
  };

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
       
        

        {/* ================================
            HEADER
        ================================= */}

        <header className="relative z-30 flex h-13 items-center bg-[#151e1b] px-5">
          <button
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

          <h1 className="absolute left-1/2 -translate-x-1/2 text-[13px] font-medium text-white">
            Scan Product
          </h1>
        </header>

        {/* ================================
            SCANNER AREA
        ================================= */}

        <section className="flex flex-col items-center">

          {/* Camera background */}
          <div
            className="
              absolute
              inset-0
              bg-[radial-gradient(circle_at_center,rgba(35,53,47,0.28),transparent_55%)]
            "
          />

          {/* Scanner frame */}
          <div
            className="
              absolute
              top-50
              h-70
              w-70
            
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

        

          {/* ================================
              INSTRUCTION
          ================================= */}

          <p
            className="
              absolute
              top-100
              text-center
              text-[11px]
              font-normal
              text-[#929b98]
            "
          >
            Align barcode inside the frame
          </p>

          {/* ================================
              CAMERA BUTTON
          ================================= */}

          <button
            onClick={handleScanner}
            aria-label="Start scanner"
            className="
              absolute
              bottom-50
              flex
              h-[50px]
              w-[50px]
              items-center
              justify-center
              rounded-full
              bg-[#28312e]
              text-white
              shadow-md
              transition
              hover:bg-[#34403c]
              active:scale-90
            "
          >
            <Zap
              size={22}
              strokeWidth={1.7}
            />
          </button>

        </section>
      </div>
    </main>
  );
};

export default ScanProduct;