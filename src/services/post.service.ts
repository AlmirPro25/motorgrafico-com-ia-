import * as PostDB from '../models/post.db';
import * as CommentDB from '../models/comment.db';
import * as LikeDB from '../models/like.db';
import {
  Post,
  CreatePostDTO,
  UpdatePostDTO,
  SharePostDTO,
  PaginationOptions,
  PaginatedPosts, // Assuming you'll want to return this structure
  PostPrivacy,
} from '../models/post.types';
import { findUserById } from '../models/user.db'; // For validating users if needed

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

export const createNewPost = async (data: CreatePostDTO): Promise<Post> => {
  // Validate user exists (optional, DB foreign key will catch it too)
  const userExists = await findUserById(data.user_id);
  if (!userExists) {
    throw new Error('User not found.');
  }

  // Validate content - at least text, image, or video must be present
  if (!data.content_text && !data.content_image_url && !data.content_video_url) {
    throw new Error('Post content (text, image, or video) is required.');
  }

  // Validate privacy level
  const validPrivacyLevels: PostPrivacy[] = ['public', 'friends', 'private'];
  if (!validPrivacyLevels.includes(data.privacy_level)) {
      throw new Error('Invalid privacy level specified.');
  }

  const newPost = await PostDB.createPost(data);

  if (data.tagged_user_ids && data.tagged_user_ids.length > 0) {
    // In a real app, you'd validate these user IDs exist
    await PostDB.addTaggedUsersToPost(newPost.id, data.tagged_user_ids);
    // Optionally, fetch and attach tagged users to the returned post object
    newPost.tagged_users = await PostDB.getTaggedUsersForPost(newPost.id);
  }
  return newPost;
};

export const getPostById = async (postId: string, currentUserId?: string): Promise<Post | null> => {
  const post = await PostDB.findPostById(postId, currentUserId);
  if (!post) return null;

  // Privacy Check:
  // This logic assumes currentUserId is the ID of the user making the request.
  if (post.privacy_level === 'private' && post.user_id !== currentUserId) {
    // For now, only owner can see private posts. Friend logic later.
    // If currentUserId is undefined (public request), private posts are hidden.
    return null;
  }
  if (post.privacy_level === 'friends' && post.user_id !== currentUserId) {
    // Placeholder for friend check. For now, treat 'friends' like 'private' if not owner.
    // if (currentUserId && !areFriends(post.user_id, currentUserId)) return null;
    // If no currentUserId, 'friends' posts are hidden.
    if (!currentUserId) return null; // Or apply more specific logic
    // For this phase, let's restrict 'friends' to owner or logged-in users (basic)
    // This is a simplification. True friend logic is needed.
    // For now, if not owner and privacy is 'friends', hide if not logged in.
    // A better approach: if currentUserId is provided, check friendship. If not, hide.
    // Simplification: only owner sees 'friends' posts unless currentUserId is provided (even then, no friend check yet)
     return null; // Hide 'friends' posts from non-owners for now
  }

  // Populate tagged users and original post details if it's a shared post
  post.tagged_users = await PostDB.getTaggedUsersForPost(post.id);
  if (post.original_post_id) {
    post.original_post_details = await getPostById(post.original_post_id, currentUserId); // Recursive call, careful with depth
  }

  return post;
};

export const getPostsByUser = async (
  targetUserId: string,
  options: PaginationOptions,
  currentUserId?: string // User making the request
): Promise<Post[]> => { // Consider returning PaginatedPosts
  const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = options;
  // currentUserId is passed to PostDB.findPostsByUserId for its own privacy/like status logic
  const posts = await PostDB.findPostsByUserId(targetUserId, { page, limit }, currentUserId);

  // Additional filtering for 'friends' privacy if not handled by DB layer fully
  // The DB layer currently shows 'public' or 'all if own profile'.
  // This service layer can refine 'friends' posts if currentUserId is provided and is a friend.
  // For now, DB layer's handling is primary.

  return Promise.all(posts.map(async (post) => {
    // Re-check privacy here if DB layer is too permissive for 'friends' (it is, for now)
    if (post.privacy_level === 'friends' && post.user_id !== currentUserId) {
        // Simplified: hide if not owner and not logged in (currentUserId is null)
        // Or if logged in but not friends (future logic)
        // For now, if currentUserId is not the owner, and privacy is 'friends', it's hidden by DB.
        // This is a bit redundant with DB logic but shows where service layer can add more.
    }
    post.tagged_users = await PostDB.getTaggedUsersForPost(post.id);
    if (post.original_post_id) {
        post.original_post_details = await getPostById(post.original_post_id, currentUserId);
    }
    return post;
  }));
};

export const getPublicFeed = async (
  options: PaginationOptions,
  currentUserId: string // For like status and personalized content
): Promise<Post[]> => { // Consider returning PaginatedPosts
  const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = options;
  // currentUserId is passed to PostDB.getFeedPosts for like status
  const posts = await PostDB.getFeedPosts(currentUserId, { page, limit });

  return Promise.all(posts.map(async (post) => {
    post.tagged_users = await PostDB.getTaggedUsersForPost(post.id);
    if (post.original_post_id) {
        post.original_post_details = await getPostById(post.original_post_id, currentUserId);
    }
    return post;
  }));
};

export const updateExistingPost = async (
  postId: string,
  userId: string, // User attempting the update
  updateData: UpdatePostDTO
): Promise<Post | null> => {
  const post = await PostDB.findPostById(postId);
  if (!post) {
    throw new Error('Post not found.');
  }
  if (post.user_id !== userId) {
    throw new Error('User not authorized to update this post.'); // Or return 403 in controller
  }

  // Validate privacy level if provided
  if (updateData.privacy_level && !['public', 'friends', 'private'].includes(updateData.privacy_level)) {
      throw new Error('Invalid privacy level specified.');
  }

  const updatedPost = await PostDB.updatePostInDB(postId, userId, updateData);
  if (!updatedPost) return null; // Should not happen if checks above pass

  if (updateData.tagged_user_ids) {
    // Simplistic update: remove all existing tags and add new ones.
    // A more sophisticated approach would diff the arrays.
    // For now, let's assume this is handled by deleting old and adding new, or that addTaggedUsersToPost is idempotent or replaces.
    // This requires a PostDB.removeTaggedUsersFromPost(postId) or similar.
    // For simplicity, let's assume addTaggedUsersToPost can handle re-adding or PostDB.updatePostInDB manages it.
    // Current PostDB.addTaggedUsersToPost just inserts. Need to clear old ones first if replacing.
    // This part needs refinement for tag updates. For now, we'll skip tag updates in service layer.
    // The DB function for updatePostInDB doesn't handle tags.
  }
  updatedPost.tagged_users = await PostDB.getTaggedUsersForPost(updatedPost.id);
  if (updatedPost.original_post_id) {
    updatedPost.original_post_details = await getPostById(updatedPost.original_post_id, userId);
  }
  return updatedPost;
};

export const deleteExistingPost = async (postId: string, userId: string): Promise<boolean> => {
  const post = await PostDB.findPostById(postId);
  if (!post) {
    throw new Error('Post not found.');
  }
  if (post.user_id !== userId) {
    // In future, admin/moderator role could also delete
    throw new Error('User not authorized to delete this post.');
  }

  // Transaction needed here in a real app to ensure all or nothing.
  // 1. Delete associated likes
  await LikeDB.deleteLikesByPostId(postId);
  // 2. Delete associated comments
  await CommentDB.deleteCommentsByPostId(postId);
  // 3. Delete associated tagged users (if a separate table `PostTaggedUsers` is managed directly)
  //    Assuming `PostTaggedUsers` has ON DELETE CASCADE for post_id, or handle explicitly:
  //    await PostDB.deleteTaggedUsersByPostId(postId); (if such function exists)

  // 4. Delete the post itself
  const deleted = await PostDB.deletePostFromDB(postId, userId);
  return deleted;
};

export const shareExistingPost = async (data: SharePostDTO): Promise<Post | null> => {
  const { user_id, original_post_id, privacy_level } = data;

  const sharer = await findUserById(user_id);
  if (!sharer) {
    throw new Error('User attempting to share not found.');
  }

  const originalPost = await PostDB.findPostById(original_post_id, user_id); // currentUserId for like status on original
  if (!originalPost) {
    throw new Error('Original post not found.');
  }

  // Privacy check for sharing:
  // Can't share a private post unless you are the owner (even then, sharing implies making it less private).
  // Can't share a 'friends' post of someone else to your own 'public' audience easily.
  // This logic can be complex.
  if (originalPost.privacy_level === 'private' && originalPost.user_id !== user_id) {
    throw new Error('Cannot share a private post from another user.');
  }
  if (originalPost.privacy_level === 'friends' && originalPost.user_id !== user_id) {
    // Add friend check: if not friends with original poster, cannot share their 'friends' post.
    // For now, basic restriction:
    throw new Error("Cannot share a 'friends' post from another user at this time.");
  }
  // Prevent re-sharing a share (optional rule)
  if (originalPost.original_post_id) {
      throw new Error('Cannot re-share a post that is already a share.');
  }

  // Validate privacy level for the new shared post
  if (!['public', 'friends', 'private'].includes(privacy_level)) {
      throw new Error('Invalid privacy level specified for the shared post.');
  }


  const sharedPost = await PostDB.createSharedPost(data);
  if (sharedPost) {
      sharedPost.tagged_users = await PostDB.getTaggedUsersForPost(sharedPost.id);
      // The DB function for createSharedPost should ideally return a full Post object
      // including author and original_post_details if possible, or we fetch them here.
      // For now, findPostById is used by createSharedPost in DB layer.
      if (sharedPost.original_post_id) {
        // Populate the original_post_details for the returned shared post.
        // Pass currentUserId (sharer's ID) to get their like status on the original post.
        sharedPost.original_post_details = await getPostById(sharedPost.original_post_id, user_id);
      }
  }
  return sharedPost;
};

// Placeholder for friend check logic
// const areFriends = async (userId1: string, userId2: string): Promise<boolean> => {
//   // Implementation depends on how friend relationships are stored (e.g., a "Friendships" table)
//   // For now, assume false or implement a basic version if User model has direct friends list
//   return false;
// };
