import express from "express";

import {
  createProduct,
  getProducts,
  getProductByBarcode,
} from "../controllers/productController.js";

const router = express.Router();

router.post("/", createProduct);

router.get("/", getProducts);

router.get("/barcode/:barcode", getProductByBarcode);

export default router;