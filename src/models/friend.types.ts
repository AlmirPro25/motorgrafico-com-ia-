import { PublicUserProfile } from './user.types';

export type FriendRequestStatus = 'pending' | 'accepted' | 'declined' | 'blocked' | 'unfriended';
// 'blocked' might be handled by a separate block list feature, but can be a status here.
// 'unfriended' can be a status to signify a past friendship.

export interface FriendRequest {
  id: string; // UUID
  requester_id: string; // Foreign key to Users table
  receiver_id: string; // Foreign key to Users table
  status: FriendRequestStatus;
  requested_at: Date; // When the request was sent
  responded_at?: Date; // When the request was accepted/declined

  // Populated by services/queries
  requester_profile?: PublicUserProfile;
  receiver_profile?: PublicUserProfile;
}

// DTO for sending a new friend request
export interface SendFriendRequestDTO {
  requesterId: string;
  receiverId: string;
}

export interface FriendListPaginationOptions {
    page?: number;
    limit?: number;
}

// For paginated friend lists or friend requests
export interface PaginatedFriendList {
    friends: PublicUserProfile[]; // A list of users who are friends
    total: number;
    page: number;
    limit: number;
}

export interface PaginatedFriendRequests {
    requests: FriendRequest[];
    total: number;
    page: number;
    limit: number;
}
