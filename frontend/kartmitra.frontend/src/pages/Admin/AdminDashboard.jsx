import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Package,
  PlusCircle,
  TrendingUp,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  Barcode,
  CheckCircle2,
  Boxes,
  Sparkles,
} from "lucide-react";
import { getAdminAuth } from "../../utils/adminAuth";
import apiClient from "../../api/client";

const DEMO_PRODUCTS = [
  {
    _id: "demo-1",
    name: "Amul Taaza Homogenised Toned Milk 1L",
    barcode: "8901262010053",
    sku: "AMUL-MILK-1L",
    price: 62.0,
    weight: 1000,
    weightUnit: "g",
    category: "Dairy",
    isActive: true,
  },
  {
    _id: "demo-2",
    name: "Britannia Good Day Butter Cookies 100g",
    barcode: "8901063012117",
    sku: "BRIT-GD-100G",
    price: 30.0,
    weight: 100,
    weightUnit: "g",
    category: "Snacks",
    isActive: true,
  },
  {
    _id: "demo-3",
    name: "Tata Salt Vacuum Evaporated 1kg",
    barcode: "8901058852896",
    sku: "TATA-SALT-1KG",
    price: 28.0,
    weight: 1000,
    weightUnit: "g",
    category: "Groceries",
    isActive: true,
  },
  {
    _id: "demo-4",
    name: "Coca-Cola Original Taste 750ml",
    barcode: "8901764012232",
    sku: "COKE-750ML",
    price: 40.0,
    weight: 750,
    weightUnit: "ml",
    category: "Beverages",
    isActive: true,
  },
];

const AdminDashboard = () => {
  const adminSession = getAdminAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  const fetchProducts = async () => {
    try {
      const res = await apiClient("/products");
      if (res && res.data && Array.isArray(res.data)) {
        setProducts(res.data);
        setUsingMock(false);
      } else if (Array.isArray(res)) {
        setProducts(res);
        setUsingMock(false);
      } else {
        setProducts(DEMO_PRODUCTS);
        setUsingMock(true);
      }
    } catch (err) {
      console.warn("Backend products API not reachable, loading fallback demo products:", err.message);
      setProducts(DEMO_PRODUCTS);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    apiClient("/products")
      .then((res) => {
        if (ignore) return;
        if (res && res.data && Array.isArray(res.data)) {
          setProducts(res.data);
          setUsingMock(false);
        } else if (Array.isArray(res)) {
          setProducts(res);
          setUsingMock(false);
        } else {
          setProducts(DEMO_PRODUCTS);
          setUsingMock(true);
        }
      })
      .catch((err) => {
        if (ignore) return;
        console.warn("Backend products API not reachable, loading fallback demo products:", err.message);
        setProducts(DEMO_PRODUCTS);
        setUsingMock(true);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="space-y-8">
      {/* Top Welcome Header */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-semibold mb-3 border border-emerald-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Admin Control Center</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {adminSession?.name || "Store Administrator"}
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl">
              Monitor store operations, manage catalog items, verify barcode registrations, and manage system readiness.
            </p>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/admin/products/add"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md transition transform active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Product</span>
            </Link>
            <Link
              to="/admin/products"
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl text-xs sm:text-sm border border-white/20 transition"
            >
              <Package className="w-4 h-4" />
              <span>View Products</span>
            </Link>
          </div>
        </div>

        {/* Subtle decorative background circles */}
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* Metric 1 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Products
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {loading ? "..." : products.length}
            </span>
            <span className="text-xs font-medium text-emerald-600">Active</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Registered in store inventory
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Barcode Engine
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Barcode className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              100%
            </span>
            <span className="text-xs font-medium text-emerald-600">Indexed</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            EAN-13 & UPC barcode lookup ready
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              AI Verification
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              Operational
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            YOLO, DINOv2 & Weight sensor ready
          </p>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Kiosk Access
            </span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              Ready
            </span>
            <span className="text-xs font-medium text-amber-600">Live</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            Entrance QR & Self-checkout active
          </p>
        </div>
      </div>

      {/* Primary Navigation Cards */}
      <div>
        <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-4">
          Admin Management Sections
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card 1: Products */}
          <Link
            to="/admin/products"
            className="group block bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs hover:shadow-md hover:border-emerald-300 transition"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Package className="w-6 h-6" />
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform">
                <span>View Products</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-4">
              Products Catalog
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Browse, search, and manage registered products, weights, prices, barcodes, and categories.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Path: /admin/products</span>
              <span className="font-semibold text-slate-700">
                {products.length} Products
              </span>
            </div>
          </Link>

          {/* Card 2: Add Product */}
          <Link
            to="/admin/products/add"
            className="group block bg-white rounded-2xl p-6 border border-slate-200 shadow-2xs hover:shadow-md hover:border-emerald-300 transition"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <PlusCircle className="w-6 h-6" />
              </div>
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform">
                <span>Add Product</span>
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-4">
              Register New Product
            </h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Add a new item to the store catalog with SKU, barcode, unit price, weight specifications, and images.
            </p>
            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>Path: /admin/products/add</span>
              <span className="font-semibold text-emerald-700">
                + Instant Registration
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Catalog Preview Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Catalog Items Preview
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Recently registered inventory items
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={fetchProducts}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 text-xs font-medium transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
            <Link
              to="/admin/products"
              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {usingMock && (
          <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 text-amber-800 text-xs flex items-center justify-between">
            <span>Displaying prototype demo catalog (backend API offline or local).</span>
            <span className="font-medium text-amber-700 text-[11px]">Demo Mode</span>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase font-bold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-6">Product</th>
                <th className="py-3.5 px-4">Barcode</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4">Price</th>
                <th className="py-3.5 px-4">Weight</th>
                <th className="py-3.5 px-6 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {products.slice(0, 5).map((p) => (
                <tr key={p._id || p.barcode} className="hover:bg-slate-50/80 transition">
                  <td className="py-3.5 px-6 font-semibold text-slate-900 max-w-xs truncate">
                    {p.name}
                    <div className="text-[10px] text-slate-400 font-mono">
                      SKU: {p.sku}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">
                    {p.barcode}
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                      {p.category || "General"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    ₹{Number(p.price).toFixed(2)}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {p.weight} {p.weightUnit || "g"}
                  </td>
                  <td className="py-3.5 px-6 text-right">
                    <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
