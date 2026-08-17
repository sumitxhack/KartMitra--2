import { ChevronLeft, Check, Lock } from "lucide-react";
import { useState } from "react";

const Payment = () => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(null);

  const paymentMethods = [
    { id: "google_pay", label: "Google Pay", icon: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/google-pay-icon.png" },
    { id: "phonepe", label: "PhonePe", icon: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/phonepe-icon.png" },
    { id: "paytm", label: "Paytm", icon: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/paytm-icon.png" },
    { id: "bhim", label: "BHIM UPI", icon: "https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/bhim-app-icon.png" },
  ];

  const orderSummary = {
    items: 4,
    itemsPrice: 1248.0,
    discount: -50.0,
    taxes: 50.0,
    totalAmount: 1248.0,
  };

  const securityChecks = [
    "All items scanned",
    "Cart verification clear",
    "Shopping session valid",
  ];

  const handleContinueToPayment = () => {
    if (selectedPaymentMethod) {
      console.log("Processing payment with:", selectedPaymentMethod);
      // TODO: Navigate to payment gateway
    } else {
      alert("Please select a payment method");
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f8f6] flex items-center justify-center p-0 sm:p-6">
      {/* Mobile App Screen */}
      <main className="relative w-full min-h-screen sm:min-h-211 sm:max-w-97.5 overflow-hidden bg-white sm:rounded-[42px] sm:border-8 sm:border-[#151a19] shadow-2xl">
        
        {/* Content */}
        <div className="relative z-10 flex min-h-screen flex-col px-5 pt-6 pb-5 sm:min-h-207 sm:px-7 sm:pt-8">
          
          {/* Header with Back Button and Title */}
          <div className="mb-6 flex items-center gap-3">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0f4f2] transition-all duration-200 hover:bg-[#e5f0eb] active:scale-95"
              onClick={() => console.log("Go back")}
            >
              <ChevronLeft size={22} className="text-[#18201e]" />
            </button>
            <h1 className="flex-1 text-center text-[22px] font-bold text-[#111716]">
              Payment
            </h1>
            <div className="w-9" /> {/* Spacer for alignment */}
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto -mx-5 px-5 sm:-mx-7 sm:px-7">
            {/* Order Summary Section */}
            <section className="mb-6">
              <h3 className="mb-3 text-[15px] font-bold text-[#111716]">
                Order Summary
              </h3>

              <div className="space-y-2 rounded-2xl bg-[#f7f9f8] p-4">
                {/* Items */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#7a8583]">
                    Items ({orderSummary.items})
                  </span>
                  <span className="text-[13px] font-semibold text-[#18201e]">
                    ₹{orderSummary.itemsPrice.toFixed(2)}
                  </span>
                </div>

                {/* Discount */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#7a8583]">Discount</span>
                  <span className="text-[13px] font-semibold text-[#159b7d]">
                    ₹{orderSummary.discount.toFixed(2)}
                  </span>
                </div>

                {/* Taxes */}
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#7a8583]">Taxes</span>
                  <span className="text-[13px] font-semibold text-[#18201e]">
                    ₹{orderSummary.taxes.toFixed(2)}
                  </span>
                </div>

                {/* Divider */}
                <div className="my-3 h-px bg-[#e2e7e5]" />

                {/* Total Amount */}
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-bold text-[#111716]">
                    Total Amount
                  </span>
                  <span className="text-[16px] font-bold text-[#159b7d]">
                    ₹{orderSummary.totalAmount.toFixed(2)}
                  </span>
                </div>
              </div>
            </section>

            {/* Security Status Section */}
            <section className="mb-6">
              <h3 className="mb-3 text-[15px] font-bold text-[#111716]">
                Security Status
              </h3>

              <div className="space-y-2">
                {securityChecks.map((check, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 rounded-lg bg-[#f0faf7] p-3"
                  >
                    <Check size={18} className="text-[#159b7d] shrink-0" />
                    <span className="text-[13px] text-[#18201e]">{check}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* UPI Options Section */}
            <section className="mb-6">
              <h3 className="mb-3 text-[15px] font-bold text-[#111716]">
                UPI Options
              </h3>

              <div className="grid grid-cols-4 gap-3">
                {paymentMethods.map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setSelectedPaymentMethod(method.id)}
                    className={`flex flex-col items-center gap-2 rounded-2xl p-3 transition-all duration-200 ${
                      selectedPaymentMethod === method.id
                        ? "border-2 border-[#159b7d] bg-[#f0faf7]"
                        : "border-2 border-[#e2e7e5] bg-white hover:border-[#159b7d]"
                    }`}
                  >
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-lg text-lg transition-all duration-200 
                       `}
                    >
                      <img src={method.icon} alt="" />
                    </div>
                    {/* <span className="text-center text-[11px] font-semibold text-[#18201e]">
                      {method.label}
                    </span> */}
                  </button>
                ))}
              </div>
            </section>

            {/* Continue to Payment Button */}
            <button
              onClick={handleContinueToPayment}
              className="mb-4 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#1a1f1e] text-[16px] font-bold text-white transition-all duration-200 hover:bg-[#0f1312] active:scale-[0.98] shadow-md hover:shadow-lg"
            >
              Continue to Payment
              <span className="text-lg">→</span>
            </button>

            {/* Security Footer */}
            <div className="flex items-center justify-center gap-1 mb-2">
              <Lock size={14} className="text-[#7a8583]" />
              <span className="text-[11px] text-[#7a8583]">
                Secured by{" "}
                <span className="font-semibold text-[#18201e]">Razorpay</span>
              </span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Payment;
