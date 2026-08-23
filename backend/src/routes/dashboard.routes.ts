import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';

const router = Router();

router.get('/summary', DashboardController.getSummary);
router.get('/sales', DashboardController.getSales);
router.get('/inventory', DashboardController.getInventory);

export default router;
