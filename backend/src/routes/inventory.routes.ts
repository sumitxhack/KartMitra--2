import { Router } from 'express';
import { z } from 'zod';
import { InventoryController } from '../controllers/inventory.controller';
import { validate } from '../middleware/validate';

const router = Router();

const adjustStockSchema = {
  body: z.object({
    productId: z.string().min(1, 'Product ID is required'),
    adjustment: z.number().int('Adjustment must be an integer').refine((val) => val !== 0, 'Adjustment cannot be zero'),
  }),
};

router.get('/', InventoryController.getAll);
router.get('/low-stock', InventoryController.getLowStock);
router.get('/:productId', InventoryController.getByProductId);
router.post('/adjust', validate(adjustStockSchema), InventoryController.adjust);

export default router;
