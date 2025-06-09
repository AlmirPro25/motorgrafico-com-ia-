export interface User {
  id: string; // UUID
  handle: string;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  bio?: string;
  profile_picture_url?: string;
  created_at: Date;
  updated_at: Date;
  is_online?: boolean;
  last_seen_at?: Date;
}

export type UserTheme = 'light' | 'dark' | 'system';
export type PostPrivacySetting = 'public' | 'friends' | 'private'; // Default privacy for new posts

export interface UserSettings {
  user_id: string; // Foreign key to Users table
  is_private: boolean; // General profile privacy (deprecated or used alongside specific privacies)
  notifications_on: boolean; // General toggle for all push/email notifications (deprecated or used as master switch)

  // New specific privacy settings
  privacy_future_posts: PostPrivacySetting; // Default privacy for new posts by this user
  privacy_friend_requests: 'everyone' | 'friends_of_friends' | 'nobody';
  privacy_show_friend_list: 'everyone' | 'friends' | 'private'; // Who can see user's friend list
  // privacy_show_groups?: 'everyone' | 'friends' | 'private'; // Who can see user's group memberships
  // privacy_direct_messages?: 'everyone' | 'friends' | 'nobody'; // Who can send direct messages

  // Notification preferences (more granular can be added later)
  notifications_push_enabled: boolean; // Master switch for push notifications
  // notifications_email_enabled: boolean; // Master switch for email
  // notifications_new_follower?: boolean;
  // notifications_friend_request?: boolean;
  // notifications_post_like?: boolean;
  // notifications_comment_on_post?: boolean;
  // notifications_message_received?: boolean;
  // notifications_event_invitation?: boolean;
  // notifications_group_invitation?: boolean;


  // Personalization
  theme: UserTheme;
  language: string; // e.g., 'en-US', 'es-ES'

  created_at: Date;
  updated_at: Date;
}

// For registration, we might not have all User fields initially
export type NewUserDTO = Pick<User, 'email' | 'handle' | 'password_hash' | 'first_name' | 'last_name'>;

// For user profile updates
export type UserProfileUpdateDTO = Partial<Pick<User, 'first_name' | 'last_name' | 'bio' | 'profile_picture_url'>>;

// For user settings updates
export type UserSettingsUpdateDTO = Partial<Pick<UserSettings, 'is_private' | 'notifications_on'>>;

// Data returned after login or for /me endpoint (excluding password)
export type AuthenticatedUser = Omit<User, 'password_hash'> & {
  settings?: UserSettings; // Optional: include settings for /me endpoint
  is_online?: boolean; // Propagate presence status
  last_seen_at?: Date; // Propagate presence status
};

// Public user profile
export type PublicUserProfile = Omit<User, 'password_hash' | 'email' | 'updated_at'> & {
  is_online?: boolean; // Propagate presence status
  last_seen_at?: Date; // Propagate presence status
};
