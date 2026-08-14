import { ArrowRight, ShoppingCart } from "lucide-react";
import cartImage from "../../assets/shopping-cart.png";

const Home = () => {
  const handleStartShopping = () => {
    // TODO:
    // Navigate to entrance QR scanner
    console.log("Starting shopping...");
  };

  const handleResume = () => {
    // TODO:
    // Resume existing shopping session
    console.log("Resuming session...");
  };

  return (
    <main className="min-h-screen bg-[#f4f8f6] flex items-center justify-center sm:p-6">
      <div
        className="
          relative
          flex
          h-screen
          w-full
          flex-col
          overflow-hidden
          bg-white
          sm:h-[844px]
          sm:w-[390px]
          sm:rounded-[40px]
          sm:border-[7px]
          sm:border-[#171b1a]
          sm:shadow-2xl
        "
      >
        {/* --------------------------------
            STATUS BAR
        -------------------------------- */}
        <header className="relative z-20 flex items-center justify-between px-4 pt-2">
          <span className="text-[11px] font-semibold text-[#171b1a]">
            9:41
          </span>

          <div className="flex items-center gap-2 text-[10px]">
            <span className="text-[#64736e]">▥</span>
            <span className="text-[#64736e]">⌁</span>
            <span className="text-[#159779]">▮</span>
          </div>
        </header>

        {/* --------------------------------
            MAIN CONTENT
        -------------------------------- */}
        <section className="relative flex flex-1 flex-col px-5 pt-6">

          {/* Logo / Brand */}
          <div className="flex items-center gap-2">
            <ShoppingCart
              size={18}
              strokeWidth={1.8}
              className="text-[#159779]"
            />

            <span className="text-[13px] font-semibold text-[#202624]">
              SmartCart
            </span>
          </div>

          {/* Heading */}
          <div className="relative z-10 mt-7">
            <h1 className="text-[26px] font-bold leading-[1.05] tracking-[-0.8px] text-[#171b1a]">
              Smart
              <br />

              <span className="text-[#159779]">
                Shopping
              </span>
            </h1>

            <p className="mt-3 text-[11px] leading-[1.45] text-[#8a9491]">
              Smarter choices.
              <br />
              Seamless checkout.
              <br />
              Secure exit.
            </p>
          </div>

          {/* --------------------------------
              DECORATIVE BACKGROUND
          -------------------------------- */}
          <div className="pointer-events-none absolute inset-x-0 bottom-[62px] top-[150px] overflow-hidden">

            {/* Large soft circle */}
            <div
              className="
                absolute
                -left-[18px]
                bottom-[25px]
                h-[310px]
                w-[310px]
                rounded-full
                bg-[radial-gradient(circle_at_45%_40%,rgba(225,242,238,0.95),rgba(232,246,242,0.55),rgba(255,255,255,0))]
              "
            />

            {/* Inner glow */}
            <div
              className="
                absolute
                left-[105px]
                top-[65px]
                h-[85px]
                w-[85px]
                rounded-full
                bg-[rgba(255,255,255,0.35)]
                blur-[1px]
              "
            />

            {/* Decorative plant */}
            <div className="absolute bottom-0 right-[-8px]">
              <div className="relative h-[155px] w-[90px]">

                {/* Stem */}
                <div
                  className="
                    absolute
                    bottom-0
                    left-[43px]
                    h-[120px]
                    w-[2px]
                    rotate-[7deg]
                    bg-[#7caa75]
                  "
                />

                {/* Leaves */}
                <div className="absolute bottom-[70px] left-[30px] h-8 w-14 -rotate-[25deg] rounded-[100%_0_100%_0] bg-[#79b36e]" />

                <div className="absolute bottom-[92px] left-[40px] h-7 w-12 rotate-[15deg] rounded-[0_100%_0_100%] bg-[#5d9e61]" />

                <div className="absolute bottom-[45px] left-[43px] h-9 w-16 rotate-[25deg] rounded-[100%_0_100%_0] bg-[#8fbe79]" />

                <div className="absolute bottom-[110px] left-[52px] h-6 w-10 rotate-[50deg] rounded-[100%_0_100%_0] bg-[#71aa69]" />

                {/* Pot */}
                <div className="absolute bottom-0 left-[35px] h-[38px] w-[45px] rounded-b-md bg-[#dce0db]" />

                <div className="absolute bottom-[32px] left-[30px] h-3 w-[55px] rounded-full bg-[#c9d0ca]" />
              </div>
            </div>
          </div>

          {/* --------------------------------
              SHOPPING CART IMAGE
          -------------------------------- */}
          <div className="pointer-events-none absolute bottom-[90px] left-1/2 z-10 w-[235px] -translate-x-1/2">

            <img
              src={cartImage}
              alt="Shopping cart"
              className="
                h-auto
                w-full
                object-contain
                drop-shadow-[0_12px_10px_rgba(0,0,0,0.12)]
              "
            />
          </div>

          {/* --------------------------------
              START SHOPPING BUTTON
          -------------------------------- */}
          <div className="relative z-20 mt-auto">

            <button
              onClick={handleStartShopping}
              className="
                flex
                h-[48px]
                w-full
                items-center
                justify-between
                rounded-[12px]
                bg-[#151a19]
                px-5
                text-white
                transition-all
                duration-200
                hover:bg-[#222827]
                active:scale-[0.98]
              "
            >
              <span className="flex-1 text-center font-serif text-[15px]">
                Start Shopping
              </span>

              <ArrowRight
                size={22}
                strokeWidth={1.7}
              />
            </button>

            {/* Resume */}
            <p className="mt-3 pb-3 text-center text-[9px] text-[#8b9491]">
              Already have a session?{" "}
              
              <button
                onClick={handleResume}
                className="
                  font-semibold
                  text-[#159779]
                  hover:underline
                "
              >
                Resume
              </button>
            </p>

          </div>
        </section>
      </div>
    </main>
  );
};

export default Home;