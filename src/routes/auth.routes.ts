import { Router } from 'express';
import * as AuthController from '../controllers/auth.controller';
import { protect, AuthenticatedRequest } from '../middlewares/auth.middleware'; // Import AuthenticatedRequest

const router = Router();

// POST /api/auth/register
router.post('/register', AuthController.register);

// POST /api/auth/login
router.post('/login', AuthController.login);

// GET /api/auth/me - Protected route
router.get('/me', protect, (req, res, next) => AuthController.getMe(req as AuthenticatedRequest, res, next));


export default router;
