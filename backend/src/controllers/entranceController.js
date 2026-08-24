import EntranceQR from "../models/EntranceQR.js";

import {
  createCart,
} from "../services/cartService.js";

import {
  generateEntranceQRToken,
} from "../services/qrService.js";


// Generate an entrance QR
export const generateEntranceQR = async (req, res) => {
  try {
    const entranceQR =
      await generateEntranceQRToken();

    return res.status(201).json({
      success: true,
      message: "Entrance QR generated successfully",
      qrToken: entranceQR.token,
      expiresAt: entranceQR.expiresAt,
    });

  } catch (error) {
    console.error(
      "Generate entrance QR error:",
      error
    );

    return res.status(500).json({
      success: false,
      message: "Unable to generate entrance QR",
    });
  }
};


// Customer scans the entrance QR
export const scanEntranceQR = async (req, res) => {
  try {
    const { qrToken } = req.body;


    // 1. Validate request
    if (!qrToken) {
      return res.status(400).json({
        success: false,
        message: "Entry QR token is required",
      });
    }


    // 2. Atomically find and consume the QR
    // This prevents the same QR from creating
    // multiple carts when scanned twice.
    const entryQR =
      await EntranceQR.findOneAndUpdate(
        {
          token: qrToken,
          isUsed: false,
          expiresAt: {
            $gt: new Date(),
          },
        },
        {
          $set: {
            isUsed: true,
            usedAt: new Date(),
          },
        },
        {
          new: true,
        }
      );


    // QR invalid, expired, or already used
    if (!entryQR) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid, expired, or already used Entry QR",
      });
    }


    // 3. ONLY NOW create a fresh cart/session
    const result =
      await createCart();


    if (!result ||!result.sessionId) {
      throw new Error(
        "Failed to create shopping session"
      );
    }


    // 4. Generate a replacement entrance QR
    // for the next customer
    const nextEntranceQR =
      await generateEntranceQRToken();


    // 5. Return the customer's new cart/session
    return res.status(201).json({
      success: true,
      message:
        "Entry verified. Shopping session created successfully.",


      sessionId: result.sessionId,

      nextEntranceQR: {
        token: nextEntranceQR.token,
        expiresAt: nextEntranceQR.expiresAt,
      },
    });

  } catch (error) {
    console.error(
      "Entry QR scan error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to start shopping session",
    });
  }
};