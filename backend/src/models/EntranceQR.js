import mongoose from "mongoose";

const entranceQRSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },

    usedAt: {
      type: Date,
      default: null,
    },

    isUsed: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const EntranceQR = mongoose.model(
  "EntranceQR",
  entranceQRSchema
);

export default EntranceQR;
