import { Router } from 'express';
import healthRoutes from './health.routes';
import authRoutes from './auth.routes';
import productRoutes from './product.routes';
import inventoryRoutes from './inventory.routes';
import orderRoutes from './order.routes';
import supplierRoutes from './supplier.routes';
import dashboardRoutes from './dashboard.routes';
import aiRoutes from './ai.routes';

const router = Router();

// Mount modules under their endpoint paths
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/products', productRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/orders', orderRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/ai', aiRoutes);

export default router;
