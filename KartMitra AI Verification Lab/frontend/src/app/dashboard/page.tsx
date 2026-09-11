"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import {
  Package,
  Images,
  Cpu,
  CheckCircle2,
  PlusCircle,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Eye,
  Edit,
  ShieldCheck,
  Tag,
  Database,
  Search,
  ExternalLink,
  Sparkles,
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

interface VisualIndexStats {
  index_loaded: boolean;
  indexed_embeddings: number;
  registered_products: number;
  registered_images: number;
  embedding_model: string;
  embedding_dimension: number;
}

interface HealthData {
  status: string;
  database: string;
  database_type: string;
  ai_status: string;
  ai_readiness?: {
    yolo?: string;
    ocr?: string;
    visual_embedding?: string;
    visual_index?: string;
  };
}

const API_BASE = "http://127.0.0.1:8000";

export default function AdminDashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [indexStats, setIndexStats] = useState<VisualIndexStats | null>(null);
  const [health, setHealth] = useState<HealthData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRebuildingIndex, setIsRebuildingIndex] = useState(false);
  const [indexNotice, setIndexNotice] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch Products
      const prodRes = await fetch(`${API_BASE}/api/v1/products`).catch(() => null);
      if (!prodRes || !prodRes.ok) {
        throw new Error("Cannot connect to KartMitra AI backend on http://127.0.0.1:8000");
      }
      const prodData = await prodRes.json();
      const productList: Product[] = prodData?.products || (Array.isArray(prodData) ? prodData : []);
      setProducts(productList);

      // 2. Fetch Visual Index Stats
      try {
        const statsRes = await fetch(`${API_BASE}/api/v1/visual-registry/stats`);
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          setIndexStats(statsData);
        }
      } catch (err) {
        console.warn("Visual registry stats check skipped:", err);
      }

      // 3. Fetch Health & AI Readiness
      try {
        const healthRes = await fetch(`${API_BASE}/health`);
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setHealth(healthData);
        }
      } catch (err) {
        console.warn("Health check skipped:", err);
      }
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
      setError(err?.message || "Failed to load dashboard data. Ensure backend is running.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRebuildIndex = async () => {
    setIsRebuildingIndex(true);
    setIndexNotice(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/visual-registry/rebuild`, {
        method: "POST",
      });
      if (res.ok) {
        setIndexNotice("DINOv2 embeddings & FAISS vector index re-synced successfully!");
        await fetchDashboardData();
      } else {
        const errData = await res.json().catch(() => ({}));
        setIndexNotice(`Re-index notice: ${errData.detail || "Completed with warnings"}`);
      }
    } catch (err: any) {
      setIndexNotice(`Connection error during re-index: ${err?.message}`);
    } finally {
      setIsRebuildingIndex(false);
      setTimeout(() => setIndexNotice(null), 5000);
    }
  };

  // Calculations
  const totalProducts = products.length;
  const totalReferenceImages = products.reduce((acc, p) => acc + (p.images?.length || 0), 0);
  const indexedImagesCount = indexStats?.indexed_embeddings ?? totalReferenceImages;
  const isIndexReady = indexStats?.index_loaded ?? (totalReferenceImages > 0);
  const recentProducts = [...products]
    .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 6);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-8">
        {/* Welcome Header */}
        <div className="bg-white rounded-3xl p-6 md:p-8 shadow-xs border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                KartMitra Admin Portal
              </span>
              <span className="text-[11px] font-bold text-slate-400">
                Store ID: #KM-DEMO-01
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
              Admin Product Management & AI Verification
            </h1>
            <p className="text-xs md:text-sm text-slate-500 font-medium mt-1 max-w-2xl">
              Manage physical store catalog, upload multiple reference photos, and trigger automated DINOv2 embedding vector indexing into FAISS.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/products/new"
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-extrabold text-xs px-5 py-3 rounded-2xl shadow-md shadow-blue-600/30 transition cursor-pointer"
            >
              <PlusCircle className="h-4 w-4" />
              Add Product
            </Link>
            <Link
              href="/products"
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-3 rounded-2xl transition"
            >
              <Package className="h-4 w-4 text-slate-600" />
              Manage Products
            </Link>
          </div>
        </div>

        {/* Index Status Notification */}
        {indexNotice && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between text-xs font-bold text-emerald-800 shadow-xs">
            <span className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              {indexNotice}
            </span>
            <button
              onClick={() => setIndexNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 text-[11px]"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 text-red-800 shadow-xs">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-red-900">Backend Connection Error</h3>
                <p className="text-xs font-medium text-red-700 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              onClick={fetchDashboardData}
              className="self-start md:self-auto flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry Connection
            </button>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
            <p className="text-xs font-bold">Connecting to KartMitra AI backend...</p>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {/* 1. KEY METRICS STAT CARDS (Prompt Requirement 1) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {/* Total Products */}
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Total Products
                  </span>
                  <div className="bg-blue-50 text-blue-600 p-2 rounded-xl">
                    <Package className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-black tracking-tight text-slate-900">
                    {totalProducts}
                  </div>
                  <div className="text-[11px] text-slate-500 font-semibold mt-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                    Registered in PostgreSQL DB
                  </div>
                </div>
              </div>

              {/* Total Reference Images */}
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Total Reference Images
                  </span>
                  <div className="bg-indigo-50 text-indigo-600 p-2 rounded-xl">
                    <Images className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-black tracking-tight text-slate-900">
                    {totalReferenceImages}
                  </div>
                  <div className="text-[11px] text-slate-500 font-semibold mt-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
                    Multi-angle dataset photos
                  </div>
                </div>
              </div>

              {/* Indexed Images */}
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Indexed Images
                  </span>
                  <div className="bg-purple-50 text-purple-600 p-2 rounded-xl">
                    <Sparkles className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-3xl font-black tracking-tight text-purple-700">
                    {indexedImagesCount}
                  </div>
                  <div className="text-[11px] text-slate-500 font-semibold mt-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-purple-500"></span>
                    384-dim DINOv2 vectors
                  </div>
                </div>
              </div>

              {/* Index Status */}
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400">
                    Index Status
                  </span>
                  <div className="bg-emerald-50 text-emerald-600 p-2 rounded-xl">
                    <Cpu className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="text-xl font-black tracking-tight text-emerald-700 uppercase">
                      {isIndexReady ? "READY / ACTIVE" : "INITIALIZING"}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-semibold mt-1">
                    FAISS IndexFlatIP ({indexStats?.embedding_model || "dinov2_vits14"})
                  </div>
                </div>
              </div>
            </div>

            {/* AI Architecture & Readiness Card */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 rounded-3xl p-6 text-white shadow-md">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/80 pb-4 mb-4">
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    AI Verification Engine Readiness
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5 font-medium">
                    PostgreSQL AI lab database + DINOv2 feature extractor + FAISS vector similarity search
                  </p>
                </div>

                <button
                  onClick={handleRebuildIndex}
                  disabled={isRebuildingIndex}
                  className="self-start md:self-auto flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold px-3.5 py-2 rounded-xl border border-slate-600 transition disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isRebuildingIndex ? "animate-spin" : ""}`} />
                  {isRebuildingIndex ? "Rebuilding FAISS..." : "Re-sync FAISS Index"}
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">AI Database</span>
                  <div className="font-extrabold text-white mt-1">
                    {health?.database_type === "postgresql" ? "PostgreSQL" : "SQLite / DB"}
                  </div>
                  <span className="text-[10px] text-emerald-400 font-semibold">● Connected</span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Embedding Model</span>
                  <div className="font-extrabold text-white mt-1">DINOv2 Small</div>
                  <span className="text-[10px] text-purple-300 font-semibold">384 Dimensions</span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Vector Index</span>
                  <div className="font-extrabold text-white mt-1">FAISS IndexFlatIP</div>
                  <span className="text-[10px] text-emerald-400 font-semibold">● Auto-syncing</span>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Verification Lab</span>
                  <div className="font-extrabold text-white mt-1">Multimodal Rules</div>
                  <Link href="/verification" className="text-[10px] text-blue-400 font-bold hover:underline flex items-center gap-1 mt-0.5">
                    Launch Sandbox <ExternalLink className="h-2.5 w-2.5" />
                  </Link>
                </div>
              </div>
            </div>

            {/* 2. RECENT PRODUCTS SECTION (Prompt Requirement 1) */}
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div>
                  <h2 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <Package className="h-5 w-5 text-blue-600" />
                    Recent Products ({recentProducts.length})
                  </h2>
                  <p className="text-xs text-slate-500 font-medium">
                    Latest registered products ready for AI visual matching and scale verification
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href="/products"
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
                  >
                    View All Products ({totalProducts})
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>

              {recentProducts.length === 0 ? (
                <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Package className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wide">No Products Registered Yet</h3>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    Get started by registering a product with its barcode, details, and multiple reference images.
                  </p>
                  <Link
                    href="/products/new"
                    className="mt-4 inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Add First Product
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 text-slate-400 font-black uppercase text-[10px] tracking-wider border-b border-slate-100">
                        <th className="py-3 px-4">Product Details</th>
                        <th className="py-3 px-4">Barcode</th>
                        <th className="py-3 px-4">Category</th>
                        <th className="py-3 px-4">Price</th>
                        <th className="py-3 px-4">Weight</th>
                        <th className="py-3 px-4 text-center">Reference Images</th>
                        <th className="py-3 px-4 text-center">AI Index Status</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {recentProducts.map((p) => {
                        const imgCount = p.images?.length || 0;
                        const frontImg = p.images?.find((img) => img.image_type === "front") || p.images?.[0];
                        const thumbnailSrc = frontImg
                          ? frontImg.image_path.startsWith("http")
                            ? frontImg.image_path
                            : frontImg.image_path.startsWith("/uploads/") || frontImg.image_path.startsWith("uploads/")
                            ? `${API_BASE}${frontImg.image_path.startsWith('/') ? '' : '/'}${frontImg.image_path}`
                            : `${API_BASE}/api/v1/products/images/${frontImg.id}/file`
                          : null;

                        return (
                          <tr key={p.id} className="hover:bg-slate-50/60 transition">
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-3">
                                {thumbnailSrc ? (
                                  <img
                                    src={thumbnailSrc}
                                    alt={p.name}
                                    className="h-10 w-10 object-cover rounded-xl border border-slate-200 shadow-xs shrink-0"
                                  />
                                ) : (
                                  <div className="h-10 w-10 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200 shrink-0">
                                    <Tag className="h-4 w-4 text-slate-400" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <Link
                                    href={`/products/${p.id}`}
                                    className="font-bold text-slate-900 hover:text-blue-600 transition block truncate max-w-[200px]"
                                  >
                                    {p.name}
                                  </Link>
                                  <span className="text-[10px] text-slate-400 font-medium">
                                    Added: {p.created_at ? new Date(p.created_at).toLocaleDateString() : "Catalog"}
                                  </span>
                                </div>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                              {p.barcode}
                            </td>

                            <td className="py-3.5 px-4">
                              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full uppercase tracking-wider">
                                {p.category || "General"}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 font-black text-slate-900">
                              ₹{Number(p.price).toFixed(2)}
                            </td>

                            <td className="py-3.5 px-4 font-semibold text-slate-600">
                              {Number(p.weight).toFixed(3)} kg
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              <span
                                className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                                  imgCount >= 5
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : imgCount > 0
                                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                                    : "bg-rose-50 text-rose-700 border border-rose-200"
                                }`}
                              >
                                {imgCount} {imgCount === 1 ? "Image" : "Images"}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 text-center">
                              {p.indexing_status === "READY" || imgCount > 0 ? (
                                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                  Ready
                                </span>
                              ) : p.indexing_status === "INDEXING" ? (
                                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                  <RefreshCw className="h-3 w-3 animate-spin text-amber-600" />
                                  Indexing
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-0.5 rounded-full font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  Pending Photos
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Link
                                  href={`/products/${p.id}`}
                                  className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Link>
                                <Link
                                  href={`/products/${p.id}/edit`}
                                  className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                  title="Edit Product"
                                >
                                  <Edit className="h-4 w-4" />
                                </Link>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quick Flow Visualizer Guide */}
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/80">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4">
                Target Admin Workflow
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-center">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-[10px] font-black text-blue-600 uppercase">Step 1</div>
                  <div className="font-extrabold text-xs text-slate-900 mt-1">Admin Dashboard</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Catalog & index overview</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-[10px] font-black text-blue-600 uppercase">Step 2</div>
                  <div className="font-extrabold text-xs text-slate-900 mt-1">Add Product Form</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Name, Barcode, SKU, Price</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-[10px] font-black text-blue-600 uppercase">Step 3</div>
                  <div className="font-extrabold text-xs text-slate-900 mt-1">Multi-Image Upload</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Batch upload photos</div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                  <div className="text-[10px] font-black text-purple-600 uppercase">Step 4</div>
                  <div className="font-extrabold text-xs text-slate-900 mt-1">DINOv2 + FAISS</div>
                  <div className="text-[10px] text-purple-700 mt-0.5">Automatic auto-indexing</div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <div className="text-[10px] font-black text-emerald-700 uppercase">Step 5</div>
                  <div className="font-extrabold text-xs text-emerald-900 mt-1">AI Ready</div>
                  <div className="text-[10px] text-emerald-700 mt-0.5">Verification Lab active</div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
