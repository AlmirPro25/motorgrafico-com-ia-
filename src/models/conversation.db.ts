import { query } from '../config/db';
import {
  Conversation,
  ConversationParticipant,
  ConversationType,
  ConversationPaginationOptions,
} from './conversation.types';
import { Message } from './message.types'; // For last_message
import { PublicUserProfile } from './user.types';

const DEFAULT_PAGE_LIMIT = 15;

// Helper to map row to Conversation object (complex due to participants, last message, unread count)
const mapRowToConversation = async (row: any, currentUserId: string): Promise<Conversation> => {
    const conversation: Conversation = {
        id: row.id,
        type: row.type,
        created_by_user_id: row.created_by_user_id,
        title: row.title,
        last_message_id: row.last_message_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        participants: [], // To be populated
        // last_message: undefined, // To be populated
        // unread_count: 0, // To be populated
    };

    // Populate last_message (simplified, assumes last_message_content etc. are joined)
    if (row.last_message_id && row.last_message_content_text) {
        conversation.last_message = {
            id: row.last_message_id,
            conversation_id: row.id,
            sender_id: row.last_message_sender_id,
            content_text: row.last_message_content_text,
            created_at: row.last_message_created_at,
            updated_at: row.last_message_created_at, // Assuming no edits for last message preview
            sender: {
                id: row.last_message_sender_user_id,
                handle: row.last_message_sender_handle,
                profile_picture_url: row.last_message_sender_profile_pic,
            } as PublicUserProfile
        } as Message;
    }
    
    // Populate unread_count (assumes unread_messages_count is joined and calculated for currentUserId)
    conversation.unread_count = row.unread_messages_count ? parseInt(row.unread_messages_count, 10) : 0;
    
    // Populate participants (assumes they are fetched separately or joined in a more complex query)
    // For simplicity, this mapping assumes participant details might be fetched in service or a more complex query
    // If participants are joined as an array of JSON objects:
    if (row.participants_data) { // e.g., participants_data is from ARRAY_AGG(JSON_BUILD_OBJECT(...))
        conversation.participants = row.participants_data.map((p: any) => ({
            id: p.user_id,
            handle: p.handle,
            first_name: p.first_name,
            last_name: p.last_name,
            profile_picture_url: p.profile_picture_url,
        }));
    }


    return conversation;
};

export const createConversation = async (
  participantUserIds: string[],
  type: ConversationType,
  creatorUserId?: string, // For one-on-one, this is one of the participants
  title?: string
): Promise<Conversation> => {
  const convSql = `
    INSERT INTO "Conversations" (type, created_by_user_id, title)
    VALUES ($1, $2, $3)
    RETURNING id, created_at, updated_at, type;
  `;
  try {
    const { rows: convRows } = await query(convSql, [type, creatorUserId, title]);
    const conversationId = convRows[0].id;

    // Add participants
    const participantPromises = participantUserIds.map(userId =>
      addParticipantToConversation(conversationId, userId)
    );
    await Promise.all(participantPromises);
    
    // For one-on-one, mark creator's last_read_at initially to now to avoid unread for self.
    if (creatorUserId && type === 'one_on_one') {
        await updateParticipantLastReadAt(conversationId, creatorUserId);
    }


    // Fetch the full conversation object (without messages/unread yet as it's new)
    const newConv = await findConversationById(conversationId, creatorUserId);
    if (!newConv) throw new Error('Failed to create or find conversation after insertion.');
    return newConv;

  } catch (error) {
    console.error('Error creating conversation:', error);
    throw error;
  }
};

export const addParticipantToConversation = async (
  conversationId: string,
  userId: string
): Promise<ConversationParticipant> => {
  const sql = `
    INSERT INTO "ConversationParticipants" (conversation_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (conversation_id, user_id) DO NOTHING -- Or DO UPDATE SET joined_at = NOW() if rejoining
    RETURNING *;
  `;
  try {
    const { rows } = await query(sql, [conversationId, userId]);
    if (rows.length > 0) return rows[0];
    // If conflict and row already existed, fetch it
    const existing = await getParticipantDetails(conversationId, userId);
    if (!existing) throw new Error('Failed to add or find participant.'); // Should not happen
    return existing;
  } catch (error) {
    console.error(`Error adding participant ${userId} to conversation ${conversationId}:`, error);
    throw error;
  }
};

export const findConversationById = async (conversationId: string, currentUserId?: string): Promise<Conversation | null> => {
  // This query needs to be quite comprehensive: get conversation, its participants, last message, and unread count for currentUserId
  // This is a simplified version. A full version would involve more complex joins or multiple queries.
  const sql = `
    SELECT
      c.*,
      lm.id AS last_message_id,
      lm.content_text AS last_message_content_text,
      lm.sender_id AS last_message_sender_id,
      lm.created_at AS last_message_created_at,
      lmsu.handle AS last_message_sender_handle,
      lmsu.profile_picture_url AS last_message_sender_profile_pic,
      lmsu.id AS last_message_sender_user_id,
      (
        SELECT COUNT(m.id)
        FROM "Messages" m
        LEFT JOIN "ConversationParticipants" cp_read ON m.conversation_id = cp_read.conversation_id AND cp_read.user_id = $2
        WHERE m.conversation_id = c.id AND m.sender_id != $2 AND (m.created_at > cp_read.last_read_at OR cp_read.last_read_at IS NULL)
      ) AS unread_messages_count,
      (
        SELECT ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'user_id', u.id,
            'handle', u.handle,
            'first_name', u.first_name,
            'last_name', u.last_name,
            'profile_picture_url', u.profile_picture_url
          )
        )
        FROM "ConversationParticipants" cp_users
        JOIN "Users" u ON cp_users.user_id = u.id
        WHERE cp_users.conversation_id = c.id
      ) AS participants_data
    FROM "Conversations" c
    LEFT JOIN "Messages" lm ON c.last_message_id = lm.id
    LEFT JOIN "Users" lmsu ON lm.sender_id = lmsu.id
    WHERE c.id = $1;
  `;
  try {
    const { rows } = await query(sql, [conversationId, currentUserId]);
    if (rows.length === 0) return null;
    // Ensure user is part of this conversation if currentUserId is provided (service layer should also check)
    if (currentUserId) {
        const participantIds = (rows[0].participants_data || []).map((p: any) => p.user_id);
        if (!participantIds.includes(currentUserId)) {
            // User is not a participant, should not be able to fetch this conversation
            // This check is important for security.
            return null; 
        }
    }
    return mapRowToConversation(rows[0], currentUserId || ''); // Pass empty if no currentUserId, mapRow will handle
  } catch (error) {
    console.error(`Error finding conversation by id (${conversationId}):`, error);
    throw error;
  }
};

export const findConversationsByUserId = async (
  userId: string,
  options: ConversationPaginationOptions
): Promise<Conversation[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT } = options;
  const offset = (page - 1) * limit;

  // This is a complex query. It needs to:
  // 1. Get conversations the user is part of.
  // 2. For each conversation, get other participants.
  // 3. Get the last message.
  // 4. Get the unread message count for the current user.
  // 5. Order by the last message's timestamp (i.e., conversation.updated_at which should mirror this).
  const sql = `
    SELECT
      c.*,
      lm.id AS last_message_id,
      lm.content_text AS last_message_content_text,
      lm.sender_id AS last_message_sender_id,
      lm.created_at AS last_message_created_at,
      lmsu.handle AS last_message_sender_handle,
      lmsu.profile_picture_url AS last_message_sender_profile_pic,
      lmsu.id AS last_message_sender_user_id,
      (
        SELECT COUNT(m.id)
        FROM "Messages" m
        WHERE m.conversation_id = c.id 
          AND m.sender_id != $1 
          AND (m.created_at > cp.last_read_at OR cp.last_read_at IS NULL)
      ) AS unread_messages_count,
      (
        SELECT ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'user_id', u_part.id,
            'handle', u_part.handle,
            'first_name', u_part.first_name,
            'last_name', u_part.last_name,
            'profile_picture_url', u_part.profile_picture_url
          )
        )
        FROM "ConversationParticipants" cp_users
        JOIN "Users" u_part ON cp_users.user_id = u_part.id
        WHERE cp_users.conversation_id = c.id
      ) AS participants_data
    FROM "Conversations" c
    JOIN "ConversationParticipants" cp ON c.id = cp.conversation_id
    LEFT JOIN "Messages" lm ON c.last_message_id = lm.id
    LEFT JOIN "Users" lmsu ON lm.sender_id = lmsu.id
    WHERE cp.user_id = $1
    ORDER BY c.updated_at DESC -- Assuming updated_at is touched when new message arrives
    LIMIT $2 OFFSET $3;
  `;
  try {
    const { rows } = await query(sql, [userId, limit, offset]);
    return Promise.all(rows.map(row => mapRowToConversation(row, userId)));
  } catch (error) {
    console.error(`Error finding conversations for user (${userId}):`, error);
    throw error;
  }
};


export const findDirectConversationByParticipantIds = async (
  userId1: string,
  userId2: string
): Promise<Conversation | null> => {
  // Find a 'one_on_one' conversation that has EXACTLY these two participants.
  const sql = `
    SELECT c.id
    FROM "Conversations" c
    JOIN "ConversationParticipants" cp1 ON c.id = cp1.conversation_id AND cp1.user_id = $1
    JOIN "ConversationParticipants" cp2 ON c.id = cp2.conversation_id AND cp2.user_id = $2
    WHERE c.type = 'one_on_one'
    AND (SELECT COUNT(*) FROM "ConversationParticipants" cp_count WHERE cp_count.conversation_id = c.id) = 2;
  `;
  // This query ensures only conversations with exactly two participants (userId1 and userId2) are returned.
  try {
    const { rows } = await query(sql, [userId1, userId2]);
    if (rows.length === 0) return null;
    // Found a conversation ID, now fetch the full conversation object
    return findConversationById(rows[0].id, userId1); // Pass one of userIds as current user for context
  } catch (error) {
    console.error('Error finding direct conversation by participant IDs:', error);
    throw error;
  }
};

export const updateConversationTimestamp = async (conversationId: string, lastMessageId: string): Promise<void> => {
  const sql = `
    UPDATE "Conversations"
    SET updated_at = CURRENT_TIMESTAMP, last_message_id = $2
    WHERE id = $1;
  `;
  try {
    await query(sql, [conversationId, lastMessageId]);
  } catch (error) {
    console.error(`Error updating conversation timestamp for ${conversationId}:`, error);
    throw error;
  }
};

export const updateParticipantLastReadAt = async (conversationId: string, userId: string): Promise<void> => {
  const sql = `
    UPDATE "ConversationParticipants"
    SET last_read_at = CURRENT_TIMESTAMP
    WHERE conversation_id = $1 AND user_id = $2;
  `;
  try {
    const result = await query(sql, [conversationId, userId]);
    if (result.rowCount === 0) {
        // This might happen if user is not a participant, or if trying to update too quickly (though unlikely for timestamp)
        // Or if they were just added and the record isn't there yet (ON CONFLICT on addParticipant should handle this).
        // For now, log if this happens, but don't throw an error as it's not always critical.
        console.warn(`Updating last_read_at for user ${userId} in conversation ${conversationId} affected 0 rows.`);
    }
  } catch (error) {
    console.error(`Error updating participant last_read_at for user ${userId} in conv ${conversationId}:`, error);
    throw error;
  }
};

export const getParticipantIds = async (conversationId: string): Promise<string[]> => {
    const sql = `SELECT user_id FROM "ConversationParticipants" WHERE conversation_id = $1;`;
    try {
        const { rows } = await query(sql, [conversationId]);
        return rows.map(r => r.user_id);
    } catch (error) {
        console.error(`Error getting participant IDs for conversation ${conversationId}:`, error);
        throw error;
    }
};

export const getParticipantDetails = async (conversationId: string, userId: string): Promise<ConversationParticipant | null> => {
    const sql = `SELECT * FROM "ConversationParticipants" WHERE conversation_id = $1 AND user_id = $2;`;
    try {
        const { rows } = await query(sql, [conversationId, userId]);
        return rows[0] || null;
    } catch (error) {
        console.error(`Error getting participant details for user ${userId} in conv ${conversationId}:`, error);
        throw error;
    }
};

// TODO: Function for total count of conversations for pagination
// export const countConversationsByUserId = async (userId: string): Promise<number> => { ... }
