import { Router } from 'express';
import * as ConversationController from '../controllers/conversation.controller';
import * as MessageController from '../controllers/message.controller';
import { protect, AuthenticatedRequest } from '../middlewares/auth.middleware';

const router = Router();

// Helper to cast Request to AuthenticatedRequest for handlers using protect middleware
// This ensures req.user is typed correctly within the handlers.
const useAuth = <TParams = any, TResBody = any, TReqBody = any, TReqQuery = any>(
    handler: (req: AuthenticatedRequest<TParams, TResBody, TReqBody, TReqQuery>, res: Response, next: NextFunction) => Promise<void>
) => {
    return (req: Request<TParams, TResBody, TReqBody, TReqQuery>, res: Response, next: NextFunction) =>
        handler(req as AuthenticatedRequest<TParams, TResBody, TReqBody, TReqQuery>, res, next);
};


// === Conversation Routes ===

// POST /api/conversations/ - Create or get a one-on-one conversation
// Body: { "targetUserId": "uuid-of-other-user" }
router.post(
    '/',
    protect,
    useAuth(ConversationController.getOrCreateOneOnOneConversationHandler)
);

// GET /api/conversations/ - List all conversations for the current user
router.get(
    '/',
    protect,
    useAuth(ConversationController.listUserConversationsHandler)
);

// GET /api/conversations/{conversationId} - Get details of a specific conversation (includes participants, last message)
// This might be redundant if listUserConversationsHandler provides enough detail,
// but can be useful for fetching a single conversation's current state.
router.get(
    '/:conversationId',
    protect,
    useAuth(ConversationController.getConversationByIdHandler)
)


// === Message Routes (within a Conversation) ===

// GET /api/conversations/{conversationId}/messages - Get messages for a specific conversation
router.get(
    '/:conversationId/messages',
    protect,
    useAuth(MessageController.getMessagesHandler)
);

// POST /api/conversations/{conversationId}/messages - Send a new message in a conversation
// Body: { "content_text": "Hello!", "content_image_url": "...", ... }
router.post(
    '/:conversationId/messages',
    protect,
    useAuth(MessageController.sendMessageHandler)
);

// POST /api/conversations/{conversationId}/read - Mark the conversation as read for the current user
router.post(
    '/:conversationId/read',
    protect,
    useAuth(MessageController.markAsReadHandler)
);

export default router;
