import { Request, Response, NextFunction } from 'express';
import * as UserService from '../services/user.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { UserProfileUpdateDTO } from '../models/user.types';

export const getUserPublicProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userIdOrHandle } = req.params;
    if (!userIdOrHandle) {
      return res.status(400).json({ error: 'User ID or Handle is required.' });
    }

    const userProfile = await UserService.getUserProfile(userIdOrHandle);

    if (!userProfile) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.status(200).json(userProfile);
  } catch (error) {
    console.error('GetUserPublicProfile error:', error);
    if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
    }
    res.status(500).json({ error: 'An unexpected error occurred while fetching user profile.' });
  }
};

export const updateAuthenticatedUserProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Not authenticated or user ID missing from token.' });
    }
    const userId = req.user.userId;
    const updateData = req.body as UserProfileUpdateDTO;

    // Basic validation: Ensure at least one field is being updated if that's a requirement
    if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: 'No update data provided.' });
    }
    // More specific validation can be added here (e.g., for data types, lengths)

    const updatedUserProfile = await UserService.updateUserProfile(userId, updateData);

    if (!updatedUserProfile) {
      // This case might indicate the user was not found during the update, which shouldn't happen if token is valid
      return res.status(404).json({ error: 'User not found or update failed.' });
    }
    res.status(200).json(updatedUserProfile);
  } catch (error) {
    console.error('UpdateAuthenticatedUserProfile error:', error);
    if (error instanceof Error) {
        // Handle specific errors from service if any (e.g., validation errors)
        return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'An unexpected error occurred while updating user profile.' });
  }
};
