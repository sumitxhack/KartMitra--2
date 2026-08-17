import { ChevronLeft, Trash2 } from "lucide-react";
import { useState } from "react";

const ProductSummary = () => {
  const [cartItems, setCartItems] = useState([
    {
      id: 1,
      name: "Amul Taaza Milk",
      size: "1 L",
      price: 62.0,
      quantity: 1,
      icon: "🥛",
    },
    {
      id: 2,
      name: "Brown Bread",
      size: "400 g",
      price: 40.0,
      quantity: 1,
      icon: "🍞",
    },
    {
      id: 3,
      name: "Basmati Rice",
      size: "5 kg",
      price: 320.0,
      quantity: 1,
      icon: "🍚",
    },
    {
      id: 4,
      name: "Dove Shampoo",
      size: "180 ml",
      price: 180.0,
      quantity: 1,
      icon: "🧴",
    },
    
  ]);

  const handleQuantityChange = (id, change) => {
    setCartItems((items) =>
      items.map((item) =>
        item.id === id
          ? { ...item, quantity: Math.max(1, item.quantity + change) }
          : item
      )
    );
  };

  const handleRemoveItem = (id) => {
    setCartItems((items) => items.filter((item) => item.id !== id));
  };

  const calculateTotal = () => {
    return cartItems
      .reduce((sum, item) => sum + item.price * item.quantity, 0)
      .toFixed(2);
  };

  const handleProceedToPay = () => {
    console.log("Proceeding to payment with items:", cartItems);
    // TODO: Navigate to payment page
  };

  return (
    <div className="min-h-screen  bg-[#f4f8f6] flex items-center justify-center p-0 sm:p-6">
      {/* Mobile App Screen */}
      <main className="relative w-full min-h-screen sm:min-h-211 sm:max-w-97.5 overflow-hidden bg-white sm:rounded-[42px] sm:border-8 sm:border-[#151a19] shadow-2xl">
        
        {/* Content */}
        <div className="relative z-10 flex min-h-screen flex-col px-5 sm:min-h-207 sm:px-7 sm:pt-8">

          {/* Header with Back Button and Title */}
          <div className="mb-6 fixed h-16 absolute bg-white w-full flex items-center gap-3">
            <button
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f0f4f2] transition-all duration-200 hover:bg-[#e5f0eb] active:scale-95"
              onClick={() => console.log("Go back")}
            >
              <ChevronLeft size={22} className="text-[#18201e]" />
            </button>
            <h1 className="flex-1 text-center text-[22px] font-bold text-[#111716]">
              My Cart
            </h1>
            <div className="w-9" /> {/* Spacer for alignment */}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-scroll pt-18 -mx-5 px-5 sm:-mx-7 sm:px-7">
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 rounded-2xl bg-[#f7f9f8] p-4 transition-all duration-200 hover:bg-[#f0f4f2]"
                >
                  {/* Product Icon */}
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-white text-3xl">
                    {item.icon}
                  </div>

                  {/* Product Details */}
                  <div className="flex-1">
                    <h3 className="text-[14px] font-semibold text-[#18201e]">
                     ({item.quantity}x) {item.name}
                    </h3>
                    <p className="text-[12px] text-[#7a8583]">{item.size}</p>
                    <p className="mt-1 text-[15px] font-bold text-[#111716]">
                      ₹{item.price.toFixed(2)}
                    </p>
                  </div>

                  {/* Quantity and Actions */}
                  <div className="flex flex-col items-end gap-2">
                    {/* Delete Button */}
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 transition-all duration-200 hover:bg-red-100 active:scale-95"
                    >
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Total Section */}
          <div className="mt-6 space-y-4 pb-8 w-100 bg-white fixed bottom-0 border-[#e2e7e5] pt-4">

            <div className="flex items-center justify-between border-t border-[#e2e7e5] pt-4">
              <span className="text-[15px] font-bold text-[#111716]">
                Total ({cartItems.length} items)
              </span>
              <span className="text-[18px] font-bold text-[#159b7d]">
                ₹{calculateTotal()}
              </span>
            </div>

            {/* Proceed to Pay Button */}
          <button
            onClick={handleProceedToPay}
            className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#159b7d] text-[16px] font-bold text-white transition-all duration-200 hover:bg-[#148074] active:scale-[0.98] shadow-md hover:shadow-lg"
          >
            Proceed To Pay
            <span className="text-lg">→</span>
          </button>
          </div>

          
        </div>
      </main>
    </div>
  );
};

export default ProductSummary;
