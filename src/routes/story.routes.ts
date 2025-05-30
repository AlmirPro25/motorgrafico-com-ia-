import { Router } from 'express';
import * as StoryController from '../controllers/story.controller';
import { protect, AuthenticatedRequest } from '../middlewares/auth.middleware';

const router = Router();

// Helper to cast Request to AuthenticatedRequest for handlers using protect middleware
const useAuth = (handler: (req: AuthenticatedRequest, res: any, next: any) => Promise<void>) => {
    return (req: Request, res: any, next: any) => handler(req as AuthenticatedRequest, res, next);
};

// POST /api/stories/ - Create a new story
router.post('/', protect, useAuth(StoryController.createStoryHandler));

// GET /api/stories/ - Get the story feed for the authenticated user
router.get('/', protect, useAuth(StoryController.getStoryFeedHandler));

// DELETE /api/stories/{storyId} - Delete a story
router.delete('/:storyId', protect, useAuth(StoryController.deleteStoryHandler));

// POST /api/stories/{storyId}/view - Mark a story as viewed
router.post('/:storyId/view', protect, useAuth(StoryController.markStoryViewedHandler));

// GET /api/stories/{storyId}/viewers - Get list of users who viewed a story (owner only)
router.get('/:storyId/viewers', protect, useAuth(StoryController.getStoryViewersHandler));


export default router;
