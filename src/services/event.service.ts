import * as EventDB from '../models/event.db';
import * as UserDB from '../models/user.db'; // For user validation
import * as FriendDB from '../models/friend.db'; // For 'friends_only' privacy if full check is done
import {
  Event, CreateEventDTO, UpdateEventDTO, EventFilterOptions, EventPaginationOptions,
  EventParticipant, RsvpStatus, RsvpDTO,
  EventComment, CreateEventCommentDTO, UpdateEventCommentDTO, PaginatedEventComments, PaginatedEventParticipants, PaginatedEvents
} from '../models/event.types';
import { UserSettings } from '../models/user.types'; // For future use with UserSettings if needed
// import { findUserSettingsByUserId } from '../models/user.settings.db'; // If event creation depends on user settings

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;

// --- Event Services ---
export const createNewEvent = async (data: CreateEventDTO): Promise<Event> => {
  const creator = await UserDB.findUserById(data.creator_id);
  if (!creator) {
    throw new Error('Event creator not found.');
  }
  // Validate start_time and end_time
  if (new Date(data.start_time) < new Date()) {
    // throw new Error('Event start time cannot be in the past.'); // Allow for flexibility, maybe for logging past events
  }
  if (data.end_time && new Date(data.end_time) < new Date(data.start_time)) {
    throw new Error('Event end time cannot be before start time.');
  }
  if (!['public', 'private', 'friends_only'].includes(data.privacy)) {
      throw new Error('Invalid event privacy setting.');
  }

  const event = await EventDB.createEvent(data);
  // Automatically RSVP creator as 'going' (optional product decision)
  await EventDB.createOrUpdateRsvp(event.id, data.creator_id, 'going');
  // Refetch to include creator's RSVP and updated counts
  return EventDB.findEventById(event.id, data.creator_id) as Promise<Event>;
};

export const getEventById = async (eventId: string, currentUserId?: string): Promise<Event | null> => {
  const event = await EventDB.findEventById(eventId, currentUserId);
  if (!event) return null;

  // Privacy Check
  if (event.privacy === 'private' && event.creator_id !== currentUserId) {
    return null; // Only creator can see private events
  }
  if (event.privacy === 'friends_only' && event.creator_id !== currentUserId) {
    if (!currentUserId) return null; // Anonymous users cannot see friends_only events
    // Simplified: For now, allow any authenticated user to see 'friends_only' if not creator.
    // TODO: Implement actual friend check:
    // const areFriends = await FriendDB.findFriendRequestBetweenUsers(event.creator_id, currentUserId)
    //                    .then(fr => fr?.status === 'accepted');
    // if (!areFriends) return null;
    console.warn(`'friends_only' privacy check for event ${eventId} is simplified. Full friend check needed.`);
  }
  return event;
};

export const getAllEvents = async (
  filters: EventFilterOptions,
  pagination: EventPaginationOptions,
  currentUserId?: string
): Promise<Event[]> => { // Consider PaginatedEvents
  // Apply default filters if not provided
  filters.type = filters.type || 'upcoming';
  
  // Default privacy filter for anonymous users: only public events
  if (!currentUserId && (!filters.privacy || filters.privacy.includes('public'))) {
      filters.privacy = ['public'];
  } else if (currentUserId && !filters.privacy) {
      // Logged-in users see public and their friends_only events (simplified)
      filters.privacy = ['public', 'friends_only'];
      // TODO: If filtering by friends_only, would need to pass currentUserId to DB to check friendships
      // or filter here after fetching, which is less efficient.
      // The current EventDB.findAllEvents doesn't have specific logic for friends_only based on currentUserId relationships.
  }


  return EventDB.findAllEvents(filters, pagination, currentUserId);
};

export const updateExistingEvent = async (
  eventId: string,
  userId: string, // User attempting update
  updateData: UpdateEventDTO
): Promise<Event | null> => {
  const event = await EventDB.findEventById(eventId);
  if (!event) throw new Error('Event not found.');
  if (event.creator_id !== userId) {
    throw new Error('User not authorized to update this event.');
  }
  if (updateData.start_time && new Date(updateData.start_time) < new Date() && !event.start_time ){
     // Allow updating past event's details, but not setting start time to past if it's a new time
  }
  if (updateData.end_time && updateData.start_time && new Date(updateData.end_time) < new Date(updateData.start_time)) {
    throw new Error('Event end time cannot be before start time.');
  }
   if (updateData.privacy && !['public', 'private', 'friends_only'].includes(updateData.privacy)) {
      throw new Error('Invalid event privacy setting.');
  }

  return EventDB.updateEventInDB(eventId, userId, updateData);
};

export const deleteExistingEvent = async (eventId: string, userId: string): Promise<boolean> => {
  const event = await EventDB.findEventById(eventId);
  if (!event) throw new Error('Event not found.');
  if (event.creator_id !== userId) {
    throw new Error('User not authorized to delete this event.');
  }
  // DB schema should handle cascade deletes for participants/comments.
  // If not, delete them here first:
  // await EventDB.deleteCommentsByEventId(eventId); // Need this function in DB
  // await EventDB.deleteParticipantsByEventId(eventId); // Need this function in DB
  return EventDB.deleteEventFromDB(eventId, userId);
};

// --- RSVP Services ---
export const rsvpToEvent = async (rsvpData: RsvpDTO): Promise<EventParticipant> => {
  const { eventId, userId, status } = rsvpData;
  const user = await UserDB.findUserById(userId);
  if (!user) throw new Error('User not found.');

  const event = await getEventById(eventId, userId); // Use service to check privacy
  if (!event) throw new Error('Event not found or not accessible to this user.');
  
  if (!['going', 'interested', 'not_going'].includes(status)) {
      throw new Error('Invalid RSVP status.');
  }

  // If event is private and user is not creator, they cannot RSVP (already handled by getEventById)
  // If event is friends_only, user must be friend of creator (TODO, currently simplified in getEventById)

  return EventDB.createOrUpdateRsvp(eventId, userId, status);
};

export const getEventParticipants = async (
  eventId: string,
  pagination: EventPaginationOptions,
  rsvpFilter?: RsvpStatus[],
  currentUserId?: string
): Promise<EventParticipant[]> => { // Consider PaginatedEventParticipants
  const event = await getEventById(eventId, currentUserId); // Check if current user can even see the event
  if (!event) throw new Error('Event not found or not accessible.');
  
  // Further privacy: Who can see participant list?
  // For now, if you can see the event, you can see participants.
  return EventDB.findParticipantsByEventId(eventId, pagination, rsvpFilter);
};

// --- Event Comment Services ---
export const createNewEventComment = async (data: CreateEventCommentDTO): Promise<EventComment> => {
  const user = await UserDB.findUserById(data.user_id);
  if (!user) throw new Error('Comment author not found.');

  const event = await getEventById(data.event_id, data.user_id); // Check if user can view (and thus comment on) event
  if (!event) throw new Error('Event not found or not accessible for commenting.');

  if (!data.content_text || data.content_text.trim() === '') {
    throw new Error('Comment content cannot be empty.');
  }
  if (data.parent_comment_id) {
      const parentComment = await EventDB.findEventCommentById(data.parent_comment_id);
      if (!parentComment || parentComment.event_id !== data.event_id) {
          throw new Error('Parent comment not found or does not belong to the same event.');
      }
  }

  return EventDB.createEventComment(data);
};

export const getCommentsForEvent = async (
  eventId: string,
  pagination: EventPaginationOptions,
  currentUserId?: string
): Promise<EventComment[]> => { // Consider PaginatedEventComments
  const event = await getEventById(eventId, currentUserId); // Check if current user can see the event
  if (!event) throw new Error('Event not found or not accessible.');
  
  return EventDB.findCommentsByEventId(eventId, pagination);
};

export const updateExistingEventComment = async (
  commentId: string,
  userId: string, // User attempting update
  updateData: UpdateEventCommentDTO
): Promise<EventComment | null> => {
  const comment = await EventDB.findEventCommentById(commentId);
  if (!comment) throw new Error('Comment not found.');
  if (comment.user_id !== userId) {
    throw new Error('User not authorized to update this comment.');
  }
   if (!updateData.content_text || updateData.content_text.trim() === '') {
    throw new Error('Comment content cannot be empty.');
  }
  return EventDB.updateEventCommentInDB(commentId, userId, updateData);
};

export const deleteExistingEventComment = async (commentId: string, userId: string): Promise<boolean> => {
  const comment = await EventDB.findEventCommentById(commentId);
  if (!comment) throw new Error('Comment not found.');

  const event = await EventDB.findEventById(comment.event_id); // Get event to check creator
  if (!event) throw new Error('Associated event not found.'); // Should not happen

  // User can delete if they are comment author OR event creator
  const isCommentOwner = comment.user_id === userId;
  const isEventCreator = event.creator_id === userId;

  if (!isCommentOwner && !isEventCreator) {
    throw new Error('User not authorized to delete this comment.');
  }
  // Pass isEventCreator to DB function to bypass user_id check if necessary (current DB func handles this)
  return EventDB.deleteEventCommentFromDB(commentId, userId, isEventCreator);
};
