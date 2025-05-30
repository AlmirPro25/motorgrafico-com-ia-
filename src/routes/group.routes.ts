import { Router } from 'express';
import * as GroupController from '../controllers/group.controller';
import { protect, AuthenticatedRequest } from '../middlewares/auth.middleware';

const router = Router();

// Helper for casting request for authenticated routes
const useAuth = <TParams = any, TResBody = any, TReqBody = any, TReqQuery = any>(
    handler: (req: AuthenticatedRequest<TParams, TResBody, TReqBody, TReqQuery>, res: Response, next: NextFunction) => Promise<void>
) => {
    return (req: Request<TParams, TResBody, TReqBody, TReqQuery>, res: Response, next: NextFunction) =>
        handler(req as AuthenticatedRequest<TParams, TResBody, TReqBody, TReqQuery>, res, next);
};

// --- Group Routes ---
// POST /api/groups/ - Create a new group
router.post('/', protect, useAuth(GroupController.createGroupHandler));

// GET /api/groups/ - List all groups with filters
// Query params: ?type=public&user_is_member=true&discoverable=true&page=1&limit=10
router.get('/', GroupController.listGroupsHandler); // Auth is optional, handled by service for filtering

// GET /api/groups/{groupId} - Get details of a specific group
router.get('/:groupId', GroupController.getGroupDetailsHandler); // Auth is optional, service handles privacy

// PUT /api/groups/{groupId} - Update a group
router.put('/:groupId', protect, useAuth(GroupController.updateGroupHandler));

// DELETE /api/groups/{groupId} - Delete a group
router.delete('/:groupId', protect, useAuth(GroupController.deleteGroupHandler));


// --- Group Membership Routes ---
// POST /api/groups/{groupId}/join - Join a public group or request to join a private group
router.post('/:groupId/join', protect, useAuth(GroupController.joinOrRequestToJoinGroupHandler));

// DELETE /api/groups/{groupId}/leave - Leave a group
router.delete('/:groupId/leave', protect, useAuth(GroupController.leaveGroupHandler));

// GET /api/groups/{groupId}/members - List members of a group
router.get('/:groupId/members', GroupController.listGroupMembersHandler); // Access controlled by service

// POST /api/groups/{groupId}/members - Admin adds a member to a group
// Body: { "userId": "user-uuid-to-add", "role": "member" | "moderator" | "admin" }
router.post('/:groupId/members', protect, useAuth(GroupController.addMemberByAdminHandler));

// PUT /api/groups/{groupId}/members/{memberUserId} - Admin updates a member's role
// Body: { "role": "member" | "moderator" | "admin" }
router.put('/:groupId/members/:memberUserId', protect, useAuth(GroupController.updateMemberRoleByAdminHandler));

// DELETE /api/groups/{groupId}/members/{memberUserId} - Admin removes a member from a group
router.delete('/:groupId/members/:memberUserId', protect, useAuth(GroupController.removeMemberByAdminHandler));


// --- Group Join Request Routes (for private groups) ---
// GET /api/groups/{groupId}/join-requests - Admin lists pending join requests for a group
router.get('/:groupId/join-requests', protect, useAuth(GroupController.listJoinRequestsHandler));

// POST /api/groups/{groupId}/join-requests/{joinRequestId}/approve - Admin approves a join request
router.post('/:groupId/join-requests/:joinRequestId/approve', protect, useAuth(GroupController.approveJoinRequestHandler));

// POST /api/groups/{groupId}/join-requests/{joinRequestId}/decline - Admin declines a join request
router.post('/:groupId/join-requests/:joinRequestId/decline', protect, useAuth(GroupController.declineJoinRequestHandler));
// Could also be a PUT or DELETE method depending on RESTful preference for status change.

// --- Group Post Routes ---
// GET /api/groups/{groupId}/posts - List posts within a group
router.get('/:groupId/posts', protect, useAuth(GroupController.listGroupPostsHandler)); // Requires auth to check membership for private

// POST /api/groups/{groupId}/posts - Create a new post within a group
// Body: { "content_text": "...", ... } (Post content)
router.post('/:groupId/posts', protect, useAuth(GroupController.createGroupPostHandler));


export default router;
