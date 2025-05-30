import { User, PublicUserProfile } from './user.types';
import { Message } from './message.types'; // Will create this next

export type ConversationType = 'one_on_one' | 'group';

export interface Conversation {
  id: string; // UUID
  type: ConversationType;
  created_by_user_id?: string; // Optional: user_id who initiated (especially for one_on_one)
  title?: string; // For group chats
  last_message_id?: string; // To quickly fetch the last message object
  created_at: Date;
  updated_at: Date; // Should be updated when a new message is sent or participants change

  // Populated by services/queries
  participants?: PublicUserProfile[];
  last_message?: Message; // The actual last message object
  unread_count?: number; // For the current user viewing the conversation list
}

export interface ConversationParticipant {
  conversation_id: string; // Foreign key to Conversations table
  user_id: string; // Foreign key to Users table
  last_read_at?: Date; // Timestamp of when the user last read messages in this conversation
  joined_at: Date;
  // role?: 'admin' | 'member'; // For group chats
}

// DTO for creating a new one-on-one conversation (implicitly)
export interface CreateOneOnOneConversationDTO {
  currentUserId: string; // User initiating or requesting the conversation
  targetUserId: string;  // The other participant
}

// DTO for creating a group conversation (future use)
// export interface CreateGroupConversationDTO {
//   creatorUserId: string;
//   participantUserIds: string[];
//   title?: string;
// }

export interface PaginatedConversations {
    conversations: Conversation[];
    total: number;
    page: number;
    limit: number;
}

export interface ConversationPaginationOptions {
    page?: number;
    limit?: number;
}
