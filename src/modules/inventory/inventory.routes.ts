import { Router } from 'express';
import { listMovements, createMovement, getProductMovements } from './inventory.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';

const router = Router();

router.use(authenticate);

// All roles can view
router.get('/movements', listMovements);
router.get('/movements/:productId', getProductMovements);

// Admin and Warehouse can create manual adjustments
router.post('/movements', requireRole('Admin', 'Warehouse'), createMovement);

export default router;
