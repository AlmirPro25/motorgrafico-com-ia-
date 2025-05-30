import { User, PublicUserProfile } from './user.types';

export type PostPrivacy = 'public' | 'friends' | 'private'; // 'friends' might be limited initially

export interface Post {
  id: string; // UUID
  user_id: string; // Foreign key to Users table
  content_text?: string;
  content_image_url?: string;
  content_video_url?: string;
  privacy_level: PostPrivacy; // For non-group posts. Group posts might have inherent group privacy.
  original_post_id?: string; // For shared posts, references the original Post
  group_id?: string; // Foreign key to Groups table, if this is a group post
  created_at: Date;
  updated_at: Date;

  // Optional, to be populated by queries/services
  author?: PublicUserProfile;
  like_count?: number;
  comment_count?: number;
  is_liked_by_user?: boolean; // Indicates if the current user liked this post
  tagged_users?: PublicUserProfile[];
  original_post_details?: Post; // For shared posts
}

export interface PostTaggedUser {
  post_id: string; // Foreign key to Posts table
  user_id: string; // Foreign key to Users table (the tagged user)
  created_at: Date;
}

// Data Transfer Object for creating a new post
export interface CreatePostDTO {
  user_id: string;
  content_text?: string;
  content_image_url?: string;
  content_video_url?: string;
  privacy_level: PostPrivacy; // For non-group posts
  tagged_user_ids?: string[]; // Array of user IDs to be tagged
  group_id?: string; // For creating a post within a group
}

// Data Transfer Object for updating an existing post
export interface UpdatePostDTO {
  content_text?: string;
  content_image_url?: string;
  content_video_url?: string;
  privacy_level?: PostPrivacy; // For non-group posts
  tagged_user_ids?: string[]; // For updating/replacing tagged users
  // group_id typically not updatable for a post (cannot move between groups)
}

// Data Transfer Object for sharing a post
export interface SharePostDTO {
  user_id: string; // User who is sharing the post
  original_post_id: string;
  content_text?: string; // Optional: user can add their own commentary
  privacy_level: PostPrivacy;
}

// For paginated results
export interface PaginatedPosts {
    posts: Post[];
    total: number;
    page: number;
    limit: number;
}

export interface PaginationOptions {
    page?: number;
    limit?: number;
}
