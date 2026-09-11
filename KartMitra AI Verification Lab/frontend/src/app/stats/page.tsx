"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import {
  BarChart3,
  Package,
  ImageIcon,
  AlertTriangle,
  CheckCircle2,
  PieChart,
  ArrowRight,
  RefreshCw,
  Search,
  Filter,
  Tag,
  Award,
  Sliders,
  Layers,
  Activity,
  Plus,
  ShieldCheck,
  Check,
  XCircle,
  HelpCircle,
  TrendingUp,
  Grid
} from "lucide-react";

interface ProductStat {
  id: string;
  barcode: string;
  name: string;
  category: string;
  total_images: number;
  needs_more_images: boolean;
  image_types: string[];
}

interface DatasetStats {
  total_products: number;
  total_images: number;
  avg_images_per_product: number;
  products_without_enough_images: number;
  products: ProductStat[];
}

interface EvalRun {
  id: string;
  name: string;
  description?: string;
  total_tests: number;
  accuracy: number;
  top1_accuracy: number;
  top3_accuracy: number;
  created_at: string;
}

interface EvalMetrics {
  total_tests: number;
  overall_accuracy: number;
  top1_accuracy: number;
  top3_accuracy: number;
  unknown_detection_rate: number;
  false_positive_rate: number;
  review_rate: number;
  match_rate: number;
  average_similarity: number;
  avg_correct_similarity: number;
  avg_incorrect_similarity: number;
  average_margin: number;
  per_product: any[];
  condition_breakdown: any;
}

const API_BASE = "http://127.0.0.1:8000";

export default function DatasetStatisticsPage() {
  const [activeTab, setActiveTab] = useState<"evaluation" | "coverage">("evaluation");

  // Coverage Stats States
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "flagged" | "complete">("all");
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Step 14 Evaluation Dashboard States
  const [runs, setRuns] = useState<EvalRun[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string>("");
  const [metrics, setMetrics] = useState<EvalMetrics | null>(null);
  const [confusionMatrix, setConfusionMatrix] = useState<{ labels: string[]; matrix: number[][] } | null>(null);
  const [thresholdAnalysis, setThresholdAnalysis] = useState<any[]>([]);
  const [recommendedThresholds, setRecommendedThresholds] = useState<any[]>([]);
  const [datasetQuality, setDatasetQuality] = useState<any[]>([]);
  const [newRunName, setNewRunName] = useState("");
  const [isCreatingRun, setIsCreatingRun] = useState(false);

  const fetchCoverageStats = async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/dataset/stats`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) setStats(data.stats);
      }
    } catch (err) {
      console.error("Error fetching dataset stats:", err);
      setFetchError("API Connection Failure to FastAPI backend.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEvaluationData = async () => {
    try {
      // Fetch runs
      const runsRes = await fetch(`${API_BASE}/api/v1/evaluation/runs`);
      if (runsRes.ok) {
        const runsData = await runsRes.json();
        setRuns(runsData);
        if (runsData.length > 0 && !selectedRunId) {
          setSelectedRunId(runsData[0].id);
        }
      }

      // Fetch dataset quality
      const qRes = await fetch(`${API_BASE}/api/v1/evaluation/dataset-quality`);
      if (qRes.ok) {
        const qData = await qRes.json();
        setDatasetQuality(qData);
      }
    } catch (e) {
      console.error("Error loading evaluation data:", e);
    }
  };

  const fetchRunMetrics = async (runId: string) => {
    if (!runId) return;
    try {
      const mRes = await fetch(`${API_BASE}/api/v1/evaluation/runs/${runId}/metrics`);
      if (mRes.ok) {
        const mData = await mRes.json();
        setMetrics(mData);
      }

      const cmRes = await fetch(`${API_BASE}/api/v1/evaluation/runs/${runId}/confusion-matrix`);
      if (cmRes.ok) {
        const cmData = await cmRes.json();
        setConfusionMatrix(cmData);
      }

      const taRes = await fetch(`${API_BASE}/api/v1/evaluation/runs/${runId}/threshold-analysis`);
      if (taRes.ok) {
        const taData = await taRes.json();
        setThresholdAnalysis(taData.threshold_analysis || []);
        setRecommendedThresholds(taData.recommended_candidates || []);
      }
    } catch (e) {
      console.error("Error fetching run metrics:", e);
    }
  };

  useEffect(() => {
    fetchCoverageStats();
    fetchEvaluationData();
  }, []);

  useEffect(() => {
    if (selectedRunId) {
      fetchRunMetrics(selectedRunId);
    }
  }, [selectedRunId]);

  const handleCreateRun = async () => {
    if (!newRunName.trim()) return;
    setIsCreatingRun(true);
    try {
      const res = await fetch(`${API_BASE}/api/v1/evaluation/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRunName.trim(), description: "Camera & visual benchmark test run" })
      });
      const data = await res.json();
      setNewRunName("");
      await fetchEvaluationData();
      if (data.id) setSelectedRunId(data.id);
    } catch (e) {
      console.error("Create run error:", e);
    } finally {
      setIsCreatingRun(false);
    }
  };

  const filteredProducts = (stats?.products || []).filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode.includes(searchQuery) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterMode === "flagged") return matchesSearch && p.needs_more_images;
    if (filterMode === "complete") return matchesSearch && !p.needs_more_images;
    return matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <Navigation />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:py-8 flex flex-col gap-6">
        {/* Page Header */}
        <header className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-blue-600" />
              Visual Evaluation & Dataset Analytics Dashboard
            </h2>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Step 14 Benchmarking: Recognition accuracy, confusion matrix, margin analysis, and dataset health
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center bg-gray-100 p-1 rounded-xl shrink-0">
              <button
                onClick={() => setActiveTab("evaluation")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "evaluation"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Award className="h-4 w-4" />
                Visual Evaluation
              </button>
              <button
                onClick={() => setActiveTab("coverage")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeTab === "coverage"
                    ? "bg-white text-blue-600 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Package className="h-4 w-4" />
                Coverage & Images
              </button>
            </div>

            <button
              onClick={() => { fetchCoverageStats(); fetchEvaluationData(); if (selectedRunId) fetchRunMetrics(selectedRunId); }}
              className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-bold transition border border-gray-200"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-blue-500" : ""}`} />
              Refresh
            </button>
          </div>
        </header>

        {/* STEP 14U: VISUAL EVALUATION DASHBOARD TAB */}
        {activeTab === "evaluation" && (
          <div className="flex flex-col gap-6">
            {/* Test Run Controls Bar */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-gray-700 uppercase tracking-wider shrink-0">Select Evaluation Run:</span>
                <select
                  value={selectedRunId}
                  onChange={(e) => setSelectedRunId(e.target.value)}
                  className="bg-gray-50 border border-gray-300 font-bold text-xs text-gray-900 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 max-w-xs"
                >
                  {runs.length === 0 && <option value="">No evaluation runs created yet</option>}
                  {runs.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.total_tests} tests — Acc: {(r.accuracy * 100).toFixed(1)}%)
                    </option>
                  ))}
                </select>
              </div>

              {/* Create Run input */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="New Evaluation Run Name..."
                  value={newRunName}
                  onChange={(e) => setNewRunName(e.target.value)}
                  className="bg-gray-50 border border-gray-300 text-xs font-semibold text-gray-800 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
                />
                <button
                  onClick={handleCreateRun}
                  disabled={isCreatingRun || !newRunName.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs px-4 py-2 rounded-xl transition shadow-xs flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" /> Create Run
                </button>
              </div>
            </div>

            {/* SECTION 1: OVERALL PERFORMANCE CARDS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Overall Accuracy</span>
                <span className="text-3xl font-black text-gray-900 mt-1 block">
                  {metrics ? `${(metrics.overall_accuracy * 100).toFixed(1)}%` : "0.0%"}
                </span>
                <span className="text-[10px] text-gray-500 font-semibold mt-1 block">
                  Total Tests: {metrics?.total_tests || 0}
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Top-1 / Top-3 Accuracy</span>
                <span className="text-3xl font-black text-blue-600 mt-1 block">
                  {metrics ? `${(metrics.top1_accuracy * 100).toFixed(1)}% / ${(metrics.top3_accuracy * 100).toFixed(1)}%` : "0% / 0%"}
                </span>
                <span className="text-[10px] text-gray-500 font-semibold mt-1 block">
                  Rank 1 exact match & Top 3 inclusion
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Unknown Detection</span>
                <span className="text-3xl font-black text-emerald-600 mt-1 block">
                  {metrics ? `${(metrics.unknown_detection_rate * 100).toFixed(1)}%` : "0.0%"}
                </span>
                <span className="text-[10px] text-gray-500 font-semibold mt-1 block">
                  Correctly rejected unregistered items
                </span>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs">
                <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">False Positive / Review Rate</span>
                <span className="text-3xl font-black text-amber-600 mt-1 block">
                  {metrics ? `${(metrics.false_positive_rate * 100).toFixed(1)}% / ${(metrics.review_rate * 100).toFixed(1)}%` : "0% / 0%"}
                </span>
                <span className="text-[10px] text-gray-500 font-semibold mt-1 block">
                  Incorrect acceptances & Review flags
                </span>
              </div>
            </div>

            {/* SECTION 2: SIMILARITY & MARGIN METRICS */}
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-4">
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <Activity className="h-5 w-5 text-indigo-600" /> Similarity & Margin Distribution Metrics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-center">
                  <span className="text-[10px] font-bold text-gray-500 uppercase block">Average Similarity</span>
                  <span className="text-2xl font-black text-gray-900 mt-1 block">{metrics?.average_similarity.toFixed(4) || "0.0000"}</span>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 text-center">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block">Avg Correct Similarity</span>
                  <span className="text-2xl font-black text-emerald-950 mt-1 block">{metrics?.avg_correct_similarity.toFixed(4) || "0.0000"}</span>
                </div>
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 text-center">
                  <span className="text-[10px] font-bold text-rose-700 uppercase block">Avg Incorrect Similarity</span>
                  <span className="text-2xl font-black text-rose-950 mt-1 block">{metrics?.avg_incorrect_similarity.toFixed(4) || "0.0000"}</span>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-center">
                  <span className="text-[10px] font-bold text-blue-700 uppercase block">Average Margin (Top 1 - Top 2)</span>
                  <span className="text-2xl font-black text-blue-950 mt-1 block">{metrics?.average_margin.toFixed(4) || "0.0000"}</span>
                </div>
              </div>
            </div>

            {/* SECTION 3 & 4: PER-PRODUCT PERFORMANCE TABLE & CONFUSION MATRIX */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Per-Product Table */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-4">
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Package className="h-5 w-5 text-blue-600" /> Per-Product Performance
                </h3>
                <div className="overflow-x-auto max-h-[350px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b text-[10px] uppercase font-bold text-gray-500">
                        <th className="py-2.5 px-3">Product Name</th>
                        <th className="py-2.5 px-3">Tests</th>
                        <th className="py-2.5 px-3">Accuracy</th>
                        <th className="py-2.5 px-3">Avg Sim</th>
                        <th className="py-2.5 px-3">Avg Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {(metrics?.per_product || []).map((p, idx) => (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-bold text-gray-900">{p.product_name}</td>
                          <td className="py-2.5 px-3">{p.total_tests}</td>
                          <td className="py-2.5 px-3 font-bold text-emerald-600">{(p.accuracy * 100).toFixed(0)}%</td>
                          <td className="py-2.5 px-3 font-mono">{p.average_similarity}</td>
                          <td className="py-2.5 px-3 font-mono">{p.average_margin}</td>
                        </tr>
                      ))}
                      {(!metrics || metrics.per_product.length === 0) && (
                        <tr>
                          <td colSpan={5} className="py-6 text-center text-gray-400 font-semibold">No evaluation records in this run.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Confusion Matrix */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-4">
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Grid className="h-5 w-5 text-indigo-600" /> Product Confusion Matrix
                </h3>
                {confusionMatrix && confusionMatrix.labels.length > 0 ? (
                  <div className="overflow-x-auto max-h-[350px]">
                    <table className="text-center text-xs font-mono border-collapse">
                      <thead>
                        <tr>
                          <th className="p-2 text-[10px] font-bold text-gray-400 uppercase">Actual ↓ / Pred →</th>
                          {confusionMatrix.labels.map((l, idx) => (
                            <th key={idx} className="p-2 text-[10px] font-bold text-gray-700 max-w-[80px] truncate">{l}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {confusionMatrix.matrix.map((row, rIdx) => (
                          <tr key={rIdx}>
                            <td className="p-2 font-bold text-gray-800 text-left text-[11px] max-w-[100px] truncate">
                              {confusionMatrix.labels[rIdx]}
                            </td>
                            {row.map((val, cIdx) => (
                              <td
                                key={cIdx}
                                className={`p-2.5 border border-white font-bold rounded ${
                                  rIdx === cIdx
                                    ? val > 0 ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-800"
                                    : val > 0 ? "bg-rose-500 text-white" : "bg-gray-100 text-gray-400"
                                }`}
                              >
                                {val}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-gray-400 font-semibold text-xs border border-dashed rounded-xl">
                    Run evaluation tests to populate the confusion matrix.
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 5 & 6: THRESHOLD ANALYSIS & DATASET QUALITY REPORT */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Threshold Analysis Table */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-4">
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-blue-600" /> Threshold Candidate Analysis
                </h3>
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left text-xs border-collapse font-mono">
                    <thead>
                      <tr className="bg-gray-100 border-b text-[10px] uppercase font-bold text-gray-500">
                        <th className="py-2.5 px-3">Threshold</th>
                        <th className="py-2.5 px-3">Accuracy</th>
                        <th className="py-2.5 px-3">Precision</th>
                        <th className="py-2.5 px-3">Recall</th>
                        <th className="py-2.5 px-3">FPR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {thresholdAnalysis.map((t, idx) => (
                        <tr key={idx} className={t.threshold === 0.82 ? "bg-blue-50 font-bold text-blue-900" : "hover:bg-gray-50"}>
                          <td className="py-2 px-3 font-bold">{t.threshold.toFixed(2)}</td>
                          <td className="py-2 px-3">{(t.accuracy * 100).toFixed(1)}%</td>
                          <td className="py-2 px-3">{(t.precision * 100).toFixed(1)}%</td>
                          <td className="py-2 px-3">{(t.recall * 100).toFixed(1)}%</td>
                          <td className="py-2 px-3 text-rose-600">{(t.false_positive_rate * 100).toFixed(1)}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dataset Quality Report */}
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex flex-col gap-4">
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-emerald-600" /> Dataset Health & Quality Audit
                </h3>
                <div className="overflow-x-auto max-h-[300px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-gray-100 border-b text-[10px] uppercase font-bold text-gray-500">
                        <th className="py-2.5 px-3">Product</th>
                        <th className="py-2.5 px-3">Images</th>
                        <th className="py-2.5 px-3">Embeddings</th>
                        <th className="py-2.5 px-3">Quality Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {datasetQuality.map((q) => (
                        <tr key={q.product_id} className="hover:bg-gray-50">
                          <td className="py-2.5 px-3 font-bold text-gray-900">{q.product_name}</td>
                          <td className="py-2.5 px-3 font-mono">{q.registered_image_count}</td>
                          <td className="py-2.5 px-3 font-mono">{q.embedding_count}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              q.status === "HEALTHY"
                                ? "bg-emerald-100 text-emerald-800"
                                : q.status === "RECOMMENDED_MORE_IMAGES"
                                ? "bg-amber-100 text-amber-800"
                                : "bg-rose-100 text-rose-800"
                            }`}>
                              {q.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* COVERAGE & IMAGES TAB */}
        {activeTab === "coverage" && (
          <div className="flex flex-col gap-6">
            {/* Key Metrics Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Total Products</span>
                  <span className="text-3xl font-black text-gray-900 mt-1 block">{isLoading ? "-" : stats?.total_products || 0}</span>
                </div>
                <div className="bg-blue-50 p-3 rounded-xl text-blue-600 border border-blue-100"><Package className="h-6 w-6" /></div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Total Usable Images</span>
                  <span className="text-3xl font-black text-gray-900 mt-1 block">{isLoading ? "-" : stats?.total_images || 0}</span>
                </div>
                <div className="bg-green-50 p-3 rounded-xl text-green-600 border border-green-100"><ImageIcon className="h-6 w-6" /></div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-xs flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-gray-400 block uppercase tracking-wider">Images Per Product</span>
                  <span className="text-3xl font-black text-gray-900 mt-1 block">{isLoading ? "-" : stats?.avg_images_per_product.toFixed(1) || "0.0"}</span>
                </div>
                <div className="bg-purple-50 p-3 rounded-xl text-purple-600 border border-purple-100"><PieChart className="h-6 w-6" /></div>
              </div>

              <div className={`p-5 rounded-2xl border shadow-xs flex items-center justify-between ${
                (stats?.products_without_enough_images || 0) > 0 ? "bg-red-50/80 border-red-200 text-red-950" : "bg-white border-gray-200 text-gray-900"
              }`}>
                <div>
                  <span className="text-xs font-bold block uppercase tracking-wider text-red-700">Needs More Images (&lt; 5)</span>
                  <span className="text-3xl font-black mt-1 block">{isLoading ? "-" : stats?.products_without_enough_images || 0}</span>
                </div>
                <div className="bg-red-600 text-white p-3 rounded-xl shadow-xs animate-pulse"><AlertTriangle className="h-6 w-6" /></div>
              </div>
            </div>

            {/* Product Image Coverage Table Section */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50/50">
                <span className="font-bold text-gray-800 text-sm">Product Image Coverage Table ({filteredProducts.length} Products)</span>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="h-4 w-4 absolute left-3 top-2.5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search product, barcode..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold text-gray-800 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-100 border-b text-[11px] font-extrabold uppercase text-gray-500">
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Barcode</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4">Usable Images</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {filteredProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-blue-50/30">
                        <td className="py-3.5 px-4 font-bold text-gray-900">{p.name}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-gray-600">{p.barcode}</td>
                        <td className="py-3.5 px-4"><span className="bg-gray-100 text-gray-700 px-2 py-0.5 rounded text-[10px] font-bold">{p.category}</span></td>
                        <td className="py-3.5 px-4">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${p.needs_more_images ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {p.total_images} / 5 Images
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <Link href="/dataset" className="bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white px-3 py-1.5 rounded-lg font-bold transition text-xs border border-blue-200">
                            Manage Images
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
