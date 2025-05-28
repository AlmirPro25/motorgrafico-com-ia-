import express, { Express, Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import cors from 'cors'; // Import cors package
// Import Prisma client instance (to be created in src/config or src/core/database.ts, for now, this is a placeholder)
// import prismaClient from './config/database'; 

// Import routes
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/users.routes';
import projectRoutes from './routes/projects.routes';
// Import error handling middleware (to be created)
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';

dotenv.config(); // Load environment variables from .env file

const app: Express = express();
const PORT = process.env.PORT || 3001; // Default to 3001 if PORT not in .env

// Middlewares
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

// Use CORS package
app.use(cors()); // Basic CORS setup, allows all origins by default

// API Routes
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'UP', message: 'Backend is healthy' });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/projects', projectRoutes); // This includes nested asset routes as per projects.routes.ts

// Handle 404 Not Found for any routes not matched above
app.use(notFoundHandler);

// Global error handler (must be the last middleware)
app.use(errorHandler);

// Function to start the server
const startServer = async () => {
  try {
    // Placeholder: Connect to database (e.g., await prismaClient.$connect();)
    // console.log('Connected to database.');

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    // Placeholder: Disconnect database if connection was established (e.g., await prismaClient.$disconnect();)
    process.exit(1);
  }
};

// Graceful shutdown (optional but good practice)
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach(signal => {
  process.on(signal, async () => {
    console.log(`
Received ${signal}, shutting down gracefully...`);
    // Placeholder: Disconnect database (e.g., await prismaClient.$disconnect();)
    // console.log('Disconnected from database.');
    process.exit(0);
  });
});

startServer();

export default app; // Export app for potential testing or other uses
