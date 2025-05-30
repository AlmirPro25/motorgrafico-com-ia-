import { Request, Response, NextFunction } from 'express';
import * as AuthService from '../services/auth.service';
import * as UserService from '../services/user.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware'; // For req.user

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Basic validation (can be expanded with a validation library like Joi or class-validator)
    const { email, handle, password, first_name, last_name } = req.body;
    if (!email || !handle || !password) {
      return res.status(400).json({ error: 'Email, handle, and password are required.' });
    }
    if (password.length < 6) { // Example: Minimum password length
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const result = await AuthService.registerUser({
      email,
      handle,
      password_raw: password,
      first_name,
      last_name,
    });
    // Typically, a 201 Created status is used for successful registration
    res.status(201).json(result);
  } catch (error) {
    // Log the error for server-side inspection
    console.error('Registration error:', error);
    // Send a user-friendly error message
    if (error instanceof Error) {
        // Check for specific error messages from the service
        if (error.message.includes('already exists')) {
            return res.status(409).json({ error: error.message }); // 409 Conflict
        }
        return res.status(400).json({ error: error.message }); // Other client-side errors
    }
    res.status(500).json({ error: 'An unexpected error occurred during registration.' });
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { emailOrHandle, password } = req.body;
    if (!emailOrHandle || !password) {
      return res.status(400).json({ error: 'Email/handle and password are required.' });
    }

    const result = await AuthService.loginUser({
      emailOrHandle,
      password_raw: password,
    });
    res.status(200).json(result);
  } catch (error) {
    console.error('Login error:', error);
    if (error instanceof Error) {
        if (error.message.includes('Invalid credentials')) {
             return res.status(401).json({ error: error.message }); // 401 Unauthorized
        }
        return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'An unexpected error occurred during login.' });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: 'Not authenticated or user ID missing from token.' });
    }
    const userId = req.user.userId;
    const userProfile = await UserService.getAuthenticatedUserProfile(userId);

    if (!userProfile) {
      return res.status(404).json({ error: 'Authenticated user profile not found.' });
    }
    res.status(200).json(userProfile);
  } catch (error) {
    console.error('GetMe error:', error);
    if (error instanceof Error) {
        return res.status(500).json({ error: error.message });
    }
    res.status(500).json({ error: 'An unexpected error occurred while fetching user profile.' });
  }
};
