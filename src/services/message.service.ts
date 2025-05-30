import * as MessageDB from '../models/message.db';
import * as ConversationDB from '../models/conversation.db';
import * as UserDB from '../models/user.db'; // For sender validation
import * as ConversationService from './conversation.service'; // To check participation
import { Message, SendMessageDTO, MessagePaginationOptions } from '../models/message.types';
// import { PaginatedMessages } from '../models/message.types'; // If returning this structure

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 30;

export const sendNewMessage = async (
  conversationId: string,
  senderId: string,
  content: Partial<Pick<SendMessageDTO, 'content_text' | 'content_image_url' | 'content_video_url'>>
): Promise<Message> => {
  // 1. Validate sender exists
  const sender = await UserDB.findUserById(senderId);
  if (!sender) {
    throw new Error('Sender not found.');
  }

  // 2. Validate conversation exists and sender is a participant
  const isParticipant = await ConversationService.isUserParticipant(conversationId, senderId);
  if (!isParticipant) {
    throw new Error('User is not a participant of this conversation.');
  }

  // 3. Validate message content (at least one field must be present)
  if (!content.content_text && !content.content_image_url && !content.content_video_url) {
    throw new Error('Message content (text, image, or video) is required.');
  }

  // 4. Create the message
  const messageData: SendMessageDTO = {
    conversation_id: conversationId,
    sender_id: senderId,
    ...content,
  };
  const newMessage = await MessageDB.createMessage(messageData);

  // 5. Update conversation's updated_at timestamp and last_message_id
  if (newMessage) {
    await ConversationDB.updateConversationTimestamp(conversationId, newMessage.id);
    // Also, mark the conversation as read for the sender up to this new message.
    await ConversationDB.updateParticipantLastReadAt(conversationId, senderId);

  } else {
    // This case should ideally not be reached if createMessage throws on failure
    throw new Error('Failed to send message.');
  }

  return newMessage;
};

export const getMessagesForConversation = async (
  conversationId: string,
  userId: string, // User requesting the messages
  options: MessagePaginationOptions
): Promise<Message[]> => { // Consider PaginatedMessages
  const { page = DEFAULT_PAGE, limit = DEFAULT_LIMIT, before_message_id } = options;

  // 1. Validate user is a participant of the conversation
  const isParticipant = await ConversationService.isUserParticipant(conversationId, userId);
  if (!isParticipant) {
    throw new Error('User is not authorized to view messages for this conversation.');
  }

  // 2. Fetch messages
  const messages = await MessageDB.findMessagesByConversationId(conversationId, { page, limit, before_message_id });
  
  // 3. Optionally, after fetching messages, mark the conversation as read for this user
  // This is often done when a user opens a chat.
  // await markConversationAsRead(conversationId, userId); // Or client triggers this explicitly

  return messages;
};

export const markConversationAsRead = async (conversationId: string, userId: string): Promise<void> => {
  // 1. Validate user is a participant
  const isParticipant = await ConversationService.isUserParticipant(conversationId, userId);
  if (!isParticipant) {
    throw new Error('User is not a participant of this conversation.');
  }

  // 2. Update last_read_at timestamp for the user in this conversation
  await ConversationDB.updateParticipantLastReadAt(conversationId, userId);
};

// Utility to get unread message count - this logic is complex with pure SQL in DB layer
// So, it's often handled here or approximated. The DB layer's findConversationsByUserId
// already includes an unread_messages_count. This could be a more direct way if needed.
export const calculateUnreadMessageCount = async (conversationId: string, userId: string): Promise<number> => {
    const participantDetails = await ConversationDB.getParticipantDetails(conversationId, userId);
    if (!participantDetails) {
        throw new Error("User is not a participant or conversation does not exist.");
    }
    const lastReadAt = participantDetails.last_read_at;

    // This requires fetching messages after lastReadAt and counting them.
    // This can be inefficient if called frequently.
    // The DB query in `findConversationsByUserId` is generally preferred for lists.
    // For a single conversation view, this might be okay, or client can count from messages.
    // For now, rely on the count from `findConversationsByUserId` or `findConversationById`.
    // This function demonstrates the logic if a dedicated count is needed.
    // const messages = await MessageDB.findMessagesByConversationId(conversationId, { limit: 1000 }); // Get recent messages
    // const unreadCount = messages.filter(m => m.sender_id !== userId && (!lastReadAt || new Date(m.created_at) > new Date(lastReadAt))).length;
    // return unreadCount;

    // Re-fetch conversation with current user context to get the pre-calculated unread_count
    const conversation = await ConversationDB.findConversationById(conversationId, userId);
    return conversation?.unread_count || 0;
};
