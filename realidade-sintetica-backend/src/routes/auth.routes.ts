import { Router } from 'express';
// import * as authController from '../auth/auth.controller'; // Placeholder for controller imports

const router = Router();

router.post('/register', /* authController.register */);
router.post('/login', /* authController.login */);
router.post('/refresh-token', /* authController.refreshToken */);

export default router;
