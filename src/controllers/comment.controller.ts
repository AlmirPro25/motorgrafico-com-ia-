import { Request, Response, NextFunction } from 'express';
import * as CommentService from '../services/comment.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { CreateCommentDTO, UpdateCommentDTO, PaginationOptions } from '../models/comment.types';

const getPaginationOptions = (req: Request): PaginationOptions => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    return { page: Math.max(1, page), limit: Math.max(1, Math.min(100, limit)) };
};

export const createCommentHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { postId } = req.params;
        const commentData: CreateCommentDTO = {
            post_id: postId,
            user_id: req.user.userId,
            parent_comment_id: req.body.parent_comment_id, // Optional
            content_text: req.body.content_text,
        };

        if (!commentData.content_text || commentData.content_text.trim() === '') {
            return res.status(400).json({ error: 'Comment content cannot be empty.' });
        }

        const comment = await CommentService.createNewComment(commentData);
        res.status(201).json(comment);
    } catch (error) {
        console.error('Create Comment Error:', error);
        if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('Cannot comment') || error.message.includes('Parent comment')) {
                return res.status(400).json({ error: error.message });
            }
        }
        next(error);
    }
};

export const getCommentsByPostIdHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { postId } = req.params;
        const paginationOptions = getPaginationOptions(req);
        const currentUserId = (req as AuthenticatedRequest).user?.userId; // For post visibility check

        const comments = await CommentService.getCommentsByPost(postId, paginationOptions, currentUserId);
        // TODO: Add pagination metadata
        res.status(200).json(comments);
    } catch (error) {
        if (error instanceof Error && error.message.includes('Post not found or not accessible')) {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
};

// Get a single comment by its ID - usually not a primary route, but can be useful
export const getCommentByIdHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { commentId } = req.params;
        // Optional: Add currentUserId if comment visibility depends on post visibility by that user
        // const currentUserId = (req as AuthenticatedRequest).user?.userId;
        const comment = await CommentService.getCommentById(commentId);
        if (!comment) {
            return res.status(404).json({ error: 'Comment not found.' });
        }
        // Add privacy check here if necessary, e.g. by fetching comment's post and checking its visibility
        res.status(200).json(comment);
    } catch (error) {
        next(error);
    }
};


export const updateCommentHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { commentId } = req.params;
        const updateData: UpdateCommentDTO = { content_text: req.body.content_text };

        if (!updateData.content_text || updateData.content_text.trim() === '') {
            return res.status(400).json({ error: 'Comment content cannot be empty.' });
        }

        const updatedComment = await CommentService.updateExistingComment(commentId, req.user.userId, updateData);
        if (!updatedComment) {
            // Service layer should throw specific errors for not found vs not authorized
            return res.status(404).json({ error: 'Comment not found or update failed.' });
        }
        res.status(200).json(updatedComment);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
            if (error.message.includes('cannot be empty')) return res.status(400).json({ error: error.message });
        }
        next(error);
    }
};

export const deleteCommentHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { commentId } = req.params;

        // The CommentService.deleteExistingComment has a known limitation with its current DB interaction model
        // for post owner deletion. This controller will reflect that for now.
        // See comment.service.ts for details.
        const success = await CommentService.deleteExistingComment(commentId, req.user.userId);

        if (!success) {
             // This path might be hit if the DB function strictly requires comment author
             // and a post owner (not comment author) tried to delete.
            return res.status(404).json({ error: 'Comment not found or deletion failed (ensure you are comment author or post owner with appropriate DB support).' });
        }
        res.status(204).send();
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
            // Catch the specific error from service about DB layer limitation for post owner deletion
            if (error.message.includes('DB layer only supports comment deletion by comment author')) {
                return res.status(501).json({ error: error.message }); // 501 Not Implemented (or 403)
            }
        }
        next(error);
    }
};
