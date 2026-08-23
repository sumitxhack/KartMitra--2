import mongoose from "mongoose";

const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    barcode: {
      type: String,
      required: true,
      trim: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },

    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    unitWeight: {
      type: Number,
      required: true,
      min: 0,
    },

    totalPrice: {
      type: Number,
      required: true,
      min: 0,
    },

    totalWeight: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: true }
);

const cartSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    items: {
      type: [cartItemSchema],
      default: [],
    },

    totalAmount: {
      type: Number,
      default: 0,
      min: 0,
    },

    expectedWeight: {
      type: Number,
      default: 0,
      min: 0,
    },

    actualWeight: {
      type: Number,
      default: null,
      min: 0,
    },

    weightDifference: {
      type: Number,
      default: null,
    },

    weightVerified: {
      type: Boolean,
      default: false,
    },

    hasMismatch: {
      type: Boolean,
      default: false,
    },

    mismatchDetails: {
      scannedProduct: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        default: null,
      },

      detectedProduct: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        default: null,
      },

      message: {
        type: String,
        default: null,
      },
    },

    status: {
      type: String,
      enum: [
        "ACTIVE",
        "CHECKOUT_PENDING",
        "VERIFICATION_REQUIRED",
        "PAYMENT_PENDING",
        "PAID",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
  }
);

const Cart = mongoose.model("Cart", cartSchema);

export default Cart;