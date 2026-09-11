"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Navigation from "@/components/Navigation";
import {
  Camera,
  CameraOff,
  Upload,
  RefreshCw,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Layers,
  Image as ImageIcon,
  Sparkles,
  Info,
  Maximize2,
  Tag,
  Sun,
  RotateCw,
  Move,
  Box,
  Eye,
} from "lucide-react";

interface Product {
  id: string;
  barcode: string;
  name: string;
  price: number;
  weight: number;
  category: string;
  image_count: number;
  needs_more_images: boolean;
}

interface ProductImage {
  id: string;
  product_id: string;
  image_path: string;
  thumbnail_path: string;
  image_type: string;
  width: number;
  height: number;
  file_size: number;
  created_at: string;
}

const VARIATION_PRESETS = [
  { id: "front", label: "Front View", icon: Box, description: "Direct front face of product" },
  { id: "back", label: "Back View", icon: Box, description: "Rear face with ingredients/barcode" },
  { id: "left", label: "Left Side", icon: Box, description: "90-degree left profile" },
  { id: "right", label: "Right Side", icon: Box, description: "90-degree right profile" },
  { id: "angle_45", label: "45° Angle", icon: Eye, description: "Isometric perspective angle" },
  { id: "distance_variation", label: "Distance Var.", icon: Maximize2, description: "Close-up or zoomed-out framing" },
  { id: "lighting_variation", label: "Lighting Var.", icon: Sun, description: "Bright, dim, or directional lighting" },
  { id: "rotation_variation", label: "Rotation Var.", icon: RotateCw, description: "Slightly tilted or angled orientation" },
  { id: "real_camera", label: "Real Camera", icon: Camera, description: "Webcam or hand-held camera photo" },
];

const API_BASE = "http://127.0.0.1:8000";

export default function DatasetManagementPage() {
  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productImages, setProductImages] = useState<ProductImage[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingImages, setIsLoadingImages] = useState(false);

  // Workflow Input Mode: 'camera' | 'upload'
  const [inputMode, setInputMode] = useState<"camera" | "upload">("camera");

  // Camera state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Staged Preview & Label State
  const [stagedBlob, setStagedBlob] = useState<Blob | null>(null);
  const [stagedPreviewUrl, setStagedPreviewUrl] = useState<string | null>(null);
  const [selectedImageType, setSelectedImageType] = useState<string>("front");
  const [customImageType, setCustomImageType] = useState<string>("");

  // Processing & UI Feedback
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // New Product Modal State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [newBarcode, setNewBarcode] = useState("");
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [newCategory, setNewCategory] = useState("Beverages");
  const [registerError, setRegisterError] = useState<string | null>(null);

  // 1. Fetch Products List
  const fetchProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/products`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        if (data.products.length > 0 && !selectedProductId) {
          setSelectedProductId(data.products[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching products:", err);
      setFeedback({ type: "error", message: "Failed to connect to backend server" });
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  // 2. Fetch Images when Selected Product Changes
  const fetchImagesForProduct = async (productId: string) => {
    if (!productId) return;
    setIsLoadingImages(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${productId}/images`);
      const data = await res.json();
      if (data.success) {
        setProductImages(data.images || []);
        // Update product image count in products state
        setProducts((prev) =>
          prev.map((p) =>
            p.id === productId
              ? { ...p, image_count: data.image_count, needs_more_images: data.needs_more_images }
              : p
          )
        );
      }
    } catch (err) {
      console.error("Error fetching product images:", err);
    } finally {
      setIsLoadingImages(false);
    }
  };

  useEffect(() => {
    if (selectedProductId) {
      fetchImagesForProduct(selectedProductId);
      // Clear staged image when switching product
      clearStagedImage();
    }
  }, [selectedProductId]);

  // Camera Device Selection states
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  const getCameraDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === "videoinput");
      setVideoDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(videoInputs[0].deviceId);
      }
    } catch (e) {
      console.log("Device enumeration error:", e);
    }
  };

  useEffect(() => {
    getCameraDevices();
  }, []);

  // Camera Controls
  const startCamera = async (deviceIdToUse?: string) => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }

    const targetDeviceId = deviceIdToUse || selectedDeviceId;

    try {
      let stream: MediaStream;
      if (targetDeviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch (e) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      } else {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch (e) {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      setCameraStream(stream);
      setCameraActive(true);
      await getCameraDevices();
    } catch (err: any) {
      console.error("Camera access error:", err);
      setFeedback({ type: "error", message: `Camera error: ${err?.message || "Webcam unavailable. Please grant camera permissions."}` });
      setCameraActive(false);
    }
  };

  useEffect(() => {
    if (cameraActive && cameraStream && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = cameraStream;
      video.onloadedmetadata = () => {
        video.play().catch((err) => console.log("Video play error:", err));
      };
    }
  }, [cameraActive, cameraStream]);

  // Auto-start camera when inputMode is camera
  useEffect(() => {
    if (inputMode === "camera" && !cameraActive) {
      startCamera();
    }
  }, [inputMode]);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
    setCameraStream(null);
    setCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // Capture Frame from Camera
  const captureFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setStagedBlob(blob);
        setStagedPreviewUrl(URL.createObjectURL(blob));
        setFeedback(null);
      },
      "image/jpeg",
      0.9
    );
  };

  // Handle File Input Upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStagedBlob(file);
    setStagedPreviewUrl(URL.createObjectURL(file));
    setFeedback(null);
  };

  // Clear Staged Image
  const clearStagedImage = () => {
    if (stagedPreviewUrl) {
      URL.revokeObjectURL(stagedPreviewUrl);
    }
    setStagedBlob(null);
    setStagedPreviewUrl(null);
  };

  // Save Image to Dataset API
  const saveImageToDataset = async () => {
    if (!selectedProductId || !stagedBlob) {
      setFeedback({ type: "error", message: "Please select a product and capture/upload an image." });
      return;
    }

    const finalLabel =
      selectedImageType === "custom"
        ? customImageType.trim() || "custom"
        : selectedImageType;

    setIsSaving(true);
    setFeedback(null);

    const formData = new FormData();
    formData.append("file", stagedBlob, "dataset_image.jpg");
    formData.append("image_type", finalLabel);

    try {
      const res = await fetch(`${API_BASE}/api/v1/products/${selectedProductId}/images/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({
          type: "success",
          message: `Image saved & preprocessed! (Type: ${finalLabel}, Max: 1024px, Thumb generated)`,
        });
        clearStagedImage();
        // Refresh product images
        await fetchImagesForProduct(selectedProductId);
      } else {
        setFeedback({
          type: "error",
          message: data.error || "Failed to save image.",
        });
      }
    } catch (err) {
      console.error("Save image error:", err);
      setFeedback({ type: "error", message: "Failed to communicate with dataset API." });
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Image
  const deleteImage = async (imageId: string) => {
    if (!confirm("Are you sure you want to delete this training image?")) return;

    try {
      const res = await fetch(
        `${API_BASE}/api/v1/products/${selectedProductId}/images/${imageId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: "Image deleted successfully." });
        fetchImagesForProduct(selectedProductId);
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to delete image." });
      }
    } catch (err) {
      console.error("Delete error:", err);
      setFeedback({ type: "error", message: "Error deleting image." });
    }
  };

  // Register New Product
  const handleRegisterProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    if (!newBarcode || !newName || !newPrice || !newWeight) {
      setRegisterError("Please fill in all required fields.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          barcode: newBarcode.trim(),
          name: newName.trim(),
          price: parseInt(newPrice, 10),
          weight: parseFloat(newWeight),
          category: newCategory,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowRegisterModal(false);
        setNewBarcode("");
        setNewName("");
        setNewPrice("");
        setNewWeight("");
        await fetchProducts();
        setSelectedProductId(data.product.id);
        setFeedback({ type: "success", message: `Registered product '${data.product.name}'` });
      } else {
        setRegisterError(data.detail || "Failed to register product.");
      }
    } catch (err) {
      setRegisterError("API connection error.");
    }
  };

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navigation />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Page Sub-header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <ImageIcon className="h-6 w-6 text-blue-600" />
              Product Image Dataset Studio
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Capture & manage multi-angle training dataset images (Minimum 5–10 per product)
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            <a
              href={`/dataset/annotation${selectedProductId ? `?product_id=${selectedProductId}` : ""}`}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Eye className="h-4 w-4" />
              Annotate Bounding Boxes
            </a>
            <button
              onClick={() => setShowRegisterModal(true)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              Register New Product
            </button>
          </div>
        </header>


        {/* Workflow Breadcrumb Indicator */}
        <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm flex items-center justify-between overflow-x-auto text-xs font-bold text-gray-500">
          <div className={`flex items-center gap-1.5 ${selectedProductId ? "text-blue-600 font-extrabold" : ""}`}>
            <span className="h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px]">1</span>
            Product
          </div>
          <span className="text-gray-300">→</span>
          <div className={`flex items-center gap-1.5 ${productImages.length > 0 ? "text-blue-600" : ""}`}>
            <span className="h-5 w-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px]">2</span>
            Training Images
          </div>
          <span className="text-gray-300">→</span>
          <div className={`flex items-center gap-1.5 ${stagedBlob ? "text-blue-600" : ""}`}>
            <span className="h-5 w-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px]">3</span>
            Upload / Capture
          </div>
          <span className="text-gray-300">→</span>
          <div className={`flex items-center gap-1.5 ${stagedPreviewUrl ? "text-blue-600" : ""}`}>
            <span className="h-5 w-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px]">4</span>
            Preview
          </div>
          <span className="text-gray-300">→</span>
          <div className="flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[10px]">5</span>
            Label
          </div>
          <span className="text-gray-300">→</span>
          <div className="flex items-center gap-1.5">
            <span className="h-5 w-5 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-[10px]">6</span>
            Save & Preprocess
          </div>
        </div>

        {/* Global Feedback Banner */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
              feedback.type === "success"
                ? "bg-green-50 text-green-800 border-green-200"
                : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              )}
              {feedback.message}
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-xs opacity-60 hover:opacity-100 font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Top Product Selector Banner */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-1">
              Select Product to Manage Dataset
            </label>
            {isLoadingProducts ? (
              <div className="h-10 bg-gray-100 animate-pulse rounded-lg w-full"></div>
            ) : (
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (Barcode: {p.barcode}) — {p.image_count} Images {p.needs_more_images ? "⚠️ (< 5 Usable)" : "✓"}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedProduct && (
            <div className="flex items-center gap-3 border-t md:border-t-0 md:border-l pt-3 md:pt-0 md:pl-4 border-gray-100">
              <div className="text-right">
                <span className="text-xs font-bold text-gray-400 block uppercase">Dataset Status</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-black tracking-wide flex items-center gap-1 ${
                      selectedProduct.needs_more_images
                        ? "bg-red-100 text-red-700 border border-red-200"
                        : "bg-green-100 text-green-700 border border-green-200"
                    }`}
                  >
                    {selectedProduct.needs_more_images ? (
                      <>
                        <AlertTriangle className="h-3 w-3" />
                        {selectedProduct.image_count} / 5 Usable Images (Needs More)
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-3 w-3" />
                        {selectedProduct.image_count} Images (Ready)
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Recommended Variations Guideline Banner */}
        {selectedProduct?.needs_more_images && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-xl text-xs flex items-start gap-3">
            <Info className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold text-sm block">Dataset Optimization Recommendation</span>
              <p className="mt-0.5 leading-relaxed text-amber-800">
                To build an accurate vision dataset, capture <strong>5 to 10 images per product</strong> with variations: Front, Back, Left, Right, 45-degree angle, different lighting, varying distances, and slight rotation.
              </p>
            </div>
          </div>
        )}

        {/* Main Grid: Capture / Preview / Label Workspace (Left) & Gallery (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Capture & Label Workspace (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
              
              {/* Input Mode Selector */}
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-blue-500" />
                  Capture & Label Training Image
                </h3>
                
                <div className="flex items-center bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => {
                      setInputMode("camera");
                      if (!cameraActive) startCamera();
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                      inputMode === "camera"
                        ? "bg-white text-blue-600 shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    Webcam Capture
                  </button>
                  <button
                    onClick={() => {
                      setInputMode("upload");
                      stopCamera();
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition ${
                      inputMode === "upload"
                        ? "bg-white text-blue-600 shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    File Upload
                  </button>
                </div>
              </div>

              {/* Input Viewport (Camera Stream vs File Upload area) */}
              {!stagedPreviewUrl ? (
                <div>
                  {inputMode === "camera" ? (
                    <div className="flex flex-col gap-3">
                      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-950 border border-gray-800 flex items-center justify-center">
                        <canvas ref={canvasRef} className="hidden" />
                        {cameraActive ? (
                          <>
                            <video
                              ref={videoRef}
                              autoPlay
                              playsInline
                              muted
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 border-2 border-dashed border-white/40 pointer-events-none m-6 rounded-lg flex items-center justify-center">
                              <span className="text-[10px] text-white/70 bg-black/50 px-2 py-0.5 rounded">
                                Align product inside frame
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center gap-2 text-gray-400 p-8 text-center">
                            <CameraOff className="h-10 w-10 text-gray-600" />
                            <p className="text-xs font-semibold text-gray-300">Webcam Stream Offline</p>
                            <button
                              onClick={() => startCamera()}
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold transition shadow-sm flex items-center gap-1.5 mt-1"
                            >
                              <Camera className="h-4 w-4" /> Start Webcam
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Camera Controls Bar */}
                      <div className="bg-gray-100 p-2.5 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {!cameraActive ? (
                            <button
                              onClick={() => startCamera()}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-xs flex items-center gap-1.5"
                            >
                              <Camera className="h-4 w-4" />
                              Start Camera
                            </button>
                          ) : (
                            <button
                              onClick={stopCamera}
                              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-xs flex items-center gap-1.5"
                            >
                              <CameraOff className="h-4 w-4" />
                              Stop Camera
                            </button>
                          )}

                          {videoDevices.length > 0 && (
                            <select
                              value={selectedDeviceId}
                              onChange={(e) => {
                                setSelectedDeviceId(e.target.value);
                                if (cameraActive) {
                                  startCamera(e.target.value);
                                }
                              }}
                              className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 font-semibold focus:outline-none max-w-[160px] truncate"
                            >
                              {videoDevices.map((dev, idx) => (
                                <option key={dev.deviceId || idx} value={dev.deviceId}>
                                  {dev.label || `Webcam ${idx + 1}`}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>

                        <button
                          onClick={captureFrame}
                          disabled={!cameraActive}
                          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-xs font-bold px-4 py-1.5 rounded-lg transition shadow-sm flex items-center gap-1.5 ml-auto"
                        >
                          <Camera className="h-4 w-4" />
                          Snap Photo Frame
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-lg p-8 text-center flex flex-col items-center justify-center gap-2 bg-gray-50/50 hover:bg-blue-50/30 transition cursor-pointer relative">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                      <Upload className="h-10 w-10 text-blue-500" />
                      <p className="text-xs font-bold text-gray-700">
                        Click or drag & drop product image file
                      </p>
                      <p className="text-[10px] text-gray-400 font-medium">
                        Supports JPEG, PNG, WEBP formats up to 10MB
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Staged Image Preview Section */
                <div className="flex flex-col gap-3">
                  <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-100 border border-gray-300 flex items-center justify-center">

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={stagedPreviewUrl}
                      alt="Staged product preview"
                      className="max-h-full max-w-full object-contain"
                    />
                    <button
                      onClick={clearStagedImage}
                      className="absolute top-2 right-2 bg-black/70 hover:bg-red-600 text-white p-1.5 rounded-full text-xs transition"
                      title="Retake / Discard"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-gray-500 font-semibold px-1">
                    <span>Preview Ready</span>
                    <button
                      onClick={clearStagedImage}
                      className="text-red-500 hover:underline font-bold"
                    >
                      Retake / Choose Different Image
                    </button>
                  </div>
                </div>
              )}

              {/* Variation Label Selector */}
              <div className="border-t pt-4 flex flex-col gap-3">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Tag className="h-4 w-4 text-blue-500" />
                  Step: Select Variation Label (`image_type`)
                </label>

                <div className="grid grid-cols-3 gap-2">
                  {VARIATION_PRESETS.map((preset) => {
                    const Icon = preset.icon;
                    const isSelected = selectedImageType === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSelectedImageType(preset.id)}
                        className={`p-2.5 rounded-lg border text-left flex flex-col justify-between transition ${
                          isSelected
                            ? "bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-500/20"
                            : "bg-white border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Icon className={`h-4 w-4 ${isSelected ? "text-blue-600" : "text-gray-400"}`} />
                          {isSelected && <span className="h-2 w-2 rounded-full bg-blue-600"></span>}
                        </div>
                        <span className="text-xs font-bold mt-2">{preset.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Variation Label Input */}
                <div className="mt-1">
                  <button
                    type="button"
                    onClick={() => setSelectedImageType("custom")}
                    className={`text-xs font-bold flex items-center gap-1 ${
                      selectedImageType === "custom" ? "text-blue-600" : "text-gray-500 hover:text-gray-800"
                    }`}
                  >
                    + Use Custom Variation Label
                  </button>
                  {selectedImageType === "custom" && (
                    <input
                      type="text"
                      placeholder="e.g. barcode_close_up, expiry_date_angle"
                      value={customImageType}
                      onChange={(e) => setCustomImageType(e.target.value)}
                      className="mt-2 w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                  )}
                </div>
              </div>

              {/* Validation & Preprocessing Specs Box */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-[11px] text-gray-600 flex flex-col gap-1">
                <span className="font-bold text-gray-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                  Automatic Backend Validation & Preprocessing:
                </span>
                <ul className="list-disc list-inside text-gray-500 pl-1 space-y-0.5">
                  <li><strong>Resize</strong>: Standardized to max 1024x1024 (aspect ratio preserved)</li>
                  <li><strong>Normalization</strong>: Converted to standard RGB color space</li>
                  <li><strong>Corruption Check</strong>: Rejects empty or unreadable byte streams</li>
                  <li><strong>Duplicate Detection</strong>: Checks MD5 & 64-bit dHash against product set</li>
                  <li><strong>Thumbnails</strong>: Generates compact 200x200 gallery preview</li>
                </ul>
              </div>

              {/* Save Button */}
              <button
                onClick={saveImageToDataset}
                disabled={!stagedBlob || isSaving || !selectedProductId}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isSaving ? "Validating & Processing Image..." : "Validate, Preprocess & Save Image"}
              </button>
            </div>
          </div>

          {/* Right Column: Existing Training Images Gallery (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="font-bold text-gray-800 text-base">
                    Product Image Dataset ({productImages.length})
                  </h3>
                  <p className="text-[11px] text-gray-400 font-medium">
                    Stored training samples for selected product
                  </p>
                </div>

                <span
                  className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase ${
                    selectedProduct?.needs_more_images
                      ? "bg-red-100 text-red-700"
                      : "bg-green-100 text-green-700"
                  }`}
                >
                  {selectedProduct?.needs_more_images ? "< 5 Usable" : "Ready"}
                </span>
              </div>

              {isLoadingImages ? (
                <div className="grid grid-cols-2 gap-3 py-8">
                  <div className="h-32 bg-gray-100 animate-pulse rounded-lg"></div>
                  <div className="h-32 bg-gray-100 animate-pulse rounded-lg"></div>
                </div>
              ) : productImages.length === 0 ? (
                <div className="text-center py-12 flex flex-col items-center gap-2 text-gray-400">
                  <ImageIcon className="h-10 w-10 stroke-[1.5]" />
                  <p className="text-xs font-bold text-gray-600">No training images saved yet</p>
                  <p className="text-[10px] text-gray-400 max-w-xs">
                    Use the camera preview or file upload on the left to capture and add at least 5 variation images.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
                  {productImages.map((img) => (
                    <div
                      key={img.id}
                      className="group relative bg-gray-50 rounded-lg border border-gray-200 overflow-hidden flex flex-col justify-between hover:shadow-md transition"
                    >
                      {/* Thumbnail Container */}
                      <div className="aspect-square bg-gray-100 relative overflow-hidden flex items-center justify-center border-b border-gray-200">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={
                            img.thumbnail_path && img.thumbnail_path.startsWith("http")
                              ? img.thumbnail_path
                              : img.thumbnail_path && (img.thumbnail_path.startsWith("/uploads/") || img.thumbnail_path.startsWith("uploads/"))
                              ? `${API_BASE}${img.thumbnail_path.startsWith('/') ? '' : '/'}${img.thumbnail_path}`
                              : img.image_path && (img.image_path.startsWith("/uploads/") || img.image_path.startsWith("uploads/"))
                              ? `${API_BASE}${img.image_path.startsWith('/') ? '' : '/'}${img.image_path}`
                              : `${API_BASE}/api/v1/products/images/${img.id}/file`
                          }
                          alt={img.image_type}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />

                        <span className="absolute top-1.5 left-1.5 bg-black/70 text-white text-[10px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider">
                          {img.image_type}
                        </span>

                        <button
                          onClick={() => deleteImage(img.id)}
                          className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition shadow-md"
                          title="Delete image"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Metadata Details */}
                      <div className="p-2.5 flex flex-col gap-0.5 bg-white border-t border-gray-100 text-[10px] text-gray-500 font-medium">
                        <div className="flex justify-between font-bold text-gray-700">
                          <span>Res: {img.width}x{img.height}</span>
                          <span>{(img.file_size / 1024).toFixed(1)} KB</span>
                        </div>
                        <span className="truncate text-gray-400">
                          {new Date(img.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Register New Product Modal */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-bold text-gray-900">Register New Product</h3>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            {registerError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs font-semibold rounded-lg border border-red-100">
                {registerError}
              </div>
            )}

            <form onSubmit={handleRegisterProduct} className="flex flex-col gap-3 text-xs">
              <div>
                <label className="font-bold text-gray-700 block mb-1">Barcode Value *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 8901234567890"
                  value={newBarcode}
                  onChange={(e) => setNewBarcode(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tropicana Orange Juice 1L"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-gray-700 block mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="120"
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="font-bold text-gray-700 block mb-1">Weight (kg) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0.01"
                    placeholder="1.0"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-gray-700 block mb-1">Category *</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-xs font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="Beverages">Beverages</option>
                  <option value="Dairy">Dairy</option>
                  <option value="Snacks">Snacks</option>
                  <option value="Books">Books</option>
                  <option value="Groceries">Groceries</option>
                  <option value="Personal Care">Personal Care</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hidden Canvas for Camera Captures */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
