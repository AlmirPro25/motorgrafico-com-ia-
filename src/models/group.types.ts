import { PublicUserProfile } from './user.types';
import { Post, PaginationOptions as PostPaginationOptions } from './post.types'; // For group posts

export type GroupType = 'public' | 'private'; // 'secret' could be another type
export type GroupMemberRole = 'admin' | 'moderator' | 'member';
export type GroupJoinRequestStatus = 'pending' | 'approved' | 'declined';

export interface Group {
  id: string; // UUID
  creator_id: string; // Foreign key to Users table
  name: string;
  description?: string;
  profile_picture_url?: string;
  cover_photo_url?: string;
  type: GroupType;
  created_at: Date;
  updated_at: Date;

  // Populated by services/queries
  member_count?: number;
  is_member?: boolean; // For current user
  current_user_role?: GroupMemberRole; // For current user
  pending_join_request?: boolean; // If current user has a pending request for a private group
}

export interface GroupMember {
  group_id: string; // Foreign key to Groups table
  user_id: string; // Foreign key to Users table
  role: GroupMemberRole;
  joined_at: Date;

  // Populated
  user_profile?: PublicUserProfile;
}

export interface GroupJoinRequest {
  id: string; // UUID
  group_id: string; // Foreign key to Groups table
  user_id: string; // Foreign key to Users table (user requesting to join)
  status: GroupJoinRequestStatus;
  requested_at: Date;
  resolved_at?: Date;
  resolved_by_user_id?: string; // Admin/Moderator who approved/declined

  // Populated
  user_profile?: PublicUserProfile;
  resolver_profile?: PublicUserProfile;
}

// DTOs
export interface CreateGroupDTO {
  creator_id: string;
  name: string;
  description?: string;
  profile_picture_url?: string;
  cover_photo_url?: string;
  type: GroupType;
}

export interface UpdateGroupDTO {
  name?: string;
  description?: string;
  profile_picture_url?: string;
  cover_photo_url?: string;
  type?: GroupType; // Changing group type can have implications
}

export interface AddMemberDTO { // For admin adding a member directly
    groupId: string;
    userId: string;
    role: GroupMemberRole; // Admin specifies role
}

export interface UpdateMemberRoleDTO {
    role: GroupMemberRole;
}


// Filter options for listing groups
export interface GroupFilterOptions {
  type?: GroupType; // 'public', 'private'
  user_is_member?: string; // User ID to filter groups they are a member of
  discoverable?: boolean; // True if looking for groups user is not part of (usually public)
}

export interface GroupPaginationOptions {
    page?: number;
    limit?: number;
}

export interface PaginatedGroups {
    groups: Group[];
    total: number;
    page: number;
    limit: number;
}

export interface PaginatedGroupMembers {
    members: GroupMember[]; // Or PublicUserProfile[] with role info
    total: number;
    page: number;
    limit: number;
}

export interface PaginatedGroupJoinRequests {
    requests: GroupJoinRequest[];
    total: number;
    page: number;
    limit: number;
}

// For creating a post within a group context
export interface CreateGroupPostDTO extends Omit<CreatePostDTO, 'user_id' | 'privacy_level' | 'tagged_user_ids'> {
    // user_id, privacy_level, tagged_user_ids are handled by group context
    // privacy_level for group posts might be 'group_members_only' or follow post privacy within group context.
}
