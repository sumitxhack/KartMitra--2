"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Layers, Scan, Database, BarChart3, Eye, ShieldCheck, Scale } from "lucide-react";

export default function Navigation() {
  const pathname = usePathname();

  const navItems = [
    {
      name: "AI Verification Dashboard",
      href: "/dashboard",
      icon: ShieldCheck,
    },
    {
      name: "Barcode Scanner",
      href: "/",
      icon: Scan,
    },
    {
      name: "Hybrid Identify",
      href: "/identify",
      icon: ShieldCheck,
    },
    {
      name: "Vision Test",
      href: "/vision",
      icon: Eye,
    },
    {
      name: "Mock Weight",
      href: "/weight",
      icon: Scale,
    },
    {
      name: "Products Database",
      href: "/products",
      icon: Layers,
    },
    {
      name: "Dataset Studio",
      href: "/dataset",
      icon: Database,
    },
    {
      name: "Annotation Tool",
      href: "/dataset/annotation",
      icon: Eye,
    },
    {
      name: "YOLO Fine-Tuning",
      href: "/training",
      icon: BarChart3,
    },
    {
      name: "Dataset Statistics",
      href: "/stats",
      icon: BarChart3,
    },
  ];




  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Logo / Title */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl text-white shadow-sm">
            <Layers className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              KartMitra
              <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                Dataset Lab
              </span>
            </h1>
            <p className="text-xs text-gray-500 font-medium">
              Product Image Verification & Dataset Studio
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-white text-blue-600 shadow-sm border border-gray-200/80"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-200/60"
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? "text-blue-600" : "text-gray-500"}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
