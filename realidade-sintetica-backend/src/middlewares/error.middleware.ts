import { Request, Response, NextFunction } from 'express';

// Interface for a generic error with a status code
interface HttpError extends Error {
  status?: number;
  isOperational?: boolean; // Optional: for distinguishing handled errors
}

export const errorHandler = (
  err: HttpError,
  req: Request,
  res: Response,
  next: NextFunction // next is required for Express to recognize it as an error handler
): void => {
  console.error('ERROR STACK:', err.stack); // Log error stack for debugging (consider a more robust logger)

  const statusCode = err.status || 500;
  const message = err.isOperational ? err.message : 'An unexpected internal server error occurred.';
  
  // Avoid sending detailed error messages to client in production for non-operational errors
  const responseMessage = (process.env.NODE_ENV === 'production' && !err.isOperational) 
    ? 'Internal Server Error' 
    : message;

  res.status(statusCode).json({
    status: 'error',
    statusCode: statusCode,
    message: responseMessage,
    // Optionally include stack in development
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Optional: A utility class for operational errors
export class AppError extends Error implements HttpError {
  public readonly status: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.status = statusCode;
    this.isOperational = true; // Mark as an operational error (e.g., user input error)

    Error.captureStackTrace(this, this.constructor); // Preserve stack trace
  }
}

// Optional: Middleware for handling 404 Not Found errors
export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new AppError('API endpoint not found', 404);
  next(error);
};
