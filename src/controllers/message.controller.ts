import { Request, Response, NextFunction } from 'express';
import * as MessageService from '../services/message.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { MessagePaginationOptions } from '../models/message.types';

const getPaginationOptions = (req: Request): MessagePaginationOptions => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1; // Less relevant if using before_message_id
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
    const before_message_id = req.query.before_message_id as string | undefined;
    return {
        page: Math.max(1, page),
        limit: Math.max(1, Math.min(100, limit)), // Max limit 100 for messages
        before_message_id
    };
};

export const sendMessageHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { conversationId } = req.params;
        const { content_text, content_image_url, content_video_url } = req.body;

        if (!content_text && !content_image_url && !content_video_url) {
            return res.status(400).json({ error: 'Message content (text, image, or video) is required.' });
        }

        const messageContent = { content_text, content_image_url, content_video_url };
        const message = await MessageService.sendNewMessage(conversationId, req.user.userId, messageContent);
        
        res.status(201).json(message);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('not a participant') || error.message.includes('required')) {
                return res.status(400).json({ error: error.message });
            }
        }
        next(error);
    }
};

export const getMessagesHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { conversationId } = req.params;
        const paginationOptions = getPaginationOptions(req);

        const messages = await MessageService.getMessagesForConversation(conversationId, req.user.userId, paginationOptions);
        // TODO: Add pagination metadata to response if returning PaginatedMessages object
        res.status(200).json(messages);
    } catch (error) {
        if (error instanceof Error && (error.message.includes('not authorized') || error.message.includes('not a participant'))) {
            return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};

export const markAsReadHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { conversationId } = req.params;
        await MessageService.markConversationAsRead(conversationId, req.user.userId);
        res.status(204).send(); // No content, success
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not a participant')) {
                return res.status(403).json({ error: error.message });
            }
        }
        next(error);
    }
};
