import { Request, Response, NextFunction } from 'express';
import * as UserSettingsService from '../services/user.settings.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { UserSettings } from '../models/user.types';

export const getCurrentUserSettingsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        const settings = await UserSettingsService.getUserSettings(req.user.userId);
        if (!settings) {
            // This case should be rare if defaults are created on registration and service handles it.
            return res.status(404).json({ error: 'User settings not found.' });
        }
        res.status(200).json(settings);
    } catch (error) {
        if (error instanceof Error && error.message.includes('User not found')) {
            return res.status(404).json({ error: error.message });
        }
        next(error);
    }
};

export const updateCurrentUserSettingsHandler = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: 'User not authenticated.' });
        }
        
        // Explicitly pick allowed fields to prevent unwanted updates
        const {
            is_private,
            notifications_on,
            privacy_future_posts,
            privacy_friend_requests,
            privacy_show_friend_list,
            notifications_push_enabled,
            theme,
            language
        } = req.body;

        const settingsData: Partial<Omit<UserSettings, 'user_id' | 'created_at' | 'updated_at'>> = {};

        if (is_private !== undefined) settingsData.is_private = is_private;
        if (notifications_on !== undefined) settingsData.notifications_on = notifications_on;
        if (privacy_future_posts !== undefined) settingsData.privacy_future_posts = privacy_future_posts;
        if (privacy_friend_requests !== undefined) settingsData.privacy_friend_requests = privacy_friend_requests;
        if (privacy_show_friend_list !== undefined) settingsData.privacy_show_friend_list = privacy_show_friend_list;
        if (notifications_push_enabled !== undefined) settingsData.notifications_push_enabled = notifications_push_enabled;
        if (theme !== undefined) settingsData.theme = theme;
        if (language !== undefined) settingsData.language = language;
        
        if (Object.keys(settingsData).length === 0) {
            return res.status(400).json({ error: 'No valid settings data provided for update.' });
        }

        const updatedSettings = await UserSettingsService.updateUserSettings(req.user.userId, settingsData);
        res.status(200).json(updatedSettings);
    } catch (error) {
        if (error instanceof Error) {
            if (error.message.includes('User not found')) return res.status(404).json({ error: error.message });
            if (error.message.includes('Invalid') || error.message.includes('must be a boolean')) {
                return res.status(400).json({ error: error.message });
            }
        }
        next(error);
    }
};
