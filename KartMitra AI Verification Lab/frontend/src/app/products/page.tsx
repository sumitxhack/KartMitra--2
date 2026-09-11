"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  Tag,
  RefreshCw,
  AlertTriangle,
  Package,
  LayoutGrid,
  Table as TableIcon,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  Filter,
} from "lucide-react";

interface ProductImage {
  id: string | number;
  product_id: string | number;
  image_path: string;
  image_type: string;
  created_at?: string;
}

interface Product {
  id: string | number;
  barcode: string;
  name: string;
  price: number;
  weight: number;
  category: string | null;
  description: string | null;
  indexing_status?: string;
  indexing_error?: string | null;
  created_at: string;
  updated_at: string;
  images: ProductImage[];
}

const API_BASE = "http://127.0.0.1:8000";

export default function ProductListPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/products`).catch(() => null);
      if (!res) {
        setError("Backend Server Offline: Ensure FastAPI backend is running on http://127.0.0.1:8000");
        setProducts([]);
        return;
      }
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data && data.success && Array.isArray(data.products)) {
        setProducts(data.products);
      } else if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (err: any) {
      console.error("Error fetching products:", err);
      setError("Failed to connect to backend server. Please verify the API is running.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id: string | number, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the product "${name}"? This will physically delete all associated training/reference images and FAISS index vectors.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProducts(products.filter((p) => p.id !== id));
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || "Failed to delete product.");
      }
    } catch (err) {
      console.error("Error deleting product:", err);
      alert("API connection failure. Unable to delete product.");
    }
  };

  // Categories list for filter
  const categories = Array.from(
    new Set(products.map((p) => p.category).filter(Boolean) as string[])
  );

  // Filter products based on search term (name, barcode, category) and category filter
  const filteredProducts = products.filter((p) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      p.name.toLowerCase().includes(term) ||
      p.barcode.toLowerCase().includes(term) ||
      (p.category && p.category.toLowerCase().includes(term));
    const matchesCategory =
      categoryFilter === "ALL" || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Page Header */}
        <header className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-200">
                Inventory & AI Models
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                {products.length} Products Registered
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
              <Package className="h-6 w-6 text-blue-600" />
              Products Management
            </h1>
            <p className="text-xs text-slate-500 font-medium">
              Registered items, multi-image reference datasets, and AI verification status
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle: Table / Cards */}
            <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
              <button
                onClick={() => setViewMode("table")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  viewMode === "table"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Table View"
              >
                <TableIcon className="h-3.5 w-3.5" />
                Table
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition cursor-pointer ${
                  viewMode === "cards"
                    ? "bg-white text-blue-600 shadow-xs"
                    : "text-slate-500 hover:text-slate-900"
                }`}
                title="Cards View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Cards
              </button>
            </div>

            <Link
              href="/products/new"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-2xl text-xs font-black transition shadow-md shadow-blue-600/30 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Product
            </Link>
          </div>
        </header>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              type="text"
              placeholder="Search by product name, barcode, or category..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 py-3 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs transition"
            />
          </div>

          {/* Category Dropdown Filter */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="h-4 w-4 text-slate-400 hidden sm:block" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full sm:w-auto bg-white border border-slate-200 rounded-2xl px-4 py-3 text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-xs cursor-pointer"
            >
              <option value="ALL">All Categories ({products.length})</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black uppercase text-red-800">Connection Error</h4>
                <p className="text-xs text-red-700 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={fetchProducts}
              className="flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
            <p className="text-xs font-bold">Loading product catalog...</p>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && filteredProducts.length === 0 && (
          <div className="bg-white rounded-3xl p-16 text-center border border-slate-200 shadow-xs flex flex-col items-center gap-3">
            <Package className="h-12 w-12 text-slate-300" />
            <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
              No Products Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm">
              {searchTerm || categoryFilter !== "ALL"
                ? "No products match your current search or category filters."
                : "No products are registered in the store catalog yet."}
            </p>
            {searchTerm || categoryFilter !== "ALL" ? (
              <button
                onClick={() => {
                  setSearchTerm("");
                  setCategoryFilter("ALL");
                }}
                className="mt-2 text-xs font-bold text-blue-600 hover:underline cursor-pointer"
              >
                Clear all filters
              </button>
            ) : (
              <Link
                href="/products/new"
                className="mt-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs"
              >
                Register First Product
              </Link>
            )}
          </div>
        )}

        {/* Product Views */}
        {!isLoading && !error && filteredProducts.length > 0 && (
          <>
            {/* VIEW 1: TABLE VIEW */}
            {viewMode === "table" && (
              <div className="bg-white border border-slate-200 rounded-3xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-400 text-[10px] font-black uppercase tracking-wider">
                        <th className="py-4 px-6">Product</th>
                        <th className="py-4 px-4">Barcode</th>
                        <th className="py-4 px-4">Category</th>
                        <th className="py-4 px-4">Price</th>
                        <th className="py-4 px-4">Weight</th>
                        <th className="py-4 px-4 text-center">Reference Images</th>
                        <th className="py-4 px-4 text-center">Active Status</th>
                        <th className="py-4 px-6 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map((p) => {
                        const imageCount = p.images?.length || 0;
                        const frontImg =
                          p.images?.find((img) => img.image_type === "front") ||
                          p.images?.[0];
                        const thumbnailSrc = frontImg
                          ? frontImg.image_path.startsWith("http")
                            ? frontImg.image_path
                            : frontImg.image_path.startsWith("/uploads/") ||
                              frontImg.image_path.startsWith("uploads/")
                            ? `${API_BASE}${frontImg.image_path.startsWith('/') ? '' : '/'}${frontImg.image_path}`
                            : `${API_BASE}/api/v1/products/images/${frontImg.id}/file`
                          : null;

                        const isAIReady = p.indexing_status === "READY" || imageCount > 0;

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/70 transition">
                            <td className="py-4 px-6">
                              <div className="flex items-center gap-3">
                                {thumbnailSrc ? (
                                  <img
                                    src={thumbnailSrc}
                                    alt={p.name}
                                    className="h-11 w-11 object-cover rounded-xl border border-slate-200 shadow-xs shrink-0"
                                  />
                                ) : (
                                  <div className="h-11 w-11 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200 shrink-0">
                                    <Tag className="h-4 w-4 text-slate-400" />
                                  </div>
                                )}

                                <div className="min-w-0">
                                  <Link
                                    href={`/products/${p.id}`}
                                    className="font-bold text-slate-900 hover:text-blue-600 block transition truncate max-w-xs"
                                  >
                                    {p.name}
                                  </Link>
                                  <span className="text-[10px] text-slate-400 font-medium block mt-0.5">
                                    ID: {String(p.id).slice(0, 16)}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-4 px-4 font-mono font-bold text-slate-700">
                              {p.barcode}
                            </td>

                            <td className="py-4 px-4">
                              <span className="text-[10px] bg-slate-100 text-slate-700 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                                {p.category || "Uncategorized"}
                              </span>
                            </td>

                            <td className="py-4 px-4 font-black text-slate-900 text-sm">
                              ₹{Number(p.price).toFixed(2)}
                            </td>

                            <td className="py-4 px-4 text-slate-600 font-semibold">
                              {Number(p.weight).toFixed(3)} kg
                            </td>

                            <td className="py-4 px-4 text-center">
                              <span
                                className={`text-[11px] px-2.5 py-1 rounded-full font-black tracking-wide ${
                                  imageCount >= 5
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : imageCount > 0
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {imageCount} {imageCount === 1 ? "Image" : "Images"}
                              </span>
                            </td>

                            {/* Active Status Column (Prompt Requirement 2) */}
                            <td className="py-4 px-4 text-center">
                              {isAIReady ? (
                                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                                  Active (AI Ready)
                                </span>
                              ) : p.indexing_status === "INDEXING" ? (
                                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <RefreshCw className="h-3 w-3 animate-spin text-amber-600" />
                                  Active (Indexing)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  Active (Pending)
                                </span>
                              )}
                            </td>

                            {/* View / Edit Button (Prompt Requirement 2) */}
                            <td className="py-4 px-6 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  href={`/products/${p.id}`}
                                  className="inline-flex items-center gap-1 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 px-3 py-1.5 rounded-xl font-bold text-[11px] transition"
                                  title="View Details"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  View
                                </Link>
                                <Link
                                  href={`/products/${p.id}/edit`}
                                  className="inline-flex items-center gap-1 bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 px-3 py-1.5 rounded-xl font-bold text-[11px] transition"
                                  title="Edit Product"
                                >
                                  <Edit className="h-3.5 w-3.5" />
                                  Edit
                                </Link>
                                <button
                                  onClick={() => handleDelete(p.id, p.name)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                                  title="Delete Product"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW 2: CARDS / GRID VIEW (Prompt Requirement 2) */}
            {viewMode === "cards" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((p) => {
                  const imageCount = p.images?.length || 0;
                  const frontImg =
                    p.images?.find((img) => img.image_type === "front") ||
                    p.images?.[0];
                  const thumbnailSrc = frontImg
                    ? frontImg.image_path.startsWith("http")
                      ? frontImg.image_path
                      : frontImg.image_path.startsWith("/uploads/") ||
                        frontImg.image_path.startsWith("uploads/")
                      ? `${API_BASE}${frontImg.image_path.startsWith('/') ? '' : '/'}${frontImg.image_path}`
                      : `${API_BASE}/api/v1/products/images/${frontImg.id}/file`
                    : null;

                  const isAIReady = p.indexing_status === "READY" || imageCount > 0;

                  return (
                    <div
                      key={p.id}
                      className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-col justify-between hover:shadow-md transition"
                    >
                      <div>
                        {/* Card Image */}
                        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-100 mb-4 flex items-center justify-center">
                          {thumbnailSrc ? (
                            <img
                              src={thumbnailSrc}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1 text-slate-400">
                              <Tag className="h-8 w-8 text-slate-300" />
                              <span className="text-[10px] font-bold">No Reference Photo</span>
                            </div>
                          )}

                          {/* Category Badge overlay */}
                          <div className="absolute top-2.5 left-2.5">
                            <span className="text-[10px] font-black uppercase tracking-wider bg-white/90 text-slate-800 backdrop-blur-xs px-2.5 py-1 rounded-full shadow-xs">
                              {p.category || "General"}
                            </span>
                          </div>

                          {/* Active Status Badge overlay (Prompt Requirement 2) */}
                          <div className="absolute top-2.5 right-2.5">
                            {isAIReady ? (
                              <span className="text-[10px] font-black bg-emerald-600 text-white px-2.5 py-1 rounded-full shadow-xs flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Active (AI Ready)
                              </span>
                            ) : (
                              <span className="text-[10px] font-black bg-slate-800 text-white px-2.5 py-1 rounded-full shadow-xs">
                                Active (Pending)
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title & Barcode */}
                        <h3 className="font-extrabold text-slate-900 text-sm hover:text-blue-600 transition truncate">
                          <Link href={`/products/${p.id}`}>{p.name}</Link>
                        </h3>
                        <div className="text-[11px] font-mono text-slate-500 mt-1 flex items-center gap-1">
                          <span className="text-slate-400 font-semibold">Barcode:</span>
                          <span className="font-bold text-slate-700">{p.barcode}</span>
                        </div>

                        {/* Price & Weight Row */}
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-slate-100 text-xs">
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Price</span>
                            <span className="text-sm font-black text-slate-900">₹{Number(p.price).toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">Weight</span>
                            <span className="font-bold text-slate-700">{Number(p.weight).toFixed(3)} kg</span>
                          </div>
                        </div>

                        {/* Number of reference images (Prompt Requirement 2) */}
                        <div className="mt-3 bg-slate-50 p-2.5 rounded-xl flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-semibold text-[11px]">Reference Images:</span>
                          <span
                            className={`font-black text-[11px] px-2 py-0.5 rounded-md ${
                              imageCount >= 5
                                ? "bg-emerald-100 text-emerald-800"
                                : imageCount > 0
                                ? "bg-blue-100 text-blue-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {imageCount} {imageCount === 1 ? "Image" : "Images"}
                          </span>
                        </div>
                      </div>

                      {/* Card Action Buttons (Prompt Requirement 2) */}
                      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                        <Link
                          href={`/products/${p.id}`}
                          className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs py-2 rounded-xl text-center transition flex items-center justify-center gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Details
                        </Link>
                        <Link
                          href={`/products/${p.id}/edit`}
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-xl transition"
                          title="Edit Product"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Link>
                        <button
                          onClick={() => handleDelete(p.id, p.name)}
                          className="bg-slate-100 hover:bg-red-50 text-slate-400 hover:text-red-600 p-2 rounded-xl transition cursor-pointer"
                          title="Delete Product"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
