"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Upload,
  RefreshCw,
  Sparkles,
  Layers,
  Eye,
  Barcode as BarcodeIcon,
  Scale,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Trash2,
  Activity,
  Sliders,
  Check,
  Zap,
} from "lucide-react";
import Navigation from "@/components/Navigation";

// Interfaces
export interface Product {
  id: string;
  barcode: string;
  name: string;
  price: number;
  weight: number;
  category: string;
}

export interface VerificationChecks {
  session: boolean;
  barcode: boolean;
  vision: boolean;
  product: boolean;
  quantity: boolean;
  amount: boolean;
  weight: boolean;
}

export interface AISignalData {
  analysis: string;
  confidence: number;
  risk_score: number;
  recommendation: "PASS" | "REVIEW" | "FAIL";
  reason: string;
}

export interface VerificationResponse {
  status: "PASS" | "REVIEW" | "FAIL";
  risk_score: number;
  checks: VerificationChecks;
  expected: {
    weight: number;
    amount: number;
  };
  actual: {
    weight: number;
    amount: number;
  };
  differences: {
    weight: number;
    amount: number;
  };
  reasons: string[];
  ai_analysis?: AISignalData;
}

export interface TestHistoryEntry {
  id: string;
  timestamp: string;
  productName: string;
  barcode: string;
  detectedBarcode: string;
  barcodeMatch: boolean;
  detectedVisionProduct: string;
  visionConfidence: number;
  expectedWeight: number;
  actualWeight: number;
  weightDifference: number;
  weightWithinTolerance: boolean;
  checks: VerificationChecks;
  checksPassedCount: number;
  checksTotalCount: number;
  riskScore: number;
  aiRecommendation: string;
  aiReason: string;
  finalResult: "PASS" | "REVIEW" | "FAIL";
}

// Fallback Default Products Catalog for offline or immediate testing
const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "prod_amul_butter",
    barcode: "8901262010052",
    name: "Amul Pasteurised Butter 500g",
    price: 275,
    weight: 0.50,
    category: "Dairy & Eggs",
  },
  {
    id: "prod_amul_milk",
    barcode: "8901234567890",
    name: "Amul Taaza Toned Milk 1L",
    price: 62,
    weight: 1.00,
    category: "Dairy & Eggs",
  },
  {
    id: "prod_dairy_milk",
    barcode: "7622201741549",
    name: "Cadbury Dairy Milk Silk 150g",
    price: 180,
    weight: 0.15,
    category: "Confectionery",
  },
  {
    id: "prod_tata_salt",
    barcode: "8901058000078",
    name: "Tata Salt Iodized 1kg",
    price: 28,
    weight: 1.00,
    category: "Grocery Essentials",
  },
  {
    id: "prod_maggi",
    barcode: "8901058852318",
    name: "Maggi 2-Minute Noodles 280g",
    price: 52,
    weight: 0.28,
    category: "Instant Food",
  },
];

export default function VerificationDashboardPage() {
  const API_BASE = "http://127.0.0.1:8000";

  // Catalog Products State
  const [catalog, setCatalog] = useState<Product[]>(DEFAULT_PRODUCTS);
  const [selectedProductId, setSelectedProductId] = useState<string>(DEFAULT_PRODUCTS[0].id);
  const [quantity, setQuantity] = useState<number>(1);
  const [sessionId] = useState<string>("sess_test_001");
  const [sessionActive, setSessionActive] = useState<boolean>(true);

  // Section 2: Vision State
  const [visionMode, setVisionMode] = useState<"camera" | "upload" | "manual">("manual");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  
  // Vision Signal outputs
  const [detectedVisionProduct, setDetectedVisionProduct] = useState<string>(DEFAULT_PRODUCTS[0].name);
  const [boundingBox, setBoundingBox] = useState<[number, number, number, number]>([140, 90, 510, 460]);
  const [visionConfidence, setVisionConfidence] = useState<number>(0.95);

  // Section 3: Barcode State
  const [detectedBarcode, setDetectedBarcode] = useState<string>(DEFAULT_PRODUCTS[0].barcode);

  // Section 4: Weight State
  const [actualMockWeight, setActualMockWeight] = useState<number>(DEFAULT_PRODUCTS[0].weight);
  const weightToleranceKg = 0.05; // 50g tolerance

  // Section 5, 6, 7: Verification Engine & AI Output State
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResponse | null>(null);

  // Section 8: Test History Table State
  const [testHistory, setTestHistory] = useState<TestHistoryEntry[]>([]);
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<TestHistoryEntry | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "PASS" | "REVIEW" | "FAIL">("ALL");

  // Canvas and Media Refs
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch product catalog from Backend API on mount
  useEffect(() => {
    fetchProductsFromBackend();
    loadTestHistoryFromStorage();
  }, []);

  const fetchProductsFromBackend = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/products`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.products && data.products.length > 0) {
          setCatalog(data.products);
          setSelectedProductId(data.products[0].id);
        }
      }
    } catch {
      console.log("Using fallback product catalog (backend connection offline or starting)");
    }
  };

  const loadTestHistoryFromStorage = () => {
    try {
      const stored = localStorage.getItem("kartmitra_verification_test_history");
      if (stored) {
        setTestHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load test history:", e);
    }
  };

  const saveTestHistoryToStorage = (updated: TestHistoryEntry[]) => {
    try {
      localStorage.setItem("kartmitra_verification_test_history", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save test history:", e);
    }
  };

  // Selected Product Reference
  const selectedProduct = catalog.find((p) => p.id === selectedProductId) || catalog[0] || DEFAULT_PRODUCTS[0];

  // Auto update expected details when selected product or quantity changes
  const expectedWeightTotal = Number((selectedProduct.weight * quantity).toFixed(3));
  const expectedPriceTotal = selectedProduct.price * quantity;

  // Sync default mock inputs when selected product changes
  const handleProductSelect = (prodId: string) => {
    setSelectedProductId(prodId);
    const prod = catalog.find((p) => p.id === prodId);
    if (prod) {
      setDetectedBarcode(prod.barcode);
      setDetectedVisionProduct(prod.name);
      setActualMockWeight(Number((prod.weight * quantity).toFixed(3)));
    }
  };

  const handleQuantityChange = (newQty: number) => {
    const validQty = Math.max(1, newQty);
    setQuantity(validQty);
    if (selectedProduct) {
      setActualMockWeight(Number((selectedProduct.weight * validQty).toFixed(3)));
    }
  };

  // Camera Management
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      setStream(mediaStream);
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch {
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setStream(null);
    setCameraActive(false);
  };

  // Handle File Upload for Vision & Barcode
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setImagePreviewUrl(url);
    await processUploadedImage(file);
  };

  const processUploadedImage = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      // 1. Call Barcode Recognition API
      const barcodeRes = await fetch(`${API_BASE}/api/v1/recognition/barcode`, {
        method: "POST",
        body: formData,
      });
      if (barcodeRes.ok) {
        const bData = await barcodeRes.json();
        if (bData.success && bData.barcode) {
          setDetectedBarcode(bData.barcode);
        }
      }

      // 2. Call Vision Detect API
      const visionFormData = new FormData();
      visionFormData.append("file", file);
      const visionRes = await fetch(`${API_BASE}/api/v1/recognition/detect`, {
        method: "POST",
        body: visionFormData,
      });
      if (visionRes.ok) {
        const vData = await visionRes.json();
        if (vData.success && vData.detections && vData.detections.length > 0) {
          const topDet = vData.detections[0];
          setDetectedVisionProduct(topDet.class_name || topDet.name || selectedProduct.name);
          setVisionConfidence(topDet.confidence || 0.92);
          if (topDet.bbox) {
            setBoundingBox(topDet.bbox);
          }
        }
      }
    } catch {
      console.log("Vision API processing fallback");
    }
  };

  // Capture frame from active camera
  const captureCameraFrame = async () => {
    if (!videoRef.current || !cameraActive) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (blob) {
        const file = new File([blob], "camera_capture.jpg", { type: "image/jpeg" });
        setImagePreviewUrl(URL.createObjectURL(blob));
        await processUploadedImage(file);
      }
    }, "image/jpeg", 0.85);
  };

  // Barcode Lookup info
  const barcodeDbProduct = catalog.find((p) => p.barcode === detectedBarcode);
  const isBarcodeMatch = selectedProduct ? detectedBarcode === selectedProduct.barcode : false;

  // Weight Calculation
  const weightDifference = Number(Math.abs(actualMockWeight - expectedWeightTotal).toFixed(3));
  const isWeightWithinTolerance = weightDifference <= weightToleranceKg;

  // Master Run Verification Function
  const runVerificationTest = async () => {
    setIsVerifying(true);

    const payload = {
      session_id: sessionActive ? sessionId : "invalid_sess_999",
      actual_weight: actualMockWeight,
      detected_products: [
        {
          name: detectedVisionProduct,
          barcode: detectedBarcode,
          confidence: visionConfidence,
          bbox: boundingBox,
          quantity: quantity,
        },
      ],
      barcode_results: [detectedBarcode],
    };

    try {
      const response = await fetch(`${API_BASE}/api/v1/verification/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const resData: VerificationResponse = await response.json();
        setVerificationResult(resData);
        logTestToHistory(resData);
      } else {
        throw new Error("HTTP error " + response.status);
      }
    } catch {
      const fallbackRes = executeLocalRuleEngine();
      setVerificationResult(fallbackRes);
      logTestToHistory(fallbackRes);
    } finally {
      setIsVerifying(false);
    }
  };

  // Local Rule Engine Implementation
  const executeLocalRuleEngine = (): VerificationResponse => {
    const isSessionOk = sessionActive;
    const isBarcodeOk = isBarcodeMatch;
    const isVisionOk = detectedVisionProduct.toLowerCase().includes(selectedProduct.name.split(" ")[0].toLowerCase()) || visionConfidence >= 0.70;
    const isProductOk = isBarcodeMatch || isVisionOk;
    const isQuantityOk = true;
    const isAmountOk = isBarcodeMatch;
    const isWeightOk = isWeightWithinTolerance;

    const checks: VerificationChecks = {
      session: isSessionOk,
      barcode: isBarcodeOk,
      vision: isVisionOk,
      product: isProductOk,
      quantity: isQuantityOk,
      amount: isAmountOk,
      weight: isWeightOk,
    };

    const reasons: string[] = [];
    if (!isSessionOk) reasons.push("Invalid shopping session");
    if (!isBarcodeOk) reasons.push(`Barcode mismatch: scanned '${detectedBarcode}' vs expected '${selectedProduct.barcode}'`);
    if (!isVisionOk) reasons.push("Vision product detection confidence below threshold");
    if (!isWeightOk) reasons.push(`Weight variance ${weightDifference}kg exceeds ${weightToleranceKg}kg tolerance limit`);

    let risk = 0.0;
    if (!isSessionOk) risk += 0.50;
    if (!isBarcodeOk) risk += 0.30;
    if (!isVisionOk) risk += 0.20;
    if (!isWeightOk) risk += 0.40;
    else if (weightDifference > 0) risk += Number(((weightDifference / 0.05) * 0.2).toFixed(2));
    risk = Number(Math.min(1.0, risk).toFixed(2));

    let status: "PASS" | "REVIEW" | "FAIL" = "PASS";
    if (!isSessionOk || !isWeightOk || risk >= 0.50) {
      status = "FAIL";
    } else if (risk > 0.0 || !isBarcodeOk || !isVisionOk) {
      status = "REVIEW";
    }

    const aiRec: "PASS" | "REVIEW" | "FAIL" = status;
    const aiReasonText = status === "PASS"
      ? "All signals match reference specs within configurable tolerances."
      : status === "REVIEW"
      ? "Minor variance observed between scanned barcode, vision confidence, or packaging weight."
      : "Significant discrepancy detected in scale weight measurement or barcode verification.";

    return {
      status: status,
      risk_score: risk,
      checks: checks,
      expected: {
        weight: expectedWeightTotal,
        amount: expectedPriceTotal,
      },
      actual: {
        weight: actualMockWeight,
        amount: isBarcodeMatch ? expectedPriceTotal : (barcodeDbProduct?.price || 0) * quantity,
      },
      differences: {
        weight: weightDifference,
        amount: Math.abs((isBarcodeMatch ? expectedPriceTotal : (barcodeDbProduct?.price || 0) * quantity) - expectedPriceTotal),
      },
      reasons: reasons,
      ai_analysis: {
        analysis: `Evaluated ${selectedProduct.name} (Qty: ${quantity}). Barcode signal: ${isBarcodeMatch ? "MATCH" : "MISMATCH"}. Vision confidence: ${(visionConfidence * 100).toFixed(1)}%. Weight delta: ${weightDifference}kg.`,
        confidence: visionConfidence,
        risk_score: risk,
        recommendation: aiRec,
        reason: aiReasonText,
      },
    };
  };

  const logTestToHistory = (res: VerificationResponse) => {
    const passedCount = Object.values(res.checks).filter(Boolean).length;
    const totalCount = Object.keys(res.checks).length;

    const newEntry: TestHistoryEntry = {
      id: "test_" + Date.now().toString().slice(-6),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      productName: selectedProduct.name,
      barcode: selectedProduct.barcode,
      detectedBarcode: detectedBarcode,
      barcodeMatch: isBarcodeMatch,
      detectedVisionProduct: detectedVisionProduct,
      visionConfidence: visionConfidence,
      expectedWeight: expectedWeightTotal,
      actualWeight: actualMockWeight,
      weightDifference: weightDifference,
      weightWithinTolerance: isWeightWithinTolerance,
      checks: res.checks,
      checksPassedCount: passedCount,
      checksTotalCount: totalCount,
      riskScore: res.risk_score,
      aiRecommendation: res.ai_analysis?.recommendation || res.status,
      aiReason: res.ai_analysis?.reason || (res.reasons[0] || "Verification completed"),
      finalResult: res.status,
    };

    const updated = [newEntry, ...testHistory];
    setTestHistory(updated);
    saveTestHistoryToStorage(updated);
  };

  const clearHistory = () => {
    setTestHistory([]);
    localStorage.removeItem("kartmitra_verification_test_history");
  };

  const applyPresetScenario = (type: "PASS" | "REVIEW_WEIGHT" | "FAIL_WEIGHT" | "FAIL_BARCODE") => {
    const prod = catalog[0] || DEFAULT_PRODUCTS[0];
    setSelectedProductId(prod.id);
    setQuantity(1);
    setSessionActive(true);

    if (type === "PASS") {
      setDetectedBarcode(prod.barcode);
      setDetectedVisionProduct(prod.name);
      setVisionConfidence(0.96);
      setActualMockWeight(prod.weight);
    } else if (type === "REVIEW_WEIGHT") {
      setDetectedBarcode(prod.barcode);
      setDetectedVisionProduct(prod.name);
      setVisionConfidence(0.88);
      setActualMockWeight(Number((prod.weight + 0.03).toFixed(3)));
    } else if (type === "FAIL_WEIGHT") {
      setDetectedBarcode(prod.barcode);
      setDetectedVisionProduct(prod.name);
      setVisionConfidence(0.91);
      setActualMockWeight(Number((prod.weight + 0.25).toFixed(3)));
    } else if (type === "FAIL_BARCODE") {
      setDetectedBarcode("8901058000078");
      setDetectedVisionProduct(prod.name);
      setVisionConfidence(0.65);
      setActualMockWeight(prod.weight);
    }
  };

  const filteredHistory = testHistory.filter((item) => {
    if (historyFilter === "ALL") return true;
    return item.finalResult === historyFilter;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-md shadow-blue-500/20">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                  AI Verification Sandbox & Simulator
                  <span className="text-xs bg-emerald-100 text-emerald-700 font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                    Testing Lab
                  </span>
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Multimodal verification environment for DINOv2 visual match, Barcode, Scale Weight & Rule Engine verification
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={runVerificationTest}
              disabled={isVerifying}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-md shadow-blue-600/30 transition disabled:opacity-50 cursor-pointer"
            >
              {isVerifying ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Zap className="h-4 w-4 fill-current text-yellow-300" />
              )}
              Run Verification Test
            </button>
          </div>
        </div>

        {/* Quick Test Scenarios Bar */}
        <div className="bg-slate-100/80 rounded-xl p-3 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5 pl-1">
            <Sliders className="h-4 w-4 text-blue-600" />
            Quick Test Presets:
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => applyPresetScenario("PASS")}
              className="bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              Perfect Match (PASS)
            </button>
            <button
              onClick={() => applyPresetScenario("REVIEW_WEIGHT")}
              className="bg-white hover:bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              Packaging Variance (REVIEW)
            </button>
            <button
              onClick={() => applyPresetScenario("FAIL_WEIGHT")}
              className="bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <XCircle className="h-3.5 w-3.5 text-rose-600" />
              Scale Overweight (FAIL)
            </button>
            <button
              onClick={() => applyPresetScenario("FAIL_BARCODE")}
              className="bg-white hover:bg-purple-50 text-purple-700 border border-purple-200 text-xs font-bold px-3 py-1.5 rounded-lg transition shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <BarcodeIcon className="h-3.5 w-3.5 text-purple-600" />
              Barcode Swap (MISMATCH)
            </button>
          </div>
        </div>

        {/* PIPELINE SIGNAL FLOW DIAGRAM */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-4 flex items-center gap-2">
            <Activity className="h-4 w-4 text-blue-600" />
            Verification Signal Flow Pipeline
          </h3>

          <div className="grid grid-cols-2 md:grid-cols-7 gap-2 items-center text-center">
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <div className="text-[10px] font-extrabold uppercase text-slate-400">1. INPUT</div>
              <div className="text-xs font-black text-slate-800 mt-1 truncate">{selectedProduct.name.split(" ")[0]}</div>
              <div className="text-[10px] font-medium text-slate-500 mt-0.5">Qty: {quantity}</div>
            </div>

            <div className="bg-blue-50/60 border border-blue-200/80 p-3 rounded-xl">
              <div className="text-[10px] font-extrabold uppercase text-blue-600 flex items-center justify-center gap-1">
                <Eye className="h-3 w-3" />
                VISION SIGNAL
              </div>
              <div className="text-xs font-black text-blue-900 mt-1 truncate">{detectedVisionProduct}</div>
              <div className="text-[10px] font-bold text-blue-700 mt-0.5">{(visionConfidence * 100).toFixed(0)}% Conf</div>
            </div>

            <div className={`border p-3 rounded-xl ${isBarcodeMatch ? "bg-emerald-50/60 border-emerald-200" : "bg-rose-50/60 border-rose-200"}`}>
              <div className={`text-[10px] font-extrabold uppercase flex items-center justify-center gap-1 ${isBarcodeMatch ? "text-emerald-700" : "text-rose-700"}`}>
                <BarcodeIcon className="h-3 w-3" />
                BARCODE SIGNAL
              </div>
              <div className="text-[11px] font-mono font-bold text-slate-800 mt-1 truncate">{detectedBarcode}</div>
              <div className={`text-[10px] font-bold mt-0.5 ${isBarcodeMatch ? "text-emerald-700" : "text-rose-700"}`}>
                {isBarcodeMatch ? "MATCH ✓" : "MISMATCH ✕"}
              </div>
            </div>

            <div className={`border p-3 rounded-xl ${isWeightWithinTolerance ? "bg-emerald-50/60 border-emerald-200" : "bg-rose-50/60 border-rose-200"}`}>
              <div className={`text-[10px] font-extrabold uppercase flex items-center justify-center gap-1 ${isWeightWithinTolerance ? "text-emerald-700" : "text-rose-700"}`}>
                <Scale className="h-3 w-3" />
                WEIGHT SIGNAL
              </div>
              <div className="text-xs font-black text-slate-800 mt-1">{actualMockWeight} kg</div>
              <div className={`text-[10px] font-bold mt-0.5 ${isWeightWithinTolerance ? "text-emerald-700" : "text-rose-700"}`}>
                Δ {weightDifference}kg ({isWeightWithinTolerance ? "OK" : "OVER"})
              </div>
            </div>

            <div className="bg-indigo-50/60 border border-indigo-200/80 p-3 rounded-xl">
              <div className="text-[10px] font-extrabold uppercase text-indigo-700 flex items-center justify-center gap-1">
                <Layers className="h-3 w-3" />
                RULE ENGINE
              </div>
              <div className="text-xs font-black text-indigo-900 mt-1">7 Deterministic Checks</div>
              <div className="text-[10px] font-bold text-indigo-700 mt-0.5">
                {verificationResult ? `${Object.values(verificationResult.checks).filter(Boolean).length}/7 Passed` : "Ready"}
              </div>
            </div>

            <div className="bg-purple-50/60 border border-purple-200/80 p-3 rounded-xl">
              <div className="text-[10px] font-extrabold uppercase text-purple-700 flex items-center justify-center gap-1">
                <Sparkles className="h-3 w-3" />
                AI SIGNAL
              </div>
              <div className="text-xs font-black text-purple-900 mt-1">
                {verificationResult?.ai_analysis ? `Risk: ${verificationResult.ai_analysis.risk_score}` : "Evaluating..."}
              </div>
              <div className="text-[10px] font-bold text-purple-700 mt-0.5">
                {verificationResult?.ai_analysis?.recommendation || "Advisory Layer"}
              </div>
            </div>

            <div className={`border p-3 rounded-xl font-black ${
              verificationResult?.status === "PASS"
                ? "bg-emerald-600 text-white border-emerald-600"
                : verificationResult?.status === "REVIEW"
                ? "bg-amber-500 text-white border-amber-500"
                : verificationResult?.status === "FAIL"
                ? "bg-rose-600 text-white border-rose-600"
                : "bg-slate-800 text-white border-slate-800"
            }`}>
              <div className="text-[10px] uppercase font-bold opacity-80">FINAL RESULT</div>
              <div className="text-sm tracking-wide mt-0.5">{verificationResult?.status || "STANDBY"}</div>
            </div>
          </div>
        </div>

        {/* 7 MAIN DASHBOARD SECTIONS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* SECTION 1: PRODUCT (REFERENCE INPUT) */}
          <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="bg-slate-100 p-1.5 rounded-lg text-slate-700">
                  <Layers className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  1. Product Reference (Expected Input)
                </h2>
              </div>
              <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                Catalog DB
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Select Product from Database Catalog:
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {catalog.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.barcode}) - ₹{p.price} / {p.weight}kg
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Selected Product</span>
                  <div className="text-xs font-extrabold text-slate-900 mt-1">{selectedProduct.name}</div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">{selectedProduct.category}</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Barcode</span>
                  <div className="text-xs font-mono font-extrabold text-blue-600 mt-1">{selectedProduct.barcode}</div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Primary Key Identifier</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expected Weight</span>
                  <div className="text-xs font-black text-slate-900 mt-1">{expectedWeightTotal} kg</div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Unit: {selectedProduct.weight}kg × {quantity}</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Expected Price</span>
                  <div className="text-xs font-black text-emerald-600 mt-1">₹{expectedPriceTotal}</div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Unit: ₹{selectedProduct.price} × {quantity}</div>
                </div>
              </div>

              <div className="flex items-center justify-between bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Quantity:</span>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                    className="w-16 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-extrabold text-center text-slate-900"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-500">Session Status:</span>
                  <button
                    onClick={() => setSessionActive(!sessionActive)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition cursor-pointer ${
                      sessionActive
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-rose-100 text-rose-800 border-rose-300"
                    }`}
                  >
                    {sessionActive ? "ACTIVE ✓" : "INVALID ✕"}
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 2: VISION SIGNAL */}
          <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="bg-blue-100 p-1.5 rounded-lg text-blue-700">
                  <Eye className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  2. Vision Signal (YOLO / AI Camera)
                </h2>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  onClick={() => { setVisionMode("manual"); stopCamera(); }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-md transition cursor-pointer ${
                    visionMode === "manual" ? "bg-white text-blue-600 shadow-xs" : "text-slate-500"
                  }`}
                >
                  Manual
                </button>
                <button
                  onClick={() => { setVisionMode("upload"); stopCamera(); }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-md transition cursor-pointer ${
                    visionMode === "upload" ? "bg-white text-blue-600 shadow-xs" : "text-slate-500"
                  }`}
                >
                  Upload
                </button>
                <button
                  onClick={() => { setVisionMode("camera"); startCamera(); }}
                  className={`text-[10px] font-bold px-2 py-1 rounded-md transition cursor-pointer ${
                    visionMode === "camera" ? "bg-white text-blue-600 shadow-xs" : "text-slate-500"
                  }`}
                >
                  Camera
                </button>
              </div>
            </div>

            <div className="relative bg-slate-900 rounded-xl overflow-hidden min-h-[160px] flex items-center justify-center border border-slate-800">
              {visionMode === "camera" && (
                <div className="relative w-full h-44 bg-black flex items-center justify-center">
                  <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  <button
                    onClick={captureCameraFrame}
                    className="absolute bottom-2 bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-md hover:bg-blue-700 flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="h-3 w-3" /> Capture & Scan
                  </button>
                </div>
              )}

              {visionMode === "upload" && (
                <div className="w-full p-4 text-center">
                  {imagePreviewUrl ? (
                    <div className="relative w-full h-40 flex items-center justify-center bg-black/40 rounded-lg overflow-hidden">
                      <img src={imagePreviewUrl} alt="Vision Upload Preview" className="max-h-full max-w-full object-contain" />
                      <div className="absolute inset-0 border-2 border-emerald-400/80 rounded-lg pointer-events-none flex items-start justify-start p-2">
                        <span className="bg-emerald-600 text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded shadow-xs">
                          {detectedVisionProduct} ({(visionConfidence * 100).toFixed(0)}%)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <label className="cursor-pointer flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-700 rounded-xl hover:bg-slate-800/50 transition">
                      <Upload className="h-8 w-8 text-slate-400 mb-2" />
                      <span className="text-xs font-bold text-slate-300">Upload Product Image for Vision AI</span>
                      <span className="text-[10px] text-slate-500 mt-1">Supports JPG, PNG, WEBP</span>
                      <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                    </label>
                  )}
                </div>
              )}

              {visionMode === "manual" && (
                <div className="w-full p-4 bg-gradient-to-br from-slate-900 to-slate-800 text-white text-left space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-blue-400">Simulation Mode</span>
                    <span className="text-[9px] bg-blue-500/20 text-blue-300 font-mono px-2 py-0.5 rounded border border-blue-400/30">
                      BBox Overlay Active
                    </span>
                  </div>
                  <div className="bg-black/40 p-3 rounded-lg border border-slate-700 font-mono text-[11px] space-y-1">
                    <div className="text-emerald-400 font-bold">▶ Detected: {detectedVisionProduct}</div>
                    <div className="text-slate-300">▶ Bounding Box: [{boundingBox.join(", ")}]</div>
                    <div className="text-yellow-400">▶ Confidence: {(visionConfidence * 100).toFixed(1)}%</div>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Detected Product</span>
                <input
                  type="text"
                  value={detectedVisionProduct}
                  onChange={(e) => setDetectedVisionProduct(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 mt-1"
                />
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Bounding Box</span>
                <div className="text-[11px] font-mono font-bold text-slate-700 mt-1 truncate">
                  [{boundingBox.join(", ")}]
                </div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                <span className="text-[9px] font-bold text-slate-400 uppercase">Confidence</span>
                <div className="flex items-center gap-1 mt-1">
                  <input
                    type="range"
                    min="0.30"
                    max="1.00"
                    step="0.01"
                    value={visionConfidence}
                    onChange={(e) => setVisionConfidence(parseFloat(e.target.value))}
                    className="w-full accent-blue-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-black text-blue-700 w-10 text-right">
                    {(visionConfidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 3: BARCODE SIGNAL */}
          <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="bg-purple-100 p-1.5 rounded-lg text-purple-700">
                  <BarcodeIcon className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  3. Barcode Signal (ZXing Reader)
                </h2>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                isBarcodeMatch
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-rose-100 text-rose-800 border-rose-300"
              }`}>
                {isBarcodeMatch ? "MATCH ✓" : "MISMATCH ✕"}
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">
                  Detected / Scanned Barcode Input:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={detectedBarcode}
                    onChange={(e) => setDetectedBarcode(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={() => setDetectedBarcode(selectedProduct.barcode)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer"
                    title="Reset to selected product barcode"
                  >
                    Sync Barcode
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detected Barcode</span>
                  <div className="text-xs font-mono font-black text-slate-900 mt-1">{detectedBarcode || "None"}</div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">Scanned Signal Value</div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Database Product</span>
                  <div className="text-xs font-extrabold text-slate-900 mt-1 truncate">
                    {barcodeDbProduct ? barcodeDbProduct.name : "Not Found in DB ✕"}
                  </div>
                  <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                    {barcodeDbProduct ? `Category: ${barcodeDbProduct.category}` : "Unregistered Barcode"}
                  </div>
                </div>
              </div>

              <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                isBarcodeMatch
                  ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                  : "bg-rose-50 text-rose-900 border-rose-200"
              }`}>
                <div className="flex items-center gap-2">
                  {isBarcodeMatch ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-rose-600" />}
                  <span>
                    {isBarcodeMatch
                      ? "Barcode scanned matches expected product barcode!"
                      : `Barcode mismatch: '${detectedBarcode}' vs expected '${selectedProduct.barcode}'`}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 4: WEIGHT SIGNAL */}
          <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="bg-amber-100 p-1.5 rounded-lg text-amber-700">
                  <Scale className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  4. Weight Signal (IoT Scale Sensor)
                </h2>
              </div>
              <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border ${
                isWeightWithinTolerance
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-rose-100 text-rose-800 border-rose-300"
              }`}>
                {isWeightWithinTolerance ? "WITHIN TOLERANCE ✓" : "EXCEEDS TOLERANCE ✕"}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-500 mr-1">Scale Offset Presets:</span>
                <button
                  onClick={() => setActualMockWeight(expectedWeightTotal)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-1 rounded-md cursor-pointer"
                >
                  Exact (0g)
                </button>
                <button
                  onClick={() => setActualMockWeight(Number((expectedWeightTotal + 0.03).toFixed(3)))}
                  className="bg-amber-50 hover:bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-1 rounded-md border border-amber-200 cursor-pointer"
                >
                  +30g (Tol. Pass)
                </button>
                <button
                  onClick={() => setActualMockWeight(Number((expectedWeightTotal + 0.25).toFixed(3)))}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-1 rounded-md border border-rose-200 cursor-pointer"
                >
                  +250g (Overweight)
                </button>
                <button
                  onClick={() => setActualMockWeight(0.00)}
                  className="bg-rose-50 hover:bg-rose-100 text-rose-800 text-[10px] font-bold px-2 py-1 rounded-md border border-rose-200 cursor-pointer"
                >
                  0.00kg (Missing)
                </button>
              </div>

              <div>
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-1">
                  <span>Actual Scale Measured Weight:</span>
                  <span className="text-amber-700 font-mono font-black text-sm">{actualMockWeight} kg</span>
                </div>
                <input
                  type="range"
                  min={0.0}
                  max={Number((expectedWeightTotal * 2.5).toFixed(2))}
                  step={0.01}
                  value={actualMockWeight}
                  onChange={(e) => setActualMockWeight(parseFloat(e.target.value))}
                  className="w-full accent-amber-600 h-2 bg-slate-200 rounded-lg cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-4 gap-2 text-center text-xs">
                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Expected</div>
                  <div className="font-black text-slate-800 mt-0.5">{expectedWeightTotal} kg</div>
                </div>

                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Actual Mock</div>
                  <div className="font-black text-amber-700 mt-0.5">{actualMockWeight} kg</div>
                </div>

                <div className={`p-2 rounded-xl border ${isWeightWithinTolerance ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"}`}>
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Difference</div>
                  <div className={`font-black mt-0.5 ${isWeightWithinTolerance ? "text-emerald-700" : "text-rose-700"}`}>
                    {weightDifference} kg
                  </div>
                </div>

                <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Tolerance</div>
                  <div className="font-black text-slate-700 mt-0.5">±{weightToleranceKg} kg</div>
                </div>
              </div>
            </div>
          </section>

          {/* SECTION 5: VERIFICATION (RULE ENGINE CHECKS) */}
          <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="bg-indigo-100 p-1.5 rounded-lg text-indigo-700">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  5. Verification Checks (Rule Engine)
                </h2>
              </div>
              <span className="text-[10px] font-extrabold bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-200">
                100% Deterministic
              </span>
            </div>

            <div className="space-y-2">
              {[
                { key: "session", label: "Session", val: verificationResult ? verificationResult.checks.session : sessionActive, desc: "Active shopping cart session token validation" },
                { key: "barcode", label: "Barcode", val: verificationResult ? verificationResult.checks.barcode : isBarcodeMatch, desc: "Scanned barcode matches registered cart product" },
                { key: "vision", label: "Vision", val: verificationResult ? verificationResult.checks.vision : (visionConfidence >= 0.70), desc: "Visual AI object recognition & classification" },
                { key: "product", label: "Product", val: verificationResult ? verificationResult.checks.product : (isBarcodeMatch && catalog.some(p => p.id === selectedProductId)), desc: "Catalog existence & item identity match" },
                { key: "quantity", label: "Quantity", val: verificationResult ? verificationResult.checks.quantity : true, desc: "Cart item quantity count consistency" },
                { key: "amount", label: "Amount", val: verificationResult ? verificationResult.checks.amount : isBarcodeMatch, desc: "Expected checkout total price validation" },
                { key: "weight", label: "Weight", val: verificationResult ? verificationResult.checks.weight : isWeightWithinTolerance, desc: "Packaging weight within tolerance limit (±0.05kg)" },
              ].map((chk) => (
                <div
                  key={chk.key}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition ${
                    chk.val
                      ? "bg-emerald-50/50 border-emerald-200/80 text-emerald-900"
                      : "bg-rose-50/50 border-rose-200/80 text-rose-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`p-1 rounded-md font-bold ${chk.val ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                      {chk.val ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <XCircle className="h-3.5 w-3.5" />}
                    </div>
                    <div>
                      <span className="font-black text-slate-800">{chk.label}</span>
                      <span className="text-[10px] text-slate-500 font-medium ml-2">{chk.desc}</span>
                    </div>
                  </div>
                  <span className={`font-mono font-black text-xs px-2 py-0.5 rounded-md ${
                    chk.val ? "bg-emerald-200/60 text-emerald-800" : "bg-rose-200/60 text-rose-800"
                  }`}>
                    {chk.val ? "✓ PASS" : "✕ FAIL"}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 6: AI SIGNAL & RISK SCORE */}
          <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2">
                <div className="bg-purple-100 p-1.5 rounded-lg text-purple-700">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-black uppercase tracking-wider text-slate-800">
                  6. AI Signal & Advisory Layer
                </h2>
              </div>
              <span className="text-[10px] font-extrabold bg-purple-50 text-purple-700 px-2.5 py-1 rounded-full border border-purple-200">
                AI Advisory
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">AI Confidence</span>
                  <div className="text-base font-black text-purple-700 mt-0.5">
                    {verificationResult?.ai_analysis
                      ? `${(verificationResult.ai_analysis.confidence * 100).toFixed(0)}%`
                      : `${(visionConfidence * 100).toFixed(0)}%`}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Risk Score</span>
                  <div className="text-base font-black text-slate-900 mt-0.5">
                    {verificationResult ? verificationResult.risk_score.toFixed(2) : "0.00"}
                  </div>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Recommendation</span>
                  <div className={`text-xs font-black uppercase mt-1 px-2 py-0.5 rounded text-center ${
                    verificationResult?.ai_analysis?.recommendation === "PASS" || verificationResult?.status === "PASS"
                      ? "bg-emerald-100 text-emerald-800"
                      : verificationResult?.ai_analysis?.recommendation === "REVIEW" || verificationResult?.status === "REVIEW"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-rose-100 text-rose-800"
                  }`}>
                    {verificationResult?.ai_analysis?.recommendation || verificationResult?.status || "PASS"}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                  <span>Risk Spectrum (0.00 = Safe, 1.00 = High Risk)</span>
                  <span>{verificationResult ? `${(verificationResult.risk_score * 100).toFixed(0)}% Risk` : "0% Risk"}</span>
                </div>
                <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden flex">
                  <div
                    style={{ width: `${(verificationResult?.risk_score || 0) * 100}%` }}
                    className={`h-full transition-all duration-500 ${
                      (verificationResult?.risk_score || 0) >= 0.50
                        ? "bg-rose-600"
                        : (verificationResult?.risk_score || 0) > 0.15
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                  />
                </div>
              </div>

              <div className="bg-purple-50/60 p-3 rounded-xl border border-purple-200 text-purple-950 space-y-1">
                <div className="font-extrabold text-xs flex items-center gap-1.5 text-purple-900">
                  <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                  AI Decision Reason:
                </div>
                <p className="text-[11px] font-medium leading-relaxed">
                  {verificationResult?.ai_analysis?.reason ||
                    verificationResult?.ai_analysis?.analysis ||
                    "All verification checks evaluated. No critical anomalies detected."}
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* SECTION 7: FINAL RESULT BANNER */}
        <section className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between border-b pb-4 mb-4">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-600" />
              7. Final Verification Decision Output
            </h2>
            <span className="text-xs text-slate-500 font-medium">Final synthesis governed strictly by rule engine</span>
          </div>

          <div className={`rounded-2xl p-6 text-white flex flex-col md:flex-row items-center justify-between gap-6 shadow-md ${
            verificationResult?.status === "PASS"
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-600/20"
              : verificationResult?.status === "REVIEW"
              ? "bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/20"
              : verificationResult?.status === "FAIL"
              ? "bg-gradient-to-r from-rose-600 to-red-600 shadow-rose-600/20"
              : "bg-gradient-to-r from-slate-800 to-slate-900 shadow-slate-900/20"
          }`}>
            <div className="flex items-center gap-4 text-center md:text-left">
              <div className="bg-white/20 p-3.5 rounded-2xl backdrop-blur-md">
                {verificationResult?.status === "PASS" ? (
                  <CheckCircle2 className="h-10 w-10 text-white" />
                ) : verificationResult?.status === "REVIEW" ? (
                  <AlertTriangle className="h-10 w-10 text-white" />
                ) : (
                  <XCircle className="h-10 w-10 text-white" />
                )}
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/80">OVERALL VERIFICATION STATUS</div>
                <div className="text-3xl font-black tracking-tight">{verificationResult?.status || "STANDBY"}</div>
                <p className="text-xs font-medium text-white/90 mt-1 max-w-xl">
                  {verificationResult?.status === "PASS"
                    ? "Product verification complete. All signals match reference database and physical scale weight specs."
                    : verificationResult?.status === "REVIEW"
                    ? "Manual review advised. Minor discrepancy detected in scale weight or vision recognition score."
                    : "Verification FAILED. Critical mismatch in barcode identification or packaging weight tolerance."}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 min-w-[200px] bg-white/10 p-4 rounded-xl backdrop-blur-sm text-xs font-bold">
              <div className="flex justify-between border-b border-white/20 pb-1.5">
                <span className="opacity-80">Checks Passed:</span>
                <span>
                  {verificationResult ? `${Object.values(verificationResult.checks).filter(Boolean).length} / 7` : "7 / 7"}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/20 pb-1.5">
                <span className="opacity-80">Risk Score:</span>
                <span>{verificationResult ? verificationResult.risk_score.toFixed(2) : "0.00"}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-80">Weight Delta:</span>
                <span>{weightDifference} kg</span>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 8: TEST HISTORY TABLE */}
        <section className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                <Activity className="h-4 w-4 text-blue-600" />
                8. Test History Log ({testHistory.length} Recorded Tests)
              </h2>
              <p className="text-xs text-slate-500 font-medium">Review and re-examine prior manual verification signal logs</p>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
                {(["ALL", "PASS", "REVIEW", "FAIL"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setHistoryFilter(filter)}
                    className={`px-3 py-1 rounded-lg transition cursor-pointer ${
                      historyFilter === filter ? "bg-white text-blue-600 shadow-xs" : "text-slate-500"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>

              {testHistory.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 p-2 rounded-xl transition cursor-pointer"
                  title="Clear history logs"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <ShieldCheck className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">No test history entries recorded yet.</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Run a verification test above to populate test log entries.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-200">
                    <th className="p-3">Time & ID</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Barcode Signal</th>
                    <th className="p-3">Vision Signal</th>
                    <th className="p-3">Weight Signal</th>
                    <th className="p-3">Checks Passed</th>
                    <th className="p-3">Risk Score</th>
                    <th className="p-3">Result</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredHistory.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="p-3 font-mono font-bold text-slate-600 whitespace-nowrap">
                        <div>{item.timestamp}</div>
                        <div className="text-[9px] text-slate-400">{item.id}</div>
                      </td>

                      <td className="p-3 font-bold text-slate-900">
                        {item.productName}
                      </td>

                      <td className="p-3 font-mono">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          item.barcodeMatch ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          {item.detectedBarcode} ({item.barcodeMatch ? "MATCH" : "MISMATCH"})
                        </span>
                      </td>

                      <td className="p-3 text-slate-700 font-medium">
                        <div className="truncate max-w-[140px] font-bold">{item.detectedVisionProduct}</div>
                        <div className="text-[10px] text-slate-400">{(item.visionConfidence * 100).toFixed(0)}% Confidence</div>
                      </td>

                      <td className="p-3 text-slate-700 whitespace-nowrap">
                        <div className="font-bold">{item.actualWeight} kg <span className="text-slate-400 font-normal">(exp: {item.expectedWeight}kg)</span></div>
                        <div className={`text-[10px] font-bold ${item.weightWithinTolerance ? "text-emerald-600" : "text-rose-600"}`}>
                          Δ {item.weightDifference}kg
                        </div>
                      </td>

                      <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                        <span className="bg-slate-100 px-2.5 py-1 rounded-lg">
                          {item.checksPassedCount} / {item.checksTotalCount}
                        </span>
                      </td>

                      <td className="p-3 font-mono font-bold text-slate-900 whitespace-nowrap">
                        {item.riskScore.toFixed(2)}
                      </td>

                      <td className="p-3 whitespace-nowrap">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase ${
                          item.finalResult === "PASS"
                            ? "bg-emerald-100 text-emerald-800"
                            : item.finalResult === "REVIEW"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-rose-100 text-rose-800"
                        }`}>
                          {item.finalResult}
                        </span>
                      </td>

                      <td className="p-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedHistoryItem(item)}
                          className="bg-blue-50 hover:bg-blue-100 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* DETAILS MODAL FOR HISTORICAL TEST */}
        {selectedHistoryItem && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4 border border-slate-200">
              <div className="flex items-center justify-between border-b pb-3">
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Test Details #{selectedHistoryItem.id}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">Executed at {selectedHistoryItem.timestamp}</p>
                </div>
                <button
                  onClick={() => setSelectedHistoryItem(null)}
                  className="bg-slate-100 text-slate-600 p-1.5 rounded-lg hover:bg-slate-200 font-bold text-xs cursor-pointer"
                >
                  ✕ Close
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                  <div className="font-extrabold text-slate-900">Product Tested: {selectedHistoryItem.productName}</div>
                  <div className="text-slate-600 font-mono">Expected Barcode: {selectedHistoryItem.barcode}</div>
                  <div className="text-slate-600 font-mono">Scanned Barcode: {selectedHistoryItem.detectedBarcode}</div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Vision Detected</span>
                    <div className="font-bold text-slate-800 mt-0.5">{selectedHistoryItem.detectedVisionProduct}</div>
                    <div className="text-[10px] text-slate-500">{(selectedHistoryItem.visionConfidence * 100).toFixed(1)}% Confidence</div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Weight Delta</span>
                    <div className="font-bold text-slate-800 mt-0.5">{selectedHistoryItem.actualWeight} kg (exp: {selectedHistoryItem.expectedWeight}kg)</div>
                    <div className="text-[10px] text-slate-500">Difference: {selectedHistoryItem.weightDifference} kg</div>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] font-extrabold uppercase text-slate-500 mb-1.5 block">Deterministic Checks Result:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {Object.entries(selectedHistoryItem.checks).map(([key, val]) => (
                      <div key={key} className={`p-2 rounded-lg border flex items-center justify-between text-[11px] font-bold ${
                        val ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-rose-50 border-rose-200 text-rose-800"
                      }`}>
                        <span className="capitalize">{key}</span>
                        <span>{val ? "✓ PASS" : "✕ FAIL"}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 text-purple-900">
                  <span className="text-[10px] font-bold uppercase text-purple-700 block mb-0.5">AI Advisory Analysis:</span>
                  <p className="text-xs font-medium">{selectedHistoryItem.aiReason}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
