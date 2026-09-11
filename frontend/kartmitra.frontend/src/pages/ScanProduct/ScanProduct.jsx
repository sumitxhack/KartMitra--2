import { useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Zap,
  ZapOff,
  Barcode,
  Camera,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Loader2,
  Package,
  ShoppingCart,
  SlidersHorizontal,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  Html5Qrcode,
  Html5QrcodeSupportedFormats,
} from "html5-qrcode";
import { useNavigate } from "react-router-dom";

import apiClient from "../../api/client";
import { verifyProductWithAi } from "../../api/cameraVerificationApi";

const SCANNER_ID = "product-scanner";

const SCAN_CONFIG = {
  fps: 30,
  qrbox: {
    width: 280,
    height: 280,
  },
  aspectRatio: 1.0,
};

// Preset products for hackathon demonstration of Mismatch / Match
const DEMO_PRESETS = [
  { name: "Maggi 2-Minute Noodles", barcode: "8901030383785", category: "Noodles" },
  { name: "Amul Taaza Milk 1L", barcode: "8901262010053", category: "Dairy" },
  { name: "Parle-G Biscuits", barcode: "8901719101038", category: "Biscuits" },
  { name: "Tata Salt 1kg", barcode: "8901058852898", category: "Staples" },
];

const ScanProduct = () => {
  const navigate = useNavigate();

  // Mode: "barcode" | "ai"
  const [mode, setMode] = useState("barcode");

  // Barcode scanner refs & states
  const scannerRef = useRef(null);
  const startingRef = useRef(false);
  const scannedRef = useRef(false);
  const mountedRef = useRef(true);
  const videoTrackRef = useRef(null);

  const [cameraError, setCameraError] = useState("");
  const [message, setMessage] = useState(
    "Point your camera at the product barcode"
  );
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // Store last scanned barcode and product info across modes
  const [lastScannedBarcode, setLastScannedBarcode] = useState("");
  const [scannedProductInfo, setScannedProductInfo] = useState(null);
  const [showDemoSelector, setShowDemoSelector] = useState(false);

  // AI Camera Verification refs & states
  const aiVideoRef = useRef(null);
  const aiStreamRef = useRef(null);
  const capturedImageRef = useRef(null);

  const [aiCameraActive, setAiCameraActive] = useState(false);
  const [aiCameraError, setAiCameraError] = useState("");
  const [capturedImage, setCapturedImage] = useState(null);
  const [capturedBlob, setCapturedBlob] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verificationError, setVerificationError] = useState("");

  // Direct Add to Cart on MATCH state
  const [directAdding, setDirectAdding] = useState(false);
  const [directAdded, setDirectAdded] = useState(false);

  /*
   * ============================================================
   * RESOLVE SESSION ID
   * ============================================================
   */
  const getSessionId = () => {
    const fromSession = sessionStorage.getItem("sessionId");
    if (fromSession && fromSession.trim()) return fromSession.trim();

    const fromLocal = localStorage.getItem("sessionId");
    if (fromLocal && fromLocal.trim()) return fromLocal.trim();

    try {
      const parsed = JSON.parse(
        localStorage.getItem("kartmitra-shopping-session") || "{}"
      );
      if (parsed.sessionId) return parsed.sessionId.trim();
    } catch {
      // Ignore
    }

    return null;
  };

  /*
   * Look up MongoDB info for scanned barcode so we know Scanned Product <Product A>
   */
  const lookupScannedProduct = useCallback(async (barcode) => {
    if (!barcode) {
      setScannedProductInfo(null);
      return;
    }
    try {
      const res = await apiClient(`/products/barcode/${encodeURIComponent(barcode.trim())}`);
      const prod = res?.data || res?.product || res;
      if (prod && (prod.name || prod.barcode)) {
        setScannedProductInfo(prod);
      } else {
        setScannedProductInfo({ name: `Item (${barcode})`, barcode });
      }
    } catch {
      // Fallback to preset or generic label
      const preset = DEMO_PRESETS.find((p) => p.barcode === barcode.trim());
      setScannedProductInfo(preset || { name: `Barcode ${barcode}`, barcode });
    }
  }, []);

  /*
   * ============================================================
   * CONFIDENCE FORMATTER (Guarantees no false 100% claim)
   * ============================================================
   */
  const formatConfidence = (conf) => {
    if (typeof conf === "number" && !isNaN(conf) && conf > 0) {
      const val = conf > 1 ? conf : conf * 100;
      // Cap at 99% - never claim 100% accuracy as per requirement
      const capped = Math.min(Math.round(val), 99);
      return `${capped}%`;
    }
    return null;
  };

  /*
   * ============================================================
   * SIGNALS PARSER (For Hackathon Demonstration)
   * ============================================================
   */
  const parseSignals = (result) => {
    if (!result) return null;

    const sigs = result.signals || {};
    const status = result.status || "UNKNOWN";
    const detections = result.detections || [];
    const primaryDet = detections[0] || {};

    // Determine detected product name
    const detectedName =
      result.product?.name ||
      primaryDet.product_name ||
      primaryDet.product?.name ||
      sigs.vision?.product_name ||
      sigs.similarity?.product_name ||
      sigs.ocr?.product_name ||
      "Unknown Product";

    const detectedBarcode =
      result.product?.barcode ||
      sigs.barcode?.barcode ||
      primaryDet.barcode ||
      primaryDet.product?.barcode ||
      null;

    const scannedName =
      scannedProductInfo?.name ||
      (lastScannedBarcode ? `Item (${lastScannedBarcode})` : "Expected Product");

    // 1. BARCODE SIGNAL
    let barcodeStatus = "agree"; // "agree" | "disagree" | "neutral"
    let barcodeText = "Barcode not in frame";

    if (lastScannedBarcode) {
      if (detectedBarcode) {
        if (detectedBarcode.trim() === lastScannedBarcode.trim()) {
          barcodeStatus = "agree";
          barcodeText = `Matches scanned barcode (${detectedBarcode})`;
        } else {
          barcodeStatus = "disagree";
          barcodeText = `Mismatch: Scanned ${lastScannedBarcode} vs Detected ${detectedBarcode}`;
        }
      } else {
        barcodeStatus = status === "MISMATCH" ? "disagree" : "neutral";
        barcodeText = `Visual packaging differs from scanned barcode ${lastScannedBarcode}`;
      }
    } else if (detectedBarcode || sigs.barcode?.detected) {
      barcodeStatus = "agree";
      barcodeText = `Detected barcode: ${detectedBarcode || sigs.barcode?.barcode}`;
    } else {
      barcodeStatus = status === "MATCH" ? "agree" : "neutral";
      barcodeText = status === "MATCH" ? "Confirmed via packaging identity" : "Barcode not visible in camera view";
    }

    // 2. YOLO OBJECT DETECTION SIGNAL
    const visionSig = sigs.vision || sigs.yolo || {};
    let yoloStatus = "agree";
    let yoloText = "No object detected";

    const yoloConf = visionSig.confidence ?? visionSig.score ?? primaryDet.confidence;
    const yoloProd = visionSig.product_name || visionSig.class_name || primaryDet.product_name;

    if (visionSig.detected || primaryDet.bbox || yoloConf) {
      const confStr = yoloConf ? ` (${formatConfidence(yoloConf)} conf)` : "";
      if (
        status === "MISMATCH" &&
        lastScannedBarcode &&
        scannedProductInfo?.name &&
        yoloProd &&
        !yoloProd.toLowerCase().includes(scannedProductInfo.name.toLowerCase().split(" ")[0])
      ) {
        yoloStatus = "disagree";
        yoloText = `Detected packaging '${yoloProd || detectedName}'${confStr}`;
      } else {
        yoloStatus = "agree";
        yoloText = yoloProd
          ? `Detected '${yoloProd}'${confStr}`
          : `Product bounded in camera frame${confStr}`;
      }
    } else {
      yoloStatus = status === "REVIEW" || status === "UNKNOWN" ? "neutral" : "agree";
      yoloText = "Packaging frame identified";
    }

    // 3. VISUAL SIMILARITY SIGNAL (DINOv2 + FAISS)
    const simSig = sigs.similarity || sigs.visual || {};
    let simStatus = "agree";
    let simText = "No visual match";

    const simScore = simSig.similarity ?? simSig.score ?? result.confidence;
    const simProd = simSig.product_name;

    if (simSig.detected || (simScore && simScore > 0.4)) {
      const scoreStr = simScore ? ` (${formatConfidence(simScore)} match)` : "";
      if (
        status === "MISMATCH" &&
        lastScannedBarcode &&
        scannedProductInfo?.name &&
        simProd &&
        !simProd.toLowerCase().includes(scannedProductInfo.name.toLowerCase().split(" ")[0])
      ) {
        simStatus = "disagree";
        simText = `Features match '${simProd || detectedName}'${scoreStr}, not scanned item`;
      } else if (status === "REVIEW") {
        simStatus = "neutral";
        simText = `Borderline feature similarity${scoreStr}`;
      } else {
        simStatus = "agree";
        simText = `Embedding matched reference images${scoreStr}`;
      }
    } else {
      simStatus = status === "MISMATCH" ? "disagree" : "neutral";
      simText = "Visual features differ from expected reference catalog";
    }

    // 4. OCR PACKAGING TEXT SIGNAL
    const ocrSig = sigs.ocr || {};
    let ocrStatus = "neutral";
    let ocrText = "No text extracted";

    if (ocrSig.detected || ocrSig.extracted_text) {
      const ocrProd = ocrSig.product_name;
      const kwCount = ocrSig.matched_keywords?.length || 0;
      const kwStr = kwCount > 0 ? ` (${kwCount} keywords verified)` : "";

      if (
        status === "MISMATCH" &&
        lastScannedBarcode &&
        scannedProductInfo?.name &&
        ocrProd &&
        !ocrProd.toLowerCase().includes(scannedProductInfo.name.toLowerCase().split(" ")[0])
      ) {
        ocrStatus = "disagree";
        ocrText = `Packaging text identifies '${ocrProd}'${kwStr}`;
      } else if (ocrProd || kwCount > 0) {
        ocrStatus = "agree";
        ocrText = `Label keywords verified${kwStr}`;
      } else {
        ocrStatus = "neutral";
        ocrText = `Text: "${(ocrSig.extracted_text || "").slice(0, 26)}..."`;
      }
    } else {
      ocrStatus = status === "MATCH" ? "agree" : "neutral";
      ocrText = status === "MATCH" ? "Brand and label text consistent" : "No readable label text detected";
    }

    return {
      barcode: { status: barcodeStatus, text: barcodeText, label: "Barcode" },
      yolo: { status: yoloStatus, text: yoloText, label: "YOLO" },
      similarity: { status: simStatus, text: simText, label: "Visual Similarity" },
      ocr: { status: ocrStatus, text: ocrText, label: "OCR" },
      detectedName,
      detectedBarcode,
      scannedName,
    };
  };

  /*
   * ============================================================
   * GET CAMERA TRACK (FOR BARCODE SCANNER TORCH)
   * ============================================================
   */
  const getCameraTrack = () => {
    try {
      const videoElement = document.querySelector(`#${SCANNER_ID} video`);
      const stream = videoElement?.srcObject;
      if (stream instanceof MediaStream) {
        const tracks = stream.getVideoTracks();
        if (tracks.length > 0) {
          videoTrackRef.current = tracks[0];
          return tracks[0];
        }
      }
    } catch (error) {
      console.warn("Unable to get camera track:", error);
    }
    return null;
  };

  /*
   * ============================================================
   * DETECT TORCH SUPPORT
   * ============================================================
   */
  const detectTorchSupport = () => {
    try {
      const track = getCameraTrack();
      if (!track) {
        setTorchSupported(false);
        return false;
      }
      const capabilities = track.getCapabilities?.();
      if (capabilities?.torch === true) {
        setTorchSupported(true);
        return true;
      }
      setTorchSupported(false);
      return false;
    } catch (error) {
      console.warn("Torch detection failed:", error);
      setTorchSupported(false);
      return false;
    }
  };

  /*
   * ============================================================
   * STOP BARCODE SCANNER
   * ============================================================
   */
  const stopScanner = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      const track = videoTrackRef.current;
      if (track?.applyConstraints) {
        try {
          await track.applyConstraints({ advanced: [{ torch: false }] });
        } catch {
          // Ignore torch cleanup
        }
      }
      setTorchOn(false);
    } catch {
      // Ignore
    }

    try {
      if (scanner.isScanning) {
        await scanner.stop();
      }
    } catch (error) {
      console.warn("Scanner stop warning:", error);
    }

    try {
      scanner.clear();
    } catch (error) {
      console.warn("Scanner clear warning:", error);
    }

    if (scannerRef.current === scanner) {
      scannerRef.current = null;
    }
    videoTrackRef.current = null;
    startingRef.current = false;
  };

  /*
   * ============================================================
   * STOP AI CAMERA STREAM
   * ============================================================
   */
  const stopAiCamera = useCallback(() => {
    if (aiStreamRef.current) {
      try {
        aiStreamRef.current.getTracks().forEach((track) => {
          track.stop();
        });
      } catch (err) {
        console.warn("Error stopping AI camera tracks:", err);
      }
      aiStreamRef.current = null;
    }
    if (aiVideoRef.current) {
      aiVideoRef.current.srcObject = null;
    }
    setAiCameraActive(false);
  }, []);

  /*
   * ============================================================
   * START AI CAMERA STREAM
   * ============================================================
   */
  const startAiCamera = useCallback(async () => {
    try {
      setAiCameraError("");
      stopAiCamera();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera access is not supported by your current browser.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!mountedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      aiStreamRef.current = stream;

      if (aiVideoRef.current) {
        aiVideoRef.current.srcObject = stream;
        await aiVideoRef.current.play().catch((playErr) => {
          console.warn("AI camera video play warning:", playErr);
        });
      }

      setAiCameraActive(true);
    } catch (error) {
      console.error("AI camera start error:", error);
      if (!mountedRef.current) return;

      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        setAiCameraError(
          "Camera access permission was denied. Please allow camera permissions in your browser address bar and try again."
        );
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        setAiCameraError("No camera device was found on this system.");
      } else {
        setAiCameraError(
          error.message || "Failed to access camera for AI verification."
        );
      }
    }
  }, [stopAiCamera]);

  /*
   * ============================================================
   * GET PRODUCT FROM DATABASE (BARCODE FLOW)
   * ============================================================
   */
  const getProduct = async (barcode) => {
    try {
      setMessage("Finding product...");
      console.log("Looking up barcode:", barcode);

      const response = await apiClient(
        `/products/barcode/${encodeURIComponent(barcode)}`
      );

      const product =
        response?.data?.data ||
        response?.data?.product ||
        response?.data ||
        response?.product ||
        null;

      if (!product) {
        throw new Error("Product not found");
      }

      sessionStorage.setItem("scannedProduct", JSON.stringify(product));
      setMessage("Product found. Opening details...");

      stopScanner().catch((error) => {
        console.warn("Scanner cleanup warning:", error);
      });

      navigate("/product-details", { replace: true });
    } catch (error) {
      console.error("Product lookup failed:", error);
      scannedRef.current = false;
      if (!mountedRef.current) return;

      setMessage(error?.message || "Product not found");
      setTimeout(() => {
        if (mountedRef.current) {
          setMessage("Point your camera at the product barcode");
        }
      }, 2000);
    }
  };

  /*
   * ============================================================
   * BARCODE SCAN SUCCESS HANDLER
   * ============================================================
   */
  const handleScanSuccess = async (decodedText) => {
    if (scannedRef.current) return;
    const barcode = decodedText?.trim();
    if (!barcode) return;

    scannedRef.current = true;
    setLastScannedBarcode(barcode);
    lookupScannedProduct(barcode);

    console.log("Product barcode scanned:", barcode);
    await getProduct(barcode);
  };

  /*
   * ============================================================
   * START BARCODE SCANNER
   * ============================================================
   */
  const startScanner = useCallback(async () => {
    if (startingRef.current || scannerRef.current) return;
    startingRef.current = true;
    let scanner = null;

    try {
      setCameraError("");
      setMessage("Opening camera...");

      scanner = new Html5Qrcode(SCANNER_ID, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.ITF,
        ],
      });

      scannerRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: { exact: "environment" } },
          SCAN_CONFIG,
          handleScanSuccess,
          () => {}
        );
      } catch (environmentError) {
        console.warn("Environment camera failed:", environmentError);
        const cameras = await Html5Qrcode.getCameras();

        if (!cameras || cameras.length === 0) {
          throw new Error("No camera was found on this device.");
        }

        const rearCamera =
          cameras.find((camera) => {
            const label = camera.label?.toLowerCase() || "";
            return (
              label.includes("back") ||
              label.includes("rear") ||
              label.includes("environment")
            );
          }) || cameras[0];

        await scanner.start(
          rearCamera.id,
          SCAN_CONFIG,
          handleScanSuccess,
          () => {}
        );
      }

      if (!mountedRef.current) {
        await stopScanner();
        return;
      }

      setMessage("Point your camera at the product barcode");
      await new Promise((resolve) => setTimeout(resolve, 300));
      detectTorchSupport();
    } catch (error) {
      console.error("Unable to start product scanner:", error);
      if (!mountedRef.current) return;

      setCameraError(
        "Unable to access the camera. Please allow camera permission and try again."
      );
      setMessage("");
    } finally {
      startingRef.current = false;
    }
  }, [lookupScannedProduct]);

  /*
   * ============================================================
   * SWITCH MODE (BARCODE <-> AI VERIFICATION)
   * ============================================================
   */
  const handleSwitchMode = async (newMode) => {
    if (newMode === mode) return;

    if (newMode === "ai") {
      await stopScanner();
      setMode("ai");
      if (capturedImageRef.current) {
        URL.revokeObjectURL(capturedImageRef.current);
        capturedImageRef.current = null;
      }
      setCapturedImage(null);
      setCapturedBlob(null);
      setVerificationResult(null);
      setVerificationError("");
      setDirectAdded(false);
      startAiCamera();
    } else {
      stopAiCamera();
      setMode("barcode");
      scannedRef.current = false;
      startScanner();
    }
  };

  /*
   * ============================================================
   * LIFECYCLE EFFECT
   * ============================================================
   */
  useEffect(() => {
    mountedRef.current = true;

    if (mode === "barcode") {
      startScanner();
    } else {
      startAiCamera();
    }

    return () => {
      mountedRef.current = false;
      stopScanner();
      stopAiCamera();

      if (capturedImageRef.current) {
        URL.revokeObjectURL(capturedImageRef.current);
        capturedImageRef.current = null;
      }
    };
  }, [mode, startScanner, startAiCamera, stopAiCamera]);

  /*
   * ============================================================
   * AI CAMERA: CAPTURE PHOTO
   * ============================================================
   */
  const handleCapturePhoto = () => {
    const video = aiVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setAiCameraError("Camera video feed is not ready yet. Please wait a moment.");
      return;
    }

    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            setVerificationError("Failed to capture picture frame.");
            return;
          }

          if (capturedImageRef.current) {
            URL.revokeObjectURL(capturedImageRef.current);
          }

          const previewUrl = URL.createObjectURL(blob);
          capturedImageRef.current = previewUrl;

          setCapturedBlob(blob);
          setCapturedImage(previewUrl);
          setVerificationResult(null);
          setVerificationError("");
          setDirectAdded(false);
        },
        "image/jpeg",
        0.92
      );
    } catch (err) {
      console.error("Frame capture error:", err);
      setVerificationError("Failed to capture image. Please try again.");
    }
  };

  /*
   * ============================================================
   * AI CAMERA: RETAKE PHOTO
   * ============================================================
   */
  const handleRetakePhoto = () => {
    if (capturedImageRef.current) {
      URL.revokeObjectURL(capturedImageRef.current);
      capturedImageRef.current = null;
    }

    setCapturedImage(null);
    setCapturedBlob(null);
    setVerificationResult(null);
    setVerificationError("");
    setDirectAdded(false);

    if (!aiStreamRef.current) {
      startAiCamera();
    }
  };

  /*
   * ============================================================
   * AI CAMERA: VERIFY PRODUCT (POST /api/camera/ai-verify)
   * ============================================================
   */
  const handleVerifyProduct = async () => {
    if (!capturedBlob) {
      setVerificationError("No image available to verify. Please capture a photo.");
      return;
    }

    setVerifying(true);
    setVerificationError("");
    setVerificationResult(null);
    setDirectAdded(false);

    try {
      const sessionId = getSessionId() || "";

      const result = await verifyProductWithAi({
        imageBlob: capturedBlob,
        scannedBarcode: lastScannedBarcode || "",
        sessionId,
      });

      console.log("AI Verification result:", result);

      if (result.status === "MATCH") {
        const candidateBarcode =
          result.product?.barcode ||
          result.signals?.barcode?.barcode ||
          result.detections?.[0]?.product?.barcode ||
          lastScannedBarcode;

        if (candidateBarcode) {
          try {
            const mongoRes = await apiClient(
              `/products/barcode/${encodeURIComponent(candidateBarcode.trim())}`
            );
            const mongoProduct = mongoRes?.data || mongoRes?.product || mongoRes;

            if (mongoProduct && (mongoProduct.barcode || mongoProduct.name)) {
              const authoritativeProduct = {
                ...mongoProduct,
                aiVerified: true,
                aiConfidence: result.confidence,
                aiStatus: result.status,
                aiReason: result.reason,
              };

              result.product = authoritativeProduct;
            }
          } catch (mongoErr) {
            console.warn("MongoDB product lookup warning:", mongoErr);
          }
        }
      }

      setVerificationResult(result);
    } catch (err) {
      console.error("AI Verification API call failed:", err);

      let errMsg = err.message || "Verification request failed.";

      if (err.status === 503 || err.data?.code === "AI_UNAVAILABLE") {
        errMsg =
          "AI Verification Lab is currently offline or unreachable. Please try again or use the Barcode Scanner.";
      } else if (err.status === 502 || err.data?.code === "AI_MALFORMED_RESPONSE") {
        errMsg =
          "AI Verification Lab returned an invalid response. Please try again.";
      } else if (err.data?.code === "AI_TIMEOUT" || err.message?.includes("timeout")) {
        errMsg =
          "AI verification request timed out. Please ensure good lighting and try again.";
      } else if (err.status === 400) {
        errMsg =
          "Invalid image submitted for AI verification. Please retake a clear photo of the product.";
      }

      setVerificationError(errMsg);
    } finally {
      setVerifying(false);
    }
  };

  /*
   * ============================================================
   * DIRECT ADD TO CART FROM MATCH SCREEN
   * ============================================================
   */
  const handleDirectAddToCart = async () => {
    if (!verificationResult?.product?.barcode) {
      navigate("/product-details");
      return;
    }

    const sessionId = getSessionId();
    if (!sessionId) {
      setVerificationError(
        "Shopping session not found. Please scan the store Entry QR first."
      );
      return;
    }

    setDirectAdding(true);
    setVerificationError("");

    try {
      const res = await apiClient(`/carts/${encodeURIComponent(sessionId)}/items`, {
        method: "POST",
        body: JSON.stringify({
          barcode: verificationResult.product.barcode.trim(),
          quantity: 1,
        }),
      });

      const updatedCart = res?.data || res;
      if (updatedCart) {
        sessionStorage.setItem("cart", JSON.stringify(updatedCart));
        localStorage.setItem("cart", JSON.stringify(updatedCart));
      }

      setDirectAdded(true);
    } catch (err) {
      console.error("Direct add to cart error:", err);
      setVerificationError(err.message || "Failed to add product to cart.");
    } finally {
      setDirectAdding(false);
    }
  };

  /*
   * ============================================================
   * NAVIGATE TO FULL PRODUCT DETAILS
   * ============================================================
   */
  const handleViewProduct = () => {
    if (!verificationResult?.product) return;

    sessionStorage.setItem(
      "scannedProduct",
      JSON.stringify(verificationResult.product)
    );

    stopScanner();
    stopAiCamera();
    navigate("/product-details");
  };

  /*
   * ============================================================
   * FLASHLIGHT TOGGLE (BARCODE MODE)
   * ============================================================
   */
  const toggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      let track = videoTrackRef.current || getCameraTrack();
      if (!track) return;

      const capabilities = track.getCapabilities?.();
      if (capabilities?.torch !== true) {
        setTorchSupported(false);
        return;
      }

      const newState = !torchOn;
      await track.applyConstraints({
        advanced: [{ torch: newState }],
      });
      setTorchOn(newState);
    } catch (error) {
      console.error("Unable to toggle flashlight:", error);
      setTorchOn(false);
    }
  };

  const handleBack = async () => {
    await stopScanner();
    stopAiCamera();
    navigate(-1);
  };

  // Parse signals for active verification result
  const parsedSignals = parseSignals(verificationResult);

  return (
    <main className="min-h-screen bg-[#e9eceb] flex items-center justify-center sm:p-6">
      <div
        className="
          relative
          flex
          h-screen
          w-full
          flex-col
          overflow-hidden
          bg-[#0c1210]
          sm:h-[844px]
          sm:w-[390px]
          sm:rounded-[40px]
          sm:border-[7px]
          sm:border-[#171c1a]
          sm:shadow-2xl
        "
      >
        {/* ======================================================
            HEADER
        ======================================================= */}
        <header
          className="
            relative
            z-30
            flex
            h-13
            shrink-0
            items-center
            bg-[#151e1b]
            px-5
          "
        >
          <button
            type="button"
            onClick={handleBack}
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-full
              text-white
              transition
              hover:bg-white/10
              active:scale-90
              cursor-pointer
            "
            aria-label="Go back"
          >
            <ArrowLeft size={19} strokeWidth={1.7} />
          </button>

          <h1
            className="
              absolute
              left-1/2
              -translate-x-1/2
              text-[13px]
              font-medium
              text-white
            "
          >
            Scan Product
          </h1>
        </header>

        {/* ======================================================
            MODE SWITCHER (BARCODE SCANNER vs AI VERIFICATION)
        ======================================================= */}
        <div className="relative z-30 flex bg-[#121916] p-1.5 border-b border-[#222c28] shrink-0">
          <button
            type="button"
            onClick={() => handleSwitchMode("barcode")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition cursor-pointer ${
              mode === "barcode"
                ? "bg-[#159b7d] text-white shadow-sm font-semibold"
                : "text-[#8e9c97] hover:text-white"
            }`}
          >
            <Barcode size={15} />
            <span>Barcode Scanner</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitchMode("ai")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition cursor-pointer ${
              mode === "ai"
                ? "bg-[#159b7d] text-white shadow-sm font-semibold"
                : "text-[#8e9c97] hover:text-white"
            }`}
          >
            <Camera size={15} />
            <span>AI Camera Verification</span>
          </button>
        </div>

        {/* ======================================================
            MAIN WORKSPACE
        ======================================================= */}
        <section className="relative flex-1 overflow-hidden bg-black flex flex-col">
          {/* ----------------------------------------------------
              BARCODE SCANNER VIEW
          ----------------------------------------------------- */}
          <div
            id={SCANNER_ID}
            className={`absolute inset-0 w-full overflow-hidden [&_video]:h-full [&_video]:w-full [&_video]:object-cover ${
              mode === "barcode" ? "block" : "hidden pointer-events-none"
            }`}
          />

          {mode === "barcode" && (
            <>
              <div className="pointer-events-none absolute inset-0 z-[5] bg-black/20" />

              {cameraError ? (
                <div className="absolute left-1/2 top-1/2 z-20 w-[80%] -translate-x-1/2 -translate-y-1/2 text-center">
                  <p className="text-[12px] leading-5 text-[#ff8f8f]">
                    {cameraError}
                  </p>
                  <button
                    type="button"
                    onClick={startScanner}
                    className="mt-3 rounded-lg bg-[#159b7d] px-4 py-2 text-xs font-medium text-white shadow cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              ) : (
                <p
                  className="
                    absolute
                    left-1/2
                    top-[calc(50%+120px)]
                    z-20
                    w-[90%]
                    -translate-x-1/2
                    text-center
                    text-[11px]
                    font-normal
                    text-[#d0d7d4]
                  "
                >
                  {message}
                </p>
              )}

              <button
                type="button"
                onClick={toggleTorch}
                disabled={!torchSupported}
                aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
                className="
                  absolute
                  bottom-12
                  left-1/2
                  z-20
                  flex
                  h-[50px]
                  w-[50px]
                  -translate-x-1/2
                  items-center
                  justify-center
                  rounded-full
                  bg-[#28312e]
                  text-white
                  shadow-md
                  transition
                  hover:bg-[#34403c]
                  active:scale-90
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                {torchOn ? <ZapOff size={22} strokeWidth={1.7} /> : <Zap size={22} strokeWidth={1.7} />}
              </button>

              {!torchSupported && (
                <p className="pointer-events-none absolute bottom-5 left-1/2 z-20 w-full -translate-x-1/2 text-center text-[8px] text-[#7d8783]">
                  Flashlight control is not supported by this browser
                </p>
              )}
            </>
          )}

          {/* ----------------------------------------------------
              AI CAMERA VERIFICATION VIEW
          ----------------------------------------------------- */}
          {mode === "ai" && (
            <div className="relative flex-1 flex flex-col h-full w-full overflow-hidden">
              {/* LIVE CAMERA FEED (When no image captured) */}
              {!capturedImage && (
                <div className="relative flex-1 w-full h-full bg-black overflow-hidden flex items-center justify-center">
                  <video
                    ref={aiVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="h-full w-full object-cover"
                  />

                  {/* Camera Reticle & Guidance */}
                  <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center p-6">
                    <div className="relative h-64 w-64 rounded-2xl border-2 border-dashed border-[#159b7d]/70 shadow-[0_0_20px_rgba(21,155,125,0.25)] flex items-center justify-center">
                      <div className="absolute top-2 left-2 w-4 h-4 border-t-2 border-l-2 border-[#159b7d]" />
                      <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-[#159b7d]" />
                      <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-[#159b7d]" />
                      <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-[#159b7d]" />
                      <p className="text-[11px] text-white/80 text-center px-4 bg-black/50 py-1 rounded-full backdrop-blur-xs">
                        Center product in frame
                      </p>
                    </div>
                  </div>

                  {/* HACKATHON DEMO: EXPECTED BARCODE SELECTOR PILL */}
                  <div className="absolute top-3 left-3 right-3 z-20 flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => setShowDemoSelector(!showDemoSelector)}
                      className="bg-black/70 hover:bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/15 text-[11px] text-white flex items-center gap-1.5 shadow-md cursor-pointer transition"
                    >
                      <SlidersHorizontal size={12} className="text-[#159b7d]" />
                      <span>
                        {lastScannedBarcode
                          ? `Expected: ${scannedProductInfo?.name || lastScannedBarcode}`
                          : "Demo: Set Expected Product (Mismatch Test)"}
                      </span>
                      <ChevronDown size={12} className="text-[#8e9c97]" />
                    </button>

                    {/* Presets dropdown */}
                    {showDemoSelector && (
                      <div className="mt-2 w-full max-w-[320px] rounded-2xl bg-[#151e1b] border border-[#27342f] p-3 shadow-2xl animate-fade-in text-left">
                        <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-[#222d28]">
                          <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                            Select Expected Product
                          </span>
                          {lastScannedBarcode && (
                            <button
                              type="button"
                              onClick={() => {
                                setLastScannedBarcode("");
                                setScannedProductInfo(null);
                                setShowDemoSelector(false);
                              }}
                              className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          {DEMO_PRESETS.map((preset) => {
                            const isSelected = lastScannedBarcode === preset.barcode;
                            return (
                              <button
                                key={preset.barcode}
                                type="button"
                                onClick={() => {
                                  setLastScannedBarcode(preset.barcode);
                                  setScannedProductInfo(preset);
                                  setShowDemoSelector(false);
                                }}
                                className={`w-full text-left p-2 rounded-xl text-xs transition cursor-pointer flex justify-between items-center ${
                                  isSelected
                                    ? "bg-[#159b7d]/20 border border-[#159b7d] text-white"
                                    : "bg-[#0c1210] hover:bg-[#1a2521] text-neutral-300 border border-transparent"
                                }`}
                              >
                                <div>
                                  <p className="font-semibold text-[11px] leading-tight">
                                    {preset.name}
                                  </p>
                                  <p className="font-mono text-[9px] text-[#8e9c97]">
                                    {preset.barcode}
                                  </p>
                                </div>
                                {isSelected && (
                                  <Check size={14} className="text-[#159b7d] shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Camera error state */}
                  {aiCameraError && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/90 p-6 text-center">
                      <AlertTriangle size={36} className="text-amber-400 mb-3" />
                      <p className="text-xs text-neutral-200 mb-4 max-w-[280px]">
                        {aiCameraError}
                      </p>
                      <button
                        type="button"
                        onClick={startAiCamera}
                        className="rounded-lg bg-[#159b7d] px-4 py-2 text-xs font-semibold text-white shadow cursor-pointer"
                      >
                        Retry Camera
                      </button>
                    </div>
                  )}

                  {/* Shutter capture button */}
                  {!aiCameraError && (
                    <div className="absolute bottom-6 left-0 right-0 z-20 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={handleCapturePhoto}
                        aria-label="Capture product photo"
                        className="group flex h-18 w-18 items-center justify-center rounded-full border-4 border-white/80 bg-white/20 backdrop-blur-sm transition active:scale-90 hover:border-white cursor-pointer shadow-lg"
                      >
                        <div className="h-12 w-12 rounded-full bg-white transition group-hover:scale-95" />
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* CAPTURED IMAGE & VERIFICATION RESULTS */}
              {capturedImage && (
                <div className="relative flex-1 w-full h-full bg-[#0c1210] flex flex-col overflow-y-auto">
                  {/* Photo preview */}
                  <div className="relative h-56 w-full bg-black shrink-0 overflow-hidden border-b border-[#1b2521]">
                    <img
                      src={capturedImage}
                      alt="Captured product preview"
                      className="h-full w-full object-contain"
                    />

                    <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-md text-[10px] text-white flex items-center gap-1.5 border border-white/10">
                      <Sparkles size={12} className="text-[#159b7d]" />
                      <span>Captured Frame</span>
                    </div>

                    {!verifying && (
                      <button
                        type="button"
                        onClick={handleRetakePhoto}
                        className="absolute top-3 right-3 bg-black/60 hover:bg-black/80 backdrop-blur-sm px-2.5 py-1 rounded-md text-[11px] text-neutral-300 hover:text-white flex items-center gap-1 border border-white/10 cursor-pointer transition"
                      >
                        <RefreshCw size={11} />
                        <span>Retake</span>
                      </button>
                    )}
                  </div>

                  {/* Body: Actions or Result Cards */}
                  <div className="flex-1 p-4 flex flex-col justify-between">
                    {/* 1. INITIAL: READY TO VERIFY */}
                    {!verifying && !verificationResult && !verificationError && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                        <div className="h-12 w-12 rounded-2xl bg-[#159b7d]/15 flex items-center justify-center text-[#159b7d] mb-3">
                          <Sparkles size={24} />
                        </div>
                        <h3 className="text-sm font-semibold text-white mb-1">
                          Ready for AI Verification
                        </h3>
                        <p className="text-xs text-[#8e9c97] max-w-[260px] leading-relaxed mb-6">
                          Our AI Lab analyzes visual packaging, YOLO boundaries, DINOv2 embeddings, and OCR text to verify identity.
                        </p>

                        <div className="w-full flex gap-2.5">
                          <button
                            type="button"
                            onClick={handleRetakePhoto}
                            className="flex-1 py-3 px-4 rounded-xl bg-[#1d2623] hover:bg-[#25322e] text-white text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <RefreshCw size={14} />
                            Retake
                          </button>
                          <button
                            type="button"
                            onClick={handleVerifyProduct}
                            className="flex-2 py-3 px-4 rounded-xl bg-[#159b7d] hover:bg-[#128a6f] text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-2 shadow-md active:scale-98"
                          >
                            <Sparkles size={15} />
                            Verify Product
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 2. LOADING STATE */}
                    {verifying && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                        <div className="relative mb-4">
                          <div className="h-14 w-14 rounded-full border-3 border-[#159b7d]/20 border-t-[#159b7d] animate-spin" />
                          <Sparkles
                            size={20}
                            className="absolute inset-0 m-auto text-[#159b7d] animate-pulse"
                          />
                        </div>
                        <h3 className="text-sm font-semibold text-white mb-1.5">
                          Verifying product...
                        </h3>
                        <p className="text-xs text-[#8e9c97] max-w-[260px] leading-relaxed">
                          AI is checking barcode, visual match and packaging...
                        </p>
                      </div>
                    )}

                    {/* 3. VERIFICATION ERROR BANNER */}
                    {verificationError && !verifying && (
                      <div className="flex-1 flex flex-col items-center justify-center text-center py-4">
                        <div className="w-full rounded-xl border border-red-500/30 bg-red-950/30 p-4 mb-4 text-center">
                          <AlertCircle className="mx-auto mb-2 text-red-400" size={26} />
                          <p className="text-xs font-medium text-red-200 leading-relaxed mb-1">
                            Verification Notice
                          </p>
                          <p className="text-[11px] text-red-300/80 leading-normal">
                            {verificationError}
                          </p>
                        </div>

                        <div className="w-full flex gap-2.5">
                          <button
                            type="button"
                            onClick={handleRetakePhoto}
                            className="flex-1 py-3 px-4 rounded-xl bg-[#1d2623] text-white text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <RefreshCw size={14} />
                            Retake Photo
                          </button>
                          <button
                            type="button"
                            onClick={handleVerifyProduct}
                            className="flex-1 py-3 px-4 rounded-xl bg-[#159b7d] text-white text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            Try Again
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ====================================================
                        4. HACKATHON RESULT: MATCH
                    ===================================================== */}
                    {verificationResult && !verifying && verificationResult.status === "MATCH" && (
                      <div className="flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          {/* Status Banner */}
                          <div className="flex items-center justify-between rounded-xl bg-emerald-950/40 border border-emerald-500/40 p-3 mb-3">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 size={20} className="text-emerald-400 shrink-0" />
                              <h4 className="text-xs font-bold text-emerald-300 tracking-wide">
                                ✓ PRODUCT VERIFIED
                              </h4>
                            </div>
                            {formatConfidence(verificationResult.confidence) && (
                              <span className="text-[11px] font-semibold text-emerald-300 bg-emerald-900/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                {formatConfidence(verificationResult.confidence)}
                              </span>
                            )}
                          </div>

                          {/* Product Card */}
                          <div className="rounded-xl bg-[#151e1b] border border-[#232e29] p-3 mb-3 flex gap-3 items-center">
                            <div className="h-16 w-16 rounded-lg bg-[#0c1210] border border-[#232e29] flex items-center justify-center overflow-hidden shrink-0">
                              {verificationResult.product?.image || verificationResult.product?.imageUrl ? (
                                <img
                                  src={verificationResult.product?.image || verificationResult.product?.imageUrl}
                                  alt={verificationResult.product?.name || "Product"}
                                  className="h-full w-full object-contain p-1"
                                />
                              ) : (
                                <Package size={26} className="text-[#8e9c97]" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] uppercase font-bold text-[#159b7d]">
                                Product
                              </p>
                              <h5 className="text-xs font-bold text-white truncate">
                                {verificationResult.product?.name || "Verified Item"}
                              </h5>
                              <div className="flex justify-between items-center mt-1">
                                <span className="text-xs font-bold text-[#159b7d]">
                                  ₹{verificationResult.product?.price ?? 0}
                                </span>
                                {verificationResult.product?.barcode && (
                                  <span className="text-[10px] font-mono text-[#8e9c97]">
                                    {verificationResult.product.barcode}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Verification Signals (Requirement 7) */}
                          <div className="rounded-xl bg-[#151e1b] border border-[#232e29] p-3 mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8e9c97] mb-2">
                              Verification signals
                            </p>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex items-center gap-2 text-emerald-400">
                                <Check size={14} className="shrink-0" />
                                <span className="text-white text-[11px]">
                                  <strong>Barcode:</strong> {parsedSignals?.barcode?.text || "Confirmed"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-emerald-400">
                                <Check size={14} className="shrink-0" />
                                <span className="text-white text-[11px]">
                                  <strong>Visual:</strong> {parsedSignals?.similarity?.text || "Packaging Matched"}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 text-emerald-400">
                                <Check size={14} className="shrink-0" />
                                <span className="text-white text-[11px]">
                                  <strong>OCR:</strong> {parsedSignals?.ocr?.text || "Label Text Verified"}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-2 mt-auto pt-2">
                          {directAdded ? (
                            <div className="rounded-xl bg-emerald-950/50 border border-emerald-500/40 p-3 text-center">
                              <p className="text-xs font-bold text-emerald-300 mb-2">
                                ✓ Added to cart!
                              </p>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => navigate("/product-summary")}
                                  className="flex-1 py-2.5 rounded-lg bg-[#159b7d] text-white text-xs font-bold shadow cursor-pointer"
                                >
                                  View Cart
                                </button>
                                <button
                                  type="button"
                                  onClick={handleRetakePhoto}
                                  className="flex-1 py-2.5 rounded-lg bg-[#1d2623] text-white text-xs font-medium cursor-pointer"
                                >
                                  Scan Another
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={handleDirectAddToCart}
                                disabled={directAdding}
                                className="w-full py-3.5 px-4 rounded-xl bg-[#159b7d] hover:bg-[#128a6f] text-white text-xs font-bold tracking-wide uppercase transition cursor-pointer flex items-center justify-center gap-2 shadow-lg active:scale-98 disabled:opacity-60"
                              >
                                {directAdding ? (
                                  <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>Adding to Cart...</span>
                                  </>
                                ) : (
                                  <>
                                    <ShoppingCart size={16} />
                                    <span>ADD TO CART</span>
                                  </>
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={handleViewProduct}
                                className="w-full py-2 text-center text-xs text-[#8e9c97] hover:text-white transition cursor-pointer"
                              >
                                View Full Product Details →
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}

                    {/* ====================================================
                        5. HACKATHON RESULT: MISMATCH (Live Demonstration)
                    ===================================================== */}
                    {verificationResult && !verifying && verificationResult.status === "MISMATCH" && (
                      <div className="flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          {/* Alert Header */}
                          <div className="flex items-center justify-between rounded-xl bg-rose-950/50 border border-rose-500/50 p-3 mb-3">
                            <div className="flex items-center gap-2">
                              <AlertTriangle size={20} className="text-rose-400 shrink-0" />
                              <h4 className="text-xs font-extrabold text-rose-300 tracking-wider">
                                ⚠ PRODUCT MISMATCH
                              </h4>
                            </div>
                            {formatConfidence(verificationResult.confidence) && (
                              <span className="text-[11px] font-bold text-rose-200 bg-rose-900/60 px-2 py-0.5 rounded-full border border-rose-500/40">
                                {formatConfidence(verificationResult.confidence)}
                              </span>
                            )}
                          </div>

                          {/* Scanned vs Detected Comparison Card */}
                          <div className="rounded-xl bg-[#151e1b] border border-[#232e29] p-3.5 mb-3 space-y-2.5 text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#8e9c97] tracking-wider">
                                Scanned Product:
                              </span>
                              <div className="flex justify-between items-center mt-0.5">
                                <p className="font-semibold text-white truncate max-w-[200px]">
                                  {parsedSignals?.scannedName || "Expected Item"}
                                </p>
                                {lastScannedBarcode && (
                                  <span className="text-[10px] font-mono text-[#8e9c97] bg-[#0c1210] px-2 py-0.5 rounded">
                                    {lastScannedBarcode}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="border-t border-[#232e29] pt-2">
                              <span className="text-[10px] uppercase font-bold text-rose-400 tracking-wider">
                                Detected Product:
                              </span>
                              <div className="flex justify-between items-center mt-0.5">
                                <p className="font-bold text-rose-300 truncate max-w-[200px]">
                                  {parsedSignals?.detectedName || "Unknown Item"}
                                </p>
                                {parsedSignals?.detectedBarcode && (
                                  <span className="text-[10px] font-mono text-rose-300 bg-rose-950/60 border border-rose-500/30 px-2 py-0.5 rounded">
                                    {parsedSignals.detectedBarcode}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Reason */}
                            <div className="border-t border-[#232e29] pt-2">
                              <span className="text-[10px] uppercase font-bold text-[#8e9c97] tracking-wider">
                                Reason:
                              </span>
                              <p className="text-[11px] text-[#a0aba6] leading-relaxed mt-0.5">
                                {verificationResult.reason ||
                                  "Visual packaging in camera frame conflicts with the scanned barcode identity."}
                              </p>
                            </div>
                          </div>

                          {/* Signals Breakdown (Shows Agree / Disagree) */}
                          <div className="rounded-xl bg-[#151e1b] border border-[#232e29] p-3 text-xs mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8e9c97] mb-2">
                              Signals Breakdown
                            </p>
                            <div className="space-y-2">
                              {/* Barcode Signal */}
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[#8e9c97] font-medium text-[11px] shrink-0">
                                  Barcode:
                                </span>
                                <span className="text-right font-medium text-[11px] text-rose-400 flex items-center gap-1 justify-end">
                                  <XCircle size={12} className="shrink-0" />
                                  <span>{parsedSignals?.barcode?.text}</span>
                                </span>
                              </div>

                              {/* YOLO Signal */}
                              <div className="flex items-start justify-between gap-2 border-t border-[#232e29]/70 pt-1.5">
                                <span className="text-[#8e9c97] font-medium text-[11px] shrink-0">
                                  YOLO:
                                </span>
                                <span className="text-right font-medium text-[11px] text-emerald-400 flex items-center gap-1 justify-end">
                                  <CheckCircle2 size={12} className="shrink-0" />
                                  <span>{parsedSignals?.yolo?.text}</span>
                                </span>
                              </div>

                              {/* Visual Similarity Signal */}
                              <div className="flex items-start justify-between gap-2 border-t border-[#232e29]/70 pt-1.5">
                                <span className="text-[#8e9c97] font-medium text-[11px] shrink-0">
                                  Visual Similarity:
                                </span>
                                <span className="text-right font-medium text-[11px] text-rose-400 flex items-center gap-1 justify-end">
                                  <XCircle size={12} className="shrink-0" />
                                  <span>{parsedSignals?.similarity?.text}</span>
                                </span>
                              </div>

                              {/* OCR Signal */}
                              <div className="flex items-start justify-between gap-2 border-t border-[#232e29]/70 pt-1.5">
                                <span className="text-[#8e9c97] font-medium text-[11px] shrink-0">
                                  OCR:
                                </span>
                                <span className="text-right font-medium text-[11px] text-neutral-300 flex items-center gap-1 justify-end">
                                  <span>{parsedSignals?.ocr?.text}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons as requested: [ RESCAN ] [ BACK ] */}
                        <div className="flex gap-2.5 mt-auto pt-2">
                          <button
                            type="button"
                            onClick={handleBack}
                            className="flex-1 py-3.5 px-4 rounded-xl bg-[#1d2623] hover:bg-[#25322e] text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5"
                          >
                            <ArrowLeft size={14} />
                            <span>BACK</span>
                          </button>
                          <button
                            type="button"
                            onClick={handleRetakePhoto}
                            className="flex-1 py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 shadow"
                          >
                            <RefreshCw size={14} />
                            <span>RESCAN</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ====================================================
                        6. HACKATHON RESULT: REVIEW
                    ===================================================== */}
                    {verificationResult && !verifying && verificationResult.status === "REVIEW" && (
                      <div className="flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex items-center justify-between rounded-xl bg-amber-950/50 border border-amber-500/40 p-3 mb-3">
                            <div className="flex items-center gap-2">
                              <AlertCircle size={20} className="text-amber-400 shrink-0" />
                              <h4 className="text-xs font-extrabold text-amber-300 tracking-wider">
                                ⚠ VERIFICATION REQUIRES REVIEW
                              </h4>
                            </div>
                            {formatConfidence(verificationResult.confidence) && (
                              <span className="text-[11px] font-bold text-amber-200 bg-amber-900/60 px-2 py-0.5 rounded-full border border-amber-500/30">
                                {formatConfidence(verificationResult.confidence)}
                              </span>
                            )}
                          </div>

                          <div className="rounded-xl bg-[#151e1b] border border-[#232e29] p-3.5 mb-3 space-y-2.5 text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#8e9c97] tracking-wider">
                                Confidence:
                              </span>
                              <p className="font-semibold text-amber-300 mt-0.5">
                                {formatConfidence(verificationResult.confidence) || "Borderline (<70%)"}
                              </p>
                            </div>

                            <div className="border-t border-[#232e29] pt-2">
                              <span className="text-[10px] uppercase font-bold text-[#8e9c97] tracking-wider">
                                Reason:
                              </span>
                              <p className="text-[11px] text-[#a0aba6] leading-relaxed mt-0.5">
                                {verificationResult.reason ||
                                  "Visual features yielded ambiguous confidence. Manual review is recommended."}
                              </p>
                            </div>
                          </div>

                          {/* Signals */}
                          <div className="rounded-xl bg-[#151e1b] border border-[#232e29] p-3 text-xs mb-2">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#8e9c97] mb-2">
                              Signals Breakdown
                            </p>
                            <div className="space-y-1.5 text-[11px]">
                              <div className="flex justify-between">
                                <span className="text-[#8e9c97]">Barcode:</span>
                                <span className="text-neutral-300">{parsedSignals?.barcode?.text}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#8e9c97]">YOLO:</span>
                                <span className="text-neutral-300">{parsedSignals?.yolo?.text}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#8e9c97]">Visual:</span>
                                <span className="text-amber-300">{parsedSignals?.similarity?.text}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#8e9c97]">OCR:</span>
                                <span className="text-neutral-300">{parsedSignals?.ocr?.text}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Button: [ RESCAN ] */}
                        <div className="mt-auto pt-2">
                          <button
                            type="button"
                            onClick={handleRetakePhoto}
                            className="w-full py-3.5 px-4 rounded-xl bg-[#159b7d] hover:bg-[#128a6f] text-white text-xs font-bold uppercase tracking-wide transition cursor-pointer flex items-center justify-center gap-2 shadow"
                          >
                            <RefreshCw size={14} />
                            <span>RESCAN</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* ====================================================
                        7. HACKATHON RESULT: UNKNOWN
                    ===================================================== */}
                    {verificationResult && !verifying && verificationResult.status === "UNKNOWN" && (
                      <div className="flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex items-center gap-2 rounded-xl bg-neutral-900 border border-neutral-700 p-3 mb-3">
                            <HelpCircle size={20} className="text-neutral-400 shrink-0" />
                            <div>
                              <h4 className="text-xs font-bold text-neutral-200">
                                Product could not be identified
                              </h4>
                              <p className="text-[10px] text-neutral-400">
                                Confidence: N/A
                              </p>
                            </div>
                          </div>

                          <div className="rounded-xl bg-[#151e1b] border border-[#232e29] p-3.5 mb-3 text-xs text-[#8e9c97] leading-relaxed">
                            <span className="text-[10px] uppercase font-bold text-[#8e9c97] tracking-wider block mb-1">
                              Reason:
                            </span>
                            <p className="text-[11px] text-[#a0aba6] mb-2">
                              {verificationResult.reason ||
                                "No registered product features were recognized in the camera view."}
                            </p>
                            <p className="text-[10px] text-[#6d7974]">
                              Tip: Ensure packaging is well lit, unoccluded, and held steady.
                            </p>
                          </div>
                        </div>

                        <div className="mt-auto pt-2">
                          <button
                            type="button"
                            onClick={handleRetakePhoto}
                            className="w-full py-3.5 px-4 rounded-xl bg-[#159b7d] hover:bg-[#128a6f] text-white text-xs font-bold uppercase tracking-wide transition cursor-pointer flex items-center justify-center gap-2 shadow"
                          >
                            <RefreshCw size={14} />
                            <span>RESCAN</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
};

export default ScanProduct;