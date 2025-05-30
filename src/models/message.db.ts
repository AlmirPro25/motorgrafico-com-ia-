import { query } from '../config/db';
import { Message, SendMessageDTO, MessagePaginationOptions } from './message.types';
import { PublicUserProfile } from '../user.types';

const DEFAULT_PAGE_LIMIT = 30; // Messages are often fetched in larger batches

// Helper to map raw row to Message object, including sender
const mapRowToMessage = async (row: any): Promise<Message> => {
  const message: Message = {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    content_text: row.content_text,
    content_image_url: row.content_image_url,
    content_video_url: row.content_video_url,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sender: { // Basic sender info from the join
      id: row.sender_user_id, // Assuming alias from join
      handle: row.sender_handle,
      first_name: row.sender_first_name,
      last_name: row.sender_last_name,
      profile_picture_url: row.sender_profile_picture_url,
    } as PublicUserProfile,
  };
  return message;
};

export const createMessage = async (messageData: SendMessageDTO): Promise<Message> => {
  const { conversation_id, sender_id, content_text, content_image_url, content_video_url } = messageData;
  const sql = `
    INSERT INTO "Messages" (conversation_id, sender_id, content_text, content_image_url, content_video_url)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id;
  `;
  try {
    const { rows } = await query(sql, [conversation_id, sender_id, content_text, content_image_url, content_video_url]);
    const newMessageId = rows[0].id;

    // After creating message, update conversation's updated_at and last_message_id
    // This is handled in conversation.db.ts by updateConversationTimestamp for now
    // await updateConversationTimestamp(conversation_id, newMessageId); // Call from service layer

    const newMessage = await findMessageById(newMessageId);
    if (!newMessage) throw new Error('Failed to create or find message after insertion.');
    return newMessage;
  } catch (error) {
    console.error('Error creating message:', error);
    // Check for foreign key violation if conversation_id or sender_id is invalid
    if ((error as any).code === '23503') {
        throw new Error('Conversation or Sender not found for creating message.');
    }
    throw error;
  }
};

export const findMessageById = async (messageId: string): Promise<Message | null> => {
  const sql = `
    SELECT
      m.*,
      u.id AS sender_user_id,
      u.handle AS sender_handle,
      u.first_name AS sender_first_name,
      u.last_name AS sender_last_name,
      u.profile_picture_url AS sender_profile_picture_url
    FROM "Messages" m
    JOIN "Users" u ON m.sender_id = u.id
    WHERE m.id = $1;
  `;
  try {
    const { rows } = await query(sql, [messageId]);
    if (rows.length === 0) return null;
    return mapRowToMessage(rows[0]);
  } catch (error) {
    console.error(`Error finding message by id (${messageId}):`, error);
    throw error;
  }
};

export const findMessagesByConversationId = async (
  conversationId: string,
  options: MessagePaginationOptions
): Promise<Message[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT, before_message_id } = options;
  const offset = (page - 1) * limit; // Only used if not using before_message_id

  let sql: string;
  const params: any[] = [conversationId];

  // Base query part
  const baseSelect = `
    SELECT
      m.*,
      u.id AS sender_user_id,
      u.handle AS sender_handle,
      u.first_name AS sender_first_name,
      u.last_name AS sender_last_name,
      u.profile_picture_url AS sender_profile_picture_url
    FROM "Messages" m
    JOIN "Users" u ON m.sender_id = u.id
    WHERE m.conversation_id = $1
  `;

  if (before_message_id) {
    // Fetch messages older than the 'before_message_id' (cursor-like pagination)
    params.push(before_message_id);
    params.push(limit);
    sql = `
      ${baseSelect}
      AND m.created_at < (SELECT created_at FROM "Messages" WHERE id = $2)
      ORDER BY m.created_at DESC
      LIMIT $3;
    `;
  } else {
    // Standard offset pagination (usually for initial load or if no cursor)
    params.push(limit);
    params.push(offset);
    sql = `
      ${baseSelect}
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3;
    `;
  }

  try {
    const { rows } = await query(sql, params);
    // Messages are fetched in reverse chronological order (newest first for that page).
    // Clients usually want to display them oldest to newest, so reverse the array.
    return Promise.all(rows.map(row => mapRowToMessage(row)).reverse());
  } catch (error) {
    console.error(`Error finding messages by conversation id (${conversationId}):`, error);
    throw error;
  }
};

// TODO: countMessagesByConversationId for pagination if not using cursor
// export const countMessagesByConversationId = async (conversationId: string): Promise<number> => { ... }
