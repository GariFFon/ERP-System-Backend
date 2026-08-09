import { Router } from 'express';
import {
  listProducts,
  createProduct,
  getProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
} from './product.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';

const router = Router();

router.use(authenticate);

// All roles can view products
router.get('/', listProducts);
router.get('/low-stock', getLowStockProducts);
router.get('/:id', getProduct);

// Admin and Warehouse can manage products
router.post('/', requireRole('Admin', 'Warehouse'), createProduct);
router.put('/:id', requireRole('Admin', 'Warehouse'), updateProduct);
router.delete('/:id', requireRole('Admin'), deleteProduct);

export default router;
