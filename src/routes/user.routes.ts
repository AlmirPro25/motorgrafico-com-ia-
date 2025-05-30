import { Router } from 'express';
import * as UserController from '../controllers/user.controller';
import { protect, AuthenticatedRequest } from '../middlewares/auth.middleware'; // Import AuthenticatedRequest
import * as StoryController from '../controllers/story.controller'; // Import StoryController
import * as FriendController from '../controllers/friend.controller'; // Import FriendController

const router = Router();

// GET /api/users/{userIdOrHandle} - Publicly accessible user profile
router.get('/:userIdOrHandle', UserController.getUserPublicProfile);

// PUT /api/users/me - Protected route to update authenticated user's profile
router.put('/me', protect, (req, res, next) => UserController.updateAuthenticatedUserProfile(req as AuthenticatedRequest, res, next));

// GET /api/users/{userId}/stories - Get a user's active stories
router.get('/:userId/stories', StoryController.getUserStoriesHandler);

// GET /api/users/{userId}/friends - Get a specific user's friend list
router.get('/:userId/friends', FriendController.getUserFriendsHandler); // Controller already created

export default router;
