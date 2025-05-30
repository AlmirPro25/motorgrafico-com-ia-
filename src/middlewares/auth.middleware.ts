import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in .env file for auth middleware.");
  process.exit(1);
}

// Extend Express Request type to include user payload from JWT
export interface AuthenticatedRequest extends Request {
  user?: { // This structure should match your JWT payload
    userId: string;
    email: string;
    handle: string;
  };
}

export const protect = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  let token;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  // Alternatively, allow token from cookies if you plan to support web sessions
  // else if (req.cookies.token) {
  //   token = req.cookies.token;
  // }

  if (!token) {
    return res.status(401).json({ error: 'Not authorized, no token' });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET!) as { userId: string; email: string; handle: string; iat: number; exp: number };
    
    // Attach user to request object.
    // You might want to fetch fresh user data from DB here to ensure user still exists / is active
    // For now, we'll just use the payload from the token.
    req.user = {
        userId: decoded.userId,
        email: decoded.email,
        handle: decoded.handle
    };

    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    // Handle specific JWT errors
    if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({ error: 'Not authorized, token expired' });
    }
    if (error instanceof jwt.JsonWebTokenError) {
        return res.status(401).json({ error: 'Not authorized, token invalid' });
    }
    return res.status(401).json({ error: 'Not authorized, token failed' });
  }
};
