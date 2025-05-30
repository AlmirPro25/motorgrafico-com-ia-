import { Router } from 'express';
import * as FriendController from '../controllers/friend.controller';
import { protect, AuthenticatedRequest } from '../middlewares/auth.middleware';

const router = Router();

// Helper to cast Request to AuthenticatedRequest for handlers using protect middleware
const useAuth = <TParams = any, TResBody = any, TReqBody = any, TReqQuery = any>(
    handler: (req: AuthenticatedRequest<TParams, TResBody, TReqBody, TReqQuery>, res: Response, next: NextFunction) => Promise<void>
) => {
    return (req: Request<TParams, TResBody, TReqBody, TReqQuery>, res: Response, next: NextFunction) =>
        handler(req as AuthenticatedRequest<TParams, TResBody, TReqBody, TReqQuery>, res, next);
};

// Send a friend request
// Body: { "receiverId": "uuid-of-receiver" }
router.post('/requests', protect, useAuth(FriendController.sendFriendRequestHandler));

// Get incoming pending friend requests for the current user
router.get('/requests/incoming', protect, useAuth(FriendController.getIncomingRequestsHandler));

// Get outgoing pending friend requests sent by the current user
router.get('/requests/outgoing', protect, useAuth(FriendController.getOutgoingRequestsHandler));

// Accept a friend request
// :requestId is the ID of the FriendRequest record
router.put('/requests/:requestId/accept', protect, useAuth(FriendController.acceptFriendRequestHandler));

// Decline or cancel a friend request
// :requestId is the ID of the FriendRequest record
router.put('/requests/:requestId/decline', protect, useAuth(FriendController.declineOrCancelFriendRequestHandler));
// Note: Alternative to PUT for decline/cancel could be DELETE /requests/{requestId} if preferred RESTfully for cancel.

// List current user's friends
router.get('/', protect, useAuth(FriendController.listFriendsHandler));

// Unfriend a user
// :friendUserId is the ID of the user to unfriend
router.delete('/:friendUserId', protect, useAuth(FriendController.unfriendUserHandler));

// Get friend suggestions for the current user
router.get('/suggestions', protect, useAuth(FriendController.getFriendSuggestionsHandler));

export default router;
