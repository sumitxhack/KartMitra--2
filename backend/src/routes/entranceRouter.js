import express from "express";

import {
  generateEntranceQR,
  scanEntranceQR,
} from "../controllers/entranceController.js";

const router = express.Router();


// Generate entrance QR
router.post(
  "/generate",
  generateEntranceQR
);


// Customer scans entrance QR
router.post(
  "/scan",
  scanEntranceQR
);

export default router;