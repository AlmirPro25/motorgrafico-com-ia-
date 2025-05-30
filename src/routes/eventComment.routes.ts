import { Router } from 'express';
import * as EventController from '../controllers/event.controller'; // Re-using event.controller for comment handlers
import { protect, AuthenticatedRequest } from '../middlewares/auth.middleware';

const router = Router();

// Helper for casting request for authenticated routes
const useAuth = <TParams = any, TResBody = any, TReqBody = any, TReqQuery = any>(
    handler: (req: AuthenticatedRequest<TParams, TResBody, TReqBody, TReqQuery>, res: Response, next: NextFunction) => Promise<void>
) => {
    return (req: Request<TParams, TResBody, TReqBody, TReqQuery>, res: Response, next: NextFunction) =>
        handler(req as AuthenticatedRequest<TParams, TResBody, TReqBody, TReqQuery>, res, next);
};

// PUT /api/event-comments/{commentId} - Update an event comment
// Body: { "content_text": "Updated comment." }
router.put('/:commentId', protect, useAuth(EventController.updateEventCommentHandler));

// DELETE /api/event-comments/{commentId} - Delete an event comment
router.delete('/:commentId', protect, useAuth(EventController.deleteEventCommentHandler));

export default router;
