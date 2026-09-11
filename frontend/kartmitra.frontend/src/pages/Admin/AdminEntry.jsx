import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isAdminAuthenticated } from "../../utils/adminAuth";

/**
 * Entry point route for /admin.
 * Intelligently redirects authenticated admins to /admin/dashboard
 * and unauthenticated visitors to /admin/login.
 */
const AdminEntry = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (isAdminAuthenticated()) {
      navigate("/admin/dashboard", { replace: true });
    } else {
      navigate("/admin/login", { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-medium">
          Entering KartMitra Admin Portal...
        </p>
      </div>
    </div>
  );
};

export default AdminEntry;
