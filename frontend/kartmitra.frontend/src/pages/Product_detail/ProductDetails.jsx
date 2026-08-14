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
    icon: "🥛",
    emoji: "😋",
    description:
      "Fresh and delicious Amul Taaza milk, perfect for your daily needs.",
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
        {/* Background decorative circles */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -right-16 top-16 h-44 w-44 rounded-full bg-[#dff1e9]" />
          <div className="absolute right-8 top-24 h-36 w-36 rounded-full bg-[#e8f5ef]" />
          <div className="absolute left-7 top-20 grid grid-cols-5 gap-1.75 opacity-70">
            {Array.from({ length: 25 }).map((_, index) => (
              <span
                key={index}
                className="h-0.75 w-0.75 rounded-full bg-[#b9ded0]"
              />
            ))}
          </div>
          <span className="absolute right-23 top-17 text-xl text-[#16a085]">
            +
          </span>
          <span className="absolute right-18 top-21.5 text-sm text-[#16a085]">
            +
          </span>
        </div>

        {/* Content */}
        <div className="relative z-10 flex min-h-screen flex-col px-5 pt-6 pb-5 sm:min-h-207 sm:px-7 sm:pt-8">
          {/* Status bar */}
          <div className="mb-6 flex items-center justify-between text-[11px] font-semibold text-[#18201e]">
            <span>9:41</span>
            <div className="flex items-center gap-2">
              <span className="text-[#60736d]">▥</span>
              <span className="text-[#60736d]">⌁</span>
              <span className="text-[#198b68]">▮</span>
            </div>
          </div>

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
          <div className="mb-6 flex justify-center">
            <div className="flex h-44 w-44 flex-col items-center justify-center rounded-3xl border-2 border-[#159b7d] bg-linear-to-br from-[#f0faf7] to-[#e8f5ef] p-4">
              {/* Brand Label */}
              <div className="mb-3 flex items-center gap-1 rounded-lg bg-red-500 px-3 py-1">
                <span className="text-[12px] font-bold text-white">
                  {product.brand}
                </span>
                <span className="text-[10px] text-red-100">Taaza</span>
              </div>

              {/* Product Emoji */}
              <div className="mb-2 flex items-center justify-center gap-2">
                <span className="text-4xl">{product.emoji}</span>
                <span className="text-4xl">{product.icon}</span>
              </div>
            </div>
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
              className="mb-6 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-[#159b7d] text-[15px] font-bold text-white transition-all duration-200 hover:bg-[#148074] active:scale-[0.98] shadow-md hover:shadow-lg"
            >
              <ShoppingCart size={18} />
              Add to Cart
            </button>

            {/* Product Information Section */}
            <div className="space-y-4 border-t border-[#e2e7e5] pt-4">
              <h3 className="text-[15px] font-bold text-[#111716]">
                Product Information
              </h3>

              {/* Information Items */}
              <div className="space-y-3">
                {/* Brand */}
                <div className="flex items-center justify-between rounded-lg bg-[#f7f9f8] p-3">
                  <span className="text-[13px] text-[#7a8583]">Brand</span>
                  <span className="text-[13px] font-semibold text-[#18201e]">
                    {product.brand}
                  </span>
                </div>

                {/* Shelf Life */}
                <div className="flex items-center justify-between rounded-lg bg-[#f7f9f8] p-3">
                  <span className="text-[13px] text-[#7a8583]">Shelf Life</span>
                  <span className="text-[13px] font-semibold text-[#18201e]">
                    {product.shelfLife}
                  </span>
                </div>

                {/* Description */}
                <div className="rounded-lg bg-[#f7f9f8] p-3">
                  <p className="text-[12px] leading-relaxed text-[#7a8583]">
                    {product.description}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProductDetails;
