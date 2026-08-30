import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import cartImage from "../../assets/home_page_bg.png";

const Home = () => {
  const navigate = useNavigate();

  const handleStartShopping = () => {
    navigate("/entry-scanner");
  };

  const handleResume = () => {
    // We'll implement resume-session logic later
    console.log("Resuming session...");
  };

  return (
    <main
      style={{ backgroundImage: `url(${cartImage})` }}
      className="min-h-screen flex items-center justify-center bg-center bg-cover bg-no-repeat"
    >
      <div
        className="
          relative
          flex
          h-screen
          w-full
          flex-col
          overflow-hidden
        "
      >
        {/* MAIN CONTENT */}
        <section className="relative flex flex-1 flex-col px-5 pt-6">

          {/* Logo / Brand */}
          <div className="flex items-center gap-2">
            <span className="text-[25px] font-semibold text-[#202624]">
              Kart
              <span className="text-[#159b7d]">
                Mitra
              </span>
            </span>
          </div>

          {/* Heading */}
          <div className="relative z-10 mt-35">
            <h1 className="text-[45px] font-bold leading-[1.05] tracking-[-0.8px] text-[#171b1a]">
              Smart AI
              <br />

              <span className="text-[#159779]">
                Shopping
              </span>
            </h1>

            <p className="mt-3 text-[13px] leading-[1.45] text-[#8a9491]">
              Smarter choices.
              <br />
              Seamless checkout.
              <br />
              Secure exit.
            </p>
          </div>

          {/* START SHOPPING */}
          <div className="relative mt-90 flex w-full flex-col items-center justify-center">

            <button
              type="button"
              onClick={handleStartShopping}
              className="
                mt-12
                flex
                h-14
                w-90
                items-center
                justify-center
                rounded-2xl
                border
                border-[#151a19]
                bg-[#151a19]
                text-[14px]
                font-semibold
                text-white
                transition-all
                duration-200
                active:scale-[0.98]
                active:bg-[#1f2421]
              "
            >
              <span className="w-60 text-center text-[15px]">
                Start Shopping
              </span>

              <ArrowRight
                size={22}
                strokeWidth={1.7}
              />
            </button>

            {/* Resume */}
            <p className="mt-3 pb-3 text-center text-[14px] text-[#8b9491]">
              Already have a session?{" "}

              <button
                type="button"
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