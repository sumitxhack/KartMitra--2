import { useState } from "react";
import { ShieldCheck, Zap, Lock } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";

import { googleLogin } from "../../api/authApi";
import loginBg from "../../assets/login_page_bg.png";

const Login = () => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setLoading(true);
      setError("");

      const credential = credentialResponse?.credential;

      if (!credential) {
        throw new Error("Google credential was not received");
      }

      const result = await googleLogin(credential);

      console.log("Google login successful:", result);

      const { token, user } = result.data;

      // Store authentication information
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));

      // For now, send customer to Home
      navigate("/home");
    } catch (err) {
      console.error("Google login error:", err);

      setError(
        err.message || "Unable to login with Google"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError("Google login was cancelled or failed");
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
          <div className="mt-12 w-full">
  {error && (
    <p className="mb-3 text-center text-sm text-red-500">
      {error}
    </p>
  )}

  {loading ? (
    <div className="flex h-12.75 w-full items-center justify-center rounded-xl border border-[#dfe3e2] bg-white text-[14px] font-semibold text-[#252b29]">
      Signing in...
    </div>
  ) : (
    <div className="flex justify-center">
      <GoogleLogin
        onSuccess={handleGoogleSuccess}
        onError={handleGoogleError}
        useOneTap
        width="100%"
      />
    </div>
  )}
</div>

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