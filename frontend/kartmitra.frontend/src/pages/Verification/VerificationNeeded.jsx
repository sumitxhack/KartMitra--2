import { useState, useEffect } from 'react';
import { ArrowLeft, AlertCircle, Package, Leaf, Phone } from 'lucide-react';

export default function VerificationNeeded() {
  const [timeLeft, setTimeLeft] = useState(45);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-orange-50 px-6 py-4 flex items-center justify-between border-b border-orange-100">
          <button className="text-gray-700 hover:text-gray-900">
            <ArrowLeft size={24} />
          </button>
          <div className="flex gap-3">
            <button className="text-gray-400 hover:text-gray-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
              </svg>
            </button>
            <button className="text-gray-400 hover:text-gray-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="8 17 12 21 16 17" />
                <line x1="12" y1="12" x2="12" y2="21" />
                <path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29" />
              </svg>
            </button>
            <button className="text-gray-400 hover:text-gray-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-8 space-y-6">
          {/* Icon and Title */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <div className="bg-orange-500 rounded-full p-4 text-white">
                <AlertCircle size={32} />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Verification Needed</h1>
            <p className="text-sm text-gray-500">We detected a mismatch</p>
          </div>

          {/* Items Comparison */}
          <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
            {/* Scanned Item */}
            <div className="flex items-start gap-3 bg-white rounded-lg p-3">
              <div className="flex-shrink-0 mt-1">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600">
                  <Package size={18} />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-medium">You Scanned</p>
                <p className="text-sm font-bold text-gray-900">Mustard Oil 1 L</p>
              </div>
            </div>

            {/* Cart Item */}
            <div className="flex items-start gap-3 bg-white rounded-lg p-3">
              <div className="flex-shrink-0 mt-1">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center text-green-600">
                  <Leaf size={18} />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-500 font-medium">Cart Detected</p>
                <p className="text-sm font-bold text-gray-900">Olive Oil 1 L</p>
              </div>
            </div>
          </div>

          {/* Timer Section */}
          <div className="text-center space-y-2">
            <p className="text-sm text-gray-500">Please check the item</p>
            <div className="text-4xl font-bold text-orange-500 font-mono">
              {formatTime(timeLeft)}
            </div>
          </div>

          {/* Action Button */}
          <button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-4 rounded-full transition-colors">
            I'll Correct It
          </button>

          {/* Contact Staff Link */}
          <div className="text-center">
            <button className="text-sm text-gray-600 hover:text-gray-900 font-medium flex items-center justify-center gap-2 mx-auto">
              <Phone size={16} />
              Contact Staff
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
