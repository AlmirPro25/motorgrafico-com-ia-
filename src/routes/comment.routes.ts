import { Router } from 'express';
import * as CommentController from '../controllers/comment.controller';
import { protect, AuthenticatedRequest } from '../middlewares/auth.middleware';

const router = Router();

// Helper to cast Request to AuthenticatedRequest for handlers using protect middleware
const useAuth = (handler: (req: AuthenticatedRequest, res: any, next: any) => Promise<void>) => {
    return (req: Request, res: any, next: any) => handler(req as AuthenticatedRequest, res, next);
};

// PUT /api/comments/{commentId} - Update a comment
router.put('/:commentId', protect, useAuth(CommentController.updateCommentHandler));

// DELETE /api/comments/{commentId} - Delete a comment
// Note: The service layer currently has limitations for "post owner deletion" due to DB function constraints.
// This route will primarily work for comment authors.
router.delete('/:commentId', protect, useAuth(CommentController.deleteCommentHandler));

// GET /api/comments/{commentId} - Get a single comment by its ID (optional)
// This might be useful for specific use cases, like linking directly to a comment.
router.get('/:commentId', CommentController.getCommentByIdHandler); // Public, post privacy might affect visibility indirectly.

export default router;
