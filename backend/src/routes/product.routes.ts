import { Router } from 'express';
import { z } from 'zod';
import { ProductController } from '../controllers/product.controller';
import { validate } from '../middleware/validate';

const router = Router();

const createProductSchema = {
  body: z.object({
    name: z.string().min(2, 'Product name must be at least 2 characters'),
    barcode: z.string().min(3, 'Barcode must be at least 3 characters'),
    price: z.number().nonnegative('Price cannot be negative'),
    weight: z.number().nonnegative('Weight cannot be negative').optional(),
    image: z.string().optional(),
    category: z.string().optional(),
    // Compatibility fields
    sku: z.string().optional(),
    cost: z.number().optional(),
    stock: z.number().optional(),
    supplierId: z.string().optional(),
  }),
};

const updateProductSchema = {
  body: z.object({
    name: z.string().min(2).optional(),
    barcode: z.string().min(3).optional(),
    price: z.number().nonnegative().optional(),
    weight: z.number().nonnegative().optional(),
    image: z.string().optional(),
    category: z.string().optional(),
    // Compatibility fields
    sku: z.string().optional(),
    cost: z.number().optional(),
    stock: z.number().optional(),
    supplierId: z.string().optional(),
  }),
};

const scanSchema = {
  body: z.object({
    barcode: z.string().min(1, 'Barcode is required to scan'),
  }),
};

router.get('/', ProductController.getAll);
router.get('/barcode/:barcode', ProductController.getByBarcode);
router.get('/:id', ProductController.getById);
router.post('/', validate(createProductSchema), ProductController.create);
router.put('/:id', validate(updateProductSchema), ProductController.update);
router.delete('/:id', ProductController.delete);
router.post('/scan', validate(scanSchema), ProductController.scan);

export default router;
