import { PublicUserProfile } from './user.types';

export interface Comment {
  id: string; // UUID
  post_id: string; // Foreign key to Posts table
  user_id: string; // Foreign key to Users table (author of the comment)
  parent_comment_id?: string; // For threaded comments (optional feature)
  content_text: string;
  created_at: Date;
  updated_at: Date;

  // Optional, to be populated
  author?: PublicUserProfile;
}

// Data Transfer Object for creating a new comment
export interface CreateCommentDTO {
  post_id: string;
  user_id: string;
  parent_comment_id?: string;
  content_text: string;
}

// Data Transfer Object for updating an existing comment
export interface UpdateCommentDTO {
  content_text: string;
}

// For paginated results
export interface PaginatedComments {
    comments: Comment[];
    total: number;
    page: number;
    limit: number;
}
