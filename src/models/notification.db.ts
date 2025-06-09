import { query } from '../config/db';
import { Notification, CreateNotificationDTO, NotificationType, NotificationActor, NotificationTarget } from './notification.types';
import { PublicUserProfile } from './user.types'; // For joining actor profile

const mapRowToNotification = (row: any): Notification => {
    const notification: Notification = {
        id: row.id,
        recipient_user_id: row.recipient_user_id,
        actor_user_id: row.actor_user_id,
        type: row.type as NotificationType,
        target_entity_type: row.target_entity_type as NotificationTarget['type'],
        target_entity_id: row.target_entity_id,
        message: row.message,
        read_at: row.read_at ? new Date(row.read_at) : null,
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
        actor_profile: row.actor_id ? { // Check if actor fields were joined
            id: row.actor_id,
            handle: row.actor_handle,
            first_name: row.actor_first_name,
            last_name: row.actor_last_name,
            profile_picture_url: row.actor_profile_picture_url,
        } as NotificationActor : undefined,
        // target_details would require more complex joins based on target_entity_type and id,
        // usually handled in service layer or by specific queries.
    };
    return notification;
};

export const createNotification = async (dto: CreateNotificationDTO): Promise<Notification> => {
    const { recipient_user_id, actor_user_id, type, target_entity_type, target_entity_id, message } = dto;
    const sql = `
        INSERT INTO "Notifications"
            (recipient_user_id, actor_user_id, type, target_entity_type, target_entity_id, message)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
    `;
    // RETURNING * and then findNotificationById ensures all fields (like created_at) are fresh from DB
    // and actor_profile can be joined.
    try {
        const { rows } = await query(sql, [recipient_user_id, actor_user_id, type, target_entity_type, target_entity_id, message]);
        const newNotification = await findNotificationById(rows[0].id);
        if (!newNotification) throw new Error('Failed to create or find notification after insertion.');
        return newNotification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

export const findNotificationById = async (notificationId: string): Promise<Notification | null> => {
    const sql = `
        SELECT n.*,
               u_actor.id AS actor_id,
               u_actor.handle AS actor_handle,
               u_actor.first_name AS actor_first_name,
               u_actor.last_name AS actor_last_name,
               u_actor.profile_picture_url AS actor_profile_picture_url
        FROM "Notifications" n
        LEFT JOIN "Users" u_actor ON n.actor_user_id = u_actor.id
        WHERE n.id = $1;
    `;
    try {
        const { rows } = await query(sql, [notificationId]);
        return rows.length > 0 ? mapRowToNotification(rows[0]) : null;
    } catch (error) {
        console.error(`Error finding notification by ID (${notificationId}):`, error);
        throw error;
    }
};

export const getUnreadNotificationsCount = async (recipientUserId: string): Promise<number> => {
    const sql = `
        SELECT COUNT(*) AS unread_count
        FROM "Notifications"
        WHERE recipient_user_id = $1 AND read_at IS NULL;
    `;
    try {
        const { rows } = await query(sql, [recipientUserId]);
        return parseInt(rows[0].unread_count, 10);
    } catch (error) {
        console.error(`Error getting unread notifications count for user ${recipientUserId}:`, error);
        throw error;
    }
};

export const markNotificationAsRead = async (notificationId: string, recipientUserId: string): Promise<Notification | null> => {
    const sql = `
        UPDATE "Notifications"
        SET read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND recipient_user_id = $2 AND read_at IS NULL
        RETURNING *;
    `;
    try {
        const { rows } = await query(sql, [notificationId, recipientUserId]);
        if (rows.length === 0) {
            // Could be already read, or not found, or not owned by user.
            // Fetch to check current state if needed by service.
            return findNotificationById(notificationId);
        }
        return mapRowToNotification(rows[0]);
    } catch (error) {
        console.error(`Error marking notification ${notificationId} as read:`, error);
        throw error;
    }
};

export const markAllNotificationsAsRead = async (recipientUserId: string): Promise<number> => {
    const sql = `
        UPDATE "Notifications"
        SET read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE recipient_user_id = $1 AND read_at IS NULL;
    `;
    try {
        const result = await query(sql, [recipientUserId]);
        return result.rowCount !== null ? result.rowCount : 0; // Number of notifications marked as read
    } catch (error) {
        console.error(`Error marking all notifications as read for user ${recipientUserId}:`, error);
        throw error;
    }
};

export const findNotificationsByUserId = async (
    recipientUserId: string,
    page: number = 1,
    limit: number = 10,
    includeRead: boolean = false // Whether to include already read notifications
): Promise<Notification[]> => {
    const offset = (page - 1) * limit;
    let filterClause = 'WHERE n.recipient_user_id = $1';
    if (!includeRead) {
        filterClause += ' AND n.read_at IS NULL';
    }

    const sql = `
        SELECT n.*,
               u_actor.id AS actor_id,
               u_actor.handle AS actor_handle,
               u_actor.first_name AS actor_first_name,
               u_actor.last_name AS actor_last_name,
               u_actor.profile_picture_url AS actor_profile_picture_url
        FROM "Notifications" n
        LEFT JOIN "Users" u_actor ON n.actor_user_id = u_actor.id
        ${filterClause}
        ORDER BY n.created_at DESC
        LIMIT $2 OFFSET $3;
    `;
    try {
        const { rows } = await query(sql, [recipientUserId, limit, offset]);
        return rows.map(mapRowToNotification);
    } catch (error) {
        console.error(`Error fetching notifications for user ${recipientUserId}:`, error);
        throw error;
    }
};

// TODO: Count notifications for pagination if needed.
// export const countNotificationsByUserId = async (recipientUserId: string, includeRead: boolean = false): Promise<number> => { ... }
