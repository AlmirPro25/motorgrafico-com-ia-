import { PublicUserProfile } from "./user.types";

export interface Message {
  id: string; // UUID
  conversation_id: string; // Foreign key to Conversations table
  sender_id: string; // Foreign key to Users table (user who sent the message)
  content_text?: string;
  content_image_url?: string;
  content_video_url?: string;
  // reactions?: Reaction[]; // Future feature
  created_at: Date;
  updated_at: Date; // For edits, though chat messages are often immutable

  // Populated by services/queries
  sender?: PublicUserProfile;
  // is_read_by_recipients?: boolean; // Complex to track per recipient in group chats
}

// DTO for sending a new message
export interface SendMessageDTO {
  conversation_id: string;
  sender_id: string;
  content_text?: string;
  content_image_url?: string;
  content_video_url?: string;
}

export interface PaginatedMessages {
    messages: Message[];
    total: number;
    page: number;
    limit: number;
    // cursor?: string; // For cursor-based pagination
}

export interface MessagePaginationOptions {
    page?: number;
    limit?: number;
    before_message_id?: string; // For fetching messages older than a certain message (cursor-like)
    after_message_id?: string;  // For fetching messages newer (less common for typical chat load)
}
