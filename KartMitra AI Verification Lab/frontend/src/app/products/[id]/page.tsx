"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import { ArrowLeft, Edit, Trash2, Upload, Box, CheckCircle2, AlertTriangle, RefreshCw, Layers, Calendar, DollarSign, Weight, Tag, ImageIcon } from "lucide-react";

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
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const IMAGE_TYPES = [
  { id: "front", label: "Front Image", desc: "Front side showing primary branding" },
  { id: "back", label: "Back Image", desc: "Rear side containing details/nutrition info" },
  { id: "side", label: "Side Image", desc: "Left or right profile of the product" },
  { id: "angled", label: "Angled Image", desc: "Three-quarter / isometric perspective" },
];

export default function ProductDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // States for uploading/actions
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  const [reindexing, setReindexing] = useState(false);

  const handleTriggerReindex = async () => {
    if (!product) return;
    setReindexing(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${product.id}/index`, {
        method: "POST"
      });
      if (res.ok) {
        await fetchProduct();
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

  const fetchProduct = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${productId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("Product not found.");
        }
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      // Support wrapped or raw product
      const fetchedProduct = data.product || data;
      setProduct(fetchedProduct);
    } catch (err: any) {
      console.error("Error fetching product:", err);
      setError(err.message || "Failed to load product details.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  const handleDeleteProduct = async () => {
    if (!product) return;
    if (!confirm(`Are you sure you want to delete the product "${product.name}"? This is permanent and deletes all associated image files.`)) {
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

  const handleImageDelete = async (imageId: number) => {
    if (!product) return;
    if (!confirm("Are you sure you want to delete this training image?")) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${product.id}/images/${imageId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        // Refresh product details
        fetchProduct();
      } else {
        alert("Failed to delete image.");
      }
    } catch (err) {
      console.error("Error deleting image:", err);
      alert("Server communication error.");
    }
  };

  const handleImageUpload = async (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !product) return;

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      alert(`File is too large. Max size allowed is 5MB.`);
      return;
    }

    // Validate format
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      alert(`Unsupported file format. Supported formats: ${ALLOWED_EXTENSIONS.join(", ")}`);
      return;
    }

    setUploadingType(type);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("image_type", type);

      const res = await fetch(`${API_BASE}/api/v1/products/${product.id}/images`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (res.ok && data.success !== false) {
        fetchProduct();
      } else {
        alert(data.error || data.detail || "Failed to upload image.");
      }
    } catch (err) {
      console.error("Error uploading image:", err);
      alert("Failed to communicate with upload API.");
    } finally {
      setUploadingType(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <Navigation />
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-xs font-semibold">Loading product registry...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <Navigation />
        <main className="flex-1 max-w-lg w-full mx-auto p-4 md:py-16 flex flex-col gap-4 text-center items-center">
          <AlertTriangle className="h-12 w-12 text-red-500" />
          <h3 className="text-base font-bold text-gray-800">Error Loading Details</h3>
          <p className="text-xs text-gray-500">{error || "Product could not be retrieved."}</p>
          <Link href="/products" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition mt-2">
            Back to Products
          </Link>
        </main>
      </div>
    );
  }

  // Count existing images
  const imageCount = product.images?.length || 0;
  const isDatasetIncomplete = imageCount < 5;

  // Filter additional images
  const additionalImages = product.images?.filter(
    (img) => !["front", "back", "side", "angled"].includes(img.image_type)
  ) || [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navigation />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Navigation link */}
        <div className="flex justify-between items-center">
          <Link
            href="/products"
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Products list
          </Link>
          <div className="flex gap-2">
            <Link
              href={`/products/${product.id}/edit`}
              className="flex items-center gap-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 px-3 py-1.5 rounded-lg text-xs font-bold transition"
            >
              <Edit className="h-3.5 w-3.5" />
              Edit Details
            </Link>
            <button
              onClick={handleDeleteProduct}
              className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-800 px-3 py-1.5 rounded-lg text-xs font-bold transition"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Product
            </button>
          </div>
        </div>

        {/* Header */}
        <header className="border-b pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              {product.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-[10px] bg-blue-100 text-blue-800 font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {product.category || "Uncategorized"}
              </span>
              <span className="text-[10px] bg-mono text-gray-500 font-mono px-2.5 py-0.5 rounded-full border">
                ID: {product.id}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* AI Visual Index Badge */}
            {product.indexing_status === "READY" ? (
              <span className="text-xs px-3 py-1.5 rounded-full font-black tracking-wide flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                AI Visual Ready
              </span>
            ) : product.indexing_status === "INDEXING" ? (
              <span className="text-xs px-3 py-1.5 rounded-full font-black tracking-wide flex items-center gap-1.5 bg-amber-50 text-amber-800 border border-amber-200">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-amber-600" />
                Indexing DINOv2...
              </span>
            ) : product.indexing_status === "FAILED" ? (
              <span className="text-xs px-3 py-1.5 rounded-full font-black tracking-wide flex items-center gap-1.5 bg-rose-50 text-rose-800 border border-rose-200" title={product.indexing_error || ""}>
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                Indexing Failed
              </span>
            ) : (
              <span className="text-xs px-3 py-1.5 rounded-full font-black tracking-wide flex items-center gap-1.5 bg-gray-100 text-gray-700 border border-gray-200">
                Pending Images
              </span>
            )}

            <button
              onClick={handleTriggerReindex}
              disabled={reindexing}
              className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold transition disabled:opacity-50"
              title="Generate fresh DINOv2 embeddings and sync with FAISS index"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${reindexing ? "animate-spin" : ""}`} />
              {reindexing ? "Indexing..." : "Re-index AI"}
            </button>

            <span
              className={`text-xs px-3 py-1.5 rounded-full font-black tracking-wide flex items-center gap-1.5 ${
                isDatasetIncomplete
                  ? "bg-red-100 text-red-800 border border-red-200"
                  : "bg-green-100 text-green-800 border border-green-200"
              }`}
            >
              {isDatasetIncomplete ? (
                <>
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Dataset ({imageCount} / 5)
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  Dataset ({imageCount} Images)
                </>
              )}
            </span>
          </div>
        </header>

        {/* Main Grid: Details (Left 4 cols) & Gallery (Right 8 cols) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Details (Left Panel) */}
          <div className="lg:col-span-4 bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <h3 className="font-bold text-gray-800 text-sm border-b pb-2 uppercase tracking-wide">
              Product Specifications
            </h3>

            <div className="flex flex-col gap-3 text-xs">
              <div>
                <span className="text-gray-400 font-semibold uppercase block mb-1">Barcode</span>
                <span className="font-mono font-bold text-gray-800 text-sm">{product.barcode}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-3 border-t pt-3 border-gray-100">
                <div>
                  <span className="text-gray-400 font-semibold uppercase block mb-1">Price</span>
                  <span className="font-bold text-gray-800 text-sm flex items-center">
                    <DollarSign className="h-3.5 w-3.5 text-gray-500" />
                    ₹{Number(product.price).toFixed(2)}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400 font-semibold uppercase block mb-1">Weight</span>
                  <span className="font-bold text-gray-800 text-sm flex items-center">
                    <Weight className="h-3.5 w-3.5 text-gray-500" />
                    {Number(product.weight).toFixed(3)} kg
                  </span>
                </div>
              </div>

              <div className="border-t pt-3 border-gray-100">
                <span className="text-gray-400 font-semibold uppercase block mb-1">Description</span>
                <p className="text-gray-700 leading-relaxed bg-gray-50 p-2.5 rounded-lg border border-gray-150 font-medium">
                  {product.description || "No description provided for this product."}
                </p>
              </div>

              <div className="border-t pt-3 border-gray-100 flex flex-col gap-1 text-[10px] text-gray-400 font-bold">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Registered: {new Date(product.created_at).toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <RefreshCw className="h-3 w-3" />
                  Last Updated: {new Date(product.updated_at).toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Dataset Gallery (Right Panel) */}
          <div className="lg:col-span-8 bg-white border border-gray-200 rounded-xl p-5 shadow-sm flex flex-col gap-4">
            <h3 className="font-bold text-gray-800 text-sm border-b pb-2 uppercase tracking-wide">
              Dataset Image Catalog
            </h3>

            {/* Standard image types grid (4 boxes) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {IMAGE_TYPES.map((type) => {
                const img = product.images?.find((i) => i.image_type === type.id);

                return (
                  <div
                    key={type.id}
                    className="border border-gray-100 rounded-xl bg-gray-50/50 p-3.5 flex flex-col gap-3 min-h-[180px] justify-between relative"
                  >
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-800">{type.label}</span>
                        {img && (
                          <button
                            onClick={() => handleImageDelete(img.id)}
                            className="bg-red-50 hover:bg-red-100 border border-red-150 text-red-700 rounded-lg p-1.5 transition"
                            title="Delete image"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-[9px] text-gray-400 font-semibold">{type.desc}</p>
                    </div>

                    {img ? (
                      <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-white mt-2">
                        <img
                          src={
                            img.image_path.startsWith("http")
                              ? img.image_path
                              : img.image_path.startsWith("/uploads/") || img.image_path.startsWith("uploads/")
                              ? `${API_BASE}${img.image_path.startsWith('/') ? '' : '/'}${img.image_path}`
                              : `${API_BASE}/api/v1/products/images/${img.id}/file`
                          }
                          alt={type.label}
                          className="h-full w-full object-cover"
                        />

                      </div>
                    ) : (
                      <div className="border border-dashed border-gray-300 hover:border-blue-500 rounded-lg aspect-video w-full flex flex-col items-center justify-center bg-white cursor-pointer relative transition mt-2">
                        {uploadingType === type.id ? (
                          <div className="flex flex-col items-center gap-1 text-gray-500">
                            <RefreshCw className="h-6 w-6 text-blue-500 animate-spin" />
                            <span className="text-[10px] font-bold">Uploading...</span>
                          </div>
                        ) : (
                          <>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => handleImageUpload(type.id, e)}
                              className="absolute inset-0 opacity-0 cursor-pointer"
                            />
                            <Upload className="h-6 w-6 text-gray-400" />
                            <span className="text-[10px] text-gray-400 font-bold mt-1">Upload Photo</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Additional images section */}
            <div className="border-t pt-4 mt-2">
              <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-1.5">
                  <ImageIcon className="h-4.5 w-4.5 text-gray-500" />
                  <span className="text-xs font-bold text-gray-800">Additional Dataset Images</span>
                </div>
                <div className="relative bg-blue-50 hover:bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition border border-blue-200">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload("additional", e)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className="h-3 w-3" />
                  Add Photo
                </div>
              </div>

              {additionalImages.length === 0 ? (
                <div className="text-center py-6 px-4 bg-gray-50 border border-dashed rounded-xl text-[10px] text-gray-400 font-semibold">
                  No additional dataset images registered.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {additionalImages.map((img) => (
                    <div
                      key={img.id}
                      className="border border-gray-150 bg-white rounded-lg p-2 flex flex-col gap-2 relative group"
                    >
                      <div className="relative aspect-square w-full rounded-md overflow-hidden border">
                        <img
                          src={
                            img.image_path.startsWith("http")
                              ? img.image_path
                              : img.image_path.startsWith("/uploads/") || img.image_path.startsWith("uploads/")
                              ? `${API_BASE}${img.image_path.startsWith('/') ? '' : '/'}${img.image_path}`
                              : `${API_BASE}/api/v1/products/images/${img.id}/file`
                          }
                          alt="Additional product view"
                          className="h-full w-full object-cover"
                        />

                      </div>
                      <div className="flex justify-between items-center text-[9px] text-gray-400 font-semibold px-0.5">
                        <span>Image ID: {img.id}</span>
                        <button
                          onClick={() => handleImageDelete(img.id)}
                          className="text-red-500 hover:text-red-700 transition"
                          title="Delete image"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
