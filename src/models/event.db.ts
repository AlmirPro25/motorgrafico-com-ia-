import { query } from '../config/db';
import {
  Event, CreateEventDTO, UpdateEventDTO, EventFilterOptions, EventPaginationOptions,
  EventParticipant, RsvpStatus,
  EventComment, CreateEventCommentDTO, UpdateEventCommentDTO
} from './event.types';
import { PublicUserProfile } from './user.types';

const DEFAULT_PAGE_LIMIT = 10;

// --- Helper Functions ---
const mapRowToEvent = (row: any, currentUserId?: string): Event => {
  const event: Event = {
    id: row.id,
    creator_id: row.creator_id,
    title: row.title,
    description: row.description,
    start_time: new Date(row.start_time),
    end_time: row.end_time ? new Date(row.end_time) : undefined,
    location_name: row.location_name,
    location_address: row.location_address,
    location_latitude: row.location_latitude,
    location_longitude: row.location_longitude,
    cover_image_url: row.cover_image_url,
    privacy: row.privacy,
    category: row.category,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    creator_profile: row.creator_handle ? {
        id: row.creator_id,
        handle: row.creator_handle,
        first_name: row.creator_first_name,
        last_name: row.creator_last_name,
        profile_picture_url: row.creator_profile_picture_url,
    } : undefined,
    participant_counts: { // Assuming these are joined or calculated
        going: parseInt(row.going_count, 10) || 0,
        interested: parseInt(row.interested_count, 10) || 0,
        not_going: parseInt(row.not_going_count, 10) || 0,
    },
    current_user_rsvp: row.current_user_rsvp_status || undefined,
  };
  return event;
};

const mapRowToEventParticipant = (row: any): EventParticipant => ({
  event_id: row.event_id,
  user_id: row.user_id,
  rsvp_status: row.rsvp_status,
  attended: row.attended,
  rsvped_at: new Date(row.rsvped_at),
  user_profile: row.user_handle ? {
      id: row.user_id,
      handle: row.user_handle,
      first_name: row.user_first_name,
      last_name: row.user_last_name,
      profile_picture_url: row.user_profile_picture_url,
  } : undefined,
});

const mapRowToEventComment = (row: any): EventComment => ({
  id: row.id,
  event_id: row.event_id,
  user_id: row.user_id,
  parent_comment_id: row.parent_comment_id,
  content_text: row.content_text,
  created_at: new Date(row.created_at),
  updated_at: new Date(row.updated_at),
  author_profile: row.author_handle ? {
      id: row.user_id,
      handle: row.author_handle,
      first_name: row.author_first_name,
      last_name: row.author_last_name,
      profile_picture_url: row.author_profile_picture_url,
  } : undefined,
});


// --- Event Functions ---
export const createEvent = async (data: CreateEventDTO): Promise<Event> => {
  const {
    creator_id, title, description, start_time, end_time,
    location_name, location_address, location_latitude, location_longitude,
    cover_image_url, privacy, category
  } = data;
  const sql = `
    INSERT INTO "Events" (creator_id, title, description, start_time, end_time, location_name, location_address, location_latitude, location_longitude, cover_image_url, privacy, category)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id;
  `;
  try {
    const { rows } = await query(sql, [
      creator_id, title, description, start_time, end_time,
      location_name, location_address, location_latitude, location_longitude,
      cover_image_url, privacy, category
    ]);
    const newEvent = await findEventById(rows[0].id, creator_id); // Pass creator as current user for rsvp status
    if (!newEvent) throw new Error('Failed to create or find event after insertion.');
    return newEvent;
  } catch (error) {
    console.error('Error creating event:', error);
    throw error;
  }
};

export const findEventById = async (eventId: string, currentUserId?: string): Promise<Event | null> => {
  // Query needs to join creator profile, participant counts, and current user's RSVP status
  const sql = `
    SELECT
      e.*,
      uc.handle AS creator_handle, uc.first_name AS creator_first_name, uc.last_name AS creator_last_name, uc.profile_picture_url AS creator_profile_picture_url,
      (SELECT COUNT(*) FROM "EventParticipants" ep WHERE ep.event_id = e.id AND ep.rsvp_status = 'going') AS going_count,
      (SELECT COUNT(*) FROM "EventParticipants" ep WHERE ep.event_id = e.id AND ep.rsvp_status = 'interested') AS interested_count,
      (SELECT COUNT(*) FROM "EventParticipants" ep WHERE ep.event_id = e.id AND ep.rsvp_status = 'not_going') AS not_going_count
      ${currentUserId ? ', (SELECT ep_user.rsvp_status FROM "EventParticipants" ep_user WHERE ep_user.event_id = e.id AND ep_user.user_id = $2) AS current_user_rsvp_status' : ''}
    FROM "Events" e
    JOIN "Users" uc ON e.creator_id = uc.id
    WHERE e.id = $1;
  `;
  try {
    const params = currentUserId ? [eventId, currentUserId] : [eventId];
    const { rows } = await query(sql, params);
    if (rows.length === 0) return null;
    return mapRowToEvent(rows[0], currentUserId);
  } catch (error) {
    console.error(`Error finding event by ID (${eventId}):`, error);
    throw error;
  }
};

export const findAllEvents = async (
  filters: EventFilterOptions,
  pagination: EventPaginationOptions,
  currentUserId?: string
): Promise<Event[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT } = pagination;
  const offset = (page - 1) * limit;
  let whereClauses: string[] = [];
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (filters.type === 'upcoming') whereClauses.push(`e.start_time > NOW()`);
  else if (filters.type === 'past') whereClauses.push(`e.start_time <= NOW()`);

  if (filters.creator_id) {
    whereClauses.push(`e.creator_id = $${paramIndex++}`);
    queryParams.push(filters.creator_id);
  }
  if (filters.category) {
    whereClauses.push(`e.category ILIKE $${paramIndex++}`);
    queryParams.push(`%${filters.category}%`);
  }
  if (filters.privacy && filters.privacy.length > 0) {
    whereClauses.push(`e.privacy IN (${filters.privacy.map(() => `$${paramIndex++}`).join(', ')})`);
    queryParams.push(...filters.privacy);
  }
  if (filters.attending_user_id) {
    // Events user is 'going' or 'interested'
    whereClauses.push(`EXISTS (
        SELECT 1 FROM "EventParticipants" ep_attend
        WHERE ep_attend.event_id = e.id
          AND ep_attend.user_id = $${paramIndex++}
          AND ep_attend.rsvp_status IN ('going', 'interested')
    )`);
    queryParams.push(filters.attending_user_id);
  }

  const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  const currentUserIdParamForSelect = currentUserId ? `$${paramIndex++}` : "NULL";
  if (currentUserId) queryParams.push(currentUserId);

  queryParams.push(limit, offset); // For LIMIT and OFFSET

  const sql = `
    SELECT
      e.*,
      uc.handle AS creator_handle, uc.first_name AS creator_first_name, uc.last_name AS creator_last_name, uc.profile_picture_url AS creator_profile_picture_url,
      (SELECT COUNT(*) FROM "EventParticipants" ep WHERE ep.event_id = e.id AND ep.rsvp_status = 'going') AS going_count,
      (SELECT COUNT(*) FROM "EventParticipants" ep WHERE ep.event_id = e.id AND ep.rsvp_status = 'interested') AS interested_count,
      (SELECT COUNT(*) FROM "EventParticipants" ep WHERE ep.event_id = e.id AND ep.rsvp_status = 'not_going') AS not_going_count,
      (SELECT ep_user.rsvp_status FROM "EventParticipants" ep_user WHERE ep_user.event_id = e.id AND ep_user.user_id = ${currentUserIdParamForSelect}) AS current_user_rsvp_status
    FROM "Events" e
    JOIN "Users" uc ON e.creator_id = uc.id
    ${whereString}
    ORDER BY e.start_time ${filters.type === 'past' ? 'DESC' : 'ASC'}
    LIMIT $${paramIndex++} OFFSET $${paramIndex++};
  `;
  try {
    const { rows } = await query(sql, queryParams);
    return rows.map(row => mapRowToEvent(row, currentUserId));
  } catch (error) {
    console.error('Error finding all events:', error);
    throw error;
  }
};

export const updateEventInDB = async (eventId: string, userId: string, data: UpdateEventDTO): Promise<Event | null> => {
    const fields = Object.keys(data) as Array<keyof UpdateEventDTO>;
    if (fields.length === 0) return findEventById(eventId, userId);

    const setClauses = fields.map((field, i) => `"${field}" = $${i + 1}`).join(', ');
    const values = fields.map(field => data[field]);
    values.push(eventId, userId); // For WHERE clause

    const sql = `
        UPDATE "Events"
        SET ${setClauses}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${fields.length + 1} AND creator_id = $${fields.length + 2}
        RETURNING id;
    `;
    try {
        const { rows } = await query(sql, values);
        if (rows.length === 0) return null; // Not found or not owner
        return findEventById(rows[0].id, userId);
    } catch (error) {
        console.error(`Error updating event (${eventId}):`, error);
        throw error;
    }
};

export const deleteEventFromDB = async (eventId: string, userId: string): Promise<boolean> => {
  // Cascade delete for participants/comments should be handled by DB schema (ON DELETE CASCADE)
  // If not, delete them here first.
  const sql = `DELETE FROM "Events" WHERE id = $1 AND creator_id = $2;`;
  try {
    const result = await query(sql, [eventId, userId]);
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error(`Error deleting event (${eventId}):`, error);
    throw error;
  }
};

// --- RSVP (EventParticipant) Functions ---
export const createOrUpdateRsvp = async (eventId: string, userId: string, rsvpStatus: RsvpStatus): Promise<EventParticipant> => {
  const sql = `
    INSERT INTO "EventParticipants" (event_id, user_id, rsvp_status)
    VALUES ($1, $2, $3)
    ON CONFLICT (event_id, user_id) DO UPDATE SET rsvp_status = EXCLUDED.rsvp_status, rsvped_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;
  try {
    const { rows } = await query(sql, [eventId, userId, rsvpStatus]);
    // Fetch with user profile for consistency
    const rsvp = rows[0];
    const participant = await findRsvpByEventAndUser(rsvp.event_id, rsvp.user_id);
    if (!participant) throw new Error("Failed to create/update RSVP or fetch details.");
    return participant;

  } catch (error) {
    console.error(`Error creating/updating RSVP for event ${eventId}, user ${userId}:`, error);
    throw error;
  }
};

export const findParticipantsByEventId = async (
    eventId: string,
    pagination: EventPaginationOptions,
    rsvpFilter?: RsvpStatus[] // Optional: filter by specific RSVP statuses
): Promise<EventParticipant[]> => {
    const { page = 1, limit = DEFAULT_PAGE_LIMIT } = pagination;
    const offset = (page - 1) * limit;
    let filterClause = "";
    const params: any[] = [eventId, limit, offset];

    if (rsvpFilter && rsvpFilter.length > 0) {
        filterClause = `AND ep.rsvp_status IN (${rsvpFilter.map((_, i) => `$${params.length + i + 1}`).join(',')})`;
        params.push(...rsvpFilter);
    }

    const sql = `
        SELECT ep.*,
               u.handle AS user_handle, u.first_name AS user_first_name, u.last_name AS user_last_name, u.profile_picture_url AS user_profile_picture_url
        FROM "EventParticipants" ep
        JOIN "Users" u ON ep.user_id = u.id
        WHERE ep.event_id = $1 ${filterClause}
        ORDER BY ep.rsvped_at DESC
        LIMIT $2 OFFSET $3;
    `;
    try {
        const { rows } = await query(sql, params);
        return rows.map(mapRowToEventParticipant);
    } catch (error) {
        console.error(`Error finding participants for event (${eventId}):`, error);
        throw error;
    }
};

export const findRsvpByEventAndUser = async (eventId: string, userId: string): Promise<EventParticipant | null> => {
  const sql = `
    SELECT ep.*,
           u.handle AS user_handle, u.first_name AS user_first_name, u.last_name AS user_last_name, u.profile_picture_url AS user_profile_picture_url
    FROM "EventParticipants" ep
    JOIN "Users" u ON ep.user_id = u.id
    WHERE ep.event_id = $1 AND ep.user_id = $2;
  `;
  try {
    const { rows } = await query(sql, [eventId, userId]);
    return rows.length > 0 ? mapRowToEventParticipant(rows[0]) : null;
  } catch (error) {
    console.error(`Error finding RSVP for event ${eventId}, user ${userId}:`, error);
    throw error;
  }
};

export const getParticipantCount = async (eventId: string, rsvpStatus: RsvpStatus): Promise<number> => {
  const sql = `SELECT COUNT(*) FROM "EventParticipants" WHERE event_id = $1 AND rsvp_status = $2;`;
  try {
    const { rows } = await query(sql, [eventId, rsvpStatus]);
    return parseInt(rows[0].count, 10);
  } catch (error) {
    console.error(`Error getting participant count for event ${eventId}, status ${rsvpStatus}:`, error);
    throw error;
  }
};

// --- EventComment Functions ---
export const createEventComment = async (data: CreateEventCommentDTO): Promise<EventComment> => {
  const { event_id, user_id, parent_comment_id, content_text } = data;
  const sql = `
    INSERT INTO "EventComments" (event_id, user_id, parent_comment_id, content_text)
    VALUES ($1, $2, $3, $4)
    RETURNING id;
  `;
  try {
    const { rows } = await query(sql, [event_id, user_id, parent_comment_id, content_text]);
    const newComment = await findEventCommentById(rows[0].id);
    if (!newComment) throw new Error('Failed to create or find comment after insertion.');
    return newComment;
  } catch (error) {
    console.error('Error creating event comment:', error);
    throw error;
  }
};

export const findEventCommentById = async (commentId: string): Promise<EventComment | null> => {
  const sql = `
    SELECT ec.*,
           u.handle AS author_handle, u.first_name AS author_first_name, u.last_name AS author_last_name, u.profile_picture_url AS author_profile_picture_url
    FROM "EventComments" ec
    JOIN "Users" u ON ec.user_id = u.id
    WHERE ec.id = $1;
  `;
  try {
    const { rows } = await query(sql, [commentId]);
    return rows.length > 0 ? mapRowToEventComment(rows[0]) : null;
  } catch (error) {
    console.error(`Error finding event comment by ID (${commentId}):`, error);
    throw error;
  }
};

export const findCommentsByEventId = async (
  eventId: string,
  pagination: EventPaginationOptions
): Promise<EventComment[]> => {
  const { page = 1, limit = DEFAULT_PAGE_LIMIT } = pagination;
  const offset = (page - 1) * limit;
  const sql = `
    SELECT ec.*,
           u.handle AS author_handle, u.first_name AS author_first_name, u.last_name AS author_last_name, u.profile_picture_url AS author_profile_picture_url
    FROM "EventComments" ec
    JOIN "Users" u ON ec.user_id = u.id
    WHERE ec.event_id = $1
    ORDER BY ec.created_at DESC -- Or ASC for chronological
    LIMIT $2 OFFSET $3;
  `;
  try {
    const { rows } = await query(sql, [eventId, limit, offset]);
    return rows.map(mapRowToEventComment);
  } catch (error) {
    console.error(`Error finding comments for event (${eventId}):`, error);
    throw error;
  }
};

export const updateEventCommentInDB = async (commentId: string, userId: string, data: UpdateEventCommentDTO): Promise<EventComment | null> => {
  const sql = `
    UPDATE "EventComments"
    SET content_text = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2 AND user_id = $3
    RETURNING id;
  `;
  try {
    const { rows } = await query(sql, [data.content_text, commentId, userId]);
    if (rows.length === 0) return null; // Not found or not owner
    return findEventCommentById(rows[0].id);
  } catch (error) {
    console.error(`Error updating event comment (${commentId}):`, error);
    throw error;
  }
};

export const deleteEventCommentFromDB = async (commentId: string, userId: string, isEventCreator: boolean = false): Promise<boolean> => {
  let sql: string;
  const params: any[] = [commentId];

  if (isEventCreator) {
    // Event creator can delete any comment on their event
    sql = `DELETE FROM "EventComments" WHERE id = $1 RETURNING event_id;`;
    // No user_id check needed for deletion itself, but service layer should verify isEventCreator
  } else {
    // Comment owner can delete their own comment
    sql = `DELETE FROM "EventComments" WHERE id = $1 AND user_id = $2 RETURNING event_id;`;
    params.push(userId);
  }

  try {
    const result = await query(sql, params);
    return result.rowCount !== null && result.rowCount > 0;
  } catch (error) {
    console.error(`Error deleting event comment (${commentId}):`, error);
    throw error;
  }
};

// TODO: Count functions for pagination (events, participants, comments)
// export const countAllEvents = async (filters: EventFilterOptions, currentUserId?: string): Promise<number> => { ... }
// export const countParticipantsByEventId = async (eventId: string, rsvpFilter?: RsvpStatus[]): Promise<number> => { ... }
// export const countCommentsByEventId = async (eventId: string): Promise<number> => { ... }
