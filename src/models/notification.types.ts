import { PublicUserProfile } from "./user.types";

export type NotificationType =
  | 'new_like'
  | 'new_comment_on_post'
  | 'new_friend_request'
  | 'friend_request_accepted'
  | 'new_group_invite' // Future
  | 'group_request_approved' // Future
  | 'new_event_invitation' // Future
  | 'event_update' // Future
  | 'new_group_post' // Future (if user subscribed to group notifications)
  | 'new_marketplace_message' // Future
  | 'item_sold' // Future
  // System notifications
  | 'system_announcement';

// Represents the entity that triggered the notification (e.g., user who liked a post)
export interface NotificationActor extends PublicUserProfile {} // Re-use PublicUserProfile or a subset

// Represents the target of the action (e.g., the post that was liked/commented on)
export interface NotificationTarget {
  type: 'post' | 'comment' | 'user' | 'group' | 'event' | 'marketplace_item' | 'friend_request'; // Add more as needed
  id: string; // ID of the target entity
  title?: string; // e.g., post content snippet, group name, event title
  url?: string; // A direct link to the target, if applicable
}

export interface Notification {
  id: string; // UUID
  recipient_user_id: string; // User who should receive this notification
  actor_user_id?: string; // User who performed the action (null for system notifications)
  type: NotificationType;
  target_entity_type?: NotificationTarget['type']; // e.g., 'post', 'user'
  target_entity_id?: string; // ID of the post, comment, user, etc.
  message: string; // Pre-formatted message for display, or key for i18n
  read_at?: Date | null;
  created_at: Date;
  updated_at: Date;

  // Populated for payload
  actor_profile?: NotificationActor;
  target_details?: NotificationTarget; // Simplified for now, could be more complex
}

// DTO for creating a new notification in the DB
export interface CreateNotificationDTO {
  recipient_user_id: string;
  actor_user_id?: string;
  type: NotificationType;
  target_entity_type?: NotificationTarget['type'];
  target_entity_id?: string;
  message: string; // This message will be stored and can also be part of the emitted payload
}

// Payload for WebSocket emission (can be a processed version of Notification)
export interface NotificationWebSocketPayload {
  id: string;
  type: NotificationType;
  actor?: NotificationActor; // User who performed the action
  target?: NotificationTarget; // Entity related to notification (post, comment, other user)
  message: string; // Display message
  created_at: string; // ISO string
  read_at?: string | null; // ISO string
}

export interface UnreadNotificationsCount {
    unread_count: number;
}
