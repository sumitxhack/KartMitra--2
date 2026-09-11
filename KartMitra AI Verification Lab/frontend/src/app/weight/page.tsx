"use client";

import { useState, useEffect } from "react";
import { Scale, CheckCircle2, AlertTriangle, RefreshCw, Cpu, Layers, HelpCircle, ArrowRight } from "lucide-react";
import Navigation from "@/components/Navigation";

interface Product {
  id: string;
  name: string;
  barcode: string;
  weight: number;
  price: number;
  category: string;
}

interface VerificationResult {
  expected_weight: number;
  actual_weight: number;
  difference: number;
  within_tolerance: boolean;
  tolerance_kg: number;
  status: string;
}


type PresetMode = "Exact" | "+1%" | "+3%" | "+5%" | "+10%" | "+20%" | "Custom";

export default function MockWeightDashboard() {
  const [expectedWeight, setExpectedWeight] = useState<number>(1.0);
  const [actualWeight, setActualWeight] = useState<number>(1.03);
  const [selectedPreset, setSelectedPreset] = useState<PresetMode>("+3%");
  
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const API_BASE = "http://127.0.0.1:8000";

  // Fetch registered products on load to allow product weight selection
  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/products`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          setProducts(data.products);
        }
      }
    } catch (e) {
      console.warn("Could not fetch products for auto-fill selection:", e);
    }
  };

  // Helper to calculate actual weight based on preset percentage
  const calculateActualWeight = (expWeight: number, preset: PresetMode): number => {
    switch (preset) {
      case "Exact":
        return parseFloat(expWeight.toFixed(4));
      case "+1%":
        return parseFloat((expWeight * 1.01).toFixed(4));
      case "+3%":
        return parseFloat((expWeight * 1.03).toFixed(4));
      case "+5%":
        return parseFloat((expWeight * 1.05).toFixed(4));
      case "+10%":
        return parseFloat((expWeight * 1.10).toFixed(4));
      case "+20%":
        return parseFloat((expWeight * 1.20).toFixed(4));
      case "Custom":
      default:
        return actualWeight;
    }
  };

  // Handle Preset selection click
  const handlePresetSelect = (preset: PresetMode) => {
    setSelectedPreset(preset);
    if (preset !== "Custom") {
      const updatedActual = calculateActualWeight(expectedWeight, preset);
      setActualWeight(updatedActual);
    }
  };

  // Handle Expected Weight change
  const handleExpectedWeightChange = (newExpWeight: number) => {
    setExpectedWeight(newExpWeight);
    if (selectedPreset !== "Custom") {
      const updatedActual = calculateActualWeight(newExpWeight, selectedPreset);
      setActualWeight(updatedActual);
    }
  };

  // Select registered product from dropdown
  const handleSelectProduct = (productId: string) => {
    setSelectedProductId(productId);
    const prod = products.find((p) => p.id === productId);
    if (prod) {
      handleExpectedWeightChange(prod.weight);
    }
  };

  // Perform POST to /api/v1/verification/mock-weight
  const handleVerifyWeight = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/api/v1/verification/mock-weight`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          expected_weight: Number(expectedWeight),
          actual_weight: Number(actualWeight),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: VerificationResult = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error("Verification API Error:", err);
      setError(err.message || "Failed to connect to verification API");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-run initial verification on component mount
  useEffect(() => {
    handleVerifyWeight();
  }, []);

  const presets: PresetMode[] = ["Exact", "+1%", "+3%", "+5%", "+10%", "+20%", "Custom"];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navigation />

      <main className="flex-1 max-w-6xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Header Section */}
        <header className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              <Scale className="h-4 w-4" /> Weight Verification Simulator
            </div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              Mock Weight Dashboard
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Hardware-Independent Verification Service using pluggable <code className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded font-mono text-[11px]">MockWeightService</code> architecture
            </p>
          </div>

          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 px-3.5 py-2 rounded-xl text-blue-800 text-xs font-semibold">
            <Cpu className="h-4 w-4 text-blue-600 shrink-0" />
            <div>
              <span className="font-bold block">Pluggable Weight Service</span>
              <span className="text-[11px] text-blue-600">MockWeightService &rarr; RealHardwareWeightService</span>
            </div>
          </div>
        </header>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Controls Column (7 Cols) */}
          <div className="lg:col-span-7 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-6">
            <div className="flex items-center justify-between border-b pb-4">
              <h3 className="font-bold text-gray-800 text-base flex items-center gap-2">
                <Scale className="h-5 w-5 text-blue-600" />
                Weight Control Simulator
              </h3>

              {products.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 font-medium hidden sm:inline">Product Preset:</span>
                  <select
                    value={selectedProductId}
                    onChange={(e) => handleSelectProduct(e.target.value)}
                    className="text-xs font-medium bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select registered product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.weight} kg)
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Inputs Section */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Expected Weight Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                  Expected Weight (kg)
                  <span className="text-[10px] text-gray-400 font-normal">Catalog / Spec Weight</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={expectedWeight}
                    onChange={(e) => handleExpectedWeightChange(parseFloat(e.target.value) || 0)}
                    className="w-full text-lg font-extrabold text-gray-900 bg-gray-50 border border-gray-300 rounded-xl px-4 py-2.5 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  />
                  <span className="absolute right-3.5 top-3 text-xs font-bold text-gray-400">KG</span>
                </div>
              </div>

              {/* Actual Weight Input */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center justify-between">
                  Actual Weight (kg)
                  <span className="text-[10px] text-gray-400 font-normal">Simulated / Scale Reading</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={actualWeight}
                    onChange={(e) => {
                      setActualWeight(parseFloat(e.target.value) || 0);
                      setSelectedPreset("Custom");
                    }}
                    className={`w-full text-lg font-extrabold border rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none transition ${
                      selectedPreset === "Custom"
                        ? "bg-white border-blue-500 text-blue-900"
                        : "bg-gray-50 border-gray-300 text-gray-900"
                    }`}
                  />
                  <span className="absolute right-3.5 top-3 text-xs font-bold text-gray-400">KG</span>
                </div>
              </div>
            </div>

            {/* Quick Percentage Presets Section */}
            <div className="flex flex-col gap-3 pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Weight Offset Controls
                </span>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                  Active: {selectedPreset}
                </span>
              </div>

              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {presets.map((preset) => {
                  const isSelected = selectedPreset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handlePresetSelect(preset)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-0.5 ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-md shadow-blue-200 scale-[1.02]"
                          : "bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
                      }`}
                    >
                      <span>{preset}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action Trigger */}
            <div className="pt-2">
              <button
                onClick={handleVerifyWeight}
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3.5 rounded-xl font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Executing Verification API...
                  </>
                ) : (
                  <>
                    <Scale className="h-4 w-4" />
                    Run Weight Verification
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results Column (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {/* Verification Outcome Card */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-5">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="font-bold text-gray-800 text-base">Verification Result</h3>
                {result && (
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                      result.within_tolerance
                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        : "bg-red-100 text-red-800 border border-red-300"
                    }`}
                  >
                    {result.within_tolerance ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        {result.status} (PASS)
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                        {result.status} (FAIL)
                      </>
                    )}
                  </span>
                )}
              </div>

              {error ? (
                <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-xs font-medium">
                  <p className="font-bold mb-1">API Request Failed</p>
                  <p>{error}</p>
                </div>
              ) : result ? (
                <div className="flex flex-col gap-4">
                  {/* Weight Comparison Cards */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <span className="text-[11px] font-semibold text-gray-500 block uppercase">Expected</span>
                      <span className="text-base font-extrabold text-gray-900 mt-1 block">
                        {result.expected_weight.toFixed(2)} <span className="text-xs font-normal">kg</span>
                      </span>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                      <span className="text-[11px] font-semibold text-gray-500 block uppercase">Actual</span>
                      <span className="text-base font-extrabold text-gray-900 mt-1 block">
                        {result.actual_weight.toFixed(2)} <span className="text-xs font-normal">kg</span>
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-xl border ${
                        result.within_tolerance
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                          : "bg-red-50 border-red-200 text-red-900"
                      }`}
                    >
                      <span className="text-[11px] font-semibold block uppercase opacity-75">Difference</span>
                      <span className="text-base font-extrabold mt-1 block">
                        {result.difference.toFixed(2)} <span className="text-xs font-normal">kg</span>
                      </span>
                    </div>
                  </div>

                  {/* Configured Tolerance Banner */}
                  <div className="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-800 text-xs flex flex-col gap-1.5">
                    <div className="flex items-center justify-between font-bold text-white">
                      <span>Tolerance Threshold</span>
                      <span className="font-mono text-emerald-400 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        WEIGHT_TOLERANCE_KG = {result.tolerance_kg ?? 0.05} kg
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Evaluated condition: <code className="text-slate-300">difference ({result.difference} kg) &le; tolerance ({result.tolerance_kg ?? 0.05} kg)</code>
                    </p>
                  </div>

                  {/* API Response JSON Box */}
                  <div className="flex flex-col gap-1.5 pt-1">
                    <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      Raw JSON Response (<code className="lowercase">POST /api/v1/verification/mock-weight</code>)
                    </span>
                    <pre className="bg-slate-950 text-emerald-400 font-mono text-xs p-4 rounded-xl overflow-x-auto border border-slate-800 shadow-inner">
{JSON.stringify(
  {
    expected_weight: result.expected_weight,
    actual_weight: result.actual_weight,
    difference: result.difference,
  },
  null,
  2
)}
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Loading verification result...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
