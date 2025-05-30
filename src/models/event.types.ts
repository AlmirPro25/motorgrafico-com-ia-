import { PublicUserProfile } from './user.types';

export type EventPrivacy = 'public' | 'private' | 'friends_only';
export type RsvpStatus = 'going' | 'interested' | 'not_going';

export interface Event {
  id: string; // UUID
  creator_id: string; // Foreign key to Users table
  title: string;
  description?: string;
  start_time: Date; // Store as TIMESTAMPTZ
  end_time?: Date;   // Store as TIMESTAMPTZ
  location_name?: string;
  location_address?: string;
  location_latitude?: number;
  location_longitude?: number;
  cover_image_url?: string;
  privacy: EventPrivacy;
  category?: string; // e.g., 'Music', 'Tech', 'Sports'
  created_at: Date;
  updated_at: Date;

  // Populated by services/queries
  creator_profile?: PublicUserProfile;
  participant_counts?: {
    going: number;
    interested: number;
    not_going: number; // Usually not displayed but can be tracked
  };
  current_user_rsvp?: RsvpStatus; // RSVP status of the logged-in user for this event
}

export interface EventParticipant {
  event_id: string; // Foreign key to Events table
  user_id: string; // Foreign key to Users table
  rsvp_status: RsvpStatus;
  attended?: boolean; // Optional: if tracking actual attendance
  rsvped_at: Date;

  // Populated by services/queries
  user_profile?: PublicUserProfile;
}

export interface EventComment {
  id: string; // UUID
  event_id: string; // Foreign key to Events table
  user_id: string; // Foreign key to Users table (comment author)
  parent_comment_id?: string; // For threaded comments
  content_text: string;
  created_at: Date;
  updated_at: Date;

  // Populated by services/queries
  author_profile?: PublicUserProfile;
}

// DTOs
export interface CreateEventDTO {
  creator_id: string;
  title: string;
  description?: string;
  start_time: string; // ISO 8601 string
  end_time?: string;   // ISO 8601 string
  location_name?: string;
  location_address?: string;
  location_latitude?: number;
  location_longitude?: number;
  cover_image_url?: string;
  privacy: EventPrivacy;
  category?: string;
}

export interface UpdateEventDTO {
  title?: string;
  description?: string;
  start_time?: string; // ISO 8601 string
  end_time?: string;   // ISO 8601 string
  location_name?: string;
  location_address?: string;
  location_latitude?: number;
  location_longitude?: number;
  cover_image_url?: string;
  privacy?: EventPrivacy;
  category?: string;
}

export interface RsvpDTO {
  eventId: string;
  userId: string;
  status: RsvpStatus;
}

export interface CreateEventCommentDTO {
  event_id: string;
  user_id: string;
  parent_comment_id?: string;
  content_text: string;
}

export interface UpdateEventCommentDTO {
  content_text: string;
}

// Filter options for listing events
export interface EventFilterOptions {
  type?: 'upcoming' | 'past' | 'all'; // Default 'upcoming'
  creator_id?: string; // Events created by a specific user
  attending_user_id?: string; // Events a specific user is 'going' or 'interested' in
  category?: string;
  privacy?: EventPrivacy[]; // e.g. ['public', 'friends_only']
}

export interface EventPaginationOptions {
    page?: number;
    limit?: number;
}

export interface PaginatedEvents {
    events: Event[];
    total: number;
    page: number;
    limit: number;
}

export interface PaginatedEventParticipants {
    participants: EventParticipant[]; // Often PublicUserProfile is returned directly for participants list
    total: number;
    page: number;
    limit: number;
}
export interface PaginatedEventComments {
    comments: EventComment[];
    total: number;
    page: number;
    limit: number;
}
