import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import cartRoutes from "./routes/cartRoutes.js";
import checkoutRoutes from "./routes/checkoutRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import exitRoutes from "./routes/exitRoutes.js";
import cameraVerificationRoutes from "./routes/cameraVerificationRoutes.js";

dotenv.config();

const app = express();

// Database
connectDB();

// Security
app.use(helmet());

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan("dev"));

// Routes
app.use("/api/products", productRoutes);
app.use("/api/carts", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/exit", exitRoutes);
app.use("/api/camera", cameraVerificationRoutes);



// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "KartMitra backend is running",
  });
});

export default app;