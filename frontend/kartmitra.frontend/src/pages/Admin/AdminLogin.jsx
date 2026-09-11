import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Store, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, ShieldCheck } from "lucide-react";
import {
  isAdminAuthenticated,
  setAdminAuth,
  verifyAdminCredentials,
} from "../../utils/adminAuth";

const AdminLogin = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const defaultEmail = import.meta.env.VITE_ADMIN_EMAIL || "admin@kartmitra.com";
  const defaultPassword = import.meta.env.VITE_ADMIN_PASSWORD || "admin123";

  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState(defaultPassword);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // If already authenticated, redirect to /admin/dashboard
  useEffect(() => {
    if (isAdminAuthenticated()) {
      const destination = location.state?.from?.pathname || "/admin/dashboard";
      navigate(destination, { replace: true });
    }
  }, [navigate, location]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please provide both email and password.");
      return;
    }

    setLoading(true);

    setTimeout(() => {
      const verification = verifyAdminCredentials(email, password);

      if (verification.success) {
        setAdminAuth(verification.user);
        setSuccess(true);
        setLoading(false);

        setTimeout(() => {
          const destination =
            location.state?.from?.pathname || "/admin/dashboard";
          navigate(destination, { replace: true });
        }, 400);
      } else {
        setError(verification.message || "Invalid email or password.");
        setLoading(false);
      }
    }, 300);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex flex-col justify-center items-center p-4 text-slate-800 font-sans">
      <div className="max-w-md w-full">
        {/* Branding header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3.5 bg-emerald-600 rounded-2xl text-white shadow-xl shadow-emerald-500/20 mb-3.5">
            <Store className="h-8 w-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            KartMitra Admin
          </h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1.5">
            Store Manager & AI Verification Control Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-200/50">
          <div className="mb-6 flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                Sign In to Portal
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Enter your administrative credentials
              </p>
            </div>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <ShieldCheck className="w-5 h-5" />
            </span>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Banner */}
          {success && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Authentication successful! Redirecting to dashboard...</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Field */}
            <div>
              <label
                htmlFor="admin-email"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </div>
                <input
                  id="admin-email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@kartmitra.com"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  id="admin-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>

            {/* Demo Hint Banner */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-500 flex items-start gap-2">
              <span className="font-bold text-emerald-700 shrink-0 mt-0.5">Note:</span>
              <span>
                Prototype admin credentials:{" "}
                <code className="bg-slate-200/80 px-1 py-0.5 rounded text-slate-800 font-mono text-[10px]">
                  admin@kartmitra.com
                </code>{" "}
                /{" "}
                <code className="bg-slate-200/80 px-1 py-0.5 rounded text-slate-800 font-mono text-[10px]">
                  admin123
                </code>
              </span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || success}
              className="w-full mt-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-75 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 text-sm transition transform active:scale-[0.99]"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : success ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Welcome Admin!</span>
                </>
              ) : (
                <>
                  <span>Login</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Return to Customer App */}
          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <Link
              to="/"
              className="text-xs text-slate-500 hover:text-slate-800 font-medium transition"
            >
              &larr; Return to Customer Entrance
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
