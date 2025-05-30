import { Request, Response, NextFunction } from 'express';
import * as ConversationService from '../services/conversation.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { ConversationPaginationOptions } from '../models/conversation.types';

const getPaginationOptions = (req: Request): ConversationPaginationOptions => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    return { page: Math.max(1, page), limit: Math.max(1, Math.min(50, limit)) }; // Max limit 50
};

// Create or get a one-on-one conversation
export const getOrCreateOneOnOneConversationHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { targetUserId } = req.body; // Expect targetUserId in the body
        if (!targetUserId) {
            return res.status(400).json({ error: 'targetUserId is required.' });
        }

        const conversation = await ConversationService.getOrCreateOneOnOneConversation(req.user.userId, targetUserId);
        if (!conversation) {
            // Should be handled by service layer throwing errors for user not found etc.
            return res.status(404).json({ error: 'Could not get or create conversation.' });
        }
        res.status(200).json(conversation); // 200 OK if found, 201 if created (service could indicate this)
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('oneself')) {
                return res.status(400).json({ error: error.message });
            }
        }
        next(error);
    }
};

// List current user's conversations
export const listUserConversationsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const paginationOptions = getPaginationOptions(req);
        const conversations = await ConversationService.getUserConversations(req.user.userId, paginationOptions);
        // TODO: Add pagination metadata to response if returning PaginatedConversations object
        res.status(200).json(conversations);
    } catch (error) {
        next(error);
    }
};

// Get a specific conversation by ID (more for direct access if needed, or for message context)
export const getConversationByIdHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { conversationId } = req.params;
        const conversation = await ConversationService.getConversationDetails(conversationId, req.user.userId);
        // Service layer throws error if not found or not participant
        res.status(200).json(conversation);
    } catch (error) {
        if (error instanceof Error && (error.message.includes('not found') || error.message.includes('not a participant'))) {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
};
