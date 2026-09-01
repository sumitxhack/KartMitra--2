import {
  ChevronLeft,
  ShoppingCart,
} from "lucide-react";

import {
  useEffect,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";

import apiClient from "../../api/client";

const ProductDetails = () => {
  const navigate = useNavigate();

  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);

  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] =
    useState(false);

  const [error, setError] = useState("");

  /*
   * ==========================================================
   * LOAD SCANNED PRODUCT
   * ==========================================================
   */

  useEffect(() => {
    try {
      const storedProduct =
        sessionStorage.getItem(
          "scannedProduct"
        );

      if (!storedProduct) {
        setError(
          "No scanned product was found."
        );
        setLoading(false);
        return;
      }

      const parsedProduct =
        JSON.parse(storedProduct);

      setProduct(parsedProduct);
    } catch (error) {
      console.error(
        "Failed to load scanned product:",
        error
      );

      setError(
        "Unable to load product details."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * ==========================================================
   * QUANTITY
   * ==========================================================
   */

  const handleQuantityChange = (change) => {
    setQuantity((previousQuantity) =>
      Math.max(
        1,
        previousQuantity + change
      )
    );
  };

  /*
   * ==========================================================
   * ADD TO CART
   * ==========================================================
   */

  const handleAddToCart = async () => {
    if (!product) {
      return;
    }

    /*
     * The session ID MUST have been created when
     * the customer scanned the Entry QR.
     */

    const sessionId =
      sessionStorage.getItem(
        "sessionId"
      );

    if (!sessionId) {
      setError(
        "Shopping session not found. Please scan the Entry QR again."
      );
      return;
    }

    const barcode =
      product.barcode;

    if (!barcode) {
      setError(
        "Product barcode is missing."
      );
      return;
    }

    try {
      setAddingToCart(true);
      setError("");

      /*
       * Add the selected quantity in ONE request.
       *
       * POST
       * /api/carts/:sessionId/items
       *
       * {
       *   barcode,
       *   quantity
       * }
       */

      const response = await apiClient(
        `/carts/${encodeURIComponent(
          sessionId
        )}/items`,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            barcode,
            quantity,
          }),
        }
      );

      console.log(
        "Product added to cart:",
        response
      );

      /*
       * Store the latest cart locally so the
       * shopping page can immediately display it.
       */

      const updatedCart =
        response?.data;

      if (updatedCart) {
        sessionStorage.setItem(
          "cart",
          JSON.stringify(
            updatedCart
          )
        );
      }

      /*
       * Product has successfully been
       * added to the customer's cart.
       *
       * Go to Shopping page.
       */

      navigate("/shopping");
    } catch (error) {
      console.error(
        "Add to cart failed:",
        error
      );

      setError(
        error?.message ||
          "Unable to add product to cart."
      );
    } finally {
      setAddingToCart(false);
    }
  };

  /*
   * ==========================================================
   * LOADING
   * ==========================================================
   */

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f8f6]">
        <p className="text-[#7a8583]">
          Loading product...
        </p>
      </div>
    );
  }

  /*
   * ==========================================================
   * ERROR
   * ==========================================================
   */

  if (error && !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f4f8f6] p-6">
        <div className="text-center">
          <p className="mb-5 text-sm text-red-500">
            {error}
          </p>

          <button
            onClick={() =>
              navigate(-1)
            }
            className="rounded-xl bg-[#159b7d] px-6 py-3 text-sm font-semibold text-white"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  /*
   * ==========================================================
   * PRODUCT IMAGE
   * ==========================================================
   *
   * Different products may use different image
   * property names. This safely handles the
   * common ones.
   */

  const productImage =
    product.image ||
    product.imageUrl ||
    product.imageURL ||
    product.thumbnail ||
    "";

  /*
   * ==========================================================
   * TOTAL FOR THIS PRODUCT
   * ==========================================================
   */

  const unitPrice =
    Number(product.price) || 0;

  const selectedTotal =
    unitPrice * quantity;

  return (
    <div className="min-h-screen bg-[#f4f8f6] flex items-center justify-center p-0 sm:p-6">
      <main
        className="
          relative
          w-full
          min-h-screen
          sm:min-h-211
          sm:max-w-97.5
          overflow-hidden
          bg-white
          sm:rounded-[42px]
          sm:border-8
          sm:border-[#151a19]
          shadow-2xl
        "
      >
        <div
          className="
            relative
            z-10
            flex
            min-h-screen
            flex-col
            px-5
            pt-6
            pb-5
            sm:min-h-207
            sm:px-7
            sm:pt-8
          "
        >
          {/* =================================================
              HEADER
          ================================================== */}

          <div className="mb-6 flex items-center gap-3">
            <button
              className="
                flex
                h-9
                w-9
                items-center
                justify-center
                rounded-full
                bg-[#f0f4f2]
                transition-all
                duration-200
                hover:bg-[#e5f0eb]
                active:scale-95
              "
              onClick={() =>
                navigate(-1)
              }
              aria-label="Go back"
            >
              <ChevronLeft
                size={22}
                className="text-[#18201e]"
              />
            </button>

            <h1
              className="
                flex-1
                text-center
                text-[22px]
                font-bold
                text-[#111716]
              "
            >
              Product Details
            </h1>

            <div className="w-9" />
          </div>

          {/* =================================================
              PRODUCT IMAGE
          ================================================== */}

          <div
            className="
              mb-6
              flex
              h-80
              items-center
              justify-center
              overflow-hidden
              rounded-2xl
              bg-[#e8f5ef]
            "
          >
            {productImage ? (
              <img
                src={productImage}
                alt={product.name}
                className="
                  h-full
                  w-full
                  object-contain
                  p-6
                "
              />
            ) : (
              <span className="text-sm text-[#8b9693]">
                Product image unavailable
              </span>
            )}
          </div>

          {/* =================================================
              DETAILS
          ================================================== */}

          <div
            className="
              flex-1
              overflow-y-auto
              -mx-5
              px-5
              sm:-mx-7
              sm:px-7
            "
          >
            {/* Product name */}

            <div className="mb-4">
              <h2
                className="
                  text-[18px]
                  font-bold
                  text-[#111716]
                "
              >
                {product.name}
              </h2>

              {(product.size ||
                product.weight) && (
                <p
                  className="
                    mt-1
                    text-[13px]
                    text-[#7a8583]
                  "
                >
                  {product.size ||
                    product.weight}
                </p>
              )}
            </div>

            {/* Price */}

            <div className="mb-6">
              <p
                className="
                  text-[28px]
                  font-bold
                  text-[#159b7d]
                "
              >
                ₹{unitPrice.toFixed(2)}
              </p>
            </div>

            {/* Quantity */}

            <div className="mb-6 flex items-center gap-4">
              <span
                className="
                  text-[14px]
                  font-semibold
                  text-[#7a8583]
                "
              >
                Quantity
              </span>

              <div
                className="
                  flex
                  items-center
                  gap-3
                  rounded-lg
                  border
                  border-[#e2e7e5]
                  bg-white
                  px-4
                  py-2
                "
              >
                <button
                  onClick={() =>
                    handleQuantityChange(-1)
                  }
                  disabled={
                    quantity === 1
                  }
                  className="
                    flex
                    h-6
                    w-6
                    items-center
                    justify-center
                    text-[16px]
                    text-[#7a8583]
                    transition-all
                    duration-200
                    hover:text-[#18201e]
                    active:scale-90
                    disabled:opacity-30
                  "
                >
                  −
                </button>

                <span
                  className="
                    w-6
                    text-center
                    text-[14px]
                    font-semibold
                    text-[#18201e]
                  "
                >
                  {quantity}
                </span>

                <button
                  onClick={() =>
                    handleQuantityChange(1)
                  }
                  className="
                    flex
                    h-6
                    w-6
                    items-center
                    justify-center
                    text-[16px]
                    text-[#7a8583]
                    transition-all
                    duration-200
                    hover:text-[#18201e]
                    active:scale-90
                  "
                >
                  +
                </button>
              </div>
            </div>

            {/* Selected total */}

            <div
              className="
                mb-4
                flex
                items-center
                justify-between
                rounded-xl
                bg-[#f4f8f6]
                px-4
                py-3
              "
            >
              <span
                className="
                  text-[13px]
                  font-medium
                  text-[#7a8583]
                "
              >
                Total
              </span>

              <span
                className="
                  text-[18px]
                  font-bold
                  text-[#159b7d]
                "
              >
                ₹{selectedTotal.toFixed(2)}
              </span>
            </div>

            {/* Error */}

            {error && (
              <p
                className="
                  mb-4
                  text-center
                  text-[12px]
                  text-red-500
                "
              >
                {error}
              </p>
            )}

            {/* Add to cart */}

            <button
              onClick={handleAddToCart}
              disabled={addingToCart}
              className="
                mt-8
                flex
                h-16
                w-full
                items-center
                justify-center
                gap-2
                rounded-2xl
                bg-[#159b7d]
                text-[15px]
                font-bold
                text-white
                shadow-md
                transition-all
                duration-200
                active:scale-[0.98]
                active:bg-[#0a8d71]
                disabled:cursor-not-allowed
                disabled:opacity-60
              "
            >
              <ShoppingCart size={18} />

              {addingToCart
                ? "Adding..."
                : `Add ${quantity} to Cart`}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProductDetails;