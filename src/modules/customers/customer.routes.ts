import { Router } from 'express';
import {
  listCustomers,
  createCustomer,
  getCustomer,
  updateCustomer,
  deleteCustomer,
  addFollowup,
  listFollowups,
} from './customer.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/roleGuard';

const router = Router();

// All customer routes require authentication
router.use(authenticate);

// GET /api/customers — all roles
router.get('/', listCustomers);

// POST /api/customers — Admin, Sales
router.post('/', requireRole('Admin', 'Sales'), createCustomer);

// GET /api/customers/:id — all roles
router.get('/:id', getCustomer);

// PUT /api/customers/:id — Admin, Sales
router.put('/:id', requireRole('Admin', 'Sales'), updateCustomer);

// DELETE /api/customers/:id — Admin only
router.delete('/:id', requireRole('Admin'), deleteCustomer);

// Follow-ups
router.post('/:id/followups', requireRole('Admin', 'Sales'), addFollowup);
router.get('/:id/followups', listFollowups);

export default router;
