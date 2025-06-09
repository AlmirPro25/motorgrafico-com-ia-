import { Request, Response, NextFunction } from 'express';
import * as EventService from '../services/event.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import {
  CreateEventDTO, UpdateEventDTO, RsvpDTO, CreateEventCommentDTO, UpdateEventCommentDTO,
  EventFilterOptions, EventPaginationOptions, RsvpStatus
} from '../models/event.types';

const getPaginationOptions = (req: Request): EventPaginationOptions => {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    return { page: Math.max(1, page), limit: Math.max(1, Math.min(50, limit)) };
};

// --- Event Handlers ---
export const createEventHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const dto: CreateEventDTO = { ...req.body, creator_id: req.user.userId };

        // Basic validation (more in service)
        if (!dto.title || !dto.start_time || !dto.privacy) {
            return res.status(400).json({ error: 'Title, start_time, and privacy are required.' });
        }
        const event = await EventService.createNewEvent(dto);
        res.status(201).json(event);
    } catch (error) {
        if (error instanceof Error && (error.message.includes('not found') || error.message.includes('Invalid') || error.message.includes('cannot be'))) {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
};

export const listEventsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUserId = (req as AuthenticatedRequest).user?.userId;
        const filters: EventFilterOptions = {
            type: req.query.type as EventFilterOptions['type'] || 'upcoming',
            creator_id: req.query.creator_id as string,
            attending_user_id: req.query.attending_user_id as string,
            category: req.query.category as string,
            // Privacy filter handled by service based on currentUserId
        };
        const pagination = getPaginationOptions(req);
        const events = await EventService.getAllEvents(filters, pagination, currentUserId);
        res.status(200).json(events); // TODO: Add pagination metadata
    } catch (error) {
        next(error);
    }
};

export const getEventHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUserId = (req as AuthenticatedRequest).user?.userId;
        const event = await EventService.getEventById(req.params.eventId, currentUserId);
        if (!event) return res.status(404).json({ error: 'Event not found or not accessible.' });
        res.status(200).json(event);
    } catch (error) {
        next(error);
    }
};

export const updateEventHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const dto: UpdateEventDTO = req.body;
        if (Object.keys(dto).length === 0) {
            return res.status(400).json({ error: 'No update data provided.'});
        }
        const event = await EventService.updateExistingEvent(req.params.eventId, req.user.userId, dto);
        if (!event) return res.status(404).json({ error: 'Event not found or update failed.' }); // Should be caught by service
        res.status(200).json(event);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
            if (error.message.includes('Invalid') || error.message.includes('cannot be')) return res.status(400).json({ error: error.message });
        }
        next(error);
    }
};

export const deleteEventHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        await EventService.deleteExistingEvent(req.params.eventId, req.user.userId);
        res.status(204).send();
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};

// --- RSVP Handlers ---
export const rsvpEventHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const { status } = req.body;
        if (!status || !['going', 'interested', 'not_going'].includes(status as RsvpStatus)) {
            return res.status(400).json({ error: 'Valid RSVP status (going, interested, not_going) is required.' });
        }
        const rsvpData: RsvpDTO = { eventId: req.params.eventId, userId: req.user.userId, status: status as RsvpStatus };
        const rsvp = await EventService.rsvpToEvent(rsvpData);
        res.status(200).json(rsvp);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('not accessible')) return res.status(404).json({ error: error.message });
            if (error.message.includes('Invalid RSVP')) return res.status(400).json({ error: error.message });
        }
        next(error);
    }
};

export const getParticipantsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUserId = (req as AuthenticatedRequest).user?.userId;
        const pagination = getPaginationOptions(req);
        const rsvpFilter = req.query.status ? (req.query.status as string).split(',') as RsvpStatus[] : undefined;

        const participants = await EventService.getEventParticipants(req.params.eventId, pagination, rsvpFilter, currentUserId);
        res.status(200).json(participants); // TODO: Add pagination metadata
    } catch (error) {
        if (error instanceof Error && (error.message.includes('not found') || error.message.includes('not accessible'))) {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
};

// --- Event Comment Handlers ---
export const createEventCommentHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const dto: CreateEventCommentDTO = {
            ...req.body,
            event_id: req.params.eventId,
            user_id: req.user.userId,
        };
        if (!dto.content_text) return res.status(400).json({ error: 'Comment content_text is required.' });

        const comment = await EventService.createNewEventComment(dto);
        res.status(201).json(comment);
    } catch (error) {
         if (error instanceof Error) {
            if (error.message.includes('not found') || error.message.includes('not accessible') || error.message.includes('Parent comment')) {
                return res.status(400).json({ error: error.message });
            }
        }
        next(error);
    }
};

export const getEventCommentsHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const currentUserId = (req as AuthenticatedRequest).user?.userId;
        const pagination = getPaginationOptions(req);
        const comments = await EventService.getCommentsForEvent(req.params.eventId, pagination, currentUserId);
        res.status(200).json(comments); // TODO: Add pagination metadata
    } catch (error) {
        if (error instanceof Error && (error.message.includes('not found') || error.message.includes('not accessible'))) {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
};

export const updateEventCommentHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const { commentId } = req.params; // Assuming commentId is part of path for separate comment routes
                                         // If nested under event: req.params.commentId
        const dto: UpdateEventCommentDTO = req.body;
        if (!dto.content_text) return res.status(400).json({ error: 'Comment content_text is required.' });

        const comment = await EventService.updateExistingEventComment(commentId, req.user.userId, dto);
        if (!comment) return res.status(404).json({ error: 'Comment not found or update failed.' });
        res.status(200).json(comment);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
             if (error.message.includes('cannot be empty')) return res.status(400).json({ error: error.message });
        }
        next(error);
    }
};

export const deleteEventCommentHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) return res.status(401).json({ error: 'User not authenticated.' });
        const { commentId } = req.params; // Similar to update
        await EventService.deleteExistingEventComment(commentId, req.user.userId);
        res.status(204).send();
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};
