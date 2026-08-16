import { Check, QrCode } from "lucide-react";

const ThankYou = () => {
  const paymentAmount = "₹1,248.00";

  const successChecks = [
    "Payment Successful",
    "Security Verified",
    "Ready to Exit",
  ];

  const handleGenerateExitQR = () => {
    console.log("Generating exit QR code");
    // TODO: Generate QR code functionality
  };

  return (
    <div className="min-h-screen bg-[#f4f8f6] flex items-center justify-center p-0 sm:p-6">
      {/* Mobile App Screen */}
      <main className="relative w-full min-h-screen sm:min-h-211 sm:max-w-97.5 overflow-hidden bg-[#159b7d] sm:rounded-[42px] sm:border-8 sm:border-[#151a19] shadow-2xl">
        {/* Background decorative dots */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Colored decorative dots scattered around */}
          <div className="absolute top-12 left-8 h-3 w-3 rounded-full bg-yellow-300 opacity-70" />
          <div className="absolute top-24 right-12 h-2.5 w-2.5 rounded-full bg-red-300 opacity-70" />
          <div className="absolute top-32 left-1/4 h-2 w-2 rounded-full bg-white opacity-50" />
          <div className="absolute top-48 right-1/4 h-3 w-3 rounded-full bg-yellow-200 opacity-60" />
          <div className="absolute bottom-32 left-12 h-2 w-2 rounded-full bg-red-200 opacity-60" />
          <div className="absolute bottom-24 right-16 h-3 w-3 rounded-full bg-white opacity-40" />
          <div className="absolute bottom-40 right-1/3 h-2.5 w-2.5 rounded-full bg-yellow-300 opacity-50" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-5 pt-6 pb-5 sm:min-h-207 sm:px-7 sm:pt-8">
         
          {/* Success Checkmark Icon */}
          <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-white shadow-lg">
            <Check size={56} className="text-[#159b7d]" strokeWidth={2} />
          </div>

          {/* Thank You Heading */}
          <h1 className="mb-3 text-center text-[28px] font-bold leading-tight text-white">
            Thank You For Shopping
            <br />
            With Us!
          </h1>

          {/* Payment Success Message */}
          <p className="mb-8 text-center text-[14px] text-white opacity-90">
            Your payment of <span className="font-semibold">{paymentAmount}</span>
            <br />
            was successful.
          </p>

          {/* Success Status Card */}
          <div className="mb-6 w-full rounded-3xl bg-white p-5 shadow-lg">
            <div className="space-y-3">
              {successChecks.map((check, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3"
                >
                  <Check
                    size={20}
                    className="text-[#159b7d] shrink-0"
                    strokeWidth={3}
                  />
                  <span className="text-[14px] font-semibold text-[#18201e]">
                    {check}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Generate Exit QR Button */}
          <button
            onClick={handleGenerateExitQR}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[16px] font-bold text-[#159b7d] transition-all duration-200 hover:bg-gray-50 active:scale-[0.98] shadow-md hover:shadow-lg"
          >
            <QrCode size={20} />
            Generate Exit QR
            <span className="text-lg">→</span>
          </button>
        </div>
      </main>
    </div>
  );
};

export default ThankYou;
