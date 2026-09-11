"use client";

import { useEffect, useRef, useState } from "react";
import Navigation from "@/components/Navigation";
import {
  Square,
  Sparkles,
  Save,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Tag,
  Layers,
  Box
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  class_id?: number;
}

interface BBox {
  id: string;
  class_id: number;
  product_id: string;
  product_name: string;
  x: number; // pixels on canvas
  y: number;
  w: number;
  h: number;
}

const API_BASE = "http://127.0.0.1:8000";

export default function AnnotationToolPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [imageList, setImageList] = useState<string[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0);
  const [activeClassId, setActiveClassId] = useState<number>(0);

  const [bboxes, setBboxes] = useState<BBox[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrawBox, setCurrentDrawBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Read product_id query param if available
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const pid = urlParams.get("product_id");
      if (pid) {
        setSelectedProductId(pid);
      }
    }
  }, []);

  // Fetch products
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/products`);
        const data = await res.json();
        if (data.success) {
          const mappedProds = data.products.map((p: any, idx: number) => ({
            id: p.id,
            name: p.name,
            class_id: idx
          }));
          setProducts(mappedProds);
          if (mappedProds.length > 0 && !selectedProductId) {
            setSelectedProductId(mappedProds[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch products:", err);
      }
    };
    fetchProducts();
  }, []);

  // Fetch image list when product selected
  useEffect(() => {
    if (!selectedProductId) return;
    const fetchDatasetInfo = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/v1/dataset/products/${selectedProductId}`);
        const data = await res.json();
        if (data.success) {
          setImageList(data.images || []);
          setCurrentImageIndex(0);
        }
      } catch (err) {
        console.error("Error fetching dataset info:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDatasetInfo();
  }, [selectedProductId]);

  const currentImageFilename = imageList[currentImageIndex] || null;
  const currentImageId = currentImageFilename ? currentImageFilename.split(".")[0] : null;

  // Load Image onto Canvas
  useEffect(() => {
    if (!currentImageId) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `${API_BASE}/api/v1/dataset/images/${currentImageId}?product_id=${selectedProductId}`;

    img.onload = () => {
      imageRef.current = img;
      renderCanvas();
    };
  }, [currentImageId, selectedProductId, bboxes, currentDrawBox]);

  const renderCanvas = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = img.naturalWidth || 800;
    canvas.height = img.naturalHeight || 600;

    // Draw background image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Draw saved bounding boxes
    bboxes.forEach((box) => {
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x, box.y, box.w, box.h);

      ctx.fillStyle = "rgba(59, 130, 246, 0.2)";
      ctx.fillRect(box.x, box.y, box.w, box.h);

      // Draw label badge
      ctx.fillStyle = "#3b82f6";
      ctx.fillRect(box.x, Math.max(0, box.y - 24), Math.max(120, box.product_name.length * 9), 24);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText(`[${box.class_id}] ${box.product_name}`, box.x + 6, Math.max(16, box.y - 7));
    });

    // Draw current drawing box
    if (currentDrawBox) {
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(currentDrawBox.x, currentDrawBox.y, currentDrawBox.w, currentDrawBox.h);
      ctx.setLineDash([]);
    }
  };

  // Mouse Canvas Drawing Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    setIsDrawing(true);
    setDrawStart({ x: mouseX, y: mouseY });
    setCurrentDrawBox({ x: mouseX, y: mouseY, w: 0, h: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawStart || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const currentX = (e.clientX - rect.left) * scaleX;
    const currentY = (e.clientY - rect.top) * scaleY;

    const x = Math.min(drawStart.x, currentX);
    const y = Math.min(drawStart.y, currentY);
    const w = Math.abs(currentX - drawStart.x);
    const h = Math.abs(currentY - drawStart.y);

    setCurrentDrawBox({ x, y, w, h });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentDrawBox) return;
    setIsDrawing(false);

    if (currentDrawBox.w > 10 && currentDrawBox.h > 10) {
      const activeProd = products.find((p) => p.id === selectedProductId) || products[0];
      const newBox: BBox = {
        id: `box_${Date.now()}`,
        class_id: activeClassId,
        product_id: selectedProductId,
        product_name: activeProd ? activeProd.name : "Product",
        x: currentDrawBox.x,
        y: currentDrawBox.y,
        w: currentDrawBox.w,
        h: currentDrawBox.h
      };

      setBboxes((prev) => [...prev, newBox]);
    }

    setDrawStart(null);
    setCurrentDrawBox(null);
  };

  // AI Auto-Suggest Bounding Boxes
  const autoSuggestBoxes = async () => {
    if (!currentImageId) return;
    setFeedback({ type: "success", message: "Running AI detector to suggest bounding boxes..." });

    try {
      // Fetch image blob first
      const imgRes = await fetch(`${API_BASE}/api/v1/dataset/images/${currentImageId}?product_id=${selectedProductId}`);
      const blob = await imgRes.blob();

      const formData = new FormData();
      formData.append("file", blob, "image.jpg");

      const detRes = await fetch(`${API_BASE}/api/v1/recognition/detect`, {
        method: "POST",
        body: formData
      });
      const data = await detRes.json();

      if (data.success && data.detections && data.detections.length > 0) {
        const img = imageRef.current;
        if (!img) return;

        const activeProd = products.find((p) => p.id === selectedProductId) || products[0];

        const suggested: BBox[] = data.detections.map((det: any, idx: number) => ({
          id: `ai_${idx}_${Date.now()}`,
          class_id: activeClassId,
          product_id: selectedProductId,
          product_name: activeProd ? activeProd.name : "Product",
          x: det.bounding_box.x,
          y: det.bounding_box.y,
          w: det.bounding_box.width,
          h: det.bounding_box.height
        }));

        setBboxes(suggested);
        setFeedback({ type: "success", message: `AI suggested ${suggested.length} bounding box(es). Please review and adjust.` });
      } else {
        setFeedback({ type: "error", message: "AI detector found no bounding box proposals." });
      }
    } catch (err) {
      setFeedback({ type: "error", message: "AI auto-suggest failed." });
    }
  };

  // Save Annotations
  const saveAnnotations = async () => {
    if (!currentImageId || !selectedProductId) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (bboxes.length === 0) {
      setFeedback({ type: "error", message: "Please draw at least one product bounding box before saving." });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    // Convert pixel coordinates to normalized YOLO format (0..1)
    const normalizedAnn = bboxes.map((box) => {
      const cx = (box.x + box.w / 2.0) / canvas.width;
      const cy = (box.y + box.h / 2.0) / canvas.height;
      const nw = box.w / canvas.width;
      const nh = box.h / canvas.height;

      return {
        class_id: box.class_id,
        product_id: box.product_id,
        center_x: Math.max(0, Math.min(1, cx)),
        center_y: Math.max(0, Math.min(1, cy)),
        width: Math.max(0, Math.min(1, nw)),
        height: Math.max(0, Math.min(1, nh))
      };
    });

    try {
      const res = await fetch(`${API_BASE}/api/v1/dataset/annotate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_id: currentImageId,
          product_id: selectedProductId,
          annotations: normalizedAnn
        })
      });

      const data = await res.json();
      if (data.success) {
        setFeedback({ type: "success", message: `Saved ${normalizedAnn.length} annotation(s) for image ${currentImageId}.` });

        // Auto move to next image
        if (currentImageIndex < imageList.length - 1) {
          setCurrentImageIndex((prev) => prev + 1);
          setBboxes([]);
        }
      } else {
        setFeedback({ type: "error", message: data.error || "Failed to save annotations." });
      }
    } catch (err) {
      setFeedback({ type: "error", message: "API communication error." });
    } finally {
      setIsSaving(false);
    }
  };

  const removeBox = (id: string) => {
    setBboxes((prev) => prev.filter((b) => b.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:py-6 flex flex-col gap-5">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <Square className="h-6 w-6 text-blue-600" />
              YOLO Bounding Box Annotation Tool
            </h2>
            <p className="text-xs text-gray-500 font-medium">
              Step 16H: Draw bounding boxes for products in training images (Multi-product support enabled)
            </p>
          </div>

          {/* Product Selector */}
          <div className="flex items-center gap-3">
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-xs font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Class {p.class_id ?? 0})
                </option>
              ))}
            </select>
          </div>
        </header>

        {/* Feedback Banner */}
        {feedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center justify-between ${
              feedback.type === "success" ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-red-600" />}
              {feedback.message}
            </div>
            <button onClick={() => setFeedback(null)} className="text-xs opacity-60 hover:opacity-100 font-bold ml-4">✕</button>
          </div>
        )}

        {/* Main Canvas & Controls Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Canvas Panel (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-3">
              {/* Navigation Bar */}
              <div className="flex items-center justify-between border-b pb-3 text-xs font-bold text-gray-600">
                <span>
                  Image {imageList.length > 0 ? currentImageIndex + 1 : 0} of {imageList.length}:{" "}
                  <code className="text-blue-600">{currentImageFilename || "No image loaded"}</code>
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    disabled={currentImageIndex === 0}
                    onClick={() => {
                      setCurrentImageIndex((prev) => Math.max(0, prev - 1));
                      setBboxes([]);
                    }}
                    className="p-1.5 rounded-lg border bg-white hover:bg-gray-100 disabled:opacity-40 text-gray-700"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    disabled={currentImageIndex >= imageList.length - 1}
                    onClick={() => {
                      setCurrentImageIndex((prev) => Math.min(imageList.length - 1, prev + 1));
                      setBboxes([]);
                    }}
                    className="p-1.5 rounded-lg border bg-white hover:bg-gray-100 disabled:opacity-40 text-gray-700"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (currentImageIndex < imageList.length - 1) {
                        setCurrentImageIndex((prev) => prev + 1);
                        setBboxes([]);
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold ml-2"
                  >
                    <SkipForward className="h-3.5 w-3.5" />
                    Skip
                  </button>
                </div>
              </div>

              {/* Canvas Area */}
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-100 border border-gray-300 flex items-center justify-center cursor-crosshair select-none">

                {currentImageId ? (
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center py-16 text-gray-500 text-xs font-semibold">
                    No images available for selected product dataset.
                  </div>
                )}
              </div>

              {/* Instructions */}
              <p className="text-[11px] text-gray-400 font-medium">
                💡 <strong>Instructions</strong>: Click & drag on the image canvas to draw product bounding boxes. Multiple boxes per image are supported.
              </p>
            </div>
          </div>

          {/* Right Side Panel: Class Selector, AI Suggestion & Annotations List (4 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            {/* Controls Box */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col gap-4">
              <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2 border-b pb-2">
                <Tag className="h-4 w-4 text-blue-500" />
                Annotation Class & Controls
              </h3>

              {/* AI Auto-Suggest Button */}
              <button
                onClick={autoSuggestBoxes}
                className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white py-2.5 rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center gap-2"
              >
                <Sparkles className="h-4 w-4" />
                AI Suggested Box (Human Review)
              </button>

              {/* Drawn Bounding Boxes List */}
              <div className="border-t pt-3 flex flex-col gap-2">
                <span className="text-xs font-bold text-gray-600 flex justify-between">
                  <span>Annotated Objects ({bboxes.length})</span>
                  {bboxes.length > 0 && (
                    <button onClick={() => setBboxes([])} className="text-red-500 text-[11px] hover:underline">
                      Clear All
                    </button>
                  )}
                </span>

                {bboxes.length === 0 ? (
                  <p className="text-xs text-gray-400 italic text-center py-4">No bounding boxes drawn yet.</p>
                ) : (
                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                    {bboxes.map((box, idx) => (
                      <div key={box.id} className="p-2 bg-gray-50 rounded-lg border border-gray-200 flex items-center justify-between text-xs">
                        <div>
                          <span className="font-bold text-gray-800">Box #{idx + 1}</span>
                          <span className="text-[10px] text-gray-500 block">
                            [{box.class_id}] {box.product_name} ({Math.round(box.w)}x{Math.round(box.h)}px)
                          </span>
                        </div>
                        <button onClick={() => removeBox(box.id)} className="text-red-500 hover:text-red-700 p-1">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Save Annotation Button */}
              <button
                onClick={saveAnnotations}
                disabled={isSaving || bboxes.length === 0}
                className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving Annotations..." : "Save Annotation & Next"}
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
