import { Request, Response, NextFunction } from 'express';
import *. StoryService from '../services/story.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { CreateStoryDTO, StoryFeedOptions } from '../models/story.types';

export const createStoryHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const storyData: CreateStoryDTO = {
            user_id: req.user.userId,
            content_image_url: req.body.content_image_url,
            content_video_url: req.body.content_video_url,
            content_text: req.body.content_text,
            background_color: req.body.background_color,
            font_style: req.body.font_style,
        };

        if (!storyData.content_image_url && !storyData.content_video_url && !storyData.content_text) {
            return res.status(400).json({ error: 'Story content (image, video, or text) is required.' });
        }
        // Additional validation for text-only stories (e.g., requiring background_color) can be added here or in service.

        const story = await StoryService.createNewStory(storyData);
        res.status(201).json(story);
    } catch (error) {
        console.error('Create Story Error:', error);
        if (error instanceof Error && (error.message.includes('not found') || error.message.includes('required'))) {
            return res.status(400).json({ error: error.message });
        }
        next(error);
    }
};

export const getStoryFeedHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated for story feed.' });
        }
        // Basic options, can be expanded (e.g. from req.query)
        const options: StoryFeedOptions = {
            limit_per_user: req.query.limit_per_user ? parseInt(req.query.limit_per_user as string, 10) : 3,
        };

        const stories = await StoryService.getStoriesForFeed(req.user.userId, options);
        // The service currently returns a flat list. If it returns grouped by user, adjust response.
        res.status(200).json(stories);
    } catch (error) {
        next(error);
    }
};

// Handler for getting stories by a specific user ID (to be mounted on user.routes.ts)
export const getUserStoriesHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { userId: targetUserId } = req.params;
        const currentUserId = (req as AuthenticatedRequest).user?.userId; // Optional, for viewer status
        const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 20;


        const stories = await StoryService.getActiveStoriesForUser(targetUserId, currentUserId, limit);
        res.status(200).json(stories);
    } catch (error) {
        if (error instanceof Error && error.message.includes('Target user not found')) {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
};

export const deleteStoryHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { storyId } = req.params;
        const success = await StoryService.deleteUserStory(storyId, req.user.userId);
        if (!success) {
            // This case should ideally be caught by service layer throwing specific errors
            return res.status(404).json({ error: 'Story not found or deletion failed.' });
        }
        res.status(204).send(); // No content
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};

// ---- Optional StoryView Controller Functions ----
export const markStoryViewedHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { storyId } = req.params;
        await StoryService.markStoryAsViewed(storyId, req.user.userId);
        res.status(204).send(); // No content, success
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            // Add more specific error checks if StoryService throws them (e.g., story expired)
        }
        next(error);
    }
};

export const getStoryViewersHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const { storyId } = req.params;
        const viewers = await StoryService.getStoryViewers(storyId, req.user.userId);
        res.status(200).json(viewers);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('not authorized')) return res.status(403).json({ error: error.message });
        }
        next(error);
    }
};
