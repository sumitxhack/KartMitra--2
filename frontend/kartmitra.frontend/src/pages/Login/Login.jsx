
import { ShieldCheck, Zap, Lock } from "lucide-react";
import loginBg from '../../assets/login_page_bg.png';

const Login = () => {
  const handleGoogleLogin = () => {
    // TODO: Connect Google OAuth here
    console.log("Google login clicked");
  };

  return (
    <div
    style={{ backgroundImage: `url(${loginBg})` }}
     className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center">
      
      {/* Mobile App Screen */}
      <main className="relative w-full min-h-screen overflow-hidden  ">

        
        {/* Content */}
        <div className="relative flex min-h-screen flex-col px-7 pt-70 pb-5 sm:min-h-207">


          {/* Heading */}
          <section>
            <p className="text-[25px] font-semibold leading-tight text-[#18201e]">
              Welcome to
            </p>

            <h1 className="mt-1 text-[45px] font-bold leading-[1.05] tracking-[-0.7px] text-[#111716]">
              Kart
              <span className="text-[#159b7d]">
                Mitra
              </span>
            </h1>

            <p className="mt-4 max-w-65 text-[13px] leading-normal text-[#7a8583]">
              Sign in to start your smart
              <br />
              and seamless shopping experience.
            </p>
          </section>

          {/* Benefits */}
          <section className="mt-6 flex h-22.75 items-center rounded-2xl bg-[#f7f9f8] px-2">

            {/* Secure */}
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              <ShieldCheck
                size={20}
                strokeWidth={1.8}
                className="text-[#159b7d]"
              />

              <p className="text-center text-[11px] font-semibold leading-tight text-[#29312f]">
                Secure
                <br />
                & Safe
              </p>
            </div>

            <div className="h-10 w-px bg-[#e2e7e5]" />

            {/* Fast */}
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              <Zap
                size={20}
                strokeWidth={1.8}
                className="text-[#159b7d]"
              />

              <p className="text-center text-[11px] font-semibold leading-tight text-[#29312f]">
                Fast
                <br />
                Checkout
              </p>
            </div>

            <div className="h-10 w-px bg-[#e2e7e5]" />

            {/* Private */}
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              <Lock
                size={19}
                strokeWidth={1.8}
                className="text-[#159b7d]"
              />

              <p className="text-center text-[11px] font-semibold leading-tight text-[#29312f]">
                Private
                <br />
                & Protected
              </p>
            </div>
          </section>

          {/* Google Login */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="mt-12 flex h-12.75 w-full items-center justify-center gap-3 rounded-xl border border-[#dfe3e2] bg-white text-[14px] font-semibold text-[#252b29] shadow-[0_1px_3px_rgba(0,0,0,0.02)] transition-all duration-200 hover:bg-[#fafcfc] active:scale-[0.98] active:bg-[#f7f9f8]"
          >
            {/* Google G */}
            <svg
              width="19"
              height="19"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="#4285F4"
                d="M21.35 12.27c0-.71-.06-1.4-.18-2.05H12v3.88h5.23a4.47 4.47 0 0 1-1.94 2.93v2.43h3.14c1.84-1.7 2.92-4.2 2.92-7.19Z"
              />
              <path
                fill="#34A853"
                d="M12 21.67c2.63 0 4.84-.87 6.45-2.36l-3.14-2.43c-.87.58-1.98.92-3.31.92-2.55 0-4.71-1.72-5.49-4.03H3.27v2.51A9.74 9.74 0 0 0 12 21.67Z"
              />
              <path
                fill="#FBBC05"
                d="M6.51 13.77A5.86 5.86 0 0 1 6.2 12c0-.61.11-1.2.31-1.77V7.72H3.27A9.74 9.74 0 0 0 2.23 12c0 1.57.38 3.05 1.04 4.28l3.24-2.51Z"
              />
              <path
                fill="#EA4335"
                d="M12 6.2c1.43 0 2.71.49 3.72 1.46l2.79-2.79C16.84 3.31 14.63 2.33 12 2.33a9.74 9.74 0 0 0-8.73 5.39l3.24 2.51C7.29 7.92 9.45 6.2 12 6.2Z"
              />
            </svg>

            Continue with Google
          </button>

          {/* Divider */}
          <div className="my-4 flex items-center gap-4">
            <div className="h-px flex-1 bg-[#e4e8e7]" />

            <span className="text-[12px] font-semibold text-[#737c79]">
              OR
            </span>

            <div className="h-px flex-1 bg-[#e4e8e7]" />
          </div>

          {/* Terms */}
          <div className="text-center">
            <p className="text-[11px] text-[#8a9390]">
              By continuing, you agree to our
            </p>

            <p className="mt-1 text-[11px] font-medium">
              <button className="text-[#159b7d] hover:underline">
                Terms of Service
              </button>

              <span className="mx-1 text-[#8a9390]">
                and
              </span>

              <button className="text-[#159b7d] hover:underline">
                Privacy Policy
              </button>
            </p>
          </div>

        </div>
      </main>
    </div>
  );
};

export default Login;