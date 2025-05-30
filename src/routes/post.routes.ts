import { Router } from 'express';
import * as PostController from '../controllers/post.controller';
import * as CommentController from '../controllers/comment.controller'; // For routes like /posts/:postId/comments
import { protect, AuthenticatedRequest } from '../middlewares/auth.middleware';

const router = Router();

// Apply protect middleware to AuthenticatedRequest type for handlers
const useAuth = (handler: (req: AuthenticatedRequest, res: any, next: any) => Promise<void>) => {
    return (req: Request, res: any, next: any) => handler(req as AuthenticatedRequest, res, next);
};

// === Post Routes ===
// POST /api/posts/ - Create new post
router.post('/', protect, useAuth(PostController.createPostHandler));

// GET /api/posts/feed - Get user's feed
router.get('/feed', protect, useAuth(PostController.getFeedHandler));

// GET /api/posts/user/{userId} - Get all posts by a specific user
router.get('/user/:userId', PostController.getPostsByUserIdHandler); // Public, but respects privacy. Auth optional for like status.

// GET /api/posts/{postId} - Get a single post by its ID
router.get('/:postId', PostController.getPostByIdHandler); // Public, but respects privacy. Auth optional.

// PUT /api/posts/{postId} - Update a post
router.put('/:postId', protect, useAuth(PostController.updatePostHandler));

// DELETE /api/posts/{postId} - Delete a post
router.delete('/:postId', protect, useAuth(PostController.deletePostHandler));

// === Like Routes (on a Post) ===
// POST /api/posts/{postId}/like - Like a post
router.post('/:postId/like', protect, useAuth(PostController.likePostHandler));

// DELETE /api/posts/{postId}/like - Unlike a post
router.delete('/:postId/like', protect, useAuth(PostController.unlikePostHandler));

// === Comment Routes (on a Post) ===
// POST /api/posts/{postId}/comments - Create a new comment on a post
router.post('/:postId/comments', protect, useAuth(CommentController.createCommentHandler));

// GET /api/posts/{postId}/comments - Get all comments for a specific post
router.get('/:postId/comments', CommentController.getCommentsByPostIdHandler); // Public, post privacy applies. Auth optional.

// === Share Route (on a Post) ===
// POST /api/posts/{postId}/share - Share a post
router.post('/:postId/share', protect, useAuth(PostController.sharePostHandler));


export default router;
