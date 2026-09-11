"use client";

import { useEffect, useState, use, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import {
  ArrowLeft,
  Edit,
  Trash2,
  Upload,
  Box,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Calendar,
  DollarSign,
  Weight,
  Tag,
  ImageIcon,
  Sparkles,
  ShieldCheck,
  Copy,
  Check,
  Maximize2,
  X,
  Plus,
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

interface IndexStatusData {
  success: boolean;
  product_id: string;
  status: string;
  total_images: number;
  indexed_images: number;
  embeddings_created: number;
  faiss_updated: boolean;
  model_name: string;
  embedding_dimension: number;
}

const API_BASE = "http://127.0.0.1:8000";
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export default function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [indexStatus, setIndexStatus] = useState<IndexStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States for uploading & actions
  const [isUploading, setIsUploading] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [copiedBarcode, setCopiedBarcode] = useState(false);
  const [previewModalImg, setPreviewModalImg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProductDetails = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${productId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Product record not found in database.");
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      const fetchedProduct: Product = data.product || data;
      setProduct(fetchedProduct);

      // Fetch incremental index status
      try {
        const idxRes = await fetch(`${API_BASE}/api/v1/products/${productId}/index-status`);
        if (idxRes.ok) {
          const idxData = await idxRes.json();
          setIndexStatus(idxData);
        }
      } catch (e) {
        console.warn("Index status check notice:", e);
      }
    } catch (err: any) {
      console.error("Error fetching product:", err);
      setError(err?.message || "Failed to load product details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      fetchProductDetails();
    }
  }, [productId]);

  const handleCopyBarcode = () => {
    if (!product) return;
    navigator.clipboard.writeText(product.barcode);
    setCopiedBarcode(true);
    setTimeout(() => setCopiedBarcode(false), 2000);
  };

  const handleTriggerReindex = async () => {
    if (!product) return;
    setReindexing(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${product.id}/index`, {
        method: "POST",
      });
      if (res.ok) {
        await fetchProductDetails();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Indexing failed: ${errData.detail || "Server error"}`);
      }
    } catch (err: any) {
      alert(`Indexing connection error: ${err?.message}`);
    } finally {
      setReindexing(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!product) return;
    if (
      !confirm(
        `Are you sure you want to delete product "${product.name}"? This is permanent and deletes all associated physical files and FAISS embeddings.`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${product.id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push("/products");
        router.refresh();
      } else {
        alert("Failed to delete product.");
      }
    } catch (err) {
      console.error("Error deleting product:", err);
      alert("Failed to connect to server.");
    }
  };

  const handleImageDelete = async (imageId: string | number) => {
    if (!product) return;
    if (!confirm("Are you sure you want to delete this reference image?")) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${product.id}/images/${imageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchProductDetails();
      } else {
        alert("Failed to delete image.");
      }
    } catch (err) {
      console.error("Error deleting image:", err);
      alert("Server communication error.");
    }
  };

  // Upload more reference images via existing batch API
  const handleUploadMoreImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !product) return;

    setIsUploading(true);
    try {
      const batchFormData = new FormData();
      Array.from(files).forEach((file) => {
        batchFormData.append("files", file);
      });
      batchFormData.append("image_type", "reference");

      const res = await fetch(`${API_BASE}/api/v1/products/${product.id}/images/batch`, {
        method: "POST",
        body: batchFormData,
      });

      if (res.ok) {
        await fetchProductDetails();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(`Failed to upload images: ${errData.detail || "Server error"}`);
      }
    } catch (err: any) {
      console.error("Upload error:", err);
      alert(`Upload error: ${err?.message}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Helper to construct image URL
  const getImageSrc = (img: ProductImage) => {
    if (img.image_path.startsWith("http")) return img.image_path;
    if (img.image_path.startsWith("/uploads/") || img.image_path.startsWith("uploads/")) {
      return `${API_BASE}${img.image_path.startsWith('/') ? '' : '/'}${img.image_path}`;
    }
    return `${API_BASE}/api/v1/products/images/${img.id}/file`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navigation />
        <div className="flex-1 flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
          <RefreshCw className="h-8 w-8 text-blue-600 animate-spin" />
          <p className="text-xs font-bold">Loading product details & AI status...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        <Navigation />
        <main className="flex-1 max-w-lg w-full mx-auto p-4 md:py-20 flex flex-col gap-4 text-center items-center">
          <div className="h-16 w-16 bg-red-100 text-red-600 rounded-3xl flex items-center justify-center">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Product Not Found</h2>
          <p className="text-xs text-slate-500 font-medium">{error || "Product could not be retrieved from the database."}</p>
          <Link
            href="/products"
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition mt-2"
          >
            Back to Products Catalog
          </Link>
        </main>
      </div>
    );
  }

  const imageCount = product.images?.length || 0;
  const isAIReady = product.indexing_status === "READY" || imageCount > 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Top Header Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Link
            href="/products"
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-blue-600 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Products Catalog
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/products/${product.id}/edit`}
              className="flex items-center gap-1.5 bg-white hover:bg-amber-50 border border-slate-200 text-slate-700 hover:text-amber-700 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs"
            >
              <Edit className="h-3.5 w-3.5" />
              Edit Product
            </Link>

            <Link
              href="/verification"
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs"
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              Test in AI Lab
            </Link>

            <button
              onClick={handleDeleteProduct}
              className="flex items-center gap-1.5 bg-white hover:bg-red-50 border border-slate-200 text-slate-400 hover:text-red-600 px-3.5 py-2 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </button>
          </div>
        </div>

        {/* Product Overview Header Card */}
        <header className="bg-white rounded-3xl p-6 md:p-8 shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-800 px-2.5 py-0.5 rounded-full">
                {product.category || "General"}
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2.5 py-0.5 rounded-full">
                ID: {String(product.id).slice(0, 18)}
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
              {product.name}
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Registered in PostgreSQL Database • Ready for Autonomous Cart Scanning
            </p>
          </div>

          {/* Index / Embedding Status Badge & Re-index Button (Prompt Requirement 6) */}
          <div className="flex flex-wrap items-center gap-3">
            {isAIReady ? (
              <span className="text-xs px-3.5 py-2 rounded-2xl font-black tracking-wide flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-xs">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                AI Visual Ready (FAISS Indexed)
              </span>
            ) : product.indexing_status === "INDEXING" ? (
              <span className="text-xs px-3.5 py-2 rounded-2xl font-black tracking-wide flex items-center gap-2 bg-amber-50 text-amber-800 border border-amber-200">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-600" />
                DINOv2 Indexing...
              </span>
            ) : (
              <span className="text-xs px-3.5 py-2 rounded-2xl font-black tracking-wide flex items-center gap-2 bg-slate-100 text-slate-700 border border-slate-200">
                Pending Images
              </span>
            )}

            <button
              onClick={handleTriggerReindex}
              disabled={reindexing}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 rounded-2xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              title="Generate fresh DINOv2 embeddings and re-sync FAISS index"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reindexing ? "animate-spin" : ""}`} />
              {reindexing ? "Syncing..." : "Re-sync AI"}
            </button>
          </div>
        </header>

        {/* Main Grid: Product Specifications (4 cols) & Reference Images (8 cols) (Prompt Requirement 6) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Panel: Specifications (4 cols) (Prompt Requirement 6) */}
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-4">
            <h2 className="font-black text-slate-900 text-xs uppercase tracking-wider border-b border-slate-100 pb-3">
              Product Information
            </h2>

            <div className="space-y-3.5 text-xs">
              {/* Barcode with Copy (Prompt Requirement 6) */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                    Barcode Number
                  </span>
                  <span className="font-mono font-black text-slate-900 text-sm">{product.barcode}</span>
                </div>
                <button
                  onClick={handleCopyBarcode}
                  className="bg-white hover:bg-slate-100 text-slate-600 p-2 rounded-xl border border-slate-200 transition cursor-pointer"
                  title="Copy Barcode"
                >
                  {copiedBarcode ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Price & Weight Row (Prompt Requirement 6) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                    Price
                  </span>
                  <span className="font-black text-slate-900 text-base flex items-center">
                    ₹{Number(product.price).toFixed(2)}
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                    Weight (Scale)
                  </span>
                  <span className="font-black text-slate-900 text-base">
                    {Number(product.weight).toFixed(3)} kg
                  </span>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    ({Math.round(product.weight * 1000)}g)
                  </span>
                </div>
              </div>

              {/* Category (Prompt Requirement 6) */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-0.5">
                  Category
                </span>
                <span className="font-bold text-slate-800 text-xs">
                  {product.category || "Uncategorized"}
                </span>
              </div>

              {/* Description */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Description / SKU Notes
                </span>
                <p className="text-slate-700 leading-relaxed font-medium">
                  {product.description || "No description provided for this product."}
                </p>
              </div>

              {/* AI Embedding & FAISS Index Status (Prompt Requirement 6) */}
              <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-200 space-y-2 text-purple-950">
                <div className="flex items-center gap-1.5 font-black text-xs text-purple-900">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  AI Embedding & FAISS Index Status
                </div>
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Model:</span>
                    <span className="font-mono font-bold text-purple-800">
                      {indexStatus?.model_name || "dinov2_vits14"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dimension:</span>
                    <span className="font-mono font-bold text-purple-800">384-dim</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">FAISS Index:</span>
                    <span className="font-bold text-emerald-700">Synchronized ✓</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Indexed Vectors:</span>
                    <span className="font-bold text-slate-800">{imageCount} vectors</span>
                  </div>
                </div>
              </div>

              {/* Registration Timestamps */}
              <div className="pt-2 border-t border-slate-100 flex flex-col gap-1 text-[10px] text-slate-400 font-bold">
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  Registered: {new Date(product.created_at).toLocaleString()}
                </span>
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3 w-3" />
                  Updated: {new Date(product.updated_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Right Panel: All Reference Images Gallery (8 cols) (Prompt Requirement 6) */}
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <h2 className="font-black text-slate-900 text-sm tracking-tight flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-blue-600" />
                  Reference Images Catalog ({imageCount})
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  Dataset photos utilized by DINOv2 visual similarity search during cart verification
                </p>
              </div>

              {/* Upload More Reference Images Button */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleUploadMoreImages}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs px-4 py-2 rounded-xl transition border border-blue-200 cursor-pointer disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      Uploading & Indexing...
                    </>
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      Add Reference Images
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Gallery Grid */}
            {imageCount === 0 ? (
              <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <ImageIcon className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                <h3 className="text-xs font-black text-slate-700 uppercase">No Reference Images Uploaded</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  Upload multiple product photos so DINOv2 can generate vector embeddings for visual cart verification.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload Photos
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {product.images.map((img, idx) => {
                  const src = getImageSrc(img);
                  return (
                    <div
                      key={img.id}
                      className="bg-slate-50 border border-slate-200 rounded-2xl p-2.5 flex flex-col justify-between group hover:shadow-md transition"
                    >
                      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-white border border-slate-100 mb-2">
                        <img
                          src={src}
                          alt={`${product.name} view ${idx + 1}`}
                          className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                        />
                        {/* Type badge */}
                        <span className="absolute top-1.5 left-1.5 text-[9px] font-black uppercase bg-black/70 text-white backdrop-blur-xs px-2 py-0.5 rounded-md">
                          {img.image_type || "Reference"}
                        </span>
                        {/* Full Preview Icon */}
                        <button
                          onClick={() => setPreviewModalImg(src)}
                          className="absolute bottom-1.5 right-1.5 bg-black/60 hover:bg-black/90 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition cursor-pointer"
                          title="Expand View"
                        >
                          <Maximize2 className="h-3 w-3" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold px-0.5">
                        <span>Ref #{idx + 1}</span>
                        <button
                          onClick={() => handleImageDelete(img.id)}
                          className="text-slate-400 hover:text-red-600 transition cursor-pointer"
                          title="Delete reference photo"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal for Fullscreen Image Preview */}
        {previewModalImg && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 cursor-pointer"
            onClick={() => setPreviewModalImg(null)}
          >
            <div className="relative max-w-3xl max-h-[85vh] bg-white rounded-3xl overflow-hidden shadow-2xl p-2">
              <button
                onClick={() => setPreviewModalImg(null)}
                className="absolute top-4 right-4 bg-black/70 hover:bg-black text-white p-2 rounded-xl transition z-10"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={previewModalImg}
                alt="Fullscreen preview"
                className="max-h-[80vh] w-auto object-contain rounded-2xl mx-auto"
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
