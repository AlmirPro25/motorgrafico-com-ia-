import * as NotificationDB from '../models/notification.db';
import {
    CreateNotificationDTO, Notification, NotificationType,
    NotificationWebSocketPayload, NotificationActor, NotificationTarget
} from '../models/notification.types';
import { webSocketEmitterService } from './webSocketEmitter.service';
import { User, PublicUserProfile } from '../models/user.types'; // For actor details if not from DB join

// Helper to transform a full Notification object (from DB) to a WebSocket payload
const formatNotificationForSocket = (notification: Notification): NotificationWebSocketPayload => {
    // Ensure actor_profile is populated, if not, it might need a separate fetch or be an issue in the calling service.
    // For system messages, actor might be undefined.
    let actorPayload: NotificationActor | undefined = undefined;
    if (notification.actor_profile) {
        actorPayload = {
            id: notification.actor_profile.id,
            handle: notification.actor_profile.handle,
            first_name: notification.actor_profile.first_name,
            last_name: notification.actor_profile.last_name,
            profile_picture_url: notification.actor_profile.profile_picture_url,
            // No created_at for actor in this payload
        };
    }

    // Target details might be fetched and enriched by the calling service (e.g., PostService)
    // or kept simple here if target_entity_id and type are enough.
    let targetPayload: NotificationTarget | undefined = undefined;
    if (notification.target_entity_type && notification.target_entity_id) {
        targetPayload = {
            type: notification.target_entity_type,
            id: notification.target_entity_id,
            // title and url would ideally be added here if available from a richer Notification object
            // or constructed based on type/id by client or a more specific formatter.
            title: notification.target_details?.title, // Assuming target_details is populated
            url: notification.target_details?.url,     // Assuming target_details is populated
        };
    }

    return {
        id: notification.id,
        type: notification.type,
        actor: actorPayload,
        target: targetPayload,
        message: notification.message, // Use the pre-formatted message from DB
        created_at: notification.created_at.toISOString(),
        read_at: notification.read_at ? notification.read_at.toISOString() : null,
    };
};


export const createNotificationAndEmit = async (
    dto: CreateNotificationDTO
): Promise<Notification> => {
    // 1. Save notification to database
    // The NotificationDB.createNotification now calls findNotificationById which joins actor profile.
    const newNotification = await NotificationDB.createNotification(dto);

    if (newNotification) {
        // 2. Format for WebSocket
        const wsPayload = formatNotificationForSocket(newNotification);

        // 3. Emit 'new_notification' event to the recipient user's room
        webSocketEmitterService.emitToUser(
            newNotification.recipient_user_id,
            'new_notification',
            wsPayload
        );

        // 4. Fetch new unread count
        const unreadCount = await NotificationDB.getUnreadNotificationsCount(newNotification.recipient_user_id);

        // 5. Emit 'unread_notifications_count_update' event
        webSocketEmitterService.emitToUser(
            newNotification.recipient_user_id,
            'unread_notifications_count_update',
            { unread_count: unreadCount }
        );
        console.log(`Notification ${newNotification.id} created and emitted to user ${newNotification.recipient_user_id}. Unread count: ${unreadCount}`);
    }
    return newNotification;
};

// Service functions for managing notifications (e.g., marking as read)
export const markAsRead = async (notificationId: string, recipientUserId: string): Promise<Notification | null> => {
    const notification = await NotificationDB.markNotificationAsRead(notificationId, recipientUserId);
    if (notification && notification.read_at) { // Check if it was actually marked as read (not already read)
        const unreadCount = await NotificationDB.getUnreadNotificationsCount(recipientUserId);
        webSocketEmitterService.emitToUser(
            recipientUserId,
            'unread_notifications_count_update',
            { unread_count: unreadCount }
        );
    }
    return notification;
};

export const markAllAsRead = async (recipientUserId: string): Promise<number> => {
    const countMarkedAsRead = await NotificationDB.markAllNotificationsAsRead(recipientUserId);
    if (countMarkedAsRead > 0) {
         webSocketEmitterService.emitToUser(
            recipientUserId,
            'unread_notifications_count_update',
            { unread_count: 0 } // All marked as read, so count is 0
        );
    }
    return countMarkedAsRead;
};

export const getNotificationsForUser = async (
    recipientUserId: string,
    page: number = 1,
    limit: number = 10,
    includeRead: boolean = false
): Promise<Notification[]> => {
    return NotificationDB.findNotificationsByUserId(recipientUserId, page, limit, includeRead);
};

export const getUnreadCountForUser = async(userId: string): Promise<number> => {
    return NotificationDB.getUnreadNotificationsCount(userId);
};
