"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Upload,
  RefreshCw,
  Sparkles,
  Layers,
  HelpCircle,
  Eye,
  Barcode as BarcodeIcon,
  ShieldAlert,
  ShieldCheck,
  Zap,
  Sliders,
  AlertCircle,
  CheckCircle2,
  Box,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Check,
  XCircle,
  AlertTriangle,
  FileText,
  PlayCircle,
  Activity
} from "lucide-react";
import Navigation from "@/components/Navigation";
import IdentificationResultPanel, { IdentifyResult, VisionDetectionItem, Product, BoundingBox } from "@/components/IdentificationResultPanel";

export interface CartSessionItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit_weight: number;
  total_expected_weight: number;
  barcode: string;
  category: string;
  status: string;
}

export interface ScenarioResult {
  id: number;
  name: string;
  expected_status: string;
  actual_status: string;
  confidence: number;
  passed: boolean;
  reason: string;
}

export interface MultiSignalEvaluationMetrics {
  overall_verification_accuracy: number;
  total_test_scenarios: number;
  passed_scenarios: number;
  failed_scenarios: number;
  barcode_accuracy: number;
  ocr_accuracy: number;
  yolo_precision: number;
  yolo_recall: number;
  mAP50: number;
  mAP50_95: number;
  visual_similarity_accuracy: number;
  mismatch_detection_accuracy: number;
  false_positive_rate: number;
  false_negative_rate: number;
}

export default function CombinedIdentifyPage() {
  const [activeTab, setActiveTab] = useState<"camera" | "upload" | "benchmark">("camera");

  // Camera states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  // Throttling & Auto-scan controls
  const [autoScan, setAutoScan] = useState(false);
  const [scanIntervalMs, setScanIntervalMs] = useState(1500);

  // Upload & Frame Capture states
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [capturedSnapshotUrl, setCapturedSnapshotUrl] = useState<string | null>(null);

  // Identification States
  const [isIdentifying, setIsIdentifying] = useState(false);
  const [identifyResult, setIdentifyResult] = useState<IdentifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRunTime, setLastRunTime] = useState<string | null>(null);

  // Live Session Shopping Cart States
  const [sessionCart, setSessionCart] = useState<CartSessionItem[]>([]);
  const [autoAddToCart, setAutoAddToCart] = useState(true);
  const [stabilityStatus, setStabilityStatus] = useState<string>("Ready to scan");

  // Temporal Stability Tracker (prevents duplicate adds across frames)
  const lastDetectedRef = useRef<string | null>(null);
  const stableCountRef = useRef<number>(0);
  const REQUIRED_STABLE_FRAMES = 3;

  // Evaluation Benchmark States
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchmarkMetrics, setBenchmarkMetrics] = useState<MultiSignalEvaluationMetrics | null>(null);
  const [benchmarkScenarios, setBenchmarkScenarios] = useState<ScenarioResult[]>([]);

  // Canvas and Media Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const sourceImageRef = useRef<HTMLImageElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const identifyIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Request-in-flight lock to prevent duplicate/overlapping API requests during continuous scanning
  const isProcessingRef = useRef(false);

  const API_BASE = "http://127.0.0.1:8000";

  // Camera Device Selection states
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  // Cart Helper Operations
  const handleAddToCart = (prod: Product, barcodeVal?: string) => {
    setSessionCart((prev) => {
      const existingIdx = prev.findIndex((item) => item.product_id === prod.id);
      if (existingIdx >= 0) {
        const updated = [...prev];
        const item = updated[existingIdx];
        const newQty = item.quantity + 1;
        updated[existingIdx] = {
          ...item,
          quantity: newQty,
          total_price: Number((item.unit_price * newQty).toFixed(2)),
          total_expected_weight: Number((item.unit_weight * newQty).toFixed(4)),
        };
        return updated;
      } else {
        return [
          ...prev,
          {
            product_id: prod.id,
            name: prod.name,
            quantity: 1,
            unit_price: prod.price,
            total_price: prod.price,
            unit_weight: prod.weight,
            total_expected_weight: prod.weight,
            barcode: barcodeVal || prod.barcode || "N/A",
            category: prod.category || "General",
            status: "VERIFIED",
          },
        ];
      }
    });
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setSessionCart((prev) => {
      return prev
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            return {
              ...item,
              quantity: newQty,
              total_price: Number((item.unit_price * newQty).toFixed(2)),
              total_expected_weight: Number((item.unit_weight * newQty).toFixed(4)),
            };
          }
          return item;
        })
        .filter(Boolean) as CartSessionItem[];
    });
  };

  const handleRemoveFromCart = (productId: string) => {
    setSessionCart((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const handleClearCart = () => {
    setSessionCart([]);
  };

  // Enumerate available video input devices (webcams)
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

  // 1. Start Camera Stream
  const startCamera = async (deviceIdToUse?: string) => {
    setError(null);
    setPermissionDenied(false);

    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    const targetDeviceId = deviceIdToUse || selectedDeviceId;

    try {
      let mediaStream: MediaStream;
      if (targetDeviceId) {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: targetDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch (e) {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      } else {
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
          });
        } catch (e) {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      }

      setStream(mediaStream);
      setCameraActive(true);
      await getCameraDevices();
    } catch (err: any) {
      console.error("Camera start error:", err);
      setPermissionDenied(true);
      setError(`Camera access error: ${err?.message || "Webcam unavailable. Please allow camera permissions or use Image Upload mode."}`);
      setCameraActive(false);
    }
  };

  useEffect(() => {
    if (cameraActive && stream && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play().catch((err) => console.log("Video play error:", err));
      };
    }
  }, [cameraActive, stream]);

  // 2. Stop Camera Stream
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
    setCameraActive(false);
    stopAutoScan();
    clearOverlayCanvas();
  };

  // 3. Clear Bounding Box Canvas
  const clearOverlayCanvas = () => {
    const canvas = overlayCanvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  };

  // 4. Draw Bounding Boxes on Overlay Canvas
  const drawBoundingBoxes = (
    boxes: VisionDetectionItem[],
    displayWidth: number,
    displayHeight: number,
    originalWidth: number,
    originalHeight: number
  ) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    if (!boxes || boxes.length === 0) return;

    const scaleX = displayWidth / Math.max(1, originalWidth);
    const scaleY = displayHeight / Math.max(1, originalHeight);

    boxes.forEach((det) => {
      const box = det.bounding_box || (det.bbox && Array.isArray(det.bbox) ? {
        x: det.bbox[0],
        y: det.bbox[1],
        width: det.bbox[2] - det.bbox[0],
        height: det.bbox[3] - det.bbox[1]
      } : (det.bbox as BoundingBox));

      if (!box) return;

      const isRegistered = Boolean(det.product_id);

      const x = box.x * scaleX;
      const y = box.y * scaleY;
      const width = box.width * scaleX;
      const height = box.height * scaleY;

      const mainColor = isRegistered ? "#10b981" : "#f59e0b";
      const fillBg = isRegistered ? "rgba(16, 185, 129, 0.18)" : "rgba(245, 158, 11, 0.18)";

      // Draw Box Rectangle
      ctx.fillStyle = fillBg;
      ctx.fillRect(x, y, width, height);

      ctx.strokeStyle = mainColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(x, y, width, height);

      // Label Banner (Product Name & Confidence %)
      const labelText = det.name || "Product";
      const confText = `Conf: ${Math.round((det.confidence || 0) * 100)}% (${isRegistered ? "Verified" : "AI Region"})`;

      ctx.font = "bold 12px Inter, sans-serif";
      const nameWidth = ctx.measureText(labelText).width;
      ctx.font = "11px Inter, sans-serif";
      const confWidth = ctx.measureText(confText).width;
      const bannerWidth = Math.max(nameWidth, confWidth) + 16;
      const bannerHeight = 36;

      const bannerY = y - bannerHeight >= 0 ? y - bannerHeight : y;

      ctx.fillStyle = mainColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, bannerY, bannerWidth, bannerHeight, 6);
      } else {
        ctx.rect(x, bannerY, bannerWidth, bannerHeight);
      }
      ctx.fill();

      // Banner Text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px Inter, sans-serif";
      ctx.fillText(labelText, x + 8, bannerY + 15);

      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText(confText, x + 8, bannerY + 29);
    });
  };

  // 5. Throttled Auto-scan loop
  const startAutoScan = () => {
    stopAutoScan();
    identifyIntervalRef.current = setInterval(() => {
      if (!isProcessingRef.current) {
        captureAndScanFrame();
      }
    }, scanIntervalMs);
  };

  const stopAutoScan = () => {
    if (identifyIntervalRef.current) {
      clearInterval(identifyIntervalRef.current);
      identifyIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (activeTab === "camera" && cameraActive && autoScan) {
      startAutoScan();
    } else {
      stopAutoScan();
    }
    return () => stopAutoScan();
  }, [cameraActive, autoScan, activeTab, scanIntervalMs]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  // 6. Core Multi-Signal API Request Handler (POST frame to FastAPI Unified Scan)
  const sendIdentifyRequest = async (imageBlob: Blob, origW?: number, origH?: number) => {
    if (isProcessingRef.current) return null;
    
    isProcessingRef.current = true;
    setIsIdentifying(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", imageBlob, "identify_input.jpg");
    formData.append("session_id", "live_checkout_session");

    try {
      const response = await fetch(`${API_BASE}/api/v1/verification/scan`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data: IdentifyResult = await response.json();
      setIdentifyResult(data);
      setLastRunTime(new Date().toLocaleTimeString());
      setError(null);

      // Temporal Stability & Auto-add Logic
      if (data.status === "MATCH" && data.product?.id) {
        const curId = data.product.id;
        if (lastDetectedRef.current === curId) {
          stableCountRef.current += 1;
        } else {
          lastDetectedRef.current = curId;
          stableCountRef.current = 1;
        }

        if (stableCountRef.current >= REQUIRED_STABLE_FRAMES) {
          setStabilityStatus(`Stable: ${stableCountRef.current}/${REQUIRED_STABLE_FRAMES} frames ✓ Added`);
          if (autoAddToCart) {
            handleAddToCart(data.product, data.signals?.barcode?.barcode || data.barcode?.value || data.product.barcode);
          }
          // Reset count so it doesn't repeatedly spam every single frame
          stableCountRef.current = 0;
        } else {
          setStabilityStatus(`Verifying stability: ${stableCountRef.current}/${REQUIRED_STABLE_FRAMES} frames`);
        }
      } else {
        lastDetectedRef.current = null;
        stableCountRef.current = 0;
        setStabilityStatus(data.status === "MISMATCH" ? "Mismatch Blocked" : "Scanning...");
      }

      // Render Bounding Box Canvas Overlay if detections exist
      const detections: any[] = data.detections || data.vision?.detections || [];
      if (origW && origH && videoRef.current) {
        drawBoundingBoxes(
          detections,
          videoRef.current.clientWidth,
          videoRef.current.clientHeight,
          origW,
          origH
        );
      } else if (sourceImageRef.current) {
        const img = sourceImageRef.current;
        drawBoundingBoxes(
          detections,
          img.clientWidth,
          img.clientHeight,
          img.naturalWidth || img.clientWidth,
          img.naturalHeight || img.clientHeight
        );
      }

      return data;
    } catch (err) {
      console.error("Identify API error:", err);
      setError("API Connection Failure: Ensure FastAPI backend is running on http://127.0.0.1:8000.");
      setIdentifyResult(null);
      clearOverlayCanvas();
      return null;
    } finally {
      setIsIdentifying(false);
      isProcessingRef.current = false;
    }
  };

  // 7. Capture frame snapshot into state
  const captureFrameSnapshot = () => {
    if (!videoRef.current || !cameraActive) return;
    const video = videoRef.current;

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth || 640;
    tempCanvas.height = video.videoHeight || 480;

    const ctx = tempCanvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    const snapshotUrl = tempCanvas.toDataURL("image/jpeg", 0.90);
    setCapturedSnapshotUrl(snapshotUrl);

    tempCanvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], "captured_frame.jpg", { type: "image/jpeg" });
        setSelectedImageFile(file);
        setImagePreviewUrl(snapshotUrl);
      }
    }, "image/jpeg", 0.90);
  };

  // 8. Capture & Scan
  const captureAndScanFrame = async () => {
    if (isProcessingRef.current) return;

    if (activeTab === "camera" && videoRef.current && cameraActive) {
      const video = videoRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) return;

      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = video.videoWidth;
      tempCanvas.height = video.videoHeight;

      const ctx = tempCanvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

      tempCanvas.toBlob(async (blob) => {
        if (!blob) return;
        await sendIdentifyRequest(blob, video.videoWidth, video.videoHeight);
      }, "image/jpeg", 0.85);
    } else if (selectedImageFile) {
      await sendIdentifyRequest(selectedImageFile);
    }
  };

  // 9. Handle Uploaded File
  const handleImageUpload = (file: File) => {
    setSelectedImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
    setCapturedSnapshotUrl(null);
    setIdentifyResult(null);
    setError(null);
    clearOverlayCanvas();
  };

  // 10. Run 17 Multi-Signal Evaluation Scenarios
  const runEvaluationBenchmark = async () => {
    setBenchmarking(true);
    try {
      const response = await fetch(`${API_BASE}/api/v1/evaluation/multi-signal-metrics`);
      if (!response.ok) throw new Error(`HTTP error ${response.status}`);
      const data = await response.json();
      setBenchmarkMetrics(data.metrics);
      setBenchmarkScenarios(data.scenarios || []);
    } catch (err) {
      console.error("Benchmark fetch error:", err);
      setError("Failed to run evaluation benchmark: Ensure FastAPI server is running.");
    } finally {
      setBenchmarking(false);
    }
  };

  useEffect(() => {
    if (activeTab === "benchmark" && !benchmarkMetrics) {
      runEvaluationBenchmark();
    }
  }, [activeTab]);

  // Cart Metrics Calculations
  const cartTotalItems = sessionCart.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotalPrice = Number(sessionCart.reduce((acc, item) => acc + item.total_price, 0).toFixed(2));
  const cartTotalWeight = Number(sessionCart.reduce((acc, item) => acc + item.total_expected_weight, 0).toFixed(3));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navigation />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Header Section */}
        <header className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              <Sparkles className="h-4 w-4" /> Multi-Signal Product Verification + OCR + Barcode + Vision
            </div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              KartMitra Multi-Signal AI Verification Studio
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Real-time multi-modal fusion of Barcode, YOLO Vision, Packaging OCR, and DINOv2 Vector Similarity
            </p>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-gray-100 p-1 rounded-xl shrink-0">
            <button
              onClick={() => {
                setActiveTab("camera");
                setIdentifyResult(null);
                clearOverlayCanvas();
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "camera"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Camera className="h-4 w-4" />
              Live Camera
            </button>
            <button
              onClick={() => {
                setActiveTab("upload");
                stopCamera();
                setIdentifyResult(null);
                clearOverlayCanvas();
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "upload"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Upload className="h-4 w-4" />
              Image Upload
            </button>
            <button
              onClick={() => {
                setActiveTab("benchmark");
                stopCamera();
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === "benchmark"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              <Activity className="h-4 w-4" />
              17-Scenario Benchmark
            </button>
          </div>
        </header>

        {/* Top Status & Cart Summary Header Banner */}
        <div className={`p-4 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 ${
          identifyResult?.status === "MATCH" || identifyResult?.status === "VERIFIED"
            ? "bg-emerald-600 text-white border-emerald-700"
            : identifyResult?.status === "MISMATCH"
            ? "bg-rose-600 text-white border-rose-700"
            : identifyResult?.status === "REVIEW"
            ? "bg-amber-500 text-white border-amber-600"
            : "bg-slate-900 text-white border-slate-800"
        }`}>
          <div className="flex items-center gap-3">
            {identifyResult?.status === "MATCH" || identifyResult?.status === "VERIFIED" ? (
              <CheckCircle2 className="h-7 w-7 text-emerald-200 shrink-0" />
            ) : identifyResult?.status === "MISMATCH" ? (
              <XCircle className="h-7 w-7 text-rose-200 shrink-0" />
            ) : identifyResult?.status === "REVIEW" ? (
              <AlertTriangle className="h-7 w-7 text-amber-200 shrink-0" />
            ) : (
              <Box className="h-7 w-7 text-slate-400 shrink-0" />
            )}
            <div>
              <h4 className="text-base font-black tracking-wide">
                FRAME VERIFICATION STATUS: {identifyResult?.status || "READY TO SCAN"}
              </h4>
              <p className="text-xs opacity-90 mt-0.5">
                {identifyResult?.reason || "Scan a product using barcode, camera, or packaging OCR to verify and add to cart"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            <span className="bg-white/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
              <ShoppingCart className="h-4 w-4" />
              Cart Total: ₹{cartTotalPrice} ({cartTotalItems} items)
            </span>
            <span className="bg-white/20 px-3 py-1.5 rounded-xl font-mono">
              Exp. Weight: {cartTotalWeight} kg
            </span>
          </div>
        </div>

        {/* 17 Scenario Benchmark Tab View */}
        {activeTab === "benchmark" ? (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
              <div>
                <h3 className="text-xl font-black text-gray-900 flex items-center gap-2">
                  <Activity className="h-5 w-5 text-indigo-600" />
                  17-Scenario Multi-Signal Evaluation Benchmark
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Automated evaluation suite covering Barcode, Vision, Packaging OCR, Similar Products, and Edge Cases
                </p>
              </div>

              <button
                onClick={runEvaluationBenchmark}
                disabled={benchmarking}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${benchmarking ? "animate-spin" : ""}`} />
                {benchmarking ? "Running 17 Scenarios..." : "Re-Run Benchmark"}
              </button>
            </div>

            {/* Metrics Dashboard Cards */}
            {benchmarkMetrics && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-indigo-600 uppercase block">Overall Accuracy</span>
                  <span className="text-xl font-black text-indigo-900">
                    {Math.round(benchmarkMetrics.overall_verification_accuracy * 100)}%
                  </span>
                  <span className="text-[10px] text-indigo-700 block">
                    {benchmarkMetrics.passed_scenarios}/{benchmarkMetrics.total_test_scenarios} Passed
                  </span>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase block">Barcode Accuracy</span>
                  <span className="text-xl font-black text-emerald-900">
                    {Math.round(benchmarkMetrics.barcode_accuracy * 100)}%
                  </span>
                  <span className="text-[10px] text-emerald-700 block">Instant Identity</span>
                </div>

                <div className="bg-purple-50 border border-purple-100 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-purple-600 uppercase block">OCR Match Rate</span>
                  <span className="text-xl font-black text-purple-900">
                    {Math.round(benchmarkMetrics.ocr_accuracy * 100)}%
                  </span>
                  <span className="text-[10px] text-purple-700 block">RapidOCR + Fuzzy</span>
                </div>

                <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-blue-600 uppercase block">YOLO Precision</span>
                  <span className="text-xl font-black text-blue-900">
                    {Math.round(benchmarkMetrics.yolo_precision * 100)}%
                  </span>
                  <span className="text-[10px] text-blue-700 block">mAP50: {Math.round(benchmarkMetrics.mAP50 * 100)}%</span>
                </div>

                <div className="bg-teal-50 border border-teal-100 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-teal-600 uppercase block">Visual Similarity</span>
                  <span className="text-xl font-black text-teal-900">
                    {Math.round(benchmarkMetrics.visual_similarity_accuracy * 100)}%
                  </span>
                  <span className="text-[10px] text-teal-700 block">DINOv2 + FAISS</span>
                </div>

                <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl">
                  <span className="text-[10px] font-bold text-rose-600 uppercase block">Mismatch Detection</span>
                  <span className="text-xl font-black text-rose-900">
                    {Math.round(benchmarkMetrics.mismatch_detection_accuracy * 100)}%
                  </span>
                  <span className="text-[10px] text-rose-700 block">100% Conflict Block</span>
                </div>
              </div>
            )}

            {/* Scenarios Table */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {benchmarkScenarios.map((sc) => (
                <div
                  key={sc.id}
                  className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                    sc.passed ? "bg-emerald-50/40 border-emerald-200" : "bg-red-50/40 border-red-200"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-6 w-6 rounded-full flex items-center justify-center font-bold font-mono text-[10px] shrink-0 ${
                      sc.passed ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                    }`}>
                      #{sc.id}
                    </span>
                    <div>
                      <h4 className="font-extrabold text-gray-900">{sc.name}</h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">{sc.reason}</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                      sc.passed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                    }`}>
                      {sc.actual_status}
                    </span>
                    <span className="text-[10px] font-mono text-gray-500">
                      Expected: {sc.expected_status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Live Camera / Image Upload Studio */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            {/* Left Column: Viewport & Controls */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                  Camera / Input Viewport
                  {isIdentifying && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Analyzing Frame...
                    </span>
                  )}
                </h3>

                {activeTab === "camera" && cameraActive && (
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoScan}
                        onChange={(e) => setAutoScan(e.target.checked)}
                        className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      Auto-Scan
                    </label>
                    <select
                      value={scanIntervalMs}
                      onChange={(e) => setScanIntervalMs(Number(e.target.value))}
                      className="text-xs border rounded-lg px-2 py-1 bg-gray-50 text-gray-700 font-semibold focus:outline-none"
                    >
                      <option value={1000}>1.0s</option>
                      <option value={1500}>1.5s</option>
                      <option value={2000}>2.0s</option>
                      <option value={3000}>3.0s</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Viewport Area */}
              <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-center">
                {activeTab === "camera" ? (
                  cameraActive ? (
                    <>
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover"
                      />
                      <canvas
                        ref={overlayCanvasRef}
                        className="absolute inset-0 pointer-events-none w-full h-full"
                      />
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-gray-400 p-8 text-center">
                      <CameraOff className="h-12 w-12 text-gray-600 stroke-[1.5]" />
                      <div>
                        <p className="text-sm font-bold text-gray-300">Camera Stream Offline</p>
                        <p className="text-xs text-gray-500 mt-1">Start camera stream to identify items in real-time</p>
                      </div>
                      <button
                        onClick={() => startCamera()}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2 mt-2 font-sans"
                      >
                        <Camera className="h-4 w-4" /> Start Camera
                      </button>
                    </div>
                  )
                ) : (
                  imagePreviewUrl ? (
                    <div className="relative max-w-full max-h-full flex items-center justify-center">
                      <img
                        ref={sourceImageRef}
                        src={imagePreviewUrl}
                        alt="Upload Preview"
                        className="max-h-[380px] object-contain rounded-lg"
                        onLoad={() => {
                          if (identifyResult?.vision?.detections && sourceImageRef.current) {
                            const img = sourceImageRef.current;
                            drawBoundingBoxes(
                              identifyResult.vision.detections,
                              img.clientWidth,
                              img.clientHeight,
                              img.naturalWidth || img.clientWidth,
                              img.naturalHeight || img.clientHeight
                            );
                          }
                        }}
                      />
                      <canvas
                        ref={overlayCanvasRef}
                        className="absolute inset-0 pointer-events-none w-full h-full"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 text-gray-400 p-8 text-center">
                      <Upload className="h-12 w-12 text-gray-600 stroke-[1.5]" />
                      <div>
                        <p className="text-sm font-bold text-gray-300">No Image File Selected</p>
                        <p className="text-xs text-gray-500 mt-1">Upload a product image to run multi-signal verification</p>
                      </div>
                      <label className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-md cursor-pointer flex items-center gap-2 mt-2">
                        <Upload className="h-4 w-4" /> Choose Image File
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleImageUpload(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  )
                )}
              </div>

              {/* Controls Bar */}
              <div className="bg-gray-100 p-3 rounded-xl border border-gray-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {activeTab === "camera" && (
                    !cameraActive ? (
                      <button
                        onClick={() => startCamera()}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition shadow-xs flex items-center gap-1.5"
                      >
                        <Camera className="h-4 w-4" />
                        Start Camera
                      </button>
                    ) : (
                      <button
                        onClick={stopCamera}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition shadow-xs flex items-center gap-1.5"
                      >
                        <CameraOff className="h-4 w-4" />
                        Stop Camera
                      </button>
                    )
                  )}

                  {activeTab === "camera" && cameraActive && (
                    <button
                      onClick={captureFrameSnapshot}
                      className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 text-xs font-bold px-3.5 py-2 rounded-lg transition shadow-xs flex items-center gap-1.5"
                    >
                      <Zap className="h-4 w-4 text-amber-500" />
                      Capture Frame
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={captureAndScanFrame}
                    disabled={isIdentifying || (activeTab === "camera" && !cameraActive && !selectedImageFile) || (activeTab === "upload" && !selectedImageFile)}
                    className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-xs flex items-center gap-1.5"
                  >
                    <Sparkles className="h-4 w-4" />
                    {isIdentifying ? "Verifying..." : "Verify Frame"}
                  </button>
                </div>
              </div>
            </div>

            {/* Right Column: Multi-Signal Result Panel */}
            <div className="flex flex-col gap-4">
              <IdentificationResultPanel
                result={identifyResult}
                isLoading={isIdentifying}
                onAddToCart={handleAddToCart}
                stabilityStatus={stabilityStatus}
              />
            </div>
          </div>
        )}

        {/* Live Shopping Cart Footer */}
        {sessionCart.length > 0 && (
          <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-emerald-600" />
                Live Shopping Session Cart ({sessionCart.length} Unique Products, {cartTotalItems} Total Units)
              </h3>
              <button
                onClick={handleClearCart}
                className="text-xs text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear Cart
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {sessionCart.map((item) => (
                <div
                  key={item.product_id}
                  className="bg-gray-50 border border-gray-200 p-3.5 rounded-xl flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900 text-xs">{item.name}</h4>
                      <span className="text-[10px] text-gray-500 font-mono">
                        ₹{item.unit_price} × {item.quantity} = ₹{item.total_price} | {item.total_expected_weight} kg
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveFromCart(item.product_id)}
                      className="text-gray-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between border-t pt-2 mt-1">
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full uppercase">
                      ✓ Verified
                    </span>
                    <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-lg p-0.5">
                      <button
                        onClick={() => handleUpdateQuantity(item.product_id, -1)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-600"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-2 text-xs font-mono font-bold text-gray-900">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleUpdateQuantity(item.product_id, 1)}
                        className="p-1 hover:bg-gray-100 rounded text-gray-600"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
