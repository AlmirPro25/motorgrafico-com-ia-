import express, { Application, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';

dotenv.config(); // Load environment variables from .env file

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Import Routers
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import postRoutes from './routes/post.routes';
import commentRoutes from './routes/comment.routes';
import storyRoutes from './routes/story.routes';
import conversationRoutes from './routes/conversation.routes';
import friendRoutes from './routes/friend.routes';
import eventRoutes from './routes/event.routes';
import eventCommentRoutes from './routes/eventComment.routes';
import groupRoutes from './routes/group.routes';
import marketplaceRoutes from './routes/marketplace.routes';
import settingsRoutes from './routes/settings.routes'; // Import settings routes

// Basic Route
app.get('/', (req: Request, res: Response) => {
  res.send('SocialConnect API is running!');
});

// Mount Routers
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/event-comments', eventCommentRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/settings', settingsRoutes); // Mount settings routes

// Global Error Handler (Improved)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Global Error Handler:', err);

  // Default error status and message
  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected error occurred.';

  // Customize error messages for known error types (e.g., from specific libraries or custom errors)
  if (err.name === 'UnauthorizedError') { // Example: error from express-jwt if used
    statusCode = 401;
    message = 'Invalid token or not authenticated.';
  } else if (err.type === 'entity.parse.failed') { // Example: JSON parsing error from body-parser
    statusCode = 400;
    message = 'Malformed JSON in request body.';
  }
  // Add more specific error handling as needed

  res.status(statusCode).json({ error: message });
});

// Import database test connection function
import { testConnection } from './config/db';
import { createServer } from 'http'; // Import createServer
import { setupSocketIO } from './socket/socket.setup'; // Import Socket.IO setup

const httpServer = createServer(app); // Create HTTP server from Express app

// Initialize Socket.IO
const io = setupSocketIO(httpServer);

httpServer.listen(PORT, async () => { // Listen on the http server, not app
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server is running and listening on same port.`);
  // Test database connection on startup
  if (process.env.NODE_ENV !== 'test') { // Avoid running during automated tests if DB is not set up
    await testConnection();
  }
});

// Export app and io for potential testing or other uses, though typically app is main export
export { app, io, httpServer };
