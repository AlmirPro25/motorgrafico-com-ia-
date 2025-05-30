import { Request, Response, NextFunction } from 'express';
import * as FriendService from '../services/friend.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { FriendListPaginationOptions } from '../models/friend.types';

const getPaginationOptions = (req: Request): FriendListPaginationOptions => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 15;
    return { page: Math.max(1, page), limit: Math.max(1, Math.min(50, limit)) };
};

export const sendFriendRequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { receiverId } = req.body;
        if (!receiverId) {
            return res.status(400).json({ error: 'receiverId is required.' });
        }

        const request = await FriendService.sendFriendRequest(req.user.userId, receiverId);
        res.status(201).json(request);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('oneself') || error.message.includes('not found') || 
                error.message.includes('already pending') || error.message.includes('already friends') ||
                error.message.includes('not accepting friend requests')) {
                return res.status(400).json({ error: error.message });
            }
            if (error.message.includes('privacy_friend_requests')) { // Specific privacy error
                return res.status(403).json({ error: error.message });
            }
        }
        next(error);
    }
};

export const getIncomingRequestsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const paginationOptions = getPaginationOptions(req);
        const requests = await FriendService.getIncomingRequests(req.user.userId, paginationOptions);
        res.status(200).json(requests); // TODO: Add pagination metadata if using PaginatedFriendRequests
    } catch (error) {
        next(error);
    }
};

export const getOutgoingRequestsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const paginationOptions = getPaginationOptions(req);
        const requests = await FriendService.getOutgoingRequests(req.user.userId, paginationOptions);
        res.status(200).json(requests); // TODO: Add pagination metadata
    } catch (error) {
        next(error);
    }
};

export const acceptFriendRequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { requestId } = req.params;
        const updatedRequest = await FriendService.acceptFriendRequest(requestId, req.user.userId);
        res.status(200).json(updatedRequest);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized') || error.message.includes('Cannot accept')) return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};

export const declineOrCancelFriendRequestHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { requestId } = req.params;
        const updatedRequest = await FriendService.declineOrCancelFriendRequest(requestId, req.user.userId);
        res.status(200).json(updatedRequest);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized') || error.message.includes('Cannot modify')) return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};

export const listFriendsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const paginationOptions = getPaginationOptions(req);
        const friends = await FriendService.listFriends(req.user.userId, paginationOptions);
        res.status(200).json(friends); // TODO: Add pagination metadata
    } catch (error) {
        next(error);
    }
};

// Handler for getting a specific user's friend list (mounted on user.routes.ts)
export const getUserFriendsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId: profileOwnerId } = req.params;
        // const currentUserId = (req as AuthenticatedRequest).user?.userId; // For privacy checks later

        // TODO: Implement privacy check:
        // 1. Fetch profileOwnerId's UserSettings.
        // 2. Check privacy setting for friend list visibility.
        // 3. If private, and currentUserId is not profileOwnerId (and not admin/friend if that's allowed), return 403.
        // For now, assume public or service layer handles this. FriendService.listFriends currently doesn't take viewerId.

        const paginationOptions = getPaginationOptions(req);
        const friends = await FriendService.listFriends(profileOwnerId, paginationOptions);
        res.status(200).json(friends); // TODO: Add pagination metadata
    } catch (error) {
        next(error);
    }
};


export const unfriendUserHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { friendUserId } = req.params;
        if (!friendUserId) {
            return res.status(400).json({ error: 'friendUserId parameter is required.' });
        }
        await FriendService.unfriendUser(req.user.userId, friendUserId);
        res.status(204).send();
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('not currently friends')) {
                return res.status(404).json({ error: error.message });
            }
            if (error.message.includes('oneself')) {
                return res.status(400).json({ error: error.message });
            }
        }
        next(error);
    }
};

export const getFriendSuggestionsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const paginationOptions = getPaginationOptions(req); // Using this for limit
        const suggestions = await FriendService.suggestFriends(req.user.userId, paginationOptions);
        res.status(200).json(suggestions);
    } catch (error) {
        next(error);
    }
};
