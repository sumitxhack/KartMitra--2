import { useEffect, useRef, useState } from "react";
import {
  Menu,
  ShoppingCart,
  Trash2,
  ScanLine,
  ArrowRight,
} from "lucide-react";

const Shopping = () => {
  const videoRef = useRef(null);
  const [cameraError, setCameraError] = useState(false);

  const [sessionId] = useState("A82F91");

  const [recentItems, setRecentItems] = useState([
    {
      id: 1,
      name: "Amul Taaza Milk",
      quantity: "1 L",
      price: 62,
      icon: "🥛",
    },
    {
      id: 2,
      name: "Brown Bread",
      quantity: "400 g",
      price: 40,
      icon: "🍞",
    },
    {
      id: 1,
      name: "Amul Taaza Milk",
      quantity: "1 L",
      price: 62,
      icon: "🥛",
    },
    {
      id: 2,
      name: "Brown Bread",
      quantity: "400 g",
      price: 40,
      icon: "🍞",
    },
    {
      id: 1,
      name: "Amul Taaza Milk",
      quantity: "1 L",
      price: 62,
      icon: "🥛",
    },
    {
      id: 2,
      name: "Brown Bread",
      quantity: "400 g",
      price: 40,
      icon: "🍞",
    },
    {
      id: 1,
      name: "Amul Taaza Milk",
      quantity: "1 L",
      price: 62,
      icon: "🥛",
    },
    {
      id: 2,
      name: "Brown Bread",
      quantity: "400 g",
      price: 40,
      icon: "🍞",
    },
    {
      id: 1,
      name: "Amul Taaza Milk",
      quantity: "1 L",
      price: 62,
      icon: "🥛",
    },
    {
      id: 2,
      name: "Brown Bread",
      quantity: "400 g",
      price: 40,
      icon: "🍞",
    },
    {
      id: 1,
      name: "Amul Taaza Milk",
      quantity: "1 L",
      price: 62,
      icon: "🥛",
    },
    {
      id: 2,
      name: "Brown Bread",
      quantity: "400 g",
      price: 40,
      icon: "🍞",
    },
    {
      id: 1,
      name: "Amul Taaza Milk",
      quantity: "1 L",
      price: 62,
      icon: "🥛",
    },
    {
      id: 2,
      name: "Brown Bread",
      quantity: "400 g",
      price: 40,
      icon: "🍞",
    },
  ]);

  const [cartCount] = useState(4);
  const [cartTotal] = useState(1248);

  // --------------------------------
  // START PHONE CAMERA
  // --------------------------------

  useEffect(() => {
    let stream;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: {
              ideal: "environment",
            },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error("Camera permission error:", error);
        setCameraError(true);
      }
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // --------------------------------
  // SCAN PRODUCT
  // --------------------------------

  const handleScanProduct = () => {
    console.log("Opening barcode scanner...");

    /*
      Future flow:

      1. Capture current cart image
      2. Open barcode scanner
      3. Scan product
      4. Fetch product from backend
      5. Show Product Details
      6. Customer confirms "Add to Cart"
      7. Save item against sessionId
    */
  };

  const handleCheckout = () => {
    console.log("Proceeding to checkout...");
  };

  const handleDeleteItem = (id) => {
    setRecentItems((items) =>
      items.filter((item) => item.id !== id)
    );
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e9edeb] sm:p-6">

      {/* PHONE */}
      <div
        className="
          relative
          flex
          h-screen
          w-full
          flex-col
          overflow-hidden
          bg-[#f8f9f8]
          sm:h-[844px]
          sm:w-[390px]
          sm:rounded-[40px]
          sm:border-[7px]
          sm:border-[#151a19]
          sm:shadow-2xl
        "
      >


        {/* ==========================
            HEADER
        ========================== */}

        <header className="relative z-20 flex h-15 items-center bg-[#151b19] px-3">

          <button
            className="
              flex
              h-8
              w-8
              items-center
              justify-center
              rounded-full
              text-white
              hover:bg-white/10
            "
          >
            <Menu size={18} strokeWidth={1.6} />
          </button>

          <div className="ml-auto text-[12px] text-[#727d79]">
            Session ID:{" "}
            <span className="font-semibold text-[#19a77f]">
              {sessionId}
            </span>
          </div>
        </header>

        {/* ==========================
            CAMERA
        ========================== */}

        <section
          className="
            relative
            h-75
            overflow-hidden
            rounded-b-3xl
            bg-[#414141]
            shadow-[0_5px_12px_rgba(0,0,0,0.12)]
          "
        >

          {!cameraError ? (
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="
                h-full
                w-full
                object-cover
              "
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="font-serif text-[25px] text-white">
                  Camera
                </p>

                <p className="mt-2 text-[10px] text-[#c3c3c3]">
                  Camera permission required
                </p>
              </div>
            </div>
          )}

          {/* Camera overlay */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">

            <div className="h-[120px] w-[165px]">

              {/* Top left */}
              <span className="absolute h-[18px] w-[3px] bg-[#159779]" />
              <span className="absolute h-[3px] w-[18px] bg-[#159779]" />

            </div>
          </div>
        </section>

        {/* ==========================
            RECENTLY ADDED
        ========================== */}

        <section className="flex min-h-0 flex-1 flex-col mt-3 overflow-auto pt-3">

          <h2 className="mb-2 fixed bg-[#f8f9f8] w-full   px-5 text-[15px] font-semibold text-[#68726f]">
            Recently Added
          </h2>

          {/* Items */}
          <div className="space-y-2 mx-4">

            {recentItems.map((item) => (
              <div
                key={item.id}
                className="
                  flex
                  h-[48px]
                  items-center
                  rounded-[10px]
                  bg-white
                  px-2
                  shadow-[0_2px_8px_rgba(0,0,0,0.05)]
                "
              >

                {/* Product image placeholder */}
                <div
                  className="
                    flex
                    h-[32px]
                    w-[32px]
                    shrink-0
                    items-center
                    justify-center
                    rounded-lg
                    bg-[#f5f6f5]
                    text-[13px]
                  "
                >
                  {item.icon}
                </div>

                {/* Product info */}
                <div className="ml-2 min-w-0 flex-1">
                  <p className="truncate text-[10px] font-semibold text-[#252a28]">
                    {item.name}
                  </p>

                  <p className="text-[8px] text-[#929a97]">
                    {item.quantity}
                  </p>
                </div>

                {/* Price */}
                <span className="mr-3 text-[11px] font-semibold text-[#252a28]">
                  ₹{item.price.toFixed(2)}
                </span>

                {/* Delete */}
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  className="text-[#f06d4f]"
                >
                  <Trash2
                    size={13}
                    strokeWidth={1.8}
                  />
                </button>
              </div>
            ))}
          </div>

          {/* ==========================
              CART / CHECKOUT
          ========================== */}

          <div
            className="
              absolute
              bottom-0
              items-center 
              justify-center
              w-screen
              h-50
              rounded-t-[45px]
              pt-4
              px-4
              bg-[#e9edeb]
              shadow-[0_-2px_12px_rgba(0,0,0,0.04)]
            "
          >

            {/* Cart summary */}
            <div className="flex items-center">

              <div
                className="
                  flex
                  h-15
                  w-15
                  items-center
                  justify-center
                  rounded-full
                  bg-[#22a78a]
                  text-white
                "
              >
                <ShoppingCart
                  size={25}
                  strokeWidth={1.7}
                />
              </div>

              <div className="ml-4 flex-1">
                <p className="text-[19px] font-semibold text-[#252a28]">
                  My Cart
                </p>

                <p className="text-[13px] text-[#717271]">
                  {cartCount} Items
                </p>
              </div>

              <p className="text-2xl font-bold text-[#252a28]">
                ₹{cartTotal.toLocaleString("en-IN")}.00
              </p>
            </div>

            {/* Scan Product */}
            <button
              onClick={handleScanProduct}
              className="
                mt-4
                flex
                h-15
                w-full
                items-center
                justify-center
                gap-2
                rounded-[15px]
                bg-[#151a19]
                text-[18px]
                font-semibold
                text-white
                transition
                hover:bg-[#222827]
                active:scale-[0.98]
              "
            >
              Scan a Product

              <ScanLine
                size={20}
                strokeWidth={1.6}
              />
            </button>

            {/* Checkout */}
            <button
              onClick={handleCheckout}
              className="
                mx-auto
                mt-2
                flex
                items-center
                gap-1
                text-[15px]
                font-semibold
                text-[#159779]
              "
            >
              Checkout

              <ArrowRight
                size={15}
                strokeWidth={2}
              />
            </button>

          </div>
        </section>
      </div>
    </main>
  );
};

export default Shopping;