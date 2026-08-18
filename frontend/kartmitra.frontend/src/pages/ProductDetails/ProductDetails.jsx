import { ChevronLeft, ShoppingCart } from "lucide-react";
import { useState } from "react";

const ProductDetails = () => {
  const [quantity, setQuantity] = useState(1);

  const product = {
    id: 1,
    name: "Amul Taaza Milk",
    size: "1 L",
    price: 62.0,
    brand: "Amul",
    shelfLife: "7 days",
   
  };

  const handleQuantityChange = (change) => {
    setQuantity((prev) => Math.max(1, prev + change));
  };

  const handleAddToCart = () => {
    console.log(`Added ${quantity} item(s) to cart:`, product);
    // TODO: Add to cart functionality
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
              Product Details
            </h1>
            <div className="w-9" /> {/* Spacer for alignment */}
          </div>

          {/* Product Image Section */}
          <div className="mb-6 h-80 rounded-2xl items-center bg-[#e8f5ef] flex justify-center">
          </div>

          {/* Scrollable Product Details */}
          <div className="flex-1 overflow-y-auto -mx-5 px-5 sm:-mx-7 sm:px-7">
            {/* Product Name and Size */}
            <div className="mb-4">
              <h2 className="text-[18px] font-bold text-[#111716]">
                {product.name}
              </h2>
              <p className="mt-1 text-[13px] text-[#7a8583]">{product.size}</p>
            </div>

            {/* Price */}
            <div className="mb-6">
              <p className="text-[28px] font-bold text-[#159b7d]">
                ₹{product.price.toFixed(2)}
              </p>
            </div>

            {/* Quantity Controls */}
            <div className="mb-6 flex items-center gap-4">
              <span className="text-[14px] font-semibold text-[#7a8583]">
                Quantity
              </span>
              <div className="flex items-center gap-3 rounded-lg border border-[#e2e7e5] bg-white px-4 py-2">
                <button
                  onClick={() => handleQuantityChange(-1)}
                  className="flex h-6 w-6 items-center justify-center text-[16px] text-[#7a8583] transition-all duration-200 hover:text-[#18201e] active:scale-90"
                >
                  −
                </button>
                <span className="w-6 text-center text-[14px] font-semibold text-[#18201e]">
                  {quantity}
                </span>
                <button
                  onClick={() => handleQuantityChange(1)}
                  className="flex h-6 w-6 items-center justify-center text-[16px] text-[#7a8583] transition-all duration-200 hover:text-[#18201e] active:scale-90"
                >
                  +
                </button>
              </div>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={handleAddToCart}
              className="mt-12 flex h-16 w-full items-center justify-center gap-2 rounded-2xl bg-[#159b7d] text-[15px] font-bold text-white transition-all duration-200  active:scale-[0.98] shadow-md active:bg-[#0a8d71]"
            >
              <ShoppingCart size={18} />
              Add to Cart
            </button>
             
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProductDetails;
