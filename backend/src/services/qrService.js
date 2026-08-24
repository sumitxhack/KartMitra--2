import crypto from "crypto";
import EntranceQR from "../models/EntranceQR.js";

export const generateEntranceQRToken = async () => {
  const token = crypto.randomBytes(32).toString("hex");

  const expiresAt = new Date(
    Date.now() + 10 * 60 * 1000
  );

  const entranceQR = await EntranceQR.create({
    token,
    isUsed: false,
    expiresAt,
  });

  return entranceQR;
};