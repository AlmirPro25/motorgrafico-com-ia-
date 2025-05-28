import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string({
    required_error: 'Project name is required.',
    invalid_type_error: 'Project name must be a string.',
  }).min(3, { message: 'Project name must be at least 3 characters long.' }).max(255, { message: 'Project name must be at most 255 characters long.' }),
  description: z.string().max(1000, { message: 'Description must be at most 1000 characters long.' }).optional(),
  settings: z.record(z.string(), z.any()).optional(), // Allows any JSON-like object for settings. Changed z.record(z.any()) to z.record(z.string(), z.any()) as z.any() is not a valid value for record.
  thumbnailUrl: z.string().url({ message: "Invalid URL format for thumbnail." }).optional(),
  category: z.string().min(1).max(50, { message: 'Category must be at most 50 characters long.' }).optional(),
  tags: z.array(z.string().min(1).max(50, { message: 'Each tag must be at most 50 characters long.' })).max(20, { message: 'You can have at most 20 tags.' }).optional(), // Array of strings, max 20 tags, each tag max 50 chars
  isPublic: z.boolean().optional(),
});

// Type alias for validated data
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
