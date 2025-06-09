import * as ConversationDB from '../models/conversation.db';
import * as UserDB from '../models/user.db';
import {
  Conversation,
  ConversationPaginationOptions,
  // PaginatedConversations, // If returning this structure
} from '../models/conversation.types';
import { PublicUserProfile } from '../models/user.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 15;

export const getOrCreateOneOnOneConversation = async (
  currentUserId: string,
  targetUserId: string
): Promise<Conversation | null> => {
  if (currentUserId === targetUserId) {
    throw new Error('Cannot create a conversation with oneself.');
  }

  // Validate both users exist
  const currentUser = await UserDB.findUserById(currentUserId);
  const targetUser = await UserDB.findUserById(targetUserId);
  if (!currentUser || !targetUser) {
    throw new Error('One or both users not found.');
  }

  // Check if a conversation already exists between these two users
  let conversation = await ConversationDB.findDirectConversationByParticipantIds(currentUserId, targetUserId);

  if (!conversation) {
    // Create a new one-on-one conversation
    conversation = await ConversationDB.createConversation(
      [currentUserId, targetUserId],
      'one_on_one',
      currentUserId // Creator is the current user
    );
  }

  if (conversation) {
    // Ensure participant details are populated for the response (especially for newly created)
    // findDirectConversationByParticipantIds and createConversation -> findConversationById should already do this.
    // If not, fetch them explicitly.
    // For one-on-one, the other participant is targetUser.
    // The mapRowToConversation in DB layer tries to populate based on joined data.
    // We might need to specifically ensure the 'participants' array includes full PublicUserProfile objects.
    // The current DB queries for findConversationById and findConversationsByUserId use ARRAY_AGG to get participants_data.
    // Let's assume that's sufficient.
  }

  return conversation;
};

export const getUserConversations = async (
  userId: string,
  options: ConversationPaginationOptions
): Promise<Conversation[]> => { // Consider returning PaginatedConversations
  const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT } = options;

  const conversations = await ConversationDB.findConversationsByUserId(userId, { page, limit });

  // The DB query for findConversationsByUserId already attempts to join last message,
  // participant data (as JSON array), and calculate unread_messages_count.
  // The mapRowToConversation helper then parses this.
  // Any additional processing or data enrichment can happen here if needed.
  // For example, if participant details were just IDs from a simpler query,
  // you'd fetch full profiles here. But current DB query is more comprehensive.

  return conversations;
};

export const isUserParticipant = async (conversationId: string, userId: string): Promise<boolean> => {
  const participant = await ConversationDB.getParticipantDetails(conversationId, userId);
  return !!participant;
};

export const getConversationDetails = async (conversationId: string, currentUserId: string): Promise<Conversation | null> => {
    // Ensure user is a participant before allowing them to get details.
    // findConversationById in DB layer already has a check for this if currentUserId is provided.
    const conversation = await ConversationDB.findConversationById(conversationId, currentUserId);
    if (!conversation) {
        // This means either conversation doesn't exist or user is not a participant (as per DB check)
        throw new Error('Conversation not found or user is not a participant.');
    }
    return conversation;
};
