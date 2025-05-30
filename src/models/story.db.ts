import { query } from '../config/db';
import { Story, CreateStoryDTO, StoryFeedOptions } from './story.types';
import { PublicUserProfile } from './user.types';

// Helper to map raw row to Story object
const mapRowToStory = async (row: any, currentUserId?: string): Promise<Story> => {
  const story: Story = {
    id: row.id,
    user_id: row.user_id,
    content_image_url: row.content_image_url,
    content_video_url: row.content_video_url,
    content_text: row.content_text,
    background_color: row.background_color,
    font_style: row.font_style,
    expires_at: row.expires_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author: { // Basic author info from join
      id: row.author_id,
      handle: row.author_handle,
      first_name: row.author_first_name,
      last_name: row.author_last_name,
      profile_picture_url: row.author_profile_picture_url,
    } as PublicUserProfile,
    is_viewed_by_user: currentUserId ? !!row.is_viewed_by_user : false,
    view_count: row.view_count ? parseInt(row.view_count, 10) : 0,
  };
  return story;
};

export const createStory = async (storyData: CreateStoryDTO): Promise<Story> => {
  const { user_id, content_image_url, content_video_url, content_text, background_color, font_style } = storyData;
  // expires_at is set to 24 hours from now using PostgreSQL interval
  const sql = `
    INSERT INTO "Stories" 
      (user_id, content_image_url, content_video_url, content_text, background_color, font_style, expires_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '24 hours')
    RETURNING id;
  `;
  try {
    const { rows } = await query(sql, [user_id, content_image_url, content_video_url, content_text, background_color, font_style]);
    const newStoryId = rows[0].id;
    const newStory = await findStoryById(newStoryId, user_id); // Pass user_id as currentUserId to mark as not viewed by self initially (or handle differently)
    if (!newStory) throw new Error('Failed to create or find story after insertion.');
    return newStory;
  } catch (error) {
    console.error('Error creating story:', error);
    throw error;
  }
};

export const findStoryById = async (storyId: string, currentUserId?: string): Promise<Story | null> => {
  const sql = `
    SELECT
      s.*,
      u.id AS author_id,
      u.handle AS author_handle,
      u.first_name AS author_first_name,
      u.last_name AS author_last_name,
      u.profile_picture_url AS author_profile_picture_url,
      (SELECT COUNT(DISTINCT sv.user_id) FROM "StoryViews" sv WHERE sv.story_id = s.id) AS view_count
      ${currentUserId ? ', (SELECT EXISTS (SELECT 1 FROM "StoryViews" sv_user WHERE sv_user.story_id = s.id AND sv_user.user_id = $2)) AS is_viewed_by_user' : ''}
    FROM "Stories" s
    JOIN "Users" u ON s.user_id = u.id
    WHERE s.id = $1 AND s.expires_at > NOW(); 
  `;
  // Only fetch non-expired stories by ID as well generally
  try {
    const params = currentUserId ? [storyId, currentUserId] : [storyId];
    const { rows } = await query(sql, params);
    if (rows.length === 0) return null;
    return mapRowToStory(rows[0], currentUserId);
  } catch (error) {
    console.error(`Error finding story by id (${storyId}):`, error);
    throw error;
  }
};

// Fetches active (non-expired) stories for a specific user
export const findActiveStoriesByUserId = async (targetUserId: string, currentUserId?: string, limit: number = 20): Promise<Story[]> => {
  const sql = `
    SELECT
      s.*,
      u.id AS author_id,
      u.handle AS author_handle,
      u.first_name AS author_first_name,
      u.last_name AS author_last_name,
      u.profile_picture_url AS author_profile_picture_url,
      (SELECT COUNT(DISTINCT sv.user_id) FROM "StoryViews" sv WHERE sv.story_id = s.id) AS view_count
      ${currentUserId ? ', (SELECT EXISTS (SELECT 1 FROM "StoryViews" sv_user WHERE sv_user.story_id = s.id AND sv_user.user_id = $3)) AS is_viewed_by_user' : ''}
    FROM "Stories" s
    JOIN "Users" u ON s.user_id = u.id
    WHERE s.user_id = $1 AND s.expires_at > NOW()
    ORDER BY s.created_at DESC
    LIMIT $2;
  `;
  try {
    const params = currentUserId ? [targetUserId, limit, currentUserId] : [targetUserId, limit];
    const { rows } = await query(sql, params);
    return Promise.all(rows.map(row => mapRowToStory(row, currentUserId)));
  } catch (error) {
    console.error(`Error finding active stories for user (${targetUserId}):`, error);
    throw error;
  }
};

// Simplified getFeedStories: Fetches all active stories from all users.
// True feed logic requires friend/follower relationships.
export const getFeedStories = async (
  currentUserId: string, // For is_viewed_by_user status
  options?: StoryFeedOptions
): Promise<Story[]> => {
  const limitPerUser = options?.limit_per_user || 3; // Show a few latest stories per user in feed

  // This query is a common way to get N items per group (latest N stories per user)
  // It requires a subquery or window functions.
  const sql = `
    SELECT
      s.*,
      u.id AS author_id,
      u.handle AS author_handle,
      u.first_name AS author_first_name,
      u.last_name AS author_last_name,
      u.profile_picture_url AS author_profile_picture_url,
      (SELECT COUNT(DISTINCT sv.user_id) FROM "StoryViews" sv WHERE sv.story_id = s.id) AS view_count,
      (SELECT EXISTS (SELECT 1 FROM "StoryViews" sv_user WHERE sv_user.story_id = s.id AND sv_user.user_id = $1)) AS is_viewed_by_user
    FROM (
      SELECT 
        s_inner.*,
        ROW_NUMBER() OVER (PARTITION BY s_inner.user_id ORDER BY s_inner.created_at DESC) as rn
      FROM "Stories" s_inner
      WHERE s_inner.expires_at > NOW()
      -- Add friend filtering here in future: AND s_inner.user_id IN (SELECT friend_id FROM "UserFriends" WHERE user_id = $1)
    ) s
    JOIN "Users" u ON s.user_id = u.id
    WHERE s.rn <= $2  -- Limit stories per user
    ORDER BY u.handle, s.created_at DESC; -- Order by user, then story time
    -- Could also order by latest story across users: ORDER BY s.created_at DESC;
  `;
  try {
    // For now, feed shows stories from ALL users. In future, filter by connections.
    const { rows } = await query(sql, [currentUserId, limitPerUser]);
    return Promise.all(rows.map(row => mapRowToStory(row, currentUserId)));
  } catch (error) {
    console.error('Error fetching feed stories:', error);
    throw error;
  }
};

export const deleteStoryFromDB = async (storyId: string, userId: string): Promise<boolean> => {
  // First, delete associated views to maintain data integrity if ON DELETE CASCADE is not set on StoryViews for story_id
  // await deleteStoryViewsByStoryId(storyId); // This is good practice if not using CASCADE

  const sql = `
    DELETE FROM "Stories"
    WHERE id = $1 AND user_id = $2;
  `;
  try {
    const result = await query(sql, [storyId, userId]);
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error(`Error deleting story (${storyId}):`, error);
    throw error;
  }
};

// ---- Optional StoryView functions ----
export const createStoryView = async (storyId: string, userId: string): Promise<void> => {
  const sql = `
    INSERT INTO "StoryViews" (story_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (story_id, user_id) DO NOTHING; -- User can only view a story once effectively
  `;
  try {
    await query(sql, [storyId, userId]);
  } catch (error) {
    // Check for foreign key violation if story_id or user_id is invalid
    if ((error as any).code === '23503') {
        throw new Error('Story or User not found for creating story view.');
    }
    console.error(`Error creating story view for story ${storyId} by user ${userId}:`, error);
    throw error;
  }
};

export const checkIfStoryViewed = async (storyId: string, userId: string): Promise<boolean> => {
  const sql = `SELECT 1 FROM "StoryViews" WHERE story_id = $1 AND user_id = $2;`;
  try {
    const { rows } = await query(sql, [storyId, userId]);
    return rows.length > 0;
  } catch (error) {
    console.error(`Error checking if story ${storyId} viewed by user ${userId}:`, error);
    throw error;
  }
};

export const getStoryViewCount = async (storyId: string): Promise<number> => {
    const sql = `SELECT COUNT(DISTINCT user_id) AS view_count FROM "StoryViews" WHERE story_id = $1;`;
    try {
        const { rows } = await query(sql, [storyId]);
        return rows[0] ? parseInt(rows[0].view_count, 10) : 0;
    } catch (error) {
        console.error(`Error getting view count for story ${storyId}:`, error);
        throw error;
    }
};

// To be called when a story is deleted, if ON DELETE CASCADE is not set for story_id in StoryViews
export const deleteStoryViewsByStoryId = async (storyId: string): Promise<number> => {
    const sql = `DELETE FROM "StoryViews" WHERE story_id = $1;`;
    try {
        const result = await query(sql, [storyId]);
        return result.rowCount !== null ? result.rowCount : 0;
    } catch (error) {
        console.error(`Error deleting story views for story ${storyId}:`, error);
        throw error;
    }
};
