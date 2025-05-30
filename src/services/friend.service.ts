import * as FriendDB from '../models/friend.db';
import * as UserDB from '../models/user.db';
import * as UserSettingsDB from '../models/user.settings.db'; // Assuming this exists for UserSettings
import {
  FriendRequest,
  FriendRequestStatus,
  FriendListPaginationOptions,
  // PaginatedFriendRequests, PaginatedFriendList // If returning these structures
} from '../models/friend.types';
import { UserSettings } from '../models/user.types'; // Assuming UserSettings is here
import { PublicUserProfile } from '../models/user.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 15;

export const sendFriendRequest = async (requesterId: string, receiverId: string): Promise<FriendRequest> => {
  if (requesterId === receiverId) {
    throw new Error('Cannot send a friend request to oneself.');
  }

  // Validate users exist
  const requester = await UserDB.findUserById(requesterId);
  const receiver = await UserDB.findUserById(receiverId);
  if (!requester || !receiver) {
    throw new Error('One or both users not found.');
  }

  // Check for existing request (pending or accepted)
  const existingRequest = await FriendDB.findFriendRequestBetweenUsers(requesterId, receiverId);
  if (existingRequest) {
    if (existingRequest.status === 'pending') {
      throw new Error('A friend request is already pending between these users.');
    }
    if (existingRequest.status === 'accepted') {
      throw new Error('These users are already friends.');
    }
    // If declined/unfriended, allow sending a new one (or handle as per product decision)
  }
  
  // Check receiver's privacy settings for friend requests
  // Assuming UserSettingsDB.findUserSettingsByUserId exists from Phase 1 or similar
  const receiverSettings = await UserSettingsDB.findUserSettingsByUserId(receiverId);
  if (receiverSettings?.privacy_friend_requests) {
      if (receiverSettings.privacy_friend_requests === 'friends_of_friends') {
          // TODO: Implement friends_of_friends check. This is complex.
          // For now, treat as 'everyone' or throw NotImplemented error.
          console.warn("Friend request privacy 'friends_of_friends' check is not fully implemented.");
          // throw new Error("Cannot send friend request due to receiver's privacy settings (friends_of_friends not implemented).");
      } else if (receiverSettings.privacy_friend_requests === 'nobody') { // Assuming 'nobody' is a potential setting
          throw new Error("This user is not accepting friend requests at this time.");
      }
      // 'everyone' is default permissive, no check needed.
  }


  return FriendDB.createFriendRequest(requesterId, receiverId);
};

export const getIncomingRequests = async (
  userId: string,
  options: FriendListPaginationOptions
): Promise<FriendRequest[]> => { // Consider PaginatedFriendRequests
  const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = options;
  return FriendDB.findIncomingFriendRequests(userId, { page, limit });
};

export const getOutgoingRequests = async (
  userId: string,
  options: FriendListPaginationOptions
): Promise<FriendRequest[]> => { // Consider PaginatedFriendRequests
  const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = options;
  return FriendDB.findOutgoingFriendRequests(userId, { page, limit });
};

export const acceptFriendRequest = async (requestId: string, currentUserId: string): Promise<FriendRequest> => {
  const request = await FriendDB.findFriendRequestById(requestId);
  if (!request) {
    throw new Error('Friend request not found.');
  }
  if (request.receiver_id !== currentUserId) {
    throw new Error('User not authorized to accept this request.');
  }
  if (request.status !== 'pending') {
    throw new Error(`Cannot accept a request that is already '${request.status}'.`);
  }

  const updatedRequest = await FriendDB.updateFriendRequestStatus(requestId, 'accepted');
  if (!updatedRequest) throw new Error('Failed to update friend request.'); // Should not happen
  return updatedRequest;
};

export const declineOrCancelFriendRequest = async (
  requestId: string,
  currentUserId: string
): Promise<FriendRequest> => {
  const request = await FriendDB.findFriendRequestById(requestId);
  if (!request) {
    throw new Error('Friend request not found.');
  }

  let newStatus: FriendRequestStatus = 'declined'; // Default to declined

  if (request.receiver_id === currentUserId) {
    newStatus = 'declined';
  } else if (request.requester_id === currentUserId) {
    newStatus = 'cancelled'; // Custom status if requester cancels, or just use 'declined'
                            // For simplicity, let's use 'declined' for cancel too, or add 'cancelled' to types/DB
                            // The schema has 'declined'. If requester cancels a PENDING request, it's like a withdrawal.
                            // If we use 'declined', it means the receiver "declined" it, which is not accurate if requester cancels.
                            // Let's assume for now 'declined' is used for both, or service handles this state.
                            // For a clean system, 'cancelled' by requester is better.
                            // The prompt mentions "decline/cancel", so let's assume 'declined' covers both for now.
  } else {
    throw new Error('User not authorized to modify this request.');
  }

  if (request.status !== 'pending') {
    throw new Error(`Cannot modify a request that is already '${request.status}'.`);
  }
  
  const updatedRequest = await FriendDB.updateFriendRequestStatus(requestId, newStatus);
  if (!updatedRequest) throw new Error('Failed to update friend request.');
  return updatedRequest;
};

export const listFriends = async (
  userId: string,
  options: FriendListPaginationOptions
): Promise<PublicUserProfile[]> => { // Consider PaginatedFriendList
  const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = options;
  // Privacy for viewing friend list:
  // This function currently fetches friends for `userId`.
  // If a `currentUserId` (viewer) is different from `userId` (profile owner),
  // we'd need to check `userId`'s UserSettings for friend list visibility.
  // For now, this is direct fetch. Controller should handle this authorization.
  return FriendDB.getUserFriends(userId, { page, limit });
};

export const unfriendUser = async (currentUserId: string, friendToUnfriendId: string): Promise<boolean> => {
  if (currentUserId === friendToUnfriendId) {
    throw new Error('Cannot unfriend oneself.');
  }
  // Validate users exist (optional, DB will handle it)
  const friendUser = await UserDB.findUserById(friendToUnfriendId);
  if (!friendUser) {
    throw new Error('User to unfriend not found.');
  }

  // removeFriendship updates status from 'accepted' to 'unfriended'
  const success = await FriendDB.removeFriendship(currentUserId, friendToUnfriendId);
  if (!success) {
    // This means no 'accepted' friendship was found between them.
    throw new Error('These users are not currently friends or friendship already removed.');
  }
  return success;
};

export const suggestFriends = async (
  userId: string,
  options: FriendListPaginationOptions // Using this for limit, page not typical for suggestions
): Promise<PublicUserProfile[]> => {
  const { limit = 10 } = options; // Default to 10 suggestions
  return FriendDB.getFriendSuggestions(userId, limit);
};


// Helper function to get UserSettings (assuming it's needed for privacy checks)
// This might already exist in another service or directly use UserSettingsDB.
// For now, this is a placeholder if direct UserSettings access is needed here.
// const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
//   return UserSettingsDB.findUserSettingsByUserId(userId);
// };

// Placeholder for friends_of_friends check if needed
// const areFriendsOfFriends = async (requesterId: string, receiverId: string): Promise<boolean> => {
//   // 1. Get friends of receiverId.
//   // 2. For each friend of receiverId, get their friends.
//   // 3. Check if requesterId is in that list.
//   // This can be DB intensive.
//   return false; // Placeholder
// }
