import * as LikeDB from '../models/like.db';
import * as PostService from './post.service'; // To check post existence and privacy
import * as UserDB from '../models/user.db';   // To check user existence
import * as NotificationService from './notification.service'; // Import NotificationService
import { Like } from '../models/like.types';
import { Post } from '../models/post.types'; // For getting post details
import { CreateNotificationDTO } from '../models/notification.types'; // For DTO

export const likePost = async (postId: string, userId: string): Promise<Like | null> => {
  // 1. Validate user exists
  const userExists = await UserDB.findUserById(userId);
  if (!userExists) {
    throw new Error('User not found.');
  }

  // 2. Validate post exists and user can view it (respects privacy)
  // Use PostService.getPostById as it encapsulates privacy logic
  const post = await PostService.getPostById(postId, userId);
  if (!post) {
    throw new Error('Post not found or user does not have permission to view it.');
  }
  // Note: getPostById returns null if post is private and userId is not owner,
  // or if post is 'friends' and userId is not owner (current simplification).
  // So, if 'post' is null here, it means user can't see it, thus can't like it.

  // 3. Create the like
  // The DB function `createLike` has ON CONFLICT DO NOTHING, so it's safe to call.
  // It returns the new like, or fetches existing if it was already liked.
  const like = await LikeDB.createLike(postId, userId);

  if (!like) {
    // This might happen if createLike fails for reasons other than conflict (e.g. DB error not caught by findLike fallback)
    // Or if findLike fallback in createLike also fails.
    throw new Error('Failed to create or find like.');
  }

  // Send notification to post owner if someone else liked their post
  if (post && post.user_id !== userId) { // Ensure post data is available and liker is not post owner
    const likerProfile = await UserDB.findUserById(userId); // Get liker's profile for the notification message
    if (likerProfile) {
        const notificationDTO: CreateNotificationDTO = {
            recipient_user_id: post.user_id,
            actor_user_id: userId,
            type: 'new_like',
            target_entity_type: 'post',
            target_entity_id: postId,
            message: `${likerProfile.first_name || likerProfile.handle} liked your post.`,
        };
        // Fire and forget notification, no need to await for likePost response
        NotificationService.createNotificationAndEmit(notificationDTO)
            .catch(err => console.error("Failed to send 'new_like' notification:", err));
    }
  }

  return like;
};

export const unlikePost = async (postId: string, userId: string): Promise<boolean> => {
  // 1. Validate user exists (optional, as deleteLike won't fail but good practice)
  const userExists = await UserDB.findUserById(userId);
  if (!userExists) {
    throw new Error('User not found.');
  }

  // 2. Validate post exists (optional, as deleteLike won't fail if post_id is invalid, but good practice)
  // No need to check full privacy here; if a like exists, they must have been able to see it once.
  // However, ensuring the post still exists can be a good check.
  const postExists = await PostService.getPostById(postId, userId); // Check if post is viewable by user
  if (!postExists) {
    // If post is no longer viewable or doesn't exist, cannot unlike (or like entry shouldn't exist)
    // This might be overly strict if a user wants to unlike a post that later became private to them.
    // For now, let's assume you must be able to "see" a post to interact with its likes.
    // A simpler check would be `PostDB.findPostById(postId)` without currentUserId for just existence.
  }


  // 3. Delete the like
  // `deleteLike` returns true if a row was deleted, false otherwise.
  return LikeDB.deleteLike(postId, userId);
};

export const getLikeStatus = async (postId: string, userId: string): Promise<{ isLiked: boolean; likeCount: number }> => {
    // 1. Check if post exists and is viewable by user (optional, but good for consistency)
    const post = await PostService.getPostById(postId, userId);
    if (!post) {
        // If post not found or not accessible, then user can't have liked it (or like shouldn't be relevant)
        // However, the original post.service.getPostById already returns like_count and is_liked_by_user
        // This function might be redundant if using that.
        // This is more for a direct "is this specific post liked by this user" query.
        // Let's assume it's okay if the post is not "currently" viewable by the user for this check.
        // (e.g. user liked a public post, then it became private to them - the like still exists)
    }

    const like = await LikeDB.findLike(postId, userId);
    const count = await LikeDB.getLikeCountByPostId(postId); // Or get from post object if available

    return {
        isLiked: !!like,
        likeCount: count,
    };
};

export const getLikesForPost = async (postId: string, options: PaginationOptions, currentUserId?: string) => {
    // Check if current user can view the post first
    const post = await PostService.getPostById(postId, currentUserId);
    if (!post) {
        throw new Error('Post not found or not accessible.');
    }
    return LikeDB.findUsersWhoLikedPost(postId, options);
    // TODO: Add total count for pagination
};
