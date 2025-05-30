import { Request, Response, NextFunction } from 'express';
import * as PostService from '../services/post.service';
import * as LikeService from '../services/like.service';
// CommentService might be used if listing comments with post, but that's usually separate
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { CreatePostDTO, UpdatePostDTO, SharePostDTO, PaginationOptions } from '../models/post.types';

const getPaginationOptions = (req: Request): PaginationOptions => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    return { page: Math.max(1, page), limit: Math.max(1, Math.min(100, limit)) }; // Basic sanity checks
};

export const createPostHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const postData: CreatePostDTO = {
            user_id: req.user.userId,
            content_text: req.body.content_text,
            content_image_url: req.body.content_image_url,
            content_video_url: req.body.content_video_url,
            privacy_level: req.body.privacy_level || 'public', // Default to public
            tagged_user_ids: req.body.tagged_user_ids || [],
        };

        if (!postData.content_text && !postData.content_image_url && !postData.content_video_url) {
             return res.status(400).json({ error: 'Post content (text, image, or video) is required.' });
        }
        if (!['public', 'friends', 'private'].includes(postData.privacy_level)) {
            return res.status(400).json({ error: 'Invalid privacy level.' });
        }

        const post = await PostService.createNewPost(postData);
        res.status(201).json(post);
    } catch (error) {
        console.error('Create Post Error:', error);
        if (error instanceof Error && (error.message.includes('not found') || error.message.includes('Invalid'))) {
            return res.status(400).json({ error: error.message });
        }
        next(error); // Pass to global error handler
    }
};

export const getFeedHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated for feed.' });
        }
        const paginationOptions = getPaginationOptions(req);
        const posts = await PostService.getPublicFeed(paginationOptions, req.user.userId);
        // TODO: Add pagination metadata to response if returning PaginatedPosts object
        res.status(200).json(posts);
    } catch (error) {
        next(error);
    }
};

export const getPostsByUserIdHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId: targetUserId } = req.params;
        const paginationOptions = getPaginationOptions(req);
        // currentUserId is optional, for when a logged-in user views another's profile
        const currentUserId = (req as AuthenticatedRequest).user?.userId;

        const posts = await PostService.getPostsByUser(targetUserId, paginationOptions, currentUserId);
        // TODO: Add pagination metadata
        res.status(200).json(posts);
    } catch (error) {
        next(error);
    }
};

export const getPostByIdHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { postId } = req.params;
        const currentUserId = (req as AuthenticatedRequest).user?.userId; // Optional, for like status & privacy
        const post = await PostService.getPostById(postId, currentUserId);
        if (!post) {
            return res.status(404).json({ error: 'Post not found or not accessible.' });
        }
        res.status(200).json(post);
    } catch (error) {
        next(error);
    }
};

export const updatePostHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { postId } = req.params;
        const updateData: UpdatePostDTO = req.body;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No update data provided.' });
        }
        if (updateData.privacy_level && !['public', 'friends', 'private'].includes(updateData.privacy_level)) {
            return res.status(400).json({ error: 'Invalid privacy level.' });
        }

        const updatedPost = await PostService.updateExistingPost(postId, req.user.userId, updateData);
        if (!updatedPost) {
            // This case should ideally be caught by service layer throwing specific errors
            return res.status(404).json({ error: 'Post not found or update failed.' });
        }
        res.status(200).json(updatedPost);
    } catch (error) {
        console.error('Update Post Error:', error);
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
            if (error.message.includes('Invalid privacy level')) return res.status(400).json({ error: error.message});
        }
        next(error);
    }
};

export const deletePostHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { postId } = req.params;
        const success = await PostService.deleteExistingPost(postId, req.user.userId);
        if (!success) {
            // This could be because post not found or user not authorized, service throws specific errors
            return res.status(404).json({ error: 'Post not found or deletion failed.' });
        }
        res.status(204).send(); // No content
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};

export const likePostHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { postId } = req.params;
        const like = await LikeService.likePost(postId, req.user.userId);
        // likePost service now returns the like object or throws
        res.status(201).json(like);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            // Add more specific error checks if LikeService throws them
        }
        next(error);
    }
};

export const unlikePostHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { postId } = req.params;
        const success = await LikeService.unlikePost(postId, req.user.userId);
        if (!success) {
            return res.status(404).json({ error: 'Like not found or post not found.' });
        }
        res.status(204).send();
    } catch (error) {
         if (error instanceof Error) { // Catch errors from service layer (e.g. User/Post not found)
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
        }
        next(error);
    }
};

export const sharePostHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if(!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { postId: originalPostId } = req.params;
        const shareData: SharePostDTO = {
            user_id: req.user.userId,
            original_post_id: originalPostId,
            content_text: req.body.content_text, // Optional commentary
            privacy_level: req.body.privacy_level || 'public',
        };

        if (!['public', 'friends', 'private'].includes(shareData.privacy_level)) {
            return res.status(400).json({ error: 'Invalid privacy level for shared post.' });
        }

        const sharedPost = await PostService.shareExistingPost(shareData);
        res.status(201).json(sharedPost);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('Cannot share') || error.message.includes('Invalid privacy level')) {
                return res.status(400).json({ error: error.message });
            }
            if (error.message.includes('re-share')) { // Cannot re-share a share
                return res.status(400).json({ error: error.message });
            }
        }
        next(error);
    }
};
