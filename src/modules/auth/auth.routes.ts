import { Router } from 'express';
import { login, getMe } from './auth.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me (protected)
router.get('/me', authenticate, getMe);

export default router;
