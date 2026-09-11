'use client';

import { useEffect, useState } from 'react';
import { fetchHealth, HealthResponse } from '../services/api';
import { Database, Server, RefreshCw } from 'lucide-react';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<HealthResponse | null>(null);

  const checkHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchHealth();
      setData(response);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend API');
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-800">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-slate-100 p-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-indigo-600">
            KartMitra AI Lab
          </h1>
          <p className="text-sm text-slate-500">
            AI Verification Lab Environment Status
          </p>
        </div>

        {/* Status Indicators */}
        <div className="space-y-4">
          {/* Backend Status */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center space-x-3">
              <Server className="h-5 w-5 text-indigo-500" />
              <span className="font-medium text-sm">Backend API</span>
            </div>
            <div>
              {loading ? (
                <span className="text-xs text-slate-400">checking...</span>
              ) : error ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  Offline
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Online
                </span>
              )}
            </div>
          </div>

          {/* Database Status */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-100">
            <div className="flex items-center space-x-3">
              <Database className="h-5 w-5 text-indigo-500" />
              <span className="font-medium text-sm">PostgreSQL</span>
            </div>
            <div>
              {loading ? (
                <span className="text-xs text-slate-400">checking...</span>
              ) : error ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  Unknown
                </span>
              ) : data?.database === 'connected' ? (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                  Disconnected
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Error Message Details */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600 font-mono break-all">
            Error: {error}
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={checkHealth}
          disabled={loading}
          className="w-full flex items-center justify-center space-x-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-medium py-2.5 px-4 rounded-xl shadow transition duration-150 ease-in-out text-sm"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>{loading ? 'Testing Connection...' : 'Refresh Status'}</span>
        </button>
      </div>
    </div>
  );
}
