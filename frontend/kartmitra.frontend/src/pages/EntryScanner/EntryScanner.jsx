
import { ArrowLeft, Zap } from "lucide-react";

const EntryScanner = () => {
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
            STATUS BAR
        ================================= */}

        <div className="relative z-30 flex h-[27px] items-center justify-between bg-[#0c1210] px-5 pt-1">
          <span className="text-[11px] font-semibold text-white">
            9:41
          </span>

          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-[#82908b]">▥</span>
            <span className="text-[#82908b]">⌁</span>
            <span className="text-[#39a878]">▮</span>
          </div>
        </div>

        {/* ================================
            HEADER
        ================================= */}

        <header className="relative z-30 flex h-[45px] items-center bg-[#151e1b] px-5">
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
            Welcome
          </h1>
        </header>

        {/* ================================
            SCANNER AREA
        ================================= */}

        <section className="relative flex flex-1 flex-col items-center">

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
              left-1/2
              top-[73px]
              h-[142px]
              w-[162px]
              -translate-x-1/2
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
              DEMO QR / BARCODE
          ================================= */}

          <div
            className="
              absolute
              top-[122px]
              flex
              h-[53px]
              w-[137px]
              flex-col
              items-center
              justify-center
              rounded-[4px]
              bg-white
              shadow-lg
            "
          >
            {/* Barcode */}
            <div className="flex h-[20px] items-stretch gap-[1px]">
              {[
                2, 1, 3, 1, 1, 2, 1, 3, 2, 1,
                2, 1, 1, 3, 1, 2, 2, 1, 3, 1,
                1, 2, 3, 1, 2, 1, 2, 3, 1, 1,
                2, 1, 3, 1, 2, 2, 1, 3,
              ].map((width, index) => (
                <span
                  key={index}
                  className="bg-[#111]"
                  style={{
                    width: `${width}px`,
                  }}
                />
              ))}
            </div>

            <span className="mt-[3px] text-[5px] tracking-[2px] text-[#222]">
              8 901234 567892 &gt;
            </span>
          </div>

          {/* ================================
              INSTRUCTION
          ================================= */}

          <p
            className="
              absolute
              top-[238px]
              text-center
              text-[10px]
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
              bottom-[72px]
              flex
              h-[27px]
              w-[27px]
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
              size={13}
              strokeWidth={1.7}
            />
          </button>

        </section>
      </div>
    </main>
  );
};

export default EntryScanner;