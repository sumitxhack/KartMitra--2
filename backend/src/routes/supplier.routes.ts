import { Router } from 'express';
import { z } from 'zod';
import { SupplierController } from '../controllers/supplier.controller';
import { validate } from '../middleware/validate';

const router = Router();

const createSupplierSchema = {
  body: z.object({
    name: z.string().min(2, 'Supplier name must be at least 2 characters'),
    contactName: z.string().optional(),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
};

const updateSupplierSchema = {
  body: z.object({
    name: z.string().min(2).optional(),
    contactName: z.string().optional(),
    email: z.string().email('Invalid email address').optional().or(z.literal('')),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
};

router.get('/', SupplierController.getAll);
router.get('/:id', SupplierController.getById);
router.post('/', validate(createSupplierSchema), SupplierController.create);
router.put('/:id', validate(updateSupplierSchema), SupplierController.update);
router.delete('/:id', SupplierController.delete);

export default router;
