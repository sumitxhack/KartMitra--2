import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Package,
  PlusCircle,
  LogOut,
  Menu,
  X,
  Store,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";
import { clearAdminAuth, getAdminAuth } from "../utils/adminAuth";

const AdminLayout = () => {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const adminSession = getAdminAuth();

  const handleLogout = () => {
    clearAdminAuth();
    navigate("/admin/login", { replace: true });
  };

  const navItems = [
    {
      name: "Dashboard",
      path: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Products",
      path: "/admin/products",
      icon: Package,
    },
    {
      name: "Add Product",
      path: "/admin/products/add",
      icon: PlusCircle,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Top Admin Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Brand / Logo */}
            <div className="flex items-center gap-3">
              <Link
                to="/admin/dashboard"
                className="flex items-center gap-2.5 group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900">
                      Kart<span className="text-emerald-600">Mitra</span>
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Admin Portal
                    </span>
                  </div>
                </div>
              </Link>
            </div>

            {/* Center: Desktop Navigation */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? "bg-emerald-50 text-emerald-700 font-semibold shadow-2xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                      }`
                    }
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </NavLink>
                );
              })}
            </nav>

            {/* Right: User Info & Logout (Desktop) */}
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-300 text-slate-700 flex items-center justify-center font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-left leading-none">
                  <p className="text-xs font-bold text-slate-800">
                    {adminSession?.name || "Administrator"}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {adminSession?.email || "admin@kartmitra.com"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-rose-600 hover:bg-rose-50 hover:border-rose-200 text-xs font-semibold transition"
                title="Logout from Admin Portal"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Logout</span>
              </button>
            </div>

            {/* Mobile Hamburger Button */}
            <div className="flex md:hidden items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 focus:outline-none"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <X className="w-6 h-6" />
                ) : (
                  <Menu className="w-6 h-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-4 space-y-1 shadow-lg">
            <div className="pb-3 mb-2 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-800">
                  {adminSession?.name || "Administrator"}
                </p>
                <p className="text-[11px] text-slate-500">
                  {adminSession?.email || "admin@kartmitra.com"}
                </p>
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                Admin Session
              </span>
            </div>

            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 font-semibold"
                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}

            <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between">
              <Link
                to="/"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 py-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Customer Kiosk</span>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 text-xs font-semibold transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Outlet />
      </main>

      {/* Admin Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>KartMitra Admin Portal &copy; {new Date().getFullYear()}</span>
          <div className="flex items-center gap-3">
            <Link
              to="/"
              className="text-slate-500 hover:text-slate-700 transition underline underline-offset-2"
            >
              Open Customer Kiosk
            </Link>
            <span>•</span>
            <span className="text-slate-400">Prototype Environment</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default AdminLayout;
