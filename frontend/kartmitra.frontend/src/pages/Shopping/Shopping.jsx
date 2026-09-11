import { useEffect, useRef, useState } from "react";
import {
  Menu,
  ShoppingCart,
  Trash2,
  ScanLine,
  ArrowRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import {
  getCart,
  removeProductFromCart,
} from "../../api/cartApi";

const Shopping = () => {
  const navigate = useNavigate();

  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [sessionId, setSessionId] = useState("");
  const [recentItems, setRecentItems] = useState([]);

  const [cartCount, setCartCount] = useState(0);
  const [cartTotal, setCartTotal] = useState(0);

  const [loading, setLoading] = useState(true);
  const [cameraError, setCameraError] = useState(false);
  const [cartError, setCartError] = useState("");

  // --------------------------------
  // LOAD SESSION
  // --------------------------------

  useEffect(() => {
    const storedSessionId =
      localStorage.getItem("sessionId");

    if (!storedSessionId) {
      navigate("/", { replace: true });
      return;
    }

    setSessionId(storedSessionId);
  }, [navigate]);

  // --------------------------------
  // LOAD CART
  // --------------------------------

  const loadCart = async () => {
    try {
      setLoading(true);
      setCartError("");

      const cart = await getCart();

      if (!cart) {
        throw new Error("Cart not found.");
      }

      /*
       * Backend cart structure:
       *
       * cart.items
       * cart.totalAmount
       */

      setRecentItems(
        (cart.items || []).map((item) => ({
          id: item._id,
          name: item.name,
          quantity: item.quantity,
          price: item.totalPrice,
          unitPrice: item.unitPrice,
          barcode: item.barcode,
          weight: item.totalWeight,
          icon: "🛒",
        }))
      );

      setCartCount(
        (cart.items || []).reduce(
          (total, item) => total + item.quantity,
          0
        )
      );

      setCartTotal(cart.totalAmount || 0);
    } catch (error) {
      console.error("Load cart error:", error);

      setCartError(
        error.message || "Unable to load your cart."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;

    loadCart();
  }, [sessionId]);

  // --------------------------------
  // START PHONE CAMERA
  // --------------------------------

  useEffect(() => {
    let mounted = true;

    const startCamera = async () => {
      try {
        setCameraError(false);

        if (
          !navigator.mediaDevices ||
          !navigator.mediaDevices.getUserMedia
        ) {
          throw new Error(
            "Camera is not supported on this device."
          );
        }

        const stream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: {
                ideal: "environment",
              },
            },
            audio: false,
          });

        if (!mounted) {
          stream
            .getTracks()
            .forEach((track) => track.stop());

          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error(
          "Camera permission error:",
          error
        );

        if (mounted) {
          setCameraError(true);
        }
      }
    };

    startCamera();

    return () => {
      mounted = false;

      if (streamRef.current) {
        streamRef.current
          .getTracks()
          .forEach((track) => track.stop());

        streamRef.current = null;
      }
    };
  }, []);

  // --------------------------------
  // SCAN PRODUCT
  // --------------------------------

  const handleScanProduct = () => {
    navigate("/scan-product");
  };

  // --------------------------------
  // CHECKOUT
  // --------------------------------

  const handleCheckout = () => {
    if (cartCount === 0) {
      return;
    }

    navigate("/product-summary");
  };

  // --------------------------------
  // DELETE PRODUCT
  // --------------------------------

  const handleDeleteItem = async (barcode) => {
    try {
      setCartError("");

      const updatedCart =
        await removeProductFromCart(barcode);

      setRecentItems(
        (updatedCart.items || []).map((item) => ({
          id: item._id,
          name: item.name,
          quantity: item.quantity,
          price: item.totalPrice,
          unitPrice: item.unitPrice,
          barcode: item.barcode,
          weight: item.totalWeight,
          icon: "🛒",
        }))
      );

      setCartCount(
        (updatedCart.items || []).reduce(
          (total, item) => total + item.quantity,
          0
        )
      );

      setCartTotal(
        updatedCart.totalAmount || 0
      );
    } catch (error) {
      console.error(
        "Remove product error:",
        error
      );

      setCartError(
        error.message ||
          "Unable to remove product."
      );
    }
  };

  // --------------------------------
  // RENDER
  // --------------------------------

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e9edeb] sm:p-6">
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
            type="button"
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
            <Menu
              size={18}
              strokeWidth={1.6}
            />
          </button>

          <div className="ml-auto text-[12px] text-[#727d79]">
            Session ID:{" "}
            <span className="font-semibold text-[#19a77f]">
              {sessionId || "Loading..."}
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
            rounded-b-2xl
            bg-[#414141]
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

        </section>

        {/* ==========================
            RECENTLY ADDED
        ========================== */}

        <section className="flex min-h-0 flex-1 flex-col overflow-auto">

          <h2
            className="
              mb-2
              h-15
              fixed
              flex
              w-full
              items-center
              rounded-b-3xl
              bg-[#f8f9f8]
              px-5
              text-[15px]
              font-semibold
              text-[#68726f]
            "
          >
            Recently Added
          </h2>

          {/* Loading */}

          {loading && (
            <div className="mx-4 mt-20 flex justify-center py-10">
              <div className="
                h-8
                w-8
                animate-spin
                rounded-full
                border-3
                border-[#dce4e1]
                border-t-[#159779]
              " />
            </div>
          )}

          {/* Error */}

          {!loading && cartError && (
            <div className="mx-4 mt-20 rounded-xl bg-red-50 p-4 text-center">
              <p className="text-sm font-medium text-red-600">
                {cartError}
              </p>

              <button
                onClick={loadCart}
                className="
                  mt-3
                  rounded-lg
                  bg-[#159779]
                  px-4
                  py-2
                  text-xs
                  font-semibold
                  text-white
                "
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty cart */}

          {!loading &&
            !cartError &&
            recentItems.length === 0 && (
              <div className="mx-4 mt-20 flex flex-col items-center justify-center py-12 text-center">
                <ShoppingCart
                  size={40}
                  strokeWidth={1.4}
                  className="text-[#aab4b0]"
                />

                <p className="mt-4 text-sm font-semibold text-[#68726f]">
                  Your cart is empty
                </p>

                <p className="mt-1 text-xs text-[#929a97]">
                  Scan a product to start shopping
                </p>
              </div>
            )}

          {/* Items */}

          {!loading &&
            !cartError &&
            recentItems.length > 0 && (
              <div className="mx-4 mt-15.5 mb-90 space-y-2">

                {recentItems.map((item) => (
                  <div
                    key={item.id}
                    className="
                      flex
                      h-20
                      items-center
                      rounded-[10px]
                      bg-white
                      px-2
                      shadow-[0_2px_8px_rgba(0,0,0,0.05)]
                    "
                  >

                    {/* Product icon */}

                    <div
                      className="
                        flex
                        h-16
                        w-16
                        shrink-0
                        items-center
                        justify-center
                        rounded-lg
                        bg-[#f5f6f5]
                        text-[30px]
                      "
                    >
                      {item.icon}
                    </div>

                    {/* Product info */}

                    <div className="ml-2 min-w-0 flex-1">

                      <p className="
                        truncate
                        text-[15px]
                        font-semibold
                        text-[#252a28]
                      ">
                        {item.name}
                      </p>

                      <p className="text-[12px] text-[#929a97]">
                        Qty: {item.quantity}
                      </p>

                    </div>

                    {/* Price */}

                    <span className="
                      mr-3
                      text-[16px]
                      font-semibold
                      text-[#252a28]
                    ">
                      ₹{Number(item.price).toFixed(2)}
                    </span>

                    {/* Delete */}

                    <button
                      type="button"
                      onClick={() =>
                        handleDeleteItem(
                          item.barcode
                        )
                      }
                      className="text-[#f06d4f]"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2
                        size={18}
                        strokeWidth={1.8}
                      />
                    </button>

                  </div>
                ))}

              </div>
            )}

          {/* ==========================
              CART / CHECKOUT
          ========================== */}

          <div
            className="
              fixed
              bottom-0
              flex
              flex-col
              w-screen
              items-center
              h-53
              rounded-t-[45px]
              bg-[#e9edeb]
              px-4
              pt-4
              shadow-[0_-2px_12px_rgba(0,0,0,0.04)]
            "
          >

            {/* Cart summary */}

            <div className="flex w-full items-center">

              <div
                className="
                  flex
                  h-15
                  w-15
                  shrink-0
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

                <p className="
                  text-[19px]
                  font-semibold
                  text-[#252a28]
                ">
                  My Cart
                </p>

                <p className="text-[13px] text-[#717271]">
                  {cartCount}{" "}
                  {cartCount === 1
                    ? "Item"
                    : "Items"}
                </p>

              </div>

              <p className="
                text-2xl
                font-bold
                text-[#252a28]
              ">
                ₹{Number(cartTotal).toLocaleString(
                  "en-IN"
                )}.00
              </p>

            </div>

            {/* Scan Product */}

            <button
              type="button"
              onClick={handleScanProduct}
              className="
              mt-4
                left-4
                right-4
                flex
                h-15
                w-90
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
              type="button"
              onClick={handleCheckout}
              disabled={cartCount === 0}
              className="
                mt-4
                mx-auto
                flex
                items-center
                gap-1
                text-[15px]
                font-semibold
                text-[#159779]
                disabled:cursor-not-allowed
                
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