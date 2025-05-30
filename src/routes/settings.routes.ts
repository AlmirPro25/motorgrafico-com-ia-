import { Router } from 'express';
import * as UserSettingsController from '../controllers/user.settings.controller';
import { protect, AuthenticatedRequest } from '../middlewares/auth.middleware';

const router = Router();

// Helper for casting request for authenticated routes
const useAuth = <TParams = any, TResBody = any, TReqBody = any, TReqQuery = any>(
    handler: (req: AuthenticatedRequest<TParams, TResBody, TReqBody, TReqQuery>, res: Response, next: NextFunction) => Promise<void>
) => {
    return (req: Request<TParams, TResBody, TReqBody, TReqQuery>, res: Response, next: NextFunction) =>
        handler(req as AuthenticatedRequest<TParams, TResBody, TReqBody, TReqQuery>, res, next);
};

// GET /api/settings/me - Get settings for the currently authenticated user
router.get('/me', protect, useAuth(UserSettingsController.getCurrentUserSettingsHandler));

// PUT /api/settings/me - Update settings for the currently authenticated user
// Body: { field1: value1, field2: value2, ... }
router.put('/me', protect, useAuth(UserSettingsController.updateCurrentUserSettingsHandler));

export default router;
