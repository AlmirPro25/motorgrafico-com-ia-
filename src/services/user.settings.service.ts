import * as UserSettingsDB from '../models/user.settings.db';
import * as UserDB from '../models/user.db'; // To ensure user exists
import { UserSettings, PostPrivacySetting, UserTheme } from '../models/user.types';

// Define allowed values for enum-like settings for validation
const ALLOWED_THEMES: UserTheme[] = ['light', 'dark', 'system'];
const ALLOWED_POST_PRIVACY: PostPrivacySetting[] = ['public', 'friends', 'private'];
const ALLOWED_FRIEND_REQUEST_PRIVACY: UserSettings['privacy_friend_requests'][] = ['everyone', 'friends_of_friends', 'nobody'];
const ALLOWED_FRIEND_LIST_PRIVACY: UserSettings['privacy_show_friend_list'][] = ['everyone', 'friends', 'private'];
// Basic language code pattern (e.g., en, en-US) - can be more complex
const LANGUAGE_CODE_PATTERN = /^[a-z]{2}(-[A-Z]{2})?$/;


export const getUserSettings = async (userId: string): Promise<UserSettings | null> => {
  const user = await UserDB.findUserById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  let settings = await UserSettingsDB.findUserSettingsByUserId(userId);

  // This case should ideally not be hit if createDefaultUserSettings is called on user registration.
  // However, as a fallback or for users created before settings defaults were comprehensive:
  if (!settings) {
    console.warn(`No existing settings found for user ${userId}. Creating default settings now.`);
    settings = await UserSettingsDB.createDefaultUserSettings(userId);
  }
  return settings;
};

export const updateUserSettings = async (
  userId: string,
  settingsData: Partial<Omit<UserSettings, 'user_id' | 'created_at' | 'updated_at'>> // Exclude non-updatable fields
): Promise<UserSettings | null> => {
  const user = await UserDB.findUserById(userId);
  if (!user) {
    throw new Error('User not found.');
  }

  // Validate incoming data
  if (settingsData.theme && !ALLOWED_THEMES.includes(settingsData.theme)) {
    throw new Error(`Invalid theme value. Allowed themes are: ${ALLOWED_THEMES.join(', ')}.`);
  }
  if (settingsData.privacy_future_posts && !ALLOWED_POST_PRIVACY.includes(settingsData.privacy_future_posts)) {
    throw new Error(`Invalid privacy_future_posts value. Allowed values are: ${ALLOWED_POST_PRIVACY.join(', ')}.`);
  }
  if (settingsData.privacy_friend_requests && !ALLOWED_FRIEND_REQUEST_PRIVACY.includes(settingsData.privacy_friend_requests)) {
    throw new Error(`Invalid privacy_friend_requests value. Allowed values are: ${ALLOWED_FRIEND_REQUEST_PRIVACY.join(', ')}.`);
  }
  if (settingsData.privacy_show_friend_list && !ALLOWED_FRIEND_LIST_PRIVACY.includes(settingsData.privacy_show_friend_list)) {
    throw new Error(`Invalid privacy_show_friend_list value. Allowed values are: ${ALLOWED_FRIEND_LIST_PRIVACY.join(', ')}.`);
  }
  if (settingsData.language && !LANGUAGE_CODE_PATTERN.test(settingsData.language)) {
      throw new Error('Invalid language code format. Expected format like "en" or "en-US".');
  }
  // Add validation for boolean fields if necessary (e.g. ensuring they are actually boolean)
  // For example:
  if (settingsData.notifications_push_enabled !== undefined && typeof settingsData.notifications_push_enabled !== 'boolean') {
      throw new Error('notifications_push_enabled must be a boolean value.');
  }
   if (settingsData.is_private !== undefined && typeof settingsData.is_private !== 'boolean') {
      throw new Error('is_private must be a boolean value.');
  }
   if (settingsData.notifications_on !== undefined && typeof settingsData.notifications_on !== 'boolean') {
      throw new Error('notifications_on must be a boolean value.');
  }


  const updatedSettings = await UserSettingsDB.updateUserSettings(userId, settingsData);
  if (!updatedSettings) {
      // This could happen if the DB update somehow fails or if the user had no prior settings (though unlikely now)
      throw new Error('Failed to update user settings.');
  }
  return updatedSettings;
};
