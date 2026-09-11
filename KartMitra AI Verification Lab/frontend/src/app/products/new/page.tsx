"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import { ArrowLeft, Save, Upload, AlertCircle, CheckCircle2, RefreshCw, X, Box } from "lucide-react";

const API_BASE = "http://127.0.0.1:8000";
const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const IMAGE_TYPES = [
  { id: "front", label: "Front Image", desc: "Front side showing primary branding", required: true },
  { id: "back", label: "Back Image", desc: "Rear side containing details/nutrition info", required: false },
  { id: "side", label: "Side Image", desc: "Left or right profile of the product", required: false },
  { id: "angled", label: "Angled Image", desc: "Three-quarter / isometric perspective", required: false },
  { id: "additional", label: "Additional Images", desc: "Other miscellaneous views", required: false },
];

export default function AddProductPage() {
  const router = useRouter();

  // Product form states
  const [barcode, setBarcode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [weight, setWeight] = useState("");
  const [category, setCategory] = useState("Beverages");
  const [description, setDescription] = useState("");

  // Barcode verification status
  const [barcodeValidating, setBarcodeValidating] = useState(false);
  const [barcodeError, setBarcodeError] = useState<string | null>(null);

  // Staged files states: map of image_type -> File object
  const [stagedFiles, setStagedFiles] = useState<{ [key: string]: File }>({});
  const [previews, setPreviews] = useState<{ [key: string]: string }>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<"idle" | "creating_product" | "uploading_images" | "generating_embeddings" | "updating_index" | "ready">("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Verify barcode uniqueness when focus leaves the input field
  const handleBarcodeBlur = async () => {
    const trimmed = barcode.trim();
    if (!trimmed) return;

    setBarcodeValidating(true);
    setBarcodeError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/products/barcode/${trimmed}`);
      if (res.ok) {
        // Product found, barcode is NOT unique
        setBarcodeError("This barcode is already registered in the system.");
      }
    } catch (err) {
      console.error("Error verifying barcode:", err);
    } finally {
      setBarcodeValidating(false);
    }
  };

  const handleFileChange = (type: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

    // Update staged file and generate local preview url
    setStagedFiles((prev) => ({ ...prev, [type]: file }));
    if (previews[type]) {
      URL.revokeObjectURL(previews[type]);
    }
    setPreviews((prev) => ({ ...prev, [type]: URL.createObjectURL(file) }));
  };

  const removeFile = (type: string) => {
    if (previews[type]) {
      URL.revokeObjectURL(previews[type]);
    }
    setStagedFiles((prev) => {
      const copy = { ...prev };
      delete copy[type];
      return copy;
    });
    setPreviews((prev) => {
      const copy = { ...prev };
      delete copy[type];
      return copy;
    });
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

    // Front image is required for dataset completeness
    if (!stagedFiles["front"]) {
      setSubmitError("Please upload at least the Front Image of the product.");
      return;
    }

    setIsSubmitting(true);
    setSubmitStep("creating_product");

    try {
      // 1. Create Product Registry Entry
      const productRes = await fetch(`${API_BASE}/api/v1/products`, {
        method: "POST",
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

      const productData = await productRes.json();

      if (!productRes.ok) {
        throw new Error(productData.detail || "Failed to create product registry.");
      }

      // Check if product creation returns {success, product} or raw product
      const product = productData.product || productData;
      const productId = product.id;

      // 2. Upload Staged Images
      setSubmitStep("uploading_images");
      const filesToUpload = Object.entries(stagedFiles);

      if (filesToUpload.length > 0) {
        setSubmitStep("generating_embeddings");
        const batchFormData = new FormData();
        filesToUpload.forEach(([imageType, file]) => {
          batchFormData.append("files", file);
        });
        batchFormData.append("image_type", "reference");

        const batchRes = await fetch(`${API_BASE}/api/v1/products/${productId}/images/batch`, {
          method: "POST",
          body: batchFormData,
        });

        const batchData = await batchRes.json().catch(() => ({}));
        if (!batchRes.ok || batchData.success === false) {
          console.warn("Batch upload warning:", batchData);
          if (batchData.errors && batchData.errors.length > 0) {
            setSubmitError(`Warning during image indexing: ${batchData.errors.join("; ")}`);
          }
        }
      }

      // 3. Confirm Indexing Status
      setSubmitStep("updating_index");
      try {
        await fetch(`${API_BASE}/api/v1/products/${productId}/index-status`);
      } catch (err) {
        console.warn("Status check warning:", err);
      }

      setSubmitStep("ready");

      // 4. Redirect after brief confirmation
      setTimeout(() => {
        router.push("/products");
        router.refresh();
      }, 1500);
    } catch (err: any) {
      console.error("Submission error:", err);
      setSubmitError(err.message || "Failed to save product and images.");
      setIsSubmitting(false);
      setSubmitStep("idle");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navigation />

      <main className="flex-1 max-w-5xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Navigation link */}
        <div>
          <Link
            href="/products"
            className="flex items-center gap-1.5 text-xs font-bold text-gray-500 hover:text-blue-600 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Products list
          </Link>
        </div>

        {/* Header */}
        <header className="border-b pb-4">
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <Box className="h-6 w-6 text-blue-600" />
            Register New Product
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Enter product registry information and upload training dataset photos
          </p>
        </header>

        {/* Submit Alerts */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-center gap-2 text-xs font-bold text-red-800">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
            {submitError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Panel: Info form (5 cols) */}
          <div className="lg:col-span-5 bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col gap-4">
            <h3 className="font-bold text-gray-800 text-sm border-b pb-2 uppercase tracking-wide">
              Product Registry Details
            </h3>

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
          </div>

          {/* Right Panel: Dataset Upload zone (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-gray-200 p-5 rounded-xl shadow-sm flex flex-col gap-4">
            <div className="border-b pb-2 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm uppercase tracking-wide">
                Dataset Training Images
              </h3>
              <span className="text-[10px] text-gray-400 font-bold uppercase">
                Allowed formats: JPEG, PNG, WEBP (Max 5MB)
              </span>
            </div>

            {/* Upload grid */}
            <div className="flex flex-col gap-3.5">
              {IMAGE_TYPES.map((type) => {
                const preview = previews[type.id];
                const file = stagedFiles[type.id];

                return (
                  <div
                    key={type.id}
                    className="border border-gray-100 rounded-xl p-3 bg-gray-50/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-gray-800">{type.label}</span>
                        {type.required && (
                          <span className="text-[10px] bg-red-150 text-red-700 font-bold px-1.5 py-0.2 rounded-full uppercase">
                            Required
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium mt-0.5">{type.desc}</p>
                    </div>

                    <div className="w-full md:w-auto flex items-center gap-3">
                      {preview ? (
                        <div className="relative h-14 w-20 rounded-lg overflow-hidden border border-gray-200 shadow-sm shrink-0 bg-white">
                          <img src={preview} alt={type.label} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeFile(type.id)}
                            className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-0.5 shadow-xs transition"
                            title="Remove staged image"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative border border-dashed border-gray-300 hover:border-blue-500 rounded-lg h-14 w-20 flex items-center justify-center shrink-0 cursor-pointer bg-white transition">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => handleFileChange(type.id, e)}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                          />
                          <Upload className="h-4 w-4 text-gray-400" />
                        </div>
                      )}

                      <div className="text-left shrink-0">
                        {file ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] text-green-700 font-bold flex items-center gap-1">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                              Staged
                            </span>
                            <span className="text-[9px] text-gray-400 font-semibold truncate max-w-[100px]">
                              {(file.size / (1024 * 1024)).toFixed(2)} MB
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] text-gray-400 font-bold italic block">
                            Empty
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Save Buttons */}
            <div className="border-t pt-4 flex gap-3.5 justify-end">
              <Link
                href="/products"
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
                    Registering Product...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Register Product & Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Dynamic AI Registration Progress Overlay (Prompt 14) */}
        {isSubmitting && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-gray-100 flex flex-col gap-4">
              <div className="flex items-center gap-3 border-b pb-3">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
                  <RefreshCw className={`h-5 w-5 ${submitStep !== "ready" ? "animate-spin" : ""}`} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-sm">Dynamic AI Product Registration</h3>
                  <p className="text-[11px] text-gray-500 font-medium">Automatic DINOv2 visual embedding & FAISS indexing</p>
                </div>
              </div>

              {/* Progress Steps */}
              <div className="flex flex-col gap-3 py-2">
                {/* Step 1 */}
                <div className="flex items-center gap-3">
                  {submitStep === "creating_product" ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                  <span className={`text-xs font-semibold ${submitStep === "creating_product" ? "text-blue-600 font-bold" : "text-gray-700"}`}>
                    Creating product...
                  </span>
                </div>

                {/* Step 2 */}
                <div className="flex items-center gap-3">
                  {submitStep === "creating_product" ? (
                    <div className="h-4 w-4 rounded-full border border-gray-300"></div>
                  ) : submitStep === "uploading_images" ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                  <span className={`text-xs font-semibold ${submitStep === "uploading_images" ? "text-blue-600 font-bold" : (submitStep === "creating_product" ? "text-gray-400" : "text-gray-700")}`}>
                    Uploading images...
                  </span>
                </div>

                {/* Step 3 */}
                <div className="flex items-center gap-3">
                  {["creating_product", "uploading_images"].includes(submitStep) ? (
                    <div className="h-4 w-4 rounded-full border border-gray-300"></div>
                  ) : submitStep === "generating_embeddings" ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                  <span className={`text-xs font-semibold ${submitStep === "generating_embeddings" ? "text-blue-600 font-bold" : (["creating_product", "uploading_images"].includes(submitStep) ? "text-gray-400" : "text-gray-700")}`}>
                    Generating visual embeddings...
                  </span>
                </div>

                {/* Step 4 */}
                <div className="flex items-center gap-3">
                  {["creating_product", "uploading_images", "generating_embeddings"].includes(submitStep) ? (
                    <div className="h-4 w-4 rounded-full border border-gray-300"></div>
                  ) : submitStep === "updating_index" ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  )}
                  <span className={`text-xs font-semibold ${submitStep === "updating_index" ? "text-blue-600 font-bold" : (["creating_product", "uploading_images", "generating_embeddings"].includes(submitStep) ? "text-gray-400" : "text-gray-700")}`}>
                    Updating visual index...
                  </span>
                </div>

                {/* Step 5 */}
                <div className="flex items-center gap-3 pt-1 border-t border-gray-100">
                  {submitStep === "ready" ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 animate-bounce" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-gray-300"></div>
                  )}
                  <span className={`text-xs font-bold ${submitStep === "ready" ? "text-emerald-700 font-black text-sm" : "text-gray-400"}`}>
                    ✓ Product ready for AI recognition
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
