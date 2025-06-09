import * as StoryDB from '../models/story.db';
import * as UserDB from '../models/user.db'; // For user validation
import { Story, CreateStoryDTO, StoryFeedOptions } from '../models/story.types';

export const createNewStory = async (data: CreateStoryDTO): Promise<Story> => {
  // 1. Validate user exists
  const userExists = await UserDB.findUserById(data.user_id);
  if (!userExists) {
    throw new Error('User not found.');
  }

  // 2. Validate content - at least one content type must be present
  if (!data.content_image_url && !data.content_video_url && !data.content_text) {
    throw new Error('Story content (image, video, or text) is required.');
  }
  if (data.content_text && (!data.background_color || !data.font_style)) {
    // If text is primary content, background/font might be expected
    // This rule can be adjusted based on product requirements
  }

  // 3. Create story (expires_at is handled by DB)
  const story = await StoryDB.createStory(data);

  // 4. Mark as viewed by the author automatically (optional product decision)
  // Some platforms do this, some don't. For now, let's not mark it viewed by author.
  // If needed: await StoryDB.createStoryView(story.id, data.user_id);

  return story;
};

export const getStoryById = async (storyId: string, currentUserId?: string): Promise<Story | null> => {
  // StoryDB.findStoryById already filters for non-expired stories.
  // It also joins author and can check view status if currentUserId is provided.
  const story = await StoryDB.findStoryById(storyId, currentUserId);
  if (!story) return null;

  // No additional privacy here beyond existence and expiration, unless stories adopt post-like privacy.
  return story;
};

export const getActiveStoriesForUser = async (targetUserId: string, currentUserId?: string, limit?: number): Promise<Story[]> => {
  // Validate targetUser exists (optional, as query will return empty if not)
  const userExists = await UserDB.findUserById(targetUserId);
  if (!userExists) {
    // Or return empty array directly
    throw new Error('Target user not found.');
  }
  // StoryDB.findActiveStoriesByUserId filters for non-expired and orders by creation.
  // It also handles 'is_viewed_by_user' if currentUserId is provided.
  return StoryDB.findActiveStoriesByUserId(targetUserId, currentUserId, limit);
};

export const getStoriesForFeed = async (currentUserId: string, options?: StoryFeedOptions): Promise<Story[]> => {
  // StoryDB.getFeedStories is simplified: fetches from all users, non-expired, limited per user.
  // It also handles 'is_viewed_by_user' for the currentUserId.
  // Future: This service will apply actual friend/follower logic to select users for the feed.
  const stories = await StoryDB.getFeedStories(currentUserId, options);

  // Group stories by user for the feed response structure (optional, can be done in controller or frontend)
  // For now, returning flat list as per DB function.
  // If PaginatedStories.stories_by_user structure is desired:
  // const storiesByUser: { [userId: string]: Story[] } = {};
  // for (const story of stories) {
  //   if (!storiesByUser[story.user_id]) {
  //     storiesByUser[story.user_id] = [];
  //   }
  //   storiesByUser[story.user_id].push(story);
  // }
  // return storiesByUser; // Adjust return type of function

  return stories;
};

export const deleteUserStory = async (storyId: string, userId: string): Promise<boolean> => {
  const story = await StoryDB.findStoryById(storyId); // Check if story exists (and is active)
  if (!story) {
    throw new Error('Story not found or already expired.');
  }
  if (story.user_id !== userId) {
    throw new Error('User not authorized to delete this story.');
  }

  // If StoryViews table does not have ON DELETE CASCADE for story_id, delete views manually.
  // The current story.db.ts doesn't have this, assuming CASCADE or manual call.
  // Let's add it for completeness if not using CASCADE.
  await StoryDB.deleteStoryViewsByStoryId(storyId);


  return StoryDB.deleteStoryFromDB(storyId, userId);
};

// ---- Optional StoryView Service Functions ----
export const markStoryAsViewed = async (storyId: string, userId: string): Promise<void> => {
  // 1. Validate user exists
  const userExists = await UserDB.findUserById(userId);
  if (!userExists) {
    throw new Error('User not found.');
  }

  // 2. Validate story exists and is active (user can't view an expired story)
  const story = await StoryDB.findStoryById(storyId); // findStoryById already checks for expiration
  if (!story) {
    throw new Error('Story not found or has expired.');
  }

  // 3. Prevent user from viewing their own story (optional product decision)
  // if (story.user_id === userId) {
  //   // Some platforms allow viewing own story without it counting, some track it.
  //   // For now, let's allow it, ON CONFLICT in createStoryView handles duplicates.
  // }

  // 4. Create the view record
  await StoryDB.createStoryView(storyId, userId);
};

export const getStoryViewers = async (storyId: string, currentUserId: string): Promise<PublicUserProfile[]> => {
    // 1. Validate story exists and currentUserId is the author of the story
    const story = await StoryDB.findStoryById(storyId);
    if (!story) {
        throw new Error('Story not found or has expired.');
    }
    if (story.user_id !== currentUserId) {
        throw new Error('User not authorized to view the list of viewers for this story.');
    }

    // TODO: Need a DB function like `StoryDB.findUsersWhoViewedStory(storyId, paginationOptions)`
    // This is not yet implemented in story.db.ts.
    // For now, returning an empty array as a placeholder.
    console.warn("getStoryViewers service function called, but DB function 'findUsersWhoViewedStory' is not implemented.");
    return [];
};
