"use client";

import React from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Barcode,
  Eye,
  Box,
  Layers,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Sliders,
  Sparkles,
  ShoppingCart,
  Plus,
  FileText,
  Tag,
  AlertOctagon
} from "lucide-react";

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VisionDetectionItem {
  detection_id?: number;
  product_id: string | null;
  name: string;
  confidence: number;
  bbox?: BoundingBox | number[];
  bounding_box?: BoundingBox;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  price: number;
  weight: number;
  category: string;
  keywords?: string[];
  ocr_text?: string;
}

export interface BarcodeDetection {
  detected?: boolean;
  value?: string | null;
  barcode?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  score?: number;
  match?: boolean;
}

export interface VisionDetection {
  detected?: boolean;
  product_id?: string | null;
  product_name?: string | null;
  confidence?: number;
  score?: number;
  detections?: VisionDetectionItem[];
}

export interface OCRSignal {
  detected?: boolean;
  extracted_text?: string;
  normalized_text?: string;
  product_id?: string | null;
  product_name?: string | null;
  matched_keywords?: string[];
  score?: number;
  match?: boolean;
}

export interface VisualMatchDetection {
  detected?: boolean;
  product_id?: string | null;
  product_name?: string | null;
  similarity?: number;
  score?: number;
  top2_similarity?: number | null;
  margin?: number | null;
  matched_image_id?: string | null;
  matched_image_path?: string | null;
  candidates?: any[];
}

export interface MultiSignalBreakdown {
  barcode?: BarcodeDetection;
  vision?: VisionDetection;
  ocr?: OCRSignal;
  similarity?: VisualMatchDetection;
}

export interface CartItemSummary {
  product_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit_weight: number;
  total_expected_weight: number;
  expected_weight?: number;
  status: string;
  barcode?: string;
}

export interface MultiProductDetectionItem {
  detection_id?: number;
  bbox?: any;
  status?: string;
  product_id?: string | null;
  product_name?: string | null;
  confidence?: number;
  signals?: MultiSignalBreakdown;
  reason?: string;
  product?: Product | null;
}

export interface IdentifyResult {
  status: "MATCH" | "MISMATCH" | "REVIEW" | "UNKNOWN" | string;
  product_id?: string | null;
  product_name?: string | null;
  confidence?: number;
  product: Product | null;
  barcode?: BarcodeDetection | null;
  vision?: VisionDetection | null;
  ocr?: OCRSignal | null;
  visual_match?: VisualMatchDetection | null;
  signals?: MultiSignalBreakdown | null;
  reason: string;
  recommended_action?: string;
  total_detections?: number;
  detections?: MultiProductDetectionItem[];
  cart_summary?: CartItemSummary[];
  cart?: {
    total_items: number;
    total_price: number;
    expected_weight: number;
  };
  frame_status?: string;
}

interface IdentificationResultPanelProps {
  result: IdentifyResult | null;
  isLoading?: boolean;
  onAddToCart?: (product: Product, barcodeVal?: string) => void;
  stabilityStatus?: string;
}

export default function IdentificationResultPanel({
  result,
  isLoading = false,
  onAddToCart,
  stabilityStatus
}: IdentificationResultPanelProps) {
  const [showDebugMode, setShowDebugMode] = React.useState(false);

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center min-h-[300px]">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-blue-600 border-t-transparent mb-3"></div>
        <p className="text-sm font-bold text-gray-700">Running Multi-Signal AI Verification...</p>
        <p className="text-xs text-gray-500 mt-1">Fusing Barcode + YOLO Vision + Packaging OCR + DINOv2/FAISS</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col items-center justify-center text-center min-h-[300px]">
        <div className="bg-gray-100 p-4 rounded-2xl mb-3">
          <Layers className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-base font-bold text-gray-800">No Product Scan Active</h3>
        <p className="text-xs text-gray-500 max-w-sm mt-1">
          Place a product in front of the camera or upload an image to run multi-signal recognition.
        </p>
      </div>
    );
  }

  const { status, product, reason, signals, detections, cart_summary } = result;

  // Extract signals
  const barcodeSig = signals?.barcode || result.barcode;
  const visionSig = signals?.vision || result.vision;
  const ocrSig = signals?.ocr || result.ocr;
  const simSig = signals?.similarity || result.visual_match;

  const barcodeVal = barcodeSig?.barcode || barcodeSig?.value;
  const visionScore = visionSig ? Math.round(((visionSig.score ?? visionSig.confidence) || 0) * 100) : 0;
  const ocrScore = ocrSig ? Math.round((ocrSig.score || 0) * 100) : 0;
  const simScore = simSig ? Math.round(((simSig.score ?? simSig.similarity) || 0) * 100) : 0;

  // Status Styling Configuration
  const getStatusConfig = (st: string) => {
    switch (st.toUpperCase()) {
      case "MATCH":
      case "VERIFIED":
        return {
          bg: "bg-emerald-50 border-emerald-300 text-emerald-950",
          badgeBg: "bg-emerald-600 text-white",
          icon: CheckCircle2,
          iconColor: "text-emerald-600",
          title: "MATCH (VERIFIED)",
          sub: "All reliable signals verified: Ready for Cart addition",
        };
      case "MISMATCH":
        return {
          bg: "bg-red-50 border-red-300 text-red-950",
          badgeBg: "bg-red-600 text-white",
          icon: AlertOctagon,
          iconColor: "text-red-600",
          title: "MISMATCH (BLOCKED)",
          sub: "Conflicting Signals Detected: Auto-add to cart blocked",
        };
      case "REVIEW":
        return {
          bg: "bg-amber-50 border-amber-300 text-amber-950",
          badgeBg: "bg-amber-600 text-white",
          icon: AlertTriangle,
          iconColor: "text-amber-600",
          title: "REVIEW REQUIRED",
          sub: "Moderate confidence or occlusion: Manual check advised",
        };
      default:
        return {
          bg: "bg-slate-50 border-slate-300 text-slate-900",
          badgeBg: "bg-slate-600 text-white",
          icon: HelpCircle,
          iconColor: "text-slate-500",
          title: "UNKNOWN PRODUCT",
          sub: "No registered product identified across signals or background",
        };
    }
  };

  const statusCfg = getStatusConfig(status);
  const StatusIcon = statusCfg.icon;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col gap-5 p-5">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-blue-600" />
          <span className="text-xs font-black text-gray-800 uppercase tracking-wider">
            Multi-Signal AI Verification Studio
          </span>
        </div>
        <div className="flex items-center gap-2">
          {stabilityStatus && (
            <span className="text-[10px] font-mono bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full font-bold">
              {stabilityStatus}
            </span>
          )}
          <button
            onClick={() => setShowDebugMode(!showDebugMode)}
            className={`text-xs font-bold px-3 py-1 rounded-lg border transition-all flex items-center gap-1.5 ${
              showDebugMode
                ? "bg-slate-900 text-white border-slate-800 shadow"
                : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200"
            }`}
          >
            <Sliders className="h-3.5 w-3.5" />
            {showDebugMode ? "Hide Diagnostics" : "Show Diagnostics"}
          </button>
        </div>
      </div>

      {/* 1. Main Status Banner */}
      <div className={`p-4 rounded-xl border flex items-start justify-between gap-4 ${statusCfg.bg}`}>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-white shadow-sm shrink-0 mt-0.5">
            <StatusIcon className={`h-6 w-6 ${statusCfg.iconColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider ${statusCfg.badgeBg}`}>
                {statusCfg.title}
              </span>
              <span className="text-xs font-bold text-gray-700">Multi-Signal Decision</span>
            </div>
            <p className="text-sm font-extrabold text-gray-900 mt-1">{reason}</p>
            <p className="text-xs text-gray-600 mt-0.5">{statusCfg.sub}</p>
          </div>
        </div>
      </div>

      {/* 2. Multi-Signal 4-Matrix Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Signal 1: Barcode */}
        <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
          barcodeSig?.match
            ? "bg-emerald-50/60 border-emerald-200"
            : barcodeVal
            ? "bg-amber-50/60 border-amber-200"
            : "bg-gray-50 border-gray-200"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1 text-gray-700">
              <Barcode className="h-3.5 w-3.5 text-blue-600" /> 1. Barcode
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
              barcodeSig?.match ? "bg-emerald-600 text-white" : barcodeVal ? "bg-amber-600 text-white" : "bg-gray-200 text-gray-600"
            }`}>
              {barcodeSig?.match ? "MATCH" : barcodeVal ? "UNREGISTERED" : "NONE"}
            </span>
          </div>
          <div>
            <span className="text-xs font-mono font-bold text-gray-900 block truncate">
              {barcodeVal || "No barcode found"}
            </span>
            <span className="text-[10px] text-gray-500 block mt-0.5">
              Confidence: {barcodeSig?.match ? "100%" : "0%"}
            </span>
          </div>
        </div>

        {/* Signal 2: YOLO Vision */}
        <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
          visionScore >= 60 ? "bg-blue-50/60 border-blue-200" : "bg-gray-50 border-gray-200"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1 text-gray-700">
              <Eye className="h-3.5 w-3.5 text-indigo-600" /> 2. YOLO Vision
            </span>
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase bg-blue-100 text-blue-800">
              {visionScore >= 60 ? "DETECTED" : "LOW CONF"}
            </span>
          </div>
          <div>
            <span className="text-xs font-bold text-gray-900 block truncate">
              {visionSig?.product_name || "Product Region"}
            </span>
            <span className="text-[10px] text-gray-500 block mt-0.5">
              Confidence: {visionScore}%
            </span>
          </div>
        </div>

        {/* Signal 3: OCR Packaging Text */}
        <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
          ocrScore >= 65 ? "bg-purple-50/60 border-purple-200" : ocrScore > 0 ? "bg-amber-50/60 border-amber-200" : "bg-gray-50 border-gray-200"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1 text-gray-700">
              <FileText className="h-3.5 w-3.5 text-purple-600" /> 3. Packaging OCR
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
              ocrScore >= 65 ? "bg-purple-600 text-white" : ocrScore > 0 ? "bg-amber-600 text-white" : "bg-gray-200 text-gray-600"
            }`}>
              {ocrScore >= 65 ? "MATCH" : ocrScore > 0 ? "PARTIAL" : "NO TEXT"}
            </span>
          </div>
          <div>
            <span className="text-xs font-mono font-bold text-gray-900 block truncate" title={ocrSig?.extracted_text || ""}>
              {ocrSig?.extracted_text ? `"${ocrSig.extracted_text.slice(0, 22)}..."` : "No text detected"}
            </span>
            <span className="text-[10px] text-gray-500 block mt-0.5">
              Match Score: {ocrScore}% {ocrSig?.matched_keywords?.length ? `(${ocrSig.matched_keywords.length} kws)` : ""}
            </span>
          </div>
        </div>

        {/* Signal 4: DINOv2 / FAISS */}
        <div className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2 ${
          simScore >= 75 ? "bg-emerald-50/60 border-emerald-200" : simScore >= 55 ? "bg-amber-50/60 border-amber-200" : "bg-gray-50 border-gray-200"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1 text-gray-700">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> 4. DINOv2 / FAISS
            </span>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
              simScore >= 75 ? "bg-emerald-600 text-white" : simScore >= 55 ? "bg-amber-600 text-white" : "bg-gray-200 text-gray-600"
            }`}>
              {simScore >= 75 ? "MATCH" : simScore >= 55 ? "REVIEW" : "UNKNOWN"}
            </span>
          </div>
          <div>
            <span className="text-xs font-bold text-gray-900 block truncate">
              {simSig?.product_name || (simScore > 0 ? `Similarity ${simScore}%` : "No match")}
            </span>
            <span className="text-[10px] text-gray-500 block mt-0.5">
              Vector Similarity: {simScore}%
            </span>
          </div>
        </div>
      </div>

      {/* 3. Multi-Product List (if multiple items present) */}
      {detections && detections.length > 1 && (
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-blue-600" />
              INDEPENDENT MULTI-PRODUCT DETECTIONS ({detections.length} ITEMS)
            </h4>
            <span className="text-[10px] font-bold text-slate-500 bg-white border px-2 py-0.5 rounded-full">
              Per-Crop Independent AI Verification
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {detections.map((det, idx) => (
              <div
                key={idx}
                className="bg-white p-3 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono font-bold bg-gray-100 text-gray-700 px-2 py-1 rounded">
                    #{idx + 1}
                  </span>
                  <div>
                    <span className="font-extrabold text-gray-900 block">
                      {det.product_name || `Detected Product ${idx + 1}`}
                    </span>
                    <span className="text-[10px] text-gray-500 font-mono block">
                      Status: {det.status} | Conf: {Math.round((det.confidence || 0) * 100)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                    det.status === "MATCH" ? "bg-emerald-100 text-emerald-800" : det.status === "MISMATCH" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {det.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Identified Product Details & Live Cart Addition */}
      <div className="border-t pt-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
            <Box className="h-4 w-4 text-gray-700" />
            Verified Product Details
          </h4>
          {product && onAddToCart && status === "MATCH" && (
            <button
              onClick={() => onAddToCart(product, barcodeVal || product.barcode)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add to Shopping Session
            </button>
          )}
        </div>

        {product ? (
          <div className="bg-blue-50/40 border border-blue-100 p-4 rounded-xl flex flex-col gap-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-blue-100 pb-2">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                  Product Name
                </span>
                <h3 className="text-lg font-black text-gray-900">{product.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold bg-white border border-blue-200 px-2.5 py-1 rounded-lg text-blue-800">
                  Barcode: {barcodeVal || product.barcode || "N/A"}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                <span className="text-[10px] text-gray-400 font-bold block uppercase">Unit Price</span>
                <span className="text-base font-black text-emerald-600">₹{product.price}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                <span className="text-[10px] text-gray-400 font-bold block uppercase">Unit Weight</span>
                <span className="text-sm font-black text-gray-900">{product.weight} kg</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                <span className="text-[10px] text-gray-400 font-bold block uppercase">Category</span>
                <span className="text-sm font-black text-gray-900 truncate block">{product.category || "General"}</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-blue-100">
                <span className="text-[10px] text-gray-400 font-bold block uppercase">Product ID</span>
                <span className="text-xs font-mono font-bold text-gray-700 truncate block">{product.id}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gray-50 p-4 rounded-xl border text-center text-xs text-gray-500">
            No registered product matched. Align product packaging in camera or present barcode.
          </div>
        )}
      </div>

      {/* 5. Diagnostic Inspector Panel */}
      {showDebugMode && (
        <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-700 shadow-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-black text-yellow-400 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="h-4 w-4 text-yellow-400" />
              Multi-Signal Diagnostics & Weights
            </h3>
            <span className="text-[10px] bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 px-2.5 py-0.5 rounded-full font-mono font-bold">
              Config: 40% BC / 25% Vis / 20% OCR / 15% Sim
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">1. Barcode Signal</span>
              <span className="text-xs font-mono text-emerald-400 mt-1 block">Value: {barcodeVal || "None"}</span>
              <span className="text-[10px] text-slate-400">Weight: 40%</span>
            </div>
            <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">2. YOLO Vision</span>
              <span className="text-xs font-mono text-blue-400 mt-1 block">Conf: {visionScore}%</span>
              <span className="text-[10px] text-slate-400">Weight: 25%</span>
            </div>
            <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">3. Packaging OCR</span>
              <span className="text-xs font-mono text-purple-400 mt-1 block">Score: {ocrScore}%</span>
              <span className="text-[10px] text-slate-400">Weight: 20%</span>
            </div>
            <div className="bg-slate-800 p-2.5 rounded-xl border border-slate-700">
              <span className="text-[10px] text-slate-400 uppercase font-bold block">4. Visual Similarity</span>
              <span className="text-xs font-mono text-emerald-400 mt-1 block">Sim: {simScore}%</span>
              <span className="text-[10px] text-slate-400">Weight: 15%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
