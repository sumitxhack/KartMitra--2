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

    quantity: {
      type: Number,
      required: true,
      min: 1,
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

    weightUnit: {
      type: String,
      required: true,
    },

    totalWeight: {
      type: Number,
      required: true,
      min: 0,
    },

    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const shoppingSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    status: {
      type: String,
      enum: [
        "ACTIVE",
        "CHECKOUT",
        "WEIGHT_VERIFICATION",
        "VERIFICATION_REQUIRED",
        "APPROVED",
        "PAYMENT_PENDING",
        "PAYMENT_SUCCESS",
        "EXIT_QR_GENERATED",
        "COMPLETED",
        "CANCELLED",
      ],
      default: "ACTIVE",
      index: true,
    },

    items: {
      type: [cartItemSchema],
      default: [],
    },

    subtotal: {
      type: Number,
      default: 0,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
    },

    taxes: {
      type: Number,
      default: 0,
      min: 0,
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

    measuredWeight: {
      type: Number,
      default: null,
      min: 0,
    },

    weightTolerance: {
      type: Number,
      default: 50,
      min: 0,
    },

    weightVerified: {
      type: Boolean,
      default: false,
    },

    mismatchDetected: {
      type: Boolean,
      default: false,
    },

    mismatchProduct: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },

    staffApproval: {
      approved: {
        type: Boolean,
        default: false,
      },

      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
        default: null,
      },

      approvedAt: {
        type: Date,
        default: null,
      },
    },

    payment: {
      provider: {
        type: String,
        enum: ["UPI", "RAZORPAY", null],
        default: null,
      },

      status: {
        type: String,
        enum: [
          "PENDING",
          "PROCESSING",
          "SUCCESS",
          "FAILED",
        ],
        default: "PENDING",
      },

      transactionId: {
        type: String,
        default: null,
      },

      paidAt: {
        type: Date,
        default: null,
      },
    },

    exitQr: {
      token: {
        type: String,
        default: null,
      },

      generatedAt: {
        type: Date,
        default: null,
      },

      expiresAt: {
        type: Date,
        default: null,
      },

      used: {
        type: Boolean,
        default: false,
      },

      usedAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  }
);

const ShoppingSession = mongoose.model(
  "ShoppingSession",
  shoppingSessionSchema
);

export default ShoppingSession;