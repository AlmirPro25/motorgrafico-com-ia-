import { query } from '../config/db';
import {
  FriendRequest,
  FriendRequestStatus,
  FriendListPaginationOptions,
} from './friend.types';
import { PublicUserProfile } from './user.types';

const DEFAULT_PAGE_LIMIT = 15;

const mapRowToFriendRequest = (row: any): FriendRequest => {
  return {
    id: row.id,
    requester_id: row.requester_id,
    receiver_id: row.receiver_id,
    status: row.status,
    requested_at: row.requested_at,
    responded_at: row.responded_at,
    // Profiles are typically joined and mapped if needed
    requester_profile: row.req_handle ? {
        id: row.requester_id,
        handle: row.req_handle,
        first_name: row.req_first_name,
        last_name: row.req_last_name,
        profile_picture_url: row.req_profile_picture_url,
    } : undefined,
    receiver_profile: row.rec_handle ? {
        id: row.receiver_id,
        handle: row.rec_handle,
        first_name: row.rec_first_name,
        last_name: row.rec_last_name,
        profile_picture_url: row.rec_profile_picture_url,
    } : undefined,
  };
};

const mapRowToPublicUserProfile = (row: any): PublicUserProfile => {
    return {
        id: row.friend_id, // Alias used in getUserFriends query
        handle: row.handle,
        first_name: row.first_name,
        last_name: row.last_name,
        profile_picture_url: row.profile_picture_url,
        is_online: row.is_online === true,
        last_seen_at: row.last_seen_at ? new Date(row.last_seen_at) : undefined,
    };
};

export const createFriendRequest = async (requesterId: string, receiverId: string): Promise<FriendRequest> => {
  const sql = `
    INSERT INTO "FriendRequests" (requester_id, receiver_id, status)
    VALUES ($1, $2, 'pending')
    RETURNING *;
  `;
  try {
    const { rows } = await query(sql, [requesterId, receiverId]);
    return mapRowToFriendRequest(rows[0]);
  } catch (error) {
    // Handle unique constraint violation (e.g., (requester_id, receiver_id) pair might be unique for pending)
    // Or if a general error occurs
    console.error('Error creating friend request:', error);
    throw error;
  }
};

export const findFriendRequestById = async (requestId: string): Promise<FriendRequest | null> => {
  const sql = `SELECT * FROM "FriendRequests" WHERE id = $1;`;
  try {
    const { rows } = await query(sql, [requestId]);
    return rows.length > 0 ? mapRowToFriendRequest(rows[0]) : null;
  } catch (error) {
    console.error(`Error finding friend request by ID (${requestId}):`, error);
    throw error;
  }
};

// Finds a request (pending or otherwise) between two users, regardless of who is requester/receiver
export const findFriendRequestBetweenUsers = async (userId1: string, userId2: string): Promise<FriendRequest | null> => {
  const sql = `
    SELECT * FROM "FriendRequests"
    WHERE (requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1);
  `;
  try {
    const { rows } = await query(sql, [userId1, userId2]);
    // Could return multiple (e.g. old declined, new pending). Service layer should handle this.
    // For now, returns the first found, if any. Or service should iterate.
    return rows.length > 0 ? mapRowToFriendRequest(rows[0]) : null;
  } catch (error) {
    console.error('Error finding friend request between users:', error);
    throw error;
  }
};

// Specifically finds a PENDING request between two users.
export const findPendingFriendRequest = async (userId1: string, userId2: string): Promise<FriendRequest | null> => {
  const sql = `
    SELECT * FROM "FriendRequests"
    WHERE status = 'pending' AND
          ((requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1));
  `;
  try {
    const { rows } = await query(sql, [userId1, userId2]);
    return rows.length > 0 ? mapRowToFriendRequest(rows[0]) : null;
  } catch (error) {
    console.error('Error finding pending friend request:', error);
    throw error;
  }
};


export const findIncomingFriendRequests = async (
  userId: string,
  options: FriendListPaginationOptions
): Promise<FriendRequest[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT } = options;
  const offset = (page - 1) * limit;
  const sql = `
    SELECT fr.*,
           u.handle AS req_handle, u.first_name AS req_first_name, u.last_name AS req_last_name, u.profile_picture_url AS req_profile_picture_url
    FROM "FriendRequests" fr
    JOIN "Users" u ON fr.requester_id = u.id
    WHERE fr.receiver_id = $1 AND fr.status = 'pending'
    ORDER BY fr.requested_at DESC
    LIMIT $2 OFFSET $3;
  `;
  try {
    const { rows } = await query(sql, [userId, limit, offset]);
    return rows.map(mapRowToFriendRequest);
  } catch (error) {
    console.error(`Error finding incoming friend requests for user (${userId}):`, error);
    throw error;
  }
};

export const findOutgoingFriendRequests = async (
  userId: string,
  options: FriendListPaginationOptions
): Promise<FriendRequest[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT } = options;
  const offset = (page - 1) * limit;
  const sql = `
    SELECT fr.*,
           u.handle AS rec_handle, u.first_name AS rec_first_name, u.last_name AS rec_last_name, u.profile_picture_url AS rec_profile_picture_url
    FROM "FriendRequests" fr
    JOIN "Users" u ON fr.receiver_id = u.id
    WHERE fr.requester_id = $1 AND fr.status = 'pending'
    ORDER BY fr.requested_at DESC
    LIMIT $2 OFFSET $3;
  `;
  try {
    const { rows } = await query(sql, [userId, limit, offset]);
    return rows.map(mapRowToFriendRequest);
  } catch (error) {
    console.error(`Error finding outgoing friend requests for user (${userId}):`, error);
    throw error;
  }
};

export const updateFriendRequestStatus = async (
  requestId: string,
  status: FriendRequestStatus
): Promise<FriendRequest | null> => {
  const sql = `
    UPDATE "FriendRequests"
    SET status = $1, responded_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
  try {
    const { rows } = await query(sql, [status, requestId]);
    return rows.length > 0 ? mapRowToFriendRequest(rows[0]) : null;
  } catch (error) {
    console.error(`Error updating friend request status (${requestId} to ${status}):`, error);
    throw error;
  }
};

// Hard delete, typically not used. Prefer updating status to 'declined' or 'unfriended'.
export const deleteFriendRequest = async (requestId: string): Promise<boolean> => {
  const sql = `DELETE FROM "FriendRequests" WHERE id = $1;`;
  try {
    const result = await query(sql, [requestId]);
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error(`Error deleting friend request (${requestId}):`, error);
    throw error;
  }
};

export const getUserFriends = async (
  userId: string,
  options: FriendListPaginationOptions
): Promise<PublicUserProfile[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT } = options;
  const offset = (page - 1) * limit;
  // Fetches users who are friends with 'userId'
  // A friendship exists if a FriendRequest between them is 'accepted'
  const sql = `
    SELECT
      CASE
        WHEN fr.requester_id = $1 THEN fr.receiver_id
        ELSE fr.requester_id
      END AS friend_id,
      u.handle,
      u.first_name,
      u.last_name,
      u.profile_picture_url,
      u.is_online,
      u.last_seen_at
    FROM "FriendRequests" fr
    JOIN "Users" u ON u.id = (CASE WHEN fr.requester_id = $1 THEN fr.receiver_id ELSE fr.requester_id END)
    WHERE (fr.requester_id = $1 OR fr.receiver_id = $1) AND fr.status = 'accepted'
    ORDER BY u.handle -- Or by friendship accepted time, etc.
    LIMIT $2 OFFSET $3;
  `;
  try {
    const { rows } = await query(sql, [userId, limit, offset]);
    return rows.map(mapRowToPublicUserProfile);
  } catch (error) {
    console.error(`Error getting user friends for user (${userId}):`, error);
    throw error;
  }
};

// Basic suggestion: users not self, not already friends, not pending request with them.
export const getFriendSuggestions = async (userId: string, limit: number = 10): Promise<PublicUserProfile[]> => {
  const sql = `
    SELECT u.id AS friend_id, u.handle, u.first_name, u.last_name, u.profile_picture_url, u.is_online, u.last_seen_at
    FROM "Users" u
    WHERE u.id != $1  -- Not self
    AND NOT EXISTS (  -- Not already friends or pending request with them
      SELECT 1 FROM "FriendRequests" fr
      WHERE ( (fr.requester_id = $1 AND fr.receiver_id = u.id) OR
              (fr.requester_id = u.id AND fr.receiver_id = $1) )
            AND fr.status IN ('pending', 'accepted')
    )
    -- Add more complex suggestion logic here, e.g., friends of friends, common interests etc.
    ORDER BY RANDOM() -- Very basic suggestion, not for production at scale
    LIMIT $2;
  `;
  try {
    const { rows } = await query(sql, [userId, limit]);
    return rows.map(mapRowToPublicUserProfile);
  } catch (error) {
    console.error(`Error getting friend suggestions for user (${userId}):`, error);
    throw error;
  }
};

// Removes a friendship by updating the status of the 'accepted' request to 'unfriended'
// Or could delete the record, depending on desired behavior (keep history vs hard delete)
export const removeFriendship = async (userId1: string, userId2: string): Promise<boolean> => {
  const sql = `
    UPDATE "FriendRequests"
    SET status = 'unfriended', responded_at = CURRENT_TIMESTAMP
    WHERE status = 'accepted' AND
          ((requester_id = $1 AND receiver_id = $2) OR (requester_id = $2 AND receiver_id = $1))
    RETURNING id; -- to check if any row was updated
  `;
  try {
    const { rows } = await query(sql, [userId1, userId2]);
    return rows.length > 0;
  } catch (error) {
    console.error(`Error removing friendship between ${userId1} and ${userId2}:`, error);
    throw error;
  }
};

// TODO: Count functions for pagination if needed (e.g., countUserFriends)
// export const countUserFriends = async (userId: string): Promise<number> => { ... }
// export const countIncomingFriendRequests = async (userId: string): Promise<number> => { ... }
// export const countOutgoingFriendRequests = async (userId: string): Promise<number> => { ... }
