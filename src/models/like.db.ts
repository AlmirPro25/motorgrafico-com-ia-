import { query } from '../config/db';
import { Like } from './like.types';
import { PublicUserProfile } from './user.types'; // For listing users who liked
import { PaginationOptions } from './post.types'; // Re-using for pagination

const DEFAULT_PAGE_LIMIT = 10;

export const createLike = async (postId: string, userId: string): Promise<Like | null> => {
  const sql = `
    INSERT INTO "Likes" (post_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (post_id, user_id) DO NOTHING -- Prevents duplicate likes, crucial
    RETURNING *;
  `;
  try {
    const { rows } = await query(sql, [postId, userId]);
    // If ON CONFLICT DO NOTHING occurs and the row already existed, rows[0] will be undefined.
    // If it was a new like, rows[0] will contain the new like.
    // We can return the existing like if found, or the new one.
    // For simplicity, if a new like was created, it's returned. If it already existed, findLike can be called.
    if (rows.length > 0) {
        return rows[0];
    }
    // If no new row was inserted (because it already existed), we can fetch the existing one.
    return findLike(postId, userId);

  } catch (error) {
    console.error(`Error creating like for post ${postId} by user ${userId}:`, error);
    // Check for foreign key violations if post_id or user_id is invalid
    if ((error as any).code === '23503') { // PostgreSQL foreign key violation
        throw new Error('Post or User not found for creating like.');
    }
    throw error;
  }
};

export const deleteLike = async (postId: string, userId: string): Promise<boolean> => {
  const sql = `
    DELETE FROM "Likes"
    WHERE post_id = $1 AND user_id = $2;
  `;
  try {
    const result = await query(sql, [postId, userId]);
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error(`Error deleting like for post ${postId} by user ${userId}:`, error);
    throw error;
  }
};

export const findLike = async (postId: string, userId: string): Promise<Like | null> => {
  const sql = `
    SELECT * FROM "Likes"
    WHERE post_id = $1 AND user_id = $2;
  `;
  try {
    const { rows } = await query(sql, [postId, userId]);
    return rows[0] || null;
  } catch (error) {
    console.error(`Error finding like for post ${postId} by user ${userId}:`, error);
    throw error;
  }
};

export const getLikeCountByPostId = async (postId: string): Promise<number> => {
  const sql = `
    SELECT COUNT(*) AS like_count
    FROM "Likes"
    WHERE post_id = $1;
  `;
  try {
    const { rows } = await query(sql, [postId]);
    return parseInt(rows[0].like_count, 10);
  } catch (error) {
    console.error(`Error getting like count for post ${postId}:`, error);
    throw error;
  }
};

// Optional: Get a list of users who liked a specific post
export const findUsersWhoLikedPost = async (
  postId: string,
  options: PaginationOptions
): Promise<PublicUserProfile[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT } = options;
  const offset = (page - 1) * limit;

  const sql = `
    SELECT u.id, u.handle, u.first_name, u.last_name, u.profile_picture_url
    FROM "Users" u
    JOIN "Likes" l ON u.id = l.user_id
    WHERE l.post_id = $1
    ORDER BY l.created_at DESC -- Or by user handle, etc.
    LIMIT $2 OFFSET $3;
  `;
  try {
    const { rows } = await query(sql, [postId, limit, offset]);
    return rows.map(r => ({
      id: r.id,
      handle: r.handle,
      first_name: r.first_name,
      last_name: r.last_name,
      profile_picture_url: r.profile_picture_url,
    }));
  } catch (error) {
    console.error(`Error finding users who liked post ${postId}:`, error);
    throw error;
  }
};

// This function is intended to be called when a post is deleted.
export const deleteLikesByPostId = async (postId: string): Promise<number> => {
    const sql = `DELETE FROM "Likes" WHERE post_id = $1;`;
    try {
        const result = await query(sql, [postId]);
        return result.rowCount !== null ? result.rowCount : 0;
    } catch (error) {
        console.error(`Error deleting likes for post ${postId}:`, error);
        throw error;
    }
};

// TODO: countUsersWhoLikedPost for pagination
// export const countUsersWhoLikedPost = async (postId: string): Promise<number> => { ... }
