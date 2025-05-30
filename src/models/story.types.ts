import { PublicUserProfile } from './user.types'; // For author details

export interface Story {
  id: string; // UUID
  user_id: string; // Foreign key to Users table
  content_image_url?: string;
  content_video_url?: string;
  content_text?: string; // Optional text overlay or text-only story
  background_color?: string; // For text-only stories
  font_style?: string; // For text-only stories
  expires_at: Date; // Should be set to 24 hours from creation_time
  created_at: Date;
  updated_at: Date; // Might not be frequently updated, but good practice to have

  // Optional, to be populated by queries/services
  author?: PublicUserProfile;
  is_viewed_by_user?: boolean; // Indicates if the current user has viewed this story
  view_count?: number; // Optional: if tracking view counts
}

export interface StoryView {
  story_id: string; // Foreign key to Stories table
  user_id: string; // Foreign key to Users table (the viewer)
  viewed_at: Date;
}

// Data Transfer Object for creating a new story
export interface CreateStoryDTO {
  user_id: string;
  content_image_url?: string;
  content_video_url?: string;
  content_text?: string;
  background_color?: string;
  font_style?: string;
  // expires_at will be set by the backend
}

// For paginated results (though stories are often not heavily paginated in feeds, more like grouped by user)
export interface PaginatedStories {
    stories_by_user: { [userId: string]: Story[] }; // Group stories by user
    // Or a flat list if preferred for initial feed
    // stories: Story[];
    // total_users_with_stories: number; // if paginating by users with stories
    // Consider cursor-based pagination if feed is very long
}

export interface StoryFeedOptions {
    limit_per_user?: number; // Max stories to show per user in the feed
    // cursor?: string; // For cursor-based pagination
    // page?: number; // if using page-based pagination for users with stories
    // limit?: number; // if using page-based pagination for users with stories
}
