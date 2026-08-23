import { Router } from 'express';
import { z } from 'zod';
import { AiController } from '../controllers/ai.controller';
import { validate } from '../middleware/validate';

const router = Router();

const productAnalysisSchema = {
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    name: z.string().min(1, 'Product name is required'),
    category: z.string().min(1, 'Product category is required'),
    stock: z.number().int().nonnegative('Stock cannot be negative'),
    price: z.number().nonnegative('Price cannot be negative'),
  }),
};

const productRecommendationSchema = {
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
  }),
};

const demandPredictionSchema = {
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    historicalSales: z.array(
      z.object({
        date: z.string().refine((val) => !isNaN(Date.parse(val)), {
          message: 'Date must be a valid date string (e.g. YYYY-MM-DD)',
        }),
        quantity: z.number().int().nonnegative('Quantity cannot be negative'),
      })
    ).min(1, 'At least one historical sales record is required'),
  }),
};

router.post('/product-analysis', validate(productAnalysisSchema), AiController.productAnalysis);
router.post('/product-recommendation', validate(productRecommendationSchema), AiController.productRecommendation);
router.post('/demand-prediction', validate(demandPredictionSchema), AiController.demandPrediction);

export default router;
