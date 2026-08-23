import { Router } from 'express';
import { z } from 'zod';
import { OrderController } from '../controllers/order.controller';
import { validate } from '../middleware/validate';

const router = Router();

const createOrderSchema = {
  body: z.object({
    items: z.array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        quantity: z.number().int().positive('Quantity must be a positive integer'),
      })
    ).min(1, 'Order must contain at least one item'),
  }),
};

const updateStatusSchema = {
  body: z.object({
    status: z.enum(['pending', 'processing', 'completed', 'cancelled'], {
      errorMap: () => ({ message: "Status must be 'pending', 'processing', 'completed', or 'cancelled'" }),
    }),
  }),
};

router.get('/', OrderController.getAll);
router.get('/:id', OrderController.getById);
router.post('/', validate(createOrderSchema), OrderController.create);
router.put('/:id/status', validate(updateStatusSchema), OrderController.updateStatus);

export default router;
