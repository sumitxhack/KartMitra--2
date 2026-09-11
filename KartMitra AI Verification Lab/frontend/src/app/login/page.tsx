"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Lock, Mail, ArrowRight, CheckCircle2, Sparkles, Store, KeyRound } from "lucide-react";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@kartmitra.com");
  const [password, setPassword] = useState("admin123");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if already logged in
    try {
      const auth = localStorage.getItem("kartmitra_admin_auth");
      if (auth) {
        const parsed = JSON.parse(auth);
        if (parsed?.authenticated) {
          router.push("/dashboard");
        }
      }
    } catch {}
  }, [router]);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);

    // Set demo auth in localStorage
    setTimeout(() => {
      localStorage.setItem(
        "kartmitra_admin_auth",
        JSON.stringify({
          authenticated: true,
          email: email || "admin@kartmitra.com",
          name: "Store Manager",
          role: "Administrator",
          loginTime: new Date().toISOString(),
        })
      );
      setSuccess(true);
      setIsLoading(false);
      setTimeout(() => {
        router.push("/dashboard");
      }, 500);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex flex-col justify-center items-center p-4 font-sans text-slate-800">
      <div className="max-w-md w-full">
        {/* Logo and Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-500/30 mb-3">
            <Store className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
            KartMitra
            <span className="text-xs bg-blue-500/20 text-blue-300 font-extrabold px-2.5 py-1 rounded-full border border-blue-400/30 uppercase tracking-widest">
              Admin Portal
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-2 font-medium">
            AI Product Catalog, DINOv2 Vector Indexing & Store Management
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-white rounded-3xl p-8 shadow-2xl border border-slate-100">
          <div className="flex items-center justify-between border-b pb-4 mb-6">
            <div>
              <h2 className="text-lg font-black text-slate-900">Admin Sign In</h2>
              <p className="text-xs text-slate-500 mt-0.5">Enter credentials or use Quick Demo Login</p>
            </div>
            <div className="bg-emerald-50 text-emerald-700 text-[10px] font-black px-2.5 py-1 rounded-full border border-emerald-200 uppercase tracking-wide flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Demo Ready
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Admin Email
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                  placeholder="admin@kartmitra.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || success}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white py-3 px-4 rounded-xl text-xs font-black shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoading ? (
                <span>Authenticating...</span>
              ) : success ? (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> Welcome, Admin! Redirecting...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  Sign In to Admin Portal
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </button>
          </form>

          {/* Quick Demo Login One-Click */}
          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => handleLogin()}
              className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 py-2.5 px-4 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <KeyRound className="h-4 w-4 text-blue-600" />
              1-Click Demo Login (Store Manager)
            </button>
            <p className="text-[11px] text-slate-400 mt-2">
              Bypasses auth prompt for quick hackathon review and evaluation
            </p>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="grid grid-cols-3 gap-3 mt-6 text-center text-slate-400 text-xs">
          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
            <ShieldCheck className="h-4 w-4 text-emerald-400 mx-auto mb-1" />
            <span className="font-bold text-slate-300 block">DINOv2 AI</span>
            <span className="text-[10px]">384d Embeddings</span>
          </div>
          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
            <Sparkles className="h-4 w-4 text-purple-400 mx-auto mb-1" />
            <span className="font-bold text-slate-300 block">FAISS Index</span>
            <span className="text-[10px]">Instant Auto-Sync</span>
          </div>
          <div className="bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50">
            <Store className="h-4 w-4 text-blue-400 mx-auto mb-1" />
            <span className="font-bold text-slate-300 block">Admin Portal</span>
            <span className="text-[10px]">Catalog & Verification</span>
          </div>
        </div>
      </div>
    </div>
  );
}
