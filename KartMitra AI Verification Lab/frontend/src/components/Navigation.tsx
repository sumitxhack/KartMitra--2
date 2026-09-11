"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Layers,
  ShieldCheck,
  PlusCircle,
  Package,
  LayoutDashboard,
  Eye,
  Scale,
  Database,
  BarChart3,
  User,
  LogOut,
  ChevronDown,
} from "lucide-react";

export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [adminUser, setAdminUser] = useState<string | null>(null);
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);

  useEffect(() => {
    try {
      const auth = localStorage.getItem("kartmitra_admin_auth");
      if (auth) {
        const parsed = JSON.parse(auth);
        if (parsed?.authenticated) {
          setAdminUser(parsed.name || "Store Manager");
        }
      }
    } catch {}
  }, []);

  const handleLogout = () => {
    try {
      localStorage.removeItem("kartmitra_admin_auth");
    } catch {}
    setAdminUser(null);
    router.push("/login");
  };

  const primaryAdminNav = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      name: "Products",
      href: "/products",
      icon: Package,
    },
    {
      name: "Add Product",
      href: "/products/new",
      icon: PlusCircle,
    },
    {
      name: "AI Verification Lab",
      href: "/verification",
      icon: ShieldCheck,
    },
  ];

  const secondaryAITools = [
    { name: "Hybrid Identify", href: "/identify", icon: ShieldCheck },
    { name: "Vision Test", href: "/vision", icon: Eye },
    { name: "Scale Weight Test", href: "/weight", icon: Scale },
    { name: "Dataset Studio", href: "/dataset", icon: Database },
    { name: "Annotation Tool", href: "/dataset/annotation", icon: Eye },
    { name: "YOLO Fine-Tuning", href: "/training", icon: BarChart3 },
    { name: "System Statistics", href: "/stats", icon: BarChart3 },
  ];

  const isSecondaryActive = secondaryAITools.some((t) => pathname === t.href);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Logo / Title */}
        <div className="flex items-center justify-between w-full md:w-auto">
          <Link href="/dashboard" className="flex items-center gap-2.5 group">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-xs group-hover:bg-blue-700 transition">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-gray-900 tracking-tight">
                  KartMitra
                </h1>
                <span className="text-[10px] bg-blue-100 text-blue-800 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Admin Portal
                </span>
              </div>
              <p className="text-[10px] text-gray-500 font-medium">
                Product Catalog & AI Verification Management
              </p>
            </div>
          </Link>

          {/* Mobile Admin Pill */}
          <div className="md:hidden flex items-center gap-2">
            <Link
              href="/products/new"
              className="bg-blue-600 text-white p-1.5 rounded-lg text-xs"
              title="Add Product"
            >
              <PlusCircle className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1.5 bg-gray-100/90 p-1 rounded-xl w-full md:w-auto overflow-x-auto text-xs">
          {primaryAdminNav.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === "/dashboard" && pathname === "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-white text-blue-600 shadow-xs border border-gray-200/80"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-blue-600" : "text-gray-500"}`} />
                {item.name}
              </Link>
            );
          })}

          {/* AI Tools Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setShowToolsDropdown(!showToolsDropdown)}
              onBlur={() => setTimeout(() => setShowToolsDropdown(false), 200)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                isSecondaryActive
                  ? "bg-white text-purple-600 shadow-xs border border-gray-200/80"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
              }`}
            >
              <Eye className="h-3.5 w-3.5 text-purple-500" />
              AI Tools
              <ChevronDown className="h-3 w-3 text-gray-400" />
            </button>

            {showToolsDropdown && (
              <div className="absolute right-0 mt-1 w-52 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-50">
                <div className="px-3 py-1 text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">
                  AI Lab Diagnostic Tools
                </div>
                {secondaryAITools.map((t) => {
                  const SubIcon = t.icon;
                  const isCurrent = pathname === t.href;
                  return (
                    <Link
                      key={t.href}
                      href={t.href}
                      className={`flex items-center gap-2 px-3 py-2 text-xs font-semibold hover:bg-gray-50 transition ${
                        isCurrent ? "text-blue-600 bg-blue-50/50 font-bold" : "text-gray-700"
                      }`}
                    >
                      <SubIcon className="h-3.5 w-3.5 text-gray-400" />
                      {t.name}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </nav>

        {/* Right side: Admin user badge & Logout / Login */}
        <div className="hidden md:flex items-center gap-2">
          {adminUser ? (
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-2.5 py-1">
              <div className="h-6 w-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-black text-[11px]">
                <User className="h-3.5 w-3.5" />
              </div>
              <div className="text-left">
                <span className="text-[11px] font-bold text-gray-800 block leading-tight">
                  {adminUser}
                </span>
                <span className="text-[9px] text-emerald-600 font-bold uppercase">
                  Admin Logged In
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="ml-1 text-gray-400 hover:text-red-600 p-1 rounded-md transition cursor-pointer"
                title="Sign Out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 px-3 py-1 rounded-xl text-xs font-bold transition"
            >
              <User className="h-3.5 w-3.5" />
              Admin Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
