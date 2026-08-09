import { Router } from 'express';
import {
  listChallans,
  createChallan,
  getChallan,
  updateChallan,
  confirmChallan,
  cancelChallan,
  deleteChallan,
} from './challan.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';

const router = Router();

router.use(authenticate);

// All authenticated roles can view challans
router.get('/', listChallans);
router.get('/:id', getChallan);

// Admin and Sales can create
router.post('/', requireRole('Admin', 'Sales'), createChallan);

// Admin and Sales can update draft challans
router.put('/:id', requireRole('Admin', 'Sales'), updateChallan);

// Admin and Sales can confirm
router.patch('/:id/confirm', requireRole('Admin', 'Sales'), confirmChallan);

// Admin and Sales can cancel
router.patch('/:id/cancel', requireRole('Admin', 'Sales'), cancelChallan);

// Admin only can delete (Draft only)
router.delete('/:id', requireRole('Admin'), deleteChallan);

export default router;
