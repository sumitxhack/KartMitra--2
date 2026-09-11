"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  CameraOff,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Box,
  Layers,
  Sparkles,
  Info,
  Zap,
  HelpCircle,
  XCircle,
  Award,
  BarChart2,
  Clock,
  Send,
  AlertTriangle,
  ShoppingCart,
  Check,
  FileSearch,
  Bug
} from "lucide-react";
import Navigation from "@/components/Navigation";

interface MultiDetection {
  detection_id: number;
  bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };
  yolo: {
    class_name: string;
    detection_confidence: number;
  };
  visual_match: {
    product_id: string | null;
    product_name: string | null;
    similarity: number;
    top2_similarity?: number | null;
    margin?: number | null;
    decision: string;
    best_reference_image_id?: string | null;
    candidates?: Array<{
      rank: number;
      product_id: string;
      product_name: string;
      similarity: number;
      reference_image_id?: string;
    }>;
  };
  product_id?: string | null;
  product?: {
    id: string;
    barcode?: string;
    name: string;
    price: number;
    weight: number;
    category?: string;
  } | null;
  similarity?: number;
  margin?: number | null;
  decision: string;
  associated_barcode?: string | null;
  reason?: string;
}

interface CartItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit_weight: number;
  total_expected_weight: number;
  expected_weight: number;
  status: string;
}

interface MultiResponse {
  success: boolean;
  frame?: { width: number; height: number };
  total_detections: number;
  detections: MultiDetection[];
  cart_summary: CartItem[];
  summary: {
    matched: number;
    review: number;
    unknown: number;
    mismatch: number;
  };
  cart: {
    total_items: number;
    total_price: number;
    expected_weight: number;
  };
  frame_status: string;
}

interface ProductItem {
  id: string;
  barcode: string;
  name: string;
}

export default function VisionTestPage() {
  const [activeTab, setActiveTab] = useState<"camera" | "upload">("camera");

  // Camera states
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  // Auto detect & Throttling (Default TRUE for instant live camera bounding boxes & matching)
  const [autoDetect, setAutoDetect] = useState(true);
  const [scanIntervalMs, setScanIntervalMs] = useState(1000);

  // Upload & Frame Capture states
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [capturedSnapshotUrl, setCapturedSnapshotUrl] = useState<string | null>(null);

  // Multi-Product Recognition State
  const [isDetecting, setIsDetecting] = useState(false);
  const [multiResult, setMultiResult] = useState<MultiResponse | null>(null);
  const [debugMode, setDebugMode] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  // Registered Products for Ground-Truth selection
  const [registeredProducts, setRegisteredProducts] = useState<ProductItem[]>([]);
  
  // Evaluation Ground-Truth Test Form States
  const [expectedProductId, setExpectedProductId] = useState<string>("UNKNOWN");
  const [condition, setCondition] = useState<string>("normal");
  const [lighting, setLighting] = useState<string>("normal");
  const [angle, setAngle] = useState<string>("front");
  const [distance, setDistance] = useState<string>("medium");
  const [occlusion, setOcclusion] = useState<string>("none");
  const [notes, setNotes] = useState<string>("");
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evalTestResult, setEvalTestResult] = useState<any>(null);
  const [hardExampleMsg, setHardExampleMsg] = useState<string | null>(null);

  // Canvas and Media Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const sourceImageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingRef = useRef(false);

  const API_BASE = "http://127.0.0.1:8000";

  // Camera Device Selection states
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/products`)
      .then((res) => res.json())
      .then((data) => {
        if (data.products) {
          setRegisteredProducts(data.products);
        } else if (Array.isArray(data)) {
          setRegisteredProducts(data);
        }
      })
      .catch((err) => console.log("Failed to load products:", err));
  }, []);

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
      setAutoDetect(true); // Turn on Live Auto-Scan by default when camera starts
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

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
    setCameraActive(false);
    stopAutoDetect();
    clearCanvas();
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  };

  const startAutoDetect = () => {
    stopAutoDetect();
    detectIntervalRef.current = setInterval(() => {
      if (!isProcessingRef.current) {
        captureAndScanFrame();
      }
    }, scanIntervalMs);
  };

  const stopAutoDetect = () => {
    if (detectIntervalRef.current) {
      clearInterval(detectIntervalRef.current);
      detectIntervalRef.current = null;
    }
  };

  useEffect(() => {
    if (activeTab === "camera" && cameraActive && autoDetect) {
      startAutoDetect();
    } else {
      stopAutoDetect();
    }
    return () => stopAutoDetect();
  }, [cameraActive, autoDetect, activeTab, scanIntervalMs]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const drawBoundingBoxes = (
    dets: MultiDetection[],
    displayWidth: number,
    displayHeight: number,
    originalWidth: number,
    originalHeight: number
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, displayWidth, displayHeight);

    if (!dets || dets.length === 0) return;

    const scaleX = displayWidth / Math.max(1, originalWidth);
    const scaleY = displayHeight / Math.max(1, originalHeight);

    dets.forEach((det) => {
      const box = det.bbox;
      const dec = det.decision || "UNKNOWN";
      const pName = det.product?.name || det.visual_match?.product_name || "Unknown Product";
      const sim = det.similarity ?? det.visual_match?.similarity ?? 0.0;
      const simPercent = Math.round(sim * 100);

      const x = (box.x1 !== undefined ? box.x1 : (box.x || 0)) * scaleX;
      const y = (box.y1 !== undefined ? box.y1 : (box.y || 0)) * scaleY;
      const width = ((box.x2 !== undefined && box.x1 !== undefined) ? (box.x2 - box.x1) : (box.width || 50)) * scaleX;
      const height = ((box.y2 !== undefined && box.y1 !== undefined) ? (box.y2 - box.y1) : (box.height || 50)) * scaleY;

      // Color scheme: Bright Neon Emerald Green (#00e676 / #10b981) for MATCH
      let strokeColor = "#10b981"; // Bright Green for MATCH
      let fillBg = "rgba(16, 185, 129, 0.22)";
      let tagPrefix = "✓ MATCH";

      if (dec === "MATCH") {
        strokeColor = "#10b981";
        fillBg = "rgba(16, 185, 129, 0.22)";
        tagPrefix = "✓ MATCH";
      } else if (dec === "REVIEW") {
        strokeColor = "#f59e0b"; // Bright Amber
        fillBg = "rgba(245, 158, 11, 0.20)";
        tagPrefix = "⚠️ REVIEW";
      } else if (dec === "MISMATCH") {
        strokeColor = "#ef4444"; // Red
        fillBg = "rgba(239, 68, 68, 0.22)";
        tagPrefix = "❌ MISMATCH";
      } else {
        strokeColor = "#6b7280"; // Gray
        fillBg = "rgba(107, 114, 128, 0.18)";
        tagPrefix = "❓ UNKNOWN";
      }

      // 1. Semi-transparent background fill
      ctx.fillStyle = fillBg;
      ctx.fillRect(x, y, width, height);

      // 2. Thick bounding box outline
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 4;
      ctx.strokeRect(x, y, width, height);

      // 3. Corner HUD reticle brackets for camera view
      const reticleLen = Math.min(24, Math.min(width, height) / 4);
      ctx.lineWidth = 6;
      ctx.strokeStyle = strokeColor;

      // Top-Left corner
      ctx.beginPath();
      ctx.moveTo(x, y + reticleLen);
      ctx.lineTo(x, y);
      ctx.lineTo(x + reticleLen, y);
      ctx.stroke();

      // Top-Right corner
      ctx.beginPath();
      ctx.moveTo(x + width - reticleLen, y);
      ctx.lineTo(x + width, y);
      ctx.lineTo(x + width, y + reticleLen);
      ctx.stroke();

      // Bottom-Left corner
      ctx.beginPath();
      ctx.moveTo(x, y + height - reticleLen);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + reticleLen, y + height);
      ctx.stroke();

      // Bottom-Right corner
      ctx.beginPath();
      ctx.moveTo(x + width - reticleLen, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + width, y + height - reticleLen);
      ctx.stroke();

      // 4. Product Name & Confidence Pill Banner Tag
      const labelText = `${tagPrefix}: ${pName}`;
      const confText = `#${det.detection_id} | Similarity: ${simPercent}%`;

      ctx.font = "bold 13px Inter, sans-serif";
      const nameWidth = ctx.measureText(labelText).width;
      ctx.font = "11px Inter, sans-serif";
      const confWidth = ctx.measureText(confText).width;
      const bannerWidth = Math.max(nameWidth, confWidth) + 20;
      const bannerHeight = 40;

      const bannerY = y - bannerHeight >= 0 ? y - bannerHeight : y;

      // Draw Pill Tag Background
      ctx.fillStyle = strokeColor;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x, bannerY, bannerWidth, bannerHeight, 8);
      } else {
        ctx.rect(x, bannerY, bannerWidth, bannerHeight);
      }
      ctx.fill();

      // Product Name Text
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 13px Inter, sans-serif";
      ctx.fillText(labelText, x + 10, bannerY + 17);

      // Similarity & Detection ID Text
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.font = "bold 11px Inter, sans-serif";
      ctx.fillText(confText, x + 10, bannerY + 32);
    });
  };


  const sendDetectionRequest = async (imageBlob: Blob) => {
    if (isProcessingRef.current) return null;
    isProcessingRef.current = true;
    setIsDetecting(true);
    setError(null);

    const formData = new FormData();
    formData.append("image", imageBlob, "detection_input.jpg");

    try {
      // 1. Primary endpoint: /api/v1/recognition/multi
      let response: Response | null = null;
      try {
        response = await fetch(`${API_BASE}/api/v1/recognition/multi`, {
          method: "POST",
          body: formData,
        });
      } catch (fetchErr) {
        console.warn("Primary endpoint fetch failed, backend server might be offline:", fetchErr);
        setError("Backend Server Offline: Ensure FastAPI is running on http://127.0.0.1:8000.");
        setMultiResult(null);
        clearCanvas();
        return null;
      }

      // 2. Secondary fallback: /recognition/multi
      if (response && response.status === 404) {
        const formData2 = new FormData();
        formData2.append("image", imageBlob, "detection_input.jpg");
        try {
          response = await fetch(`${API_BASE}/recognition/multi`, {
            method: "POST",
            body: formData2,
          });
        } catch (fErr2) {
          console.warn("Secondary endpoint fetch failed:", fErr2);
        }
      }


      // 3. Fallback to /api/v1/recognition/identify if backend server hasn't been restarted yet
      if (response.status === 404) {
        console.warn("Multi-product route /api/v1/recognition/multi returned 404. Falling back to /identify. Please restart FastAPI backend.");
        const formData3 = new FormData();
        formData3.append("image", imageBlob, "detection_input.jpg");
        const identResp = await fetch(`${API_BASE}/api/v1/recognition/identify`, {
          method: "POST",
          body: formData3,
        });

        if (!identResp.ok) {
          throw new Error(`HTTP error ${identResp.status}`);
        }

        const identData = await identResp.json();
        const detList = identData.vision?.detections || [];
        const isMatched = identData.status === "MATCH";
        const isReview = identData.status === "REVIEW";

        const transformedDetections: MultiDetection[] = detList.map((d: any, idx: number) => ({
          detection_id: idx + 1,
          bbox: {
            x1: d.bounding_box?.x || 0,
            y1: d.bounding_box?.y || 0,
            x2: (d.bounding_box?.x || 0) + (d.bounding_box?.width || 100),
            y2: (d.bounding_box?.y || 0) + (d.bounding_box?.height || 100),
            x: d.bounding_box?.x || 0,
            y: d.bounding_box?.y || 0,
            width: d.bounding_box?.width || 100,
            height: d.bounding_box?.height || 100,
          },
          yolo: {
            class_name: d.name || "object",
            detection_confidence: d.confidence || 0.0,
          },
          visual_match: {
            product_id: d.product_id || identData.product?.id || null,
            product_name: d.name || identData.product?.name || null,
            similarity: identData.visual_match?.similarity || d.confidence || 0.0,
            margin: identData.visual_match?.margin || null,
            decision: isMatched ? "MATCH" : (isReview ? "REVIEW" : "UNKNOWN"),
          },
          product_id: d.product_id || identData.product?.id || null,
          product: identData.product?.id ? identData.product : null,
          similarity: identData.visual_match?.similarity || d.confidence || 0.0,
          decision: isMatched ? "MATCH" : (isReview ? "REVIEW" : "UNKNOWN"),
          reason: identData.reason || "",
        }));

        const cartSummary: CartItem[] = (isMatched && identData.product?.id) ? [{
          product_id: identData.product.id,
          name: identData.product.name,
          quantity: 1,
          unit_price: identData.product.price || 0,
          total_price: identData.product.price || 0,
          unit_weight: identData.product.weight || 0,
          total_expected_weight: identData.product.weight || 0,
          expected_weight: identData.product.weight || 0,
          status: "VERIFIED"
        }] : [];

        const fallbackMulti: MultiResponse = {
          success: true,
          total_detections: transformedDetections.length,
          detections: transformedDetections,
          cart_summary: cartSummary,
          summary: {
            matched: isMatched ? 1 : 0,
            review: isReview ? 1 : 0,
            unknown: (!isMatched && !isReview) ? 1 : 0,
            mismatch: 0,
          },
          cart: {
            total_items: cartSummary.length,
            total_price: cartSummary.reduce((acc, c) => acc + c.total_price, 0),
            expected_weight: cartSummary.reduce((acc, c) => acc + c.expected_weight, 0),
          },
          frame_status: isMatched ? "VERIFIED" : (isReview ? "REVIEW" : "REVIEW")
        };

        setMultiResult(fallbackMulti);
        setLastScanTime(new Date().toLocaleTimeString());
        setError("Note: Backend server needs a quick restart to activate new /api/v1/recognition/multi endpoint (Running on fallback).");
        return fallbackMulti;
      }

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const data: MultiResponse = await response.json();
      setMultiResult(data);
      setLastScanTime(new Date().toLocaleTimeString());
      setError(null);
      return data;
    } catch (err: any) {
      console.error("Multi recognition API error:", err);
      setError(`API Error: ${err?.message || "Failed to communicate with FastAPI backend."} Please restart backend server.`);
      setMultiResult(null);
      clearCanvas();
      return null;
    } finally {
      setIsDetecting(false);
      isProcessingRef.current = false;
    }
  };

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
        const resData = await sendDetectionRequest(blob);

        if (resData && videoRef.current) {
          drawBoundingBoxes(
            resData.detections,
            videoRef.current.clientWidth,
            videoRef.current.clientHeight,
            resData.frame?.width || video.videoWidth,
            resData.frame?.height || video.videoHeight
          );
        }
      }, "image/jpeg", 0.85);
    } else if (selectedImageFile) {
      const resData = await sendDetectionRequest(selectedImageFile);
      if (resData && sourceImageRef.current) {
        const img = sourceImageRef.current;
        drawBoundingBoxes(
          resData.detections,
          img.clientWidth,
          img.clientHeight,
          resData.frame?.width || img.naturalWidth || img.clientWidth,
          resData.frame?.height || img.naturalHeight || img.clientHeight
        );
      }
    }
  };

  const handleImageUpload = (file: File) => {
    setSelectedImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
    setCapturedSnapshotUrl(null);
    setMultiResult(null);
    setError(null);
    clearCanvas();
  };

  // Run Evaluation Test (Step 15Y)
  const handleRunEvaluationTest = async () => {
    if (!selectedImageFile && (!cameraActive || !videoRef.current)) {
      setError("Please capture a camera frame or upload an image first.");
      return;
    }

    setIsEvaluating(true);
    setEvalTestResult(null);
    setHardExampleMsg(null);

    const formData = new FormData();
    if (selectedImageFile) {
      formData.append("file", selectedImageFile);
    } else if (videoRef.current) {
      const tempCanvas = document.createElement("canvas");
      tempCanvas.width = videoRef.current.videoWidth || 640;
      tempCanvas.height = videoRef.current.videoHeight || 480;
      const ctx = tempCanvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0);
        const blob = await new Promise<Blob | null>((resolve) => tempCanvas.toBlob(resolve, "image/jpeg", 0.90));
        if (blob) {
          formData.append("file", blob, "eval_frame.jpg");
        }
      }
    }

    formData.append("expected_products", expectedProductId);

    try {
      const res = await fetch(`${API_BASE}/api/v1/evaluation/multi-test`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      setEvalTestResult(data);
    } catch (err) {
      console.error("Multi evaluation test API error:", err);
      setError("Failed to execute multi evaluation test API.");
    } finally {
      setIsEvaluating(false);
    }
  };

  const reviewDetections = multiResult?.detections.filter((d) => d.decision === "REVIEW") || [];
  const unknownDetections = multiResult?.detections.filter((d) => d.decision === "UNKNOWN") || [];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Header Section */}
        <header className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              <Sparkles className="h-4 w-4" /> Multi-Product Verification & Quantity Counting Studio
            </div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              Step 15 — Multi-Product Visual Pipeline
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Per-product crop extraction, batch DINOv2 embeddings, FAISS search, quantity counting & cart verification
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setDebugMode(!debugMode)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border ${
                debugMode ? "bg-slate-900 text-amber-400 border-slate-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
              }`}
            >
              <Bug className="h-4 w-4" />
              {debugMode ? "Debug Mode ON" : "Debug Mode OFF"}
            </button>

            <div className="flex items-center bg-gray-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => {
                  setActiveTab("camera");
                  setMultiResult(null);
                  clearCanvas();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
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
                  setMultiResult(null);
                  clearCanvas();
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "upload"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Upload className="h-4 w-4" />
                Image Upload
              </button>
            </div>
          </div>
        </header>

        {/* Frame Status Banner */}
        {multiResult && (
          <div className={`p-4 rounded-2xl border shadow-sm flex items-center justify-between gap-4 ${
            multiResult.frame_status === "VERIFIED"
              ? "bg-emerald-600 text-white border-emerald-700"
              : multiResult.frame_status === "MISMATCH"
              ? "bg-rose-600 text-white border-rose-700"
              : multiResult.frame_status === "REVIEW"
              ? "bg-amber-500 text-white border-amber-600"
              : "bg-slate-800 text-white border-slate-700"
          }`}>
            <div className="flex items-center gap-3">
              {multiResult.frame_status === "VERIFIED" ? (
                <CheckCircle2 className="h-7 w-7 text-emerald-200 shrink-0" />
              ) : multiResult.frame_status === "MISMATCH" ? (
                <XCircle className="h-7 w-7 text-rose-200 shrink-0" />
              ) : (
                <AlertTriangle className="h-7 w-7 text-amber-200 shrink-0" />
              )}
              <div>
                <h4 className="text-base font-black tracking-wide">
                  FRAME STATUS: {multiResult.frame_status}
                </h4>
                <p className="text-xs opacity-90 mt-0.5">
                  Detected {multiResult.total_detections} product(s) | Matched: {multiResult.summary.matched} | Review: {multiResult.summary.review} | Unknown: {multiResult.summary.unknown}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-bold">
              <span className="bg-white/20 px-3 py-1.5 rounded-xl">
                Cart Total: ₹{multiResult.cart.total_price} ({multiResult.cart.total_items} items)
              </span>
              <span className="bg-white/20 px-3 py-1.5 rounded-xl font-mono">
                Exp. Weight: {multiResult.cart.expected_weight} kg
              </span>
            </div>
          </div>
        )}

        {/* Main Grid Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Viewport Column (2 cols wide on large screen) */}
          <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                Multi-Product Camera Viewport
                {isDetecting && (
                  <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <RefreshCw className="h-3 w-3 animate-spin" /> Batch Processing...
                  </span>
                )}
              </h3>

              {activeTab === "camera" && cameraActive && (
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoDetect}
                      onChange={(e) => setAutoDetect(e.target.checked)}
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

            {/* Viewport Display Box */}
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
                      ref={canvasRef}
                      className="absolute inset-0 pointer-events-none w-full h-full"
                    />
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-gray-400 p-8 text-center">
                    <CameraOff className="h-12 w-12 text-gray-600 stroke-[1.5]" />
                    <div>
                      <p className="text-sm font-bold text-gray-300">Camera Stream Offline</p>
                      <p className="text-xs text-gray-500 mt-1">Start camera stream to run multi-product detection & quantity counting</p>
                    </div>
                    <button
                      onClick={() => startCamera()}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-md flex items-center gap-2 mt-2"
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
                      alt="Upload Target"
                      className="max-h-[450px] object-contain rounded-lg"
                      onLoad={() => {
                        if (multiResult && sourceImageRef.current) {
                          const img = sourceImageRef.current;
                          drawBoundingBoxes(
                            multiResult.detections,
                            img.clientWidth,
                            img.clientHeight,
                            multiResult.frame?.width || img.naturalWidth || img.clientWidth,
                            multiResult.frame?.height || img.naturalHeight || img.clientHeight
                          );
                        }
                      }}
                    />
                    <canvas
                      ref={canvasRef}
                      className="absolute inset-0 pointer-events-none w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-gray-400 p-8 text-center">
                    <Upload className="h-12 w-12 text-gray-600 stroke-[1.5]" />
                    <div>
                      <p className="text-sm font-bold text-gray-300">No Multi-Product Image Uploaded</p>
                      <p className="text-xs text-gray-500 mt-1">Upload a frame containing multiple items to test detection & cart summary</p>
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
                {!cameraActive ? (
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
                    className="text-xs border border-gray-300 rounded-lg px-2.5 py-2 bg-white text-gray-700 font-semibold focus:outline-none max-w-[160px] truncate"
                  >
                    {videoDevices.map((dev, idx) => (
                      <option key={dev.deviceId || idx} value={dev.deviceId}>
                        {dev.label || `Webcam ${idx + 1}`}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  onClick={captureFrameSnapshot}
                  disabled={!cameraActive}
                  className="bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white text-xs font-bold px-3.5 py-2 rounded-lg transition shadow-xs flex items-center gap-1.5"
                >
                  <Camera className="h-4 w-4 text-emerald-400" />
                  Capture
                </button>

                <button
                  onClick={captureAndScanFrame}
                  disabled={isDetecting || (!cameraActive && !selectedImageFile)}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-md flex items-center gap-1.5"
                >
                  {isDetecting ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 fill-current text-yellow-300" />
                  )}
                  Multi-Scan & Verify
                </button>
              </div>

              {lastScanTime && (
                <span className="text-[11px] font-medium text-gray-500 ml-auto">
                  Last multi-scan: {lastScanTime}
                </span>
              )}
            </div>

            {/* STEP 15P: Detected Products Raw List */}
            {multiResult && multiResult.detections.length > 0 && (
              <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between border-b pb-2">
                  <h4 className="font-bold text-gray-900 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                    <Box className="h-4 w-4 text-blue-600" /> STEP 15P — DETECTED PRODUCTS ({multiResult.total_detections})
                  </h4>
                  <span className="text-[11px] font-semibold text-gray-500">
                    Object IDs: {multiResult.detections.map((d) => `#${d.detection_id}`).join(", ")}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {multiResult.detections.map((det) => (
                    <div
                      key={det.detection_id}
                      className={`p-3 rounded-xl border flex items-center justify-between ${
                        det.decision === "MATCH"
                          ? "bg-emerald-50/70 border-emerald-200"
                          : det.decision === "REVIEW"
                          ? "bg-amber-50/70 border-amber-200"
                          : det.decision === "MISMATCH"
                          ? "bg-rose-50/70 border-rose-200"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-slate-800 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                          #{det.detection_id}
                        </span>
                        <div>
                          <span className="font-bold text-gray-900 block">
                            {det.product?.name || det.visual_match?.product_name || "Unknown Object"}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono block">
                            YOLO: {det.yolo?.class_name} ({Math.round((det.yolo?.detection_confidence || 0) * 100)}%)
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                          det.decision === "MATCH"
                            ? "bg-emerald-100 text-emerald-800"
                            : det.decision === "REVIEW"
                            ? "bg-amber-100 text-amber-800"
                            : det.decision === "MISMATCH"
                            ? "bg-rose-100 text-rose-800"
                            : "bg-gray-200 text-gray-700"
                        }`}>
                          {Math.round((det.similarity || 0) * 100)}% {det.decision}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ground Truth Evaluation Panel */}
            <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md flex flex-col gap-4 mt-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
                  <Award className="h-4 w-4 text-blue-400" /> Tester Ground-Truth Evaluation Panel (Multi-Product)
                </h3>
                <span className="text-[10px] font-bold text-blue-300 bg-blue-950 border border-blue-800 px-2 py-0.5 rounded-full">
                  Step 15 Benchmarking
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-slate-400 font-semibold mb-1 block">Expected Product IDs / Names (Comma separated)</label>
                  <input
                    type="text"
                    value={expectedProductId}
                    onChange={(e) => setExpectedProductId(e.target.value)}
                    placeholder="e.g. p001, p002, p001"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 placeholder-slate-500 font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 font-semibold mb-1 block">Notes / Observations</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. 3 products overlapping on table"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <button
                  onClick={handleRunEvaluationTest}
                  disabled={isEvaluating}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition shadow-md flex items-center gap-2"
                >
                  {isEvaluating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  RUN MULTI EVALUATION TEST
                </button>
              </div>

              {evalTestResult && (
                <div className={`p-4 rounded-xl border flex flex-col gap-2 text-xs ${
                  evalTestResult.exact_match ? "bg-emerald-950 border-emerald-800 text-emerald-100" : "bg-amber-950 border-amber-800 text-amber-100"
                }`}>
                  <div className="flex items-center justify-between font-bold">
                    <span>Exact Cart-Set Match: {evalTestResult.exact_match ? "✓ YES" : "✗ NO"}</span>
                    <span>Frame Status: {evalTestResult.frame_status}</span>
                  </div>
                  {evalTestResult.metrics && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-800 text-[11px] font-mono">
                      <div>Precision: {(evalTestResult.metrics.detection_precision * 100).toFixed(1)}%</div>
                      <div>Recall: {(evalTestResult.metrics.detection_recall * 100).toFixed(1)}%</div>
                      <div>Prod Accuracy: {(evalTestResult.metrics.product_recognition_accuracy * 100).toFixed(1)}%</div>
                      <div>Quantity Accuracy: {evalTestResult.metrics.quantity_accuracy === 1 ? "100%" : "FAIL"}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Step 15 Cart Summary & Review Sections */}
          <div className="flex flex-col gap-6">
            {/* STEP 15Q: MY CART Summary */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-emerald-600" /> MY CART
                </h3>
                {multiResult && (
                  <span className="text-xs bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full font-black">
                    {multiResult.cart.total_items} Items
                  </span>
                )}
              </div>

              {multiResult && multiResult.cart_summary.length > 0 ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-2">
                    {multiResult.cart_summary.map((item) => (
                      <div key={item.product_id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-black text-gray-900 block text-sm">{item.name}</span>
                          <span className="text-gray-500 font-medium">
                            ₹{item.unit_price} × {item.quantity} | {item.total_expected_weight} kg
                          </span>
                        </div>
                        <span className="font-black text-base text-gray-900 font-mono">
                          ₹{item.total_price}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex flex-col gap-1.5 text-xs text-emerald-950 font-semibold">
                    <div className="flex justify-between">
                      <span>Total Items:</span>
                      <span className="font-bold">{multiResult.cart.total_items}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Expected Total Weight:</span>
                      <span className="font-mono font-bold">{multiResult.cart.expected_weight} kg</span>
                    </div>
                    <div className="flex justify-between text-sm font-black text-emerald-900 border-t border-emerald-200 pt-2 mt-1">
                      <span>Total Price:</span>
                      <span className="font-mono text-base">₹{multiResult.cart.total_price}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl border border-dashed text-xs">
                  No verified products in cart yet. Run <strong>Multi-Scan & Verify</strong>.
                </div>
              )}
            </div>

            {/* STEP 15R: NEEDS REVIEW SECTION */}
            {reviewDetections.length > 0 && (
              <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                  <h4 className="font-black text-amber-900 text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" /> NEEDS REVIEW ({reviewDetections.length})
                  </h4>
                  <span className="text-[10px] font-bold uppercase bg-amber-200 text-amber-900 px-2 py-0.5 rounded">
                    Unresolved
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {reviewDetections.map((det) => (
                    <div key={det.detection_id} className="bg-white p-3 rounded-xl border border-amber-300 text-xs flex flex-col gap-2">
                      <div className="flex justify-between font-bold text-amber-950">
                        <span>Detection #{det.detection_id}</span>
                        <span>Reason: {det.reason || "Ambiguous visual match"}</span>
                      </div>

                      {det.visual_match?.candidates && det.visual_match.candidates.length > 0 && (
                        <div className="flex flex-col gap-1 text-[11px]">
                          <span className="font-bold text-gray-600">Possible Candidates:</span>
                          {det.visual_match.candidates.slice(0, 2).map((cand) => (
                            <div key={cand.product_id} className="flex justify-between bg-amber-50/60 p-1.5 rounded border border-amber-200">
                              <span>{cand.rank}. {cand.product_name}</span>
                              <span className="font-mono font-bold">{cand.similarity}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 15S: UNKNOWN PRODUCTS SECTION */}
            {unknownDetections.length > 0 && (
              <div className="bg-gray-100 p-5 rounded-2xl border border-gray-300 shadow-xs flex flex-col gap-3">
                <div className="flex items-center justify-between border-b border-gray-300 pb-2">
                  <h4 className="font-black text-gray-900 text-sm flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-gray-600" /> UNKNOWN PRODUCTS ({unknownDetections.length})
                  </h4>
                  <span className="text-[10px] font-bold uppercase bg-gray-300 text-gray-800 px-2 py-0.5 rounded">
                    Not Registered
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {unknownDetections.map((det) => (
                    <div key={det.detection_id} className="bg-white p-3 rounded-xl border border-gray-300 text-xs flex flex-col gap-1">
                      <div className="flex justify-between font-bold text-gray-900">
                        <span>Detection #{det.detection_id}</span>
                        <span>Similarity: {det.similarity ?? 0.0}</span>
                      </div>
                      <p className="text-[11px] text-gray-500">
                        No sufficiently similar registered product found. Object will not enter verified cart automatically.
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 15T: DEBUG MODE INSPECTOR */}
            {debugMode && multiResult && (
              <div className="bg-slate-950 text-slate-100 p-5 rounded-2xl border border-slate-800 shadow-lg flex flex-col gap-4 font-mono text-xs">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <h4 className="font-bold text-amber-400 flex items-center gap-2">
                    <Bug className="h-4 w-4 text-amber-400" /> STEP 15T — DEBUG MODE INSPECTOR
                  </h4>
                </div>

                <div className="flex flex-col gap-3 max-h-[400px] overflow-y-auto pr-1">
                  {multiResult.detections.map((det) => (
                    <div key={det.detection_id} className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col gap-1.5 text-[11px]">
                      <div className="flex justify-between font-bold text-emerald-400">
                        <span>DETECTION #{det.detection_id}</span>
                        <span>DECISION: {det.decision}</span>
                      </div>
                      <div>YOLO: {det.yolo?.class_name} (Conf: {det.yolo?.detection_confidence})</div>
                      <div>BBOX: [{det.bbox.x1}, {det.bbox.y1}, {det.bbox.x2}, {det.bbox.y2}]</div>
                      <div>Top1 Sim: {det.similarity} | Top2 Sim: {det.visual_match?.top2_similarity ?? "null"} | Margin: {det.margin ?? "null"}</div>
                      <div>Barcode: {det.associated_barcode || "None"}</div>
                      <div>Best Ref Image: {det.visual_match?.best_reference_image_id || "None"}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
