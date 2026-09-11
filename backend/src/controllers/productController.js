import Product from "../models/Product.js";
import { fetchProductFromAiLab } from "../services/aiVerificationService.js";

const createProduct = async (req, res) => {
  try {
    const {
      name,
      sku,
      barcode,
      description,
      category,
      price,
      unit,
      weight,
      weightUnit,
      image,
    } = req.body;

    if (
      !name ||
      !sku ||
      !barcode ||
      !category ||
      price === undefined ||
      !unit ||
      weight === undefined ||
      !weightUnit
    ) {
      return res.status(400).json({
        success: false,
        message: "Required product fields are missing",
      });
    }

    if (Number(price) < 0 || Number(weight) < 0) {
      return res.status(400).json({
        success: false,
        message: "Price and weight cannot be negative",
      });
    }

    const existingProduct = await Product.findOne({
      $or: [{ sku }, { barcode }],
    });

    if (existingProduct) {
      return res.status(409).json({
        success: false,
        message: "Product with this SKU or barcode already exists",
      });
    }

    const product = await Product.create({
      name,
      sku,
      barcode,
      description,
      category,
      price: Number(price),
      unit,
      weight: Number(weight),
      weightUnit,
      image,
    });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
      data: product,
    });
  } catch (error) {
    console.error("Create product error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to create product",
    });
  }
};

const getProducts = async (req, res) => {
  try {
    const products = await Product.find({
      isActive: true,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: products.length,
      data: products,
    });
  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch products",
    });
  }
};

const getProductByBarcode = async (req, res) => {
  try {
    const barcode = req.params.barcode?.trim();

    if (!barcode) {
      return res.status(400).json({
        success: false,
        message: "Barcode is required",
      });
    }

    // Authoritative single source of truth: AI Verification Lab PostgreSQL
    const product = await fetchProductFromAiLab(barcode);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: product,
    });
  } catch (error) {
    console.error("Get product by barcode error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch product",
    });
  }
};

export {
  createProduct,
  getProducts,
  getProductByBarcode,
};