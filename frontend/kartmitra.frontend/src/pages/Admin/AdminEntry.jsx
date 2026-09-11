import { useEffect } from "react";
import { isAdminAuthenticated } from "../../utils/adminAuth";

/**
 * Entry point route for /admin in KartMitra.
 * Redirects directly to the authoritative AI Verification Lab Admin Portal.
 * Uses environment variable VITE_AI_LAB_FRONTEND_URL with fallback.
 */
const AdminEntry = () => {
  const rawAiLabUrl =
    (typeof import.meta !== "undefined" &&
      import.meta?.env?.VITE_AI_LAB_FRONTEND_URL) ||
    "http://localhost:3000";

  const aiLabUrl = rawAiLabUrl.replace(/\/$/, "");

  useEffect(() => {
    // If already authenticated via the shared 'kartmitra_admin_auth' session,
    // open the AI Lab Dashboard, otherwise open AI Lab Login.
    const targetPath = isAdminAuthenticated() ? "/dashboard" : "/login";
    window.location.href = `${aiLabUrl}${targetPath}`;
  }, [aiLabUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-sans p-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
        <div>
          <h2 className="text-base font-bold text-white">
            Opening KartMitra Admin Portal
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Redirecting to AI Verification Lab Admin Portal...
          </p>
        </div>
        <a
          href={`${aiLabUrl}/login`}
          className="text-xs text-emerald-400 hover:text-emerald-300 underline underline-offset-4 mt-2"
        >
          Click here if you are not redirected automatically
        </a>
      </div>
    </div>
  );
};

export default AdminEntry;
