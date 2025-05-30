import { query } from '../config/db';
import { UserSettings } from './user.types'; // Assuming UserSettings type is in user.types.ts

import { UserSettings, PostPrivacySetting, UserTheme } from './user.types'; // Assuming UserSettings type is in user.types.ts

export const findUserSettingsByUserId = async (userId: string): Promise<UserSettings | null> => {
    const sql = 'SELECT * FROM "UserSettings" WHERE user_id = $1';
    try {
        const { rows } = await query(sql, [userId]);
        if (rows.length === 0) return null;
        const row = rows[0];
        // Map row to UserSettings, ensuring correct type conversion and defaults for new fields
        const settings: UserSettings = {
            user_id: row.user_id,
            is_private: row.is_private === true, 
            notifications_on: row.notifications_on === true, 
            
            privacy_future_posts: row.privacy_future_posts || 'public' as PostPrivacySetting,
            privacy_friend_requests: row.privacy_friend_requests || 'everyone',
            privacy_show_friend_list: row.privacy_show_friend_list || 'everyone',
            
            notifications_push_enabled: row.notifications_push_enabled === true,
            
            theme: row.theme || 'system' as UserTheme,
            language: row.language || 'en-US',
            
            created_at: new Date(row.created_at),
            updated_at: new Date(row.updated_at),
        };
        return settings;
    } catch (error) {
        console.error(`Error finding user settings by user_id (${userId}):`, error);
        throw error;
    }
};

// Add other UserSettings specific DB functions here if needed, e.g., updateUserSettings
export const createDefaultUserSettings = async (userId: string): Promise<UserSettings> => {
  // Note: The UserSettings table schema uses auto-generated created_at/updated_at.
  // Default values for privacy settings are also set here or in DB schema.
  const sql = `
    INSERT INTO "UserSettings" (
        user_id, is_private, notifications_on, 
        privacy_future_posts, privacy_friend_requests, privacy_show_friend_list,
        notifications_push_enabled, theme, language
    )
    VALUES ($1, false, true, 'public', 'everyone', 'everyone', true, 'system', 'en-US') 
    RETURNING *;
  `;
  try {
    const { rows } = await query(sql, [userId]);
    if (rows.length === 0) {
      throw new Error('Default user settings creation failed, no rows returned.');
    }
    const row = rows[0];
     // Map to ensure correct types, similar to findUserSettingsByUserId
    return {
        user_id: row.user_id,
        is_private: row.is_private === true,
        notifications_on: row.notifications_on === true,
        privacy_future_posts: row.privacy_future_posts || 'public' as PostPrivacySetting,
        privacy_friend_requests: row.privacy_friend_requests || 'everyone',
        privacy_show_friend_list: row.privacy_show_friend_list || 'everyone',
        notifications_push_enabled: row.notifications_push_enabled === true,
        theme: row.theme || 'system' as UserTheme,
        language: row.language || 'en-US',
        created_at: new Date(row.created_at),
        updated_at: new Date(row.updated_at),
    };
  } catch (error) {
    console.error(`Error creating default user settings for user ${userId}:`, error);
    throw error;
  }
};

export const updateUserSettings = async (userId: string, settingsData: Partial<UserSettings>): Promise<UserSettings | null> => {
    const fields = Object.keys(settingsData) as Array<keyof UserSettings>;
    // Exclude user_id, created_at, updated_at from direct update
    const updatableFields = fields.filter(f => f !== 'user_id' && f !== 'created_at' && f !== 'updated_at');

    if (updatableFields.length === 0) {
        return findUserSettingsByUserId(userId); // No actual update, return current settings
    }

    const setClauses = updatableFields.map((field, i) => `"${field}" = $${i + 1}`).join(', ');
    const values = updatableFields.map(field => (settingsData as any)[field]);
    values.push(userId); // For WHERE clause

    const sql = `
        UPDATE "UserSettings"
        SET ${setClauses}, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $${updatableFields.length + 1}
        RETURNING *;
    `;

    try {
        const { rows } = await query(sql, values);
        if (rows.length === 0) {
            // This might happen if the user_id doesn't exist in UserSettings,
            // though createDefaultUserSettings should prevent this for registered users.
            return null;
        }
        // Use findUserSettingsByUserId to ensure consistent mapping and defaults for any potentially missing fields from RETURNING *
        return findUserSettingsByUserId(rows[0].user_id); 
    } catch (error) {
        console.error(`Error updating user settings for user ${userId}:`, error);
        throw error;
    }
};
