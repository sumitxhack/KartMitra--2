"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import { ArrowLeft, Save, AlertCircle, RefreshCw, Box } from "lucide-react";

const API_BASE = "http://127.0.0.1:8000";

interface ProductImage {
  id: string | number;
  product_id: string | number;
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
  created_at: string;
  updated_at: string;
  images: ProductImage[];
}

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  // Product form states
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [weight, setWeight] = useState("");
  const [category, setCategory] = useState("Beverages");
  const [description, setDescription] = useState("");

  const [originalBarcode, setOriginalBarcode] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Barcode verification status
  const [barcodeValidating, setBarcodeValidating] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  const fetchProduct = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${productId}`);
      if (!res.ok) {
        throw new Error("Failed to retrieve product details.");
      }
      const data = await res.json();
      const product: Product = data.product || data;
      
      setBarcode(product.barcode);
      setOriginalBarcode(product.barcode);
      setName(product.name);
      setPrice(String(product.price));
      setWeight(String(product.weight));
      setCategory(product.category || "Beverages");
      setDescription(product.description || "");
    } catch (err: any) {
      console.error("Error loading product:", err);
      setLoadError(err.message || "Failed to load product for editing.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  // Verify barcode uniqueness if changed
  const handleBarcodeBlur = async () => {
    const trimmed = barcode.trim();
    if (!trimmed || trimmed === originalBarcode) return;

    setBarcodeValidating(true);
    setBarcodeError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/products/barcode/${trimmed}`);
      if (res.ok) {
        setBarcodeError("This barcode is already registered in the system.");
      }
    } catch (err) {
      console.error("Error verifying barcode:", err);
    } finally {
      setBarcodeValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    // Initial validations
    if (!barcode.trim() || !name.trim() || !price || !weight) {
      setSubmitError("Please fill in all required fields.");
      return;
    }

    if (barcodeError) {
      setSubmitError("Please resolve the duplicate barcode error.");
      return;
    }

    const priceVal = parseFloat(price);
    const weightVal = parseFloat(weight);

    if (isNaN(priceVal) || priceVal <= 0) {
      setSubmitError("Price must be a positive number.");
      return;
    }

    if (isNaN(weightVal) || weightVal <= 0) {
      setSubmitError("Weight must be a positive number.");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: barcode.trim(),
          name: name.trim(),
          price: priceVal,
          weight: weightVal,
          category: category.trim(),
          description: description.trim() || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || "Failed to update product details.");
      }

      router.push(`/products/${productId}`);
      router.refresh();
    } catch (err: any) {
      console.error("Update error:", err);
      setSubmitError(err.message || "Failed to update product.");
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <Navigation />
        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
          <RefreshCw className="h-8 w-8 text-blue-500 animate-spin" />
          <p className="text-xs font-semibold">Loading product details...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
        <Navigation />
        <main className="flex-1 max-w-lg w-full mx-auto p-4 md:py-16 flex flex-col gap-4 text-center items-center">
          <AlertCircle className="h-12 w-12 text-red-500" />
          <h3 className="text-base font-bold text-gray-800">Error Loading Product</h3>
          <p className="text-xs text-gray-500">{loadError}</p>
          <Link href="/products" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold transition mt-2">
            Back to Products
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navigation />

      <main className="flex-1 max-w-lg w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Navigation link */}
        <div>
          <Link
            href={`/products/${productId}`}
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Product Details
          </Link>
        </div>

        {/* Header */}
        <header className="border-b pb-4">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Box className="h-6 w-6 text-blue-600" />
            Edit Product details
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Modify product details in the registry
          </p>
        </header>

        {/* Submit Alerts */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center gap-2 text-xs font-bold text-red-800">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col gap-4">
          {/* Barcode */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">
              Barcode Number <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="e.g. 8901030704901"
                value={barcode}
                onChange={(e) => {
                  setBarcode(e.target.value);
                  setBarcodeError(null);
                }}
                onBlur={handleBarcodeBlur}
                className={`w-full bg-gray-50 border ${
                  barcodeError ? "border-red-300" : "border-gray-200"
                } rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none transition`}
              />
              {barcodeValidating && (
                <span className="absolute right-3.5 top-3 flex items-center pointer-events-none">
                  <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                </span>
              )}
            </div>
            {barcodeError && (
              <span className="text-[10px] text-red-600 font-bold mt-1 block">
                {barcodeError}
              </span>
            )}
          </div>

          {/* Product Name */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">
              Product Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Coca-Cola Original Taste 250ml"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
            />
          </div>

          {/* Price & Weight Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">
                Price (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 20.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">
                Weight (kg) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.001"
                required
                placeholder="e.g. 0.280"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
              />
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
            >
              <option value="Beverages">Beverages</option>
              <option value="Snacks & Chips">Snacks & Chips</option>
              <option value="Chocolates & Sweets">Chocolates & Sweets</option>
              <option value="Instant Foods">Instant Foods</option>
              <option value="Dairy & Bakery">Dairy & Bakery</option>
              <option value="Personal Care">Personal Care</option>
              <option value="Household Supplies">Household Supplies</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="Describe package characteristics, packaging type, color..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3.5 py-2.5 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none transition resize-none"
            />
          </div>

          {/* Save Buttons */}
          <div className="border-t pt-4 flex gap-3.5 justify-end">
            <Link
              href={`/products/${productId}`}
              className="bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2.5 rounded-lg text-xs font-bold transition"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition flex items-center gap-2 shadow-md"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
