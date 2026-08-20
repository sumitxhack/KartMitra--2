import { AlertCircle, Package } from "lucide-react";
import { useState, useEffect } from "react";

const Verification = () => {
  const [timeLeft, setTimeLeft] = useState(45);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const scannedItem = {
    name: "Mustard Oil 1 L",
    label: "You Scanned",
    icon: "📱",
  };

  const cartItem = {
    name: "Olive Oil 1 L",
    label: "Cart Detected",
    icon: "🛒",
  };


  const handleContactStaff = () => {
    console.log("Contacting staff");
    // TODO: Handle contact staff logic
  };

 

  return (
    <div className="min-h-screen bg-[#f4f8f6] flex items-center justify-center p-0 sm:p-6">
      {/* Mobile App Screen */}
      <main className="relative w-full min-h-screen sm:min-h-211 sm:max-w-97.5 overflow-hidden bg-[#f5e6d3] sm:rounded-[42px] sm:border-8 sm:border-[#151a19] shadow-2xl">
        {/* Content */}
        <div className="relative z-10 flex min-h-screen flex-col items-center px-5 pt-15 pb-5 sm:min-h-207 sm:px-7 sm:pt-8">
          {/* Alert Icon */}
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#ff6b35] shadow-lg">
            <AlertCircle size={48} className="text-white" strokeWidth={1.5} />
          </div>

          {/* Verification Needed Heading */}
          <h1 className="mb-2 text-center text-[26px] font-bold leading-tight text-[#1a1a1a]">
            Verification Needed
          </h1>

          {/* Mismatch Message */}
          <p className="mb-3 text-center text-[13px] text-[#666666]">
            There is a little Mismatch
          </p>
          <p className="mb-4 text-center text-[13px] text-[#666666]">
           Please check the item and Contact Staff
          </p>

          {/* Items Comparison Card */}
          <div className="mb-6 w-full rounded-2xl bg-white p-5 shadow-md">
            <div className="space-y-4">
              {/* Scanned Item */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#f0f0f0]">
                  <Package size={24} className="text-[#999999]" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] text-[#999999]">You Scanned</p>
                  <p className="text-[14px] font-semibold text-[#1a1a1a]">
                    {scannedItem.name}
                  </p>
                </div>
              </div>

              {/* Cart Item */}
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e8f5e9]">
                  <Package size={24} className="text-[#66bb6a]" />
                </div>
                <div className="flex-1">
                  <p className="text-[12px] text-[#999999]">Cart Detected</p>
                  <p className="text-[14px] font-semibold text-[#1a1a1a]">
                    {cartItem.name}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Check Item Message */}
          

          

          

          {/* Contact Staff Link */}
          <button
            onClick={handleContactStaff}
            className="flex items-center gap-2 text-[#ff6b35] text-[14px] font-semibold hover:underline"
          >
            
            
          </button>
        </div>
      </main>
    </div>
  );
};

export default Verification;
