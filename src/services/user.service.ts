import {
  findUserById,
  findUserByHandle,
  updateUserInDB
} from '../models/user.db';
import { findUserSettingsByUserId } from '../models/user.settings.db'; // Updated import
import { User, UserSettings, AuthenticatedUser, PublicUserProfile, UserProfileUpdateDTO } from '../models/user.types';

// Utility to convert a full User object to a PublicUserProfile
const toPublicUserProfile = (user: User): PublicUserProfile => {
  const { password_hash, email, updated_at, created_at, ...publicProfile } = user;
  // Keep created_at for public profile if desired, or remove it too
  return { ...publicProfile, created_at };
};

export const getUserProfile = async (identifier: string): Promise<PublicUserProfile | null> => {
  let user: User | null = null;

  // Attempt to find by ID (assuming UUID format) or by handle
  // A more robust check for UUID could be implemented if needed
  if (identifier.length === 36 && identifier.includes('-')) { // Basic UUID check
    user = await findUserById(identifier);
  } else {
    user = await findUserByHandle(identifier);
  }

  if (!user) {
    return null; // Or throw a "User not found" error
  }

  return toPublicUserProfile(user);
};

export const getAuthenticatedUserProfile = async (userId: string): Promise<AuthenticatedUser | null> => {
  const user = await findUserById(userId);
  if (!user) {
    return null; // Or throw "User not found"
  }

  const userSettings = await findUserSettingsByUserId(userId);

  // Exclude password_hash from the returned user object
  const { password_hash: _, ...userWithoutPassword } = user;

  return {
    ...userWithoutPassword,
    settings: userSettings || undefined, // Attach settings if found
  };
};

export const updateUserProfile = async (
  userId: string,
  updateData: UserProfileUpdateDTO
): Promise<AuthenticatedUser | null> => {
  // Ensure no restricted fields are passed (e.g., email, handle, password_hash)
  const allowedUpdates: UserProfileUpdateDTO = {
    first_name: updateData.first_name,
    last_name: updateData.last_name,
    bio: updateData.bio,
    profile_picture_url: updateData.profile_picture_url,
  };

  // Filter out undefined values to only update provided fields
  const validUpdateData = Object.entries(allowedUpdates).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      (acc as any)[key] = value;
    }
    return acc;
  }, {} as UserProfileUpdateDTO);

  if (Object.keys(validUpdateData).length === 0) {
    // No valid fields to update, return current profile or throw error
    return getAuthenticatedUserProfile(userId);
  }

  const updatedUser = await updateUserInDB(userId, validUpdateData);
  if (!updatedUser) {
    return null; // Or throw "Update failed"
  }

  // Return the full authenticated user profile after update
  return getAuthenticatedUserProfile(userId);
};
