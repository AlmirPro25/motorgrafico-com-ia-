import { Router } from 'express';
import * as EventController from '../controllers/event.controller';
import { protect, AuthenticatedRequest } from '../middlewares/auth.middleware';

const router = Router();

// Helper for casting request for authenticated routes
const useAuth = <TParams = any, TResBody = any, TReqBody = any, TReqQuery = any>(
    handler: (req: AuthenticatedRequest<TParams, TResBody, TReqBody, TReqQuery>, res: Response, next: NextFunction) => Promise<void>
) => {
    return (req: Request<TParams, TResBody, TReqBody, TReqQuery>, res: Response, next: NextFunction) =>
        handler(req as AuthenticatedRequest<TParams, TResBody, TReqBody, TReqQuery>, res, next);
};


// === Event Routes ===
// POST /api/events/ - Create a new event
router.post('/', protect, useAuth(EventController.createEventHandler));

// GET /api/events/ - List all events with filters
// Filters via query params: ?type=upcoming&category=Music&creator_id=...&attending_user_id=...
router.get('/', EventController.listEventsHandler); // Public, but service layer applies privacy based on auth

// GET /api/events/{eventId} - Get details of a specific event
router.get('/:eventId', EventController.getEventHandler); // Public, service layer applies privacy

// PUT /api/events/{eventId} - Update an event
router.put('/:eventId', protect, useAuth(EventController.updateEventHandler));

// DELETE /api/events/{eventId} - Delete an event
router.delete('/:eventId', protect, useAuth(EventController.deleteEventHandler));


// === Event RSVP Routes ===
// POST /api/events/{eventId}/rsvp - RSVP to an event
// Body: { "status": "going" | "interested" | "not_going" }
router.post('/:eventId/rsvp', protect, useAuth(EventController.rsvpEventHandler));

// GET /api/events/{eventId}/participants - List participants for an event
// Query params: ?status=going,interested (comma-separated)
router.get('/:eventId/participants', EventController.getParticipantsHandler); // Public, event privacy applies


// === Event Comment Routes (nested under event) ===
// POST /api/events/{eventId}/comments - Create a new comment on an event
// Body: { "content_text": "Great event!", "parent_comment_id": "..." }
router.post('/:eventId/comments', protect, useAuth(EventController.createEventCommentHandler));

// GET /api/events/{eventId}/comments - Get all comments for a specific event
router.get('/:eventId/comments', EventController.getEventCommentsHandler); // Public, event privacy applies

export default router;
