"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import { Plus, Search, Eye, Edit, Trash2, Tag, RefreshCw, AlertTriangle, Layers, DollarSign, Weight, CheckCircle2, AlertCircle } from "lucide-react";

interface ProductImage {
  id: number;
  product_id: number;
  image_path: string;
  image_type: string;
  created_at: string;
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
      // Support both wrapped response { success, products } and raw list
      if (data && data.success && Array.isArray(data.products)) {
        setProducts(data.products);
      } else if (Array.isArray(data)) {
        setProducts(data);
      } else {
        setProducts([]);
      }
    } catch (err) {
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
    if (!confirm(`Are you sure you want to delete the product "${name}"? This will physically delete all associated training images.`)) {
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

  // Filter products based on search term (name, barcode, category)
  const filteredProducts = products.filter((p) => {
    const term = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      p.barcode.toLowerCase().includes(term) ||
      (p.category && p.category.toLowerCase().includes(term))
    );
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navigation />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Page Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Layers className="h-6 w-6 text-blue-600" />
              Products Database
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Manage product registry and dataset images for the AI verification system
            </p>
          </div>

          <Link
            href="/products/new"
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm self-start md:self-auto"
          >
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        </header>

        {/* Search Bar */}
        <div className="relative">
          <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-400" />
          </span>
          <input
            type="text"
            placeholder="Search by name, barcode, or category..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none shadow-sm transition-all"
          />
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-bold text-red-800">Connection Error</h4>
              <p className="text-xs text-red-700 mt-1">{error}</p>
              <button
                onClick={fetchProducts}
                className="mt-3 flex items-center gap-1.5 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1.5 rounded-lg text-xs font-bold transition"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && !error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
            <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
            <p className="text-xs font-semibold">Loading products database...</p>
          </div>
        )}

        {/* Table / Empty State */}
        {!isLoading && !error && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-16 px-4 flex flex-col items-center gap-2">
                <Tag className="h-12 w-12 text-gray-300" />
                <h3 className="text-sm font-bold text-gray-700">No products found</h3>
                <p className="text-xs text-gray-400 max-w-sm">
                  {searchTerm
                    ? "Try adjusting your search query or filters to find what you are looking for."
                    : "Get started by registering a new product barcode and uploading training images."}
                </p>
                {!searchTerm && (
                  <Link
                    href="/products/new"
                    className="mt-3 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition"
                  >
                    Register First Product
                  </Link>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-4 px-6">Product Details</th>
                      <th className="py-4 px-4">Barcode</th>
                      <th className="py-4 px-4">Price</th>
                      <th className="py-4 px-4">Weight</th>
                      <th className="py-4 px-4 text-center">Dataset Images</th>
                      <th className="py-4 px-4 text-center">AI Visual Index</th>
                      <th className="py-4 px-6 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 text-sm">
                    {filteredProducts.map((p) => {
                      const imageCount = p.images?.length || 0;
                      const frontImg = p.images?.find((img) => img.image_type === "front") || p.images?.[0];
                      const thumbnailSrc = frontImg ? (
                        frontImg.image_path.startsWith("http")
                          ? frontImg.image_path
                          : frontImg.image_path.startsWith("/uploads/") || frontImg.image_path.startsWith("uploads/")
                          ? `${API_BASE}${frontImg.image_path.startsWith('/') ? '' : '/'}${frontImg.image_path}`
                          : `${API_BASE}/api/v1/products/images/${frontImg.id}/file`
                      ) : null;

                      return (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition">
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              {thumbnailSrc ? (
                                <img
                                  src={thumbnailSrc}
                                  alt={p.name}
                                  className="h-10 w-10 object-cover rounded-lg border border-gray-200 shadow-xs"
                                />
                              ) : (
                                <div className="h-10 w-10 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200">
                                  <Tag className="h-4 w-4 text-gray-400" />
                                </div>
                              )}

                              <div>
                                <span className="font-bold text-gray-800 hover:text-blue-600 block transition">
                                  <Link href={`/products/${p.id}`}>{p.name}</Link>
                                </span>
                                <span className="text-[10px] bg-gray-100 text-gray-600 font-bold px-2 py-0.5 rounded-full mt-1 inline-block uppercase">
                                  {p.category || "Uncategorized"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 font-mono text-xs text-gray-600">
                            {p.barcode}
                          </td>
                          <td className="py-4 px-4 font-bold text-gray-700">
                            ₹{Number(p.price).toFixed(2)}
                          </td>
                          <td className="py-4 px-4 text-xs font-semibold text-gray-500">
                            {Number(p.weight).toFixed(3)} kg
                          </td>
                          <td className="py-4 px-4 text-center">
                            <span
                              className={`text-xs px-2.5 py-1 rounded-full font-black tracking-wide ${
                                imageCount < 5
                                  ? "bg-red-50 text-red-700 border border-red-150"
                                  : "bg-green-50 text-green-700 border border-green-150"
                              }`}
                            >
                              {imageCount} / 5 Images
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {p.indexing_status === "READY" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                                AI Ready
                              </span>
                            ) : p.indexing_status === "INDEXING" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <RefreshCw className="h-3 w-3 animate-spin text-amber-600" />
                                Indexing
                              </span>
                            ) : p.indexing_status === "FAILED" ? (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-bold bg-rose-50 text-rose-700 border border-rose-200" title={p.indexing_error || "Indexing failed"}>
                                <AlertCircle className="h-3 w-3 text-rose-600" />
                                Failed
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full font-bold bg-gray-100 text-gray-600 border border-gray-200">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-6 text-right">
                            <div className="flex justify-end gap-2">
                              <Link
                                href={`/products/${p.id}`}
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                              <Link
                                href={`/products/${p.id}/edit`}
                                className="p-2 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                title="Edit Product"
                              >
                                <Edit className="h-4 w-4" />
                              </Link>
                              <button
                                onClick={() => handleDelete(p.id, p.name)}
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Delete Product"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
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
        )}
      </main>
    </div>
  );
}
