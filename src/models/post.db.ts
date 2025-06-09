import { query } from '../config/db';
import {
  Post,
  CreatePostDTO,
  UpdatePostDTO,
  SharePostDTO,
  PaginationOptions,
  PostPrivacy,
} from './post.types';
import { PublicUserProfile } from './user.types'; // For author details

const DEFAULT_PAGE_LIMIT = 10;

// Helper to map raw row to Post object, including author, like count, comment count
// currentUserId is optional, used to determine if the current user has liked this post
const mapRowToPost = async (row: any, currentUserId?: string): Promise<Post> => {
  const post: Post = {
    id: row.id,
    user_id: row.user_id,
    content_text: row.content_text,
    content_image_url: row.content_image_url,
    content_video_url: row.content_video_url,
    privacy_level: row.privacy_level,
    original_post_id: row.original_post_id,
    group_id: row.group_id, // Added group_id
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: { // Basic author info from the join
      id: row.author_id,
      handle: row.author_handle,
      first_name: row.author_first_name,
      last_name: row.author_last_name,
      profile_picture_url: row.author_profile_picture_url,
      is_online: row.author_is_online === true,
      last_seen_at: row.author_last_seen_at ? new Date(row.author_last_seen_at) : undefined,
    } as PublicUserProfile,
    like_count: parseInt(row.like_count, 10) || 0,
    comment_count: parseInt(row.comment_count, 10) || 0,
    is_liked_by_user: currentUserId ? !!row.is_liked_by_user : false,
    // tagged_users and original_post_details would require further specific queries or joins
  };
  return post;
};


export const createPost = async (postData: CreatePostDTO): Promise<Post> => {
  const { user_id, content_text, content_image_url, content_video_url, privacy_level, group_id } = postData;
  // If group_id is present, privacy_level might be ignored or set to a group-specific default by service layer.
  const sql = `
    INSERT INTO "Posts" (user_id, content_text, content_image_url, content_video_url, privacy_level, group_id)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id;
  `;
  try {
    const { rows } = await query(sql, [user_id, content_text, content_image_url, content_video_url, privacy_level, group_id]);
    const newPostId = rows[0].id;
    // Fetch the full post with author details to return
    const newPost = await findPostById(newPostId, user_id);
    if (!newPost) throw new Error('Failed to create or find post after insertion.');
    return newPost;
  } catch (error) {
    console.error('Error creating post:', error);
    throw error;
  }
};

export const addTaggedUsersToPost = async (postId: string, userIds: string[]): Promise<void> => {
  if (userIds.length === 0) return;
  // Consider ON CONFLICT DO NOTHING if re-tagging should be idempotent
  const valuesClauses = userIds.map((_, index) => `($1, $${index + 2})`).join(', ');
  const sql = `
    INSERT INTO "PostTaggedUsers" (post_id, user_id)
    VALUES ${valuesClauses};
  `;
  try {
    await query(sql, [postId, ...userIds]);
  } catch (error) {
    console.error(`Error tagging users to post ${postId}:`, error);
    // Decide if this should throw or just log, depending on criticalness
    throw error;
  }
};

export const findPostById = async (postId: string, currentUserId?: string): Promise<Post | null> => {
  // This query joins with Users for author, and aggregates likes and comments
  // It also checks if the currentUserId (if provided) has liked the post.
  const sql = `
    SELECT
      p.*,
      u.id AS author_id,
      u.handle AS author_handle,
      u.first_name AS author_first_name,
      u.last_name AS author_last_name,
      u.profile_picture_url AS author_profile_picture_url,
      u.is_online AS author_is_online,
      u.last_seen_at AS author_last_seen_at,
      (SELECT COUNT(*) FROM "Likes" l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM "Comments" c WHERE c.post_id = p.id) AS comment_count
      ${currentUserId ? ', (SELECT EXISTS (SELECT 1 FROM "Likes" l_user WHERE l_user.post_id = p.id AND l_user.user_id = $2)) AS is_liked_by_user' : ''}
    FROM "Posts" p
    JOIN "Users" u ON p.user_id = u.id
    WHERE p.id = $1;
  `;
  try {
    const params = currentUserId ? [postId, currentUserId] : [postId];
    const { rows } = await query(sql, params);
    if (rows.length === 0) return null;
    return mapRowToPost(rows[0], currentUserId);
  } catch (error) {
    console.error(`Error finding post by id (${postId}):`, error);
    throw error;
  }
};

export const findPostsByUserId = async (
  targetUserId: string,
  options: PaginationOptions,
  currentUserId?: string // For like status and privacy checks
): Promise<Post[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT } = options;
  const offset = (page - 1) * limit;

  // Privacy:
  // - If currentUserId is the targetUserId, show all their posts.
  // - If currentUserId is different, show only 'public' posts.
  // - 'friends' privacy will be more complex later. For now, treat 'friends' as 'private' unless it's own profile.
  let privacyFilter = `p.privacy_level = 'public'`;
  if (currentUserId && currentUserId === targetUserId) {
    privacyFilter = `TRUE`; // User viewing their own profile sees all their posts
  } else if (currentUserId) {
    // When viewing someone else's profile, only public posts for now.
    // Later, add friend check: OR (p.privacy_level = 'friends' AND user_is_friend(p.user_id, $3))
    privacyFilter = `p.privacy_level = 'public'`;
  }


  const sql = `
    SELECT
      p.*,
      u.id AS author_id,
      u.handle AS author_handle,
      u.first_name AS author_first_name,
      u.last_name AS author_last_name,
      u.profile_picture_url AS author_profile_picture_url,
      u.is_online AS author_is_online,
      u.last_seen_at AS author_last_seen_at,
      (SELECT COUNT(*) FROM "Likes" l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM "Comments" c WHERE c.post_id = p.id) AS comment_count
      ${currentUserId ? ', (SELECT EXISTS (SELECT 1 FROM "Likes" l_user WHERE l_user.post_id = p.id AND l_user.user_id = $3)) AS is_liked_by_user' : ''}
    FROM "Posts" p
    JOIN "Users" u ON p.user_id = u.id
    WHERE p.user_id = $1 AND (${privacyFilter})
    ORDER BY p.created_at DESC
    LIMIT $2 OFFSET $4;
  `;
  try {
    const params = currentUserId ? [targetUserId, limit, currentUserId, offset] : [targetUserId, limit, offset];
    const { rows } = await query(sql, params);
    return Promise.all(rows.map(row => mapRowToPost(row, currentUserId)));
  } catch (error) {
    console.error(`Error finding posts by user id (${targetUserId}):`, error);
    throw error;
  }
};

// Simplified getFeedPosts for now: Fetches all 'public' posts or posts from all users.
// True feed logic requires friend/follower relationships.
export const getFeedPosts = async (
  currentUserId: string, // For like status and personalized content later
  options: PaginationOptions
): Promise<Post[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT } = options;
  const offset = (page - 1) * limit;

  // For now, feed shows all public posts from all users.
  // Later: Filter by friends/followed users:
  // WHERE (p.privacy_level = 'public' OR (p.privacy_level = 'friends' AND p.user_id IN (SELECT friend_id FROM "UserFriends" WHERE user_id = $1)))
  // For now, just public posts, or all posts if not distinguishing yet.
  const sql = `
    SELECT
      p.*,
      u.id AS author_id,
      u.handle AS author_handle,
      u.first_name AS author_first_name,
      u.last_name AS author_last_name,
      u.profile_picture_url AS author_profile_picture_url,
      u.is_online AS author_is_online,
      u.last_seen_at AS author_last_seen_at,
      (SELECT COUNT(*) FROM "Likes" l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM "Comments" c WHERE c.post_id = p.id) AS comment_count,
      (SELECT EXISTS (SELECT 1 FROM "Likes" l_user WHERE l_user.post_id = p.id AND l_user.user_id = $1)) AS is_liked_by_user
    FROM "Posts" p
    JOIN "Users" u ON p.user_id = u.id
    WHERE p.privacy_level = 'public' -- Simplification: only public posts in feed for now
    ORDER BY p.created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  try {
    const { rows } = await query(sql, [currentUserId, limit, offset]);
    return Promise.all(rows.map(row => mapRowToPost(row, currentUserId)));
  } catch (error) {
    console.error('Error fetching feed posts:', error);
    throw error;
  }
};

export const updatePostInDB = async (postId: string, userId: string, updateData: UpdatePostDTO): Promise<Post | null> => {
  const { content_text, content_image_url, content_video_url, privacy_level } = updateData;
  const fields: string[] = [];
  const values: any[] = [];
  let paramCount = 1;

  if (content_text !== undefined) {
    fields.push(`content_text = $${paramCount++}`);
    values.push(content_text);
  }
  if (content_image_url !== undefined) {
    fields.push(`content_image_url = $${paramCount++}`);
    values.push(content_image_url);
  }
  if (content_video_url !== undefined) {
    fields.push(`content_video_url = $${paramCount++}`);
    values.push(content_video_url);
  }
  if (privacy_level !== undefined) {
    fields.push(`privacy_level = $${paramCount++}`);
    values.push(privacy_level);
  }

  if (fields.length === 0) {
    return findPostById(postId, userId); // No actual update, return current post
  }

  fields.push(`updated_at = CURRENT_TIMESTAMP`);
  const sql = `
    UPDATE "Posts"
    SET ${fields.join(', ')}
    WHERE id = $${paramCount++} AND user_id = $${paramCount++}
    RETURNING id;
  `;
  values.push(postId, userId);

  try {
    const { rows } = await query(sql, values);
    if (rows.length === 0) {
      // Either post not found or user is not the owner
      return null;
    }
    return findPostById(rows[0].id, userId);
  } catch (error) {
    console.error(`Error updating post (${postId}):`, error);
    throw error;
  }
};

export const deletePostFromDB = async (postId: string, userId: string): Promise<boolean> => {
  const sql = `
    DELETE FROM "Posts"
    WHERE id = $1 AND user_id = $2;
  `;
  try {
    const result = await query(sql, [postId, userId]);
    return result.rowCount !== null && result.rowCount > 0; // rowCount is 0 if no row matched (not found or not owner)
  } catch (error) {
    console.error(`Error deleting post (${postId}):`, error);
    throw error;
  }
};

export const createSharedPost = async (shareData: SharePostDTO): Promise<Post | null> => {
    const { user_id, original_post_id, content_text, privacy_level } = shareData;

    // Verify original post exists and is shareable (e.g., not private by a non-friend)
    const originalPost = await findPostById(original_post_id);
    if (!originalPost) {
        throw new Error('Original post not found or not accessible.');
    }
    // Add more complex shareability rules here if needed (e.g. original post's privacy)
    if (originalPost.privacy_level === 'private' && originalPost.user_id !== user_id) {
        // This check might be too simple, depends on product logic for sharing private posts.
        // For now, let's assume you can't share someone else's private post.
        // This logic is better suited for the service layer.
    }


    const sql = `
        INSERT INTO "Posts" (user_id, original_post_id, content_text, privacy_level)
        VALUES ($1, $2, $3, $4)
        RETURNING id;
    `;
    try {
        const { rows } = await query(sql, [user_id, original_post_id, content_text, privacy_level]);
        const newPostId = rows[0].id;
        const newPost = await findPostById(newPostId, user_id); // Fetch with author, counts etc.
        if (!newPost) throw new Error('Failed to create or find shared post after insertion.');
        return newPost;
    } catch (error) {
        console.error('Error creating shared post:', error);
        throw error;
    }
};

// Placeholder for fetching tagged users for a post - implement if needed for Post object population
export const getTaggedUsersForPost = async (postId: string): Promise<PublicUserProfile[]> => {
    const sql = `
        SELECT u.id, u.handle, u.first_name, u.last_name, u.profile_picture_url
        FROM "Users" u
        JOIN "PostTaggedUsers" ptu ON u.id = ptu.user_id
        WHERE ptu.post_id = $1;
    `;
    try {
        const { rows } = await query(sql, [postId]);
        return rows.map(r => ({
            id: r.id,
            handle: r.handle,
            first_name: r.first_name,
            last_name: r.last_name,
            profile_picture_url: r.profile_picture_url,
            // Note: created_at from User model is not part of PublicUserProfile here
        }));
    } catch (error) {
        console.error(`Error fetching tagged users for post ${postId}:`, error);
        throw error; // Or return empty array
    }
};

// TODO: Function to get total count for pagination for findPostsByUserId and getFeedPosts
// export const countPostsByUserId = async (targetUserId: string, currentUserId?: string): Promise<number> => { ... }
// export const countFeedPosts = async (currentUserId: string): Promise<number> => { ... }

export const findPostsByGroupId = async (
  groupId: string,
  options: PaginationOptions,
  currentUserId?: string // For like status
): Promise<Post[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT } = options;
  const offset = (page - 1) * limit;

  // Group posts are typically only visible to members. Access control should be in service layer.
  // Here, we just fetch posts for the given group.
  const sql = `
    SELECT
      p.*,
      u.id AS author_id,
      u.handle AS author_handle,
      u.first_name AS author_first_name,
      u.last_name AS author_last_name,
      u.profile_picture_url AS author_profile_picture_url,
      u.is_online AS author_is_online,
      u.last_seen_at AS author_last_seen_at,
      (SELECT COUNT(*) FROM "Likes" l WHERE l.post_id = p.id) AS like_count,
      (SELECT COUNT(*) FROM "Comments" c WHERE c.post_id = p.id) AS comment_count
      ${currentUserId ? ', (SELECT EXISTS (SELECT 1 FROM "Likes" l_user WHERE l_user.post_id = p.id AND l_user.user_id = $3)) AS is_liked_by_user' : ''}
    FROM "Posts" p
    JOIN "Users" u ON p.user_id = u.id
    WHERE p.group_id = $1
    ORDER BY p.created_at DESC
    LIMIT $2 OFFSET $4;
  `;
  try {
    // Note: Parameter indexing for currentUserId needs to be adjusted if it's present.
    const params = currentUserId ? [groupId, limit, currentUserId, offset] : [groupId, limit, offset];
    // Correcting param indexing for currentUserId:
    // If currentUserId is present, it's $3, and offset is $4.
    // If not, limit is $2, and offset is $3.
    // The query string needs to be robust to this or params adjusted carefully.
    // Let's adjust the query string for clarity if currentUserId is present.

    let finalSql = `
      SELECT
        p.*,
        u.id AS author_id,
        u.handle AS author_handle,
        u.first_name AS author_first_name,
        u.last_name AS author_last_name,
        u.profile_picture_url AS author_profile_picture_url,
      u.is_online AS author_is_online,
      u.last_seen_at AS author_last_seen_at,
        (SELECT COUNT(*) FROM "Likes" l WHERE l.post_id = p.id) AS like_count,
        (SELECT COUNT(*) FROM "Comments" c WHERE c.post_id = p.id) AS comment_count
        ${currentUserId ? ', (SELECT EXISTS (SELECT 1 FROM "Likes" l_user WHERE l_user.post_id = p.id AND l_user.user_id = $3)) AS is_liked_by_user' : ''}
      FROM "Posts" p
      JOIN "Users" u ON p.user_id = u.id
      WHERE p.group_id = $1
      ORDER BY p.created_at DESC
      LIMIT $2 OFFSET ${currentUserId ? '$4' : '$3'};
    `;
    const finalParams = currentUserId ? [groupId, limit, currentUserId, offset] : [groupId, limit, offset];


    const { rows } = await query(finalSql, finalParams);
    return Promise.all(rows.map(row => mapRowToPost(row, currentUserId)));
  } catch (error) {
    console.error(`Error finding posts by group id (${groupId}):`, error);
    throw error;
  }
};

// TODO: countPostsByGroupId for pagination
