import { query } from '../config/db';
import { User, NewUserDTO } from './user.types'; // UserSettings removed as it's in its own file

// Helper to map raw DB row to User object
const mapRowToUser = (row: any): User | null => {
  if (!row) return null;
  return {
    id: row.id,
    handle: row.handle,
    email: row.email,
    password_hash: row.password_hash,
    first_name: row.first_name,
    last_name: row.last_name,
    bio: row.bio,
    profile_picture_url: row.profile_picture_url,
    created_at: new Date(row.created_at),
    updated_at: new Date(row.updated_at),
    is_online: row.is_online === true, // Ensure boolean
    last_seen_at: row.last_seen_at ? new Date(row.last_seen_at) : undefined,
  };
};

export const findUserByEmail = async (email: string): Promise<User | null> => {
  const sql = 'SELECT * FROM "Users" WHERE email = $1';
  try {
    const { rows } = await query(sql, [email]);
    return mapRowToUser(rows[0]);
    return mapRowToUser(rows[0]);
  } catch (error) {
    console.error(`Error finding user by email (${email}):`, error);
    throw error; // Re-throw to be handled by service layer
  }
};

export const findUserByHandle = async (handle: string): Promise<User | null> => {
  const sql = 'SELECT * FROM "Users" WHERE handle = $1';
  try {
    const { rows } = await query(sql, [handle]);
    return mapRowToUser(rows[0]);
  } catch (error)
  {
    console.error(`Error finding user by handle (${handle}):`, error);
    throw error;
  }
};

export const findUserById = async (id: string): Promise<User | null> => {
  const sql = 'SELECT * FROM "Users" WHERE id = $1';
  try {
    const { rows } = await query(sql, [id]);
    return mapRowToUser(rows[0]);
  } catch (error) {
    console.error(`Error finding user by id (${id}):`, error);
    throw error;
  }
};

export const createUserInDB = async (userData: NewUserDTO): Promise<User> => {
  const { email, handle, password_hash, first_name, last_name } = userData;
  // Initialize is_online to false and last_seen_at to current time
  const sql = `
    INSERT INTO "Users" (email, handle, password_hash, first_name, last_name, is_online, last_seen_at)
    VALUES ($1, $2, $3, $4, $5, FALSE, NOW())
    RETURNING *;
  `;
  try {
    const { rows } = await query(sql, [email, handle, password_hash, first_name, last_name]);
    if (rows.length === 0) {
      throw new Error('User creation failed, no rows returned.');
    }
    return mapRowToUser(rows[0]) as User; // mapRowToUser can return null, but here it shouldn't
  } catch (error) {
    console.error('Error creating user in DB:', error);
    // Check for unique constraint violations (e.g., email or handle already exists)
    // PostgreSQL error codes for unique violation: '23505'
    if ((error as any).code === '23505') {
        // More specific error can be thrown based on constraint name if needed
        throw new Error('User with this email or handle already exists.');
    }
    throw error;
  }
};

// findUserSettingsByUserId MOVED to user.settings.db.ts
// createDefaultUserSettings MOVED to user.settings.db.ts

export const updateUserPresence = async (userId: string, isOnline: boolean, lastSeenAt: Date): Promise<void> => {
  const sql = `
    UPDATE "Users"
    SET is_online = $1, last_seen_at = $2, updated_at = NOW()
    WHERE id = $3;
  `;
  try {
    await query(sql, [isOnline, lastSeenAt, userId]);
  } catch (error) {
    console.error(`Error updating user presence for user ${userId}:`, error);
    throw error; // Re-throw to be handled by service layer or caller
  }
};

export const updateUserInDB = async (userId: string, updateData: Partial<Omit<User, 'id' | 'email' | 'handle' | 'password_hash' | 'created_at' | 'updated_at' | 'is_online' | 'last_seen_at'>>): Promise<User | null> => {
    const { first_name, last_name, bio, profile_picture_url } = updateData;
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (first_name !== undefined) {
        fields.push(`first_name = $${paramCount++}`);
        values.push(first_name);
    }
    if (last_name !== undefined) {
        fields.push(`last_name = $${paramCount++}`);
        values.push(last_name);
    }
    if (bio !== undefined) {
        fields.push(`bio = $${paramCount++}`);
        values.push(bio);
    }
    if (profile_picture_url !== undefined) {
        fields.push(`profile_picture_url = $${paramCount++}`);
        values.push(profile_picture_url);
    }

    if (fields.length === 0) {
        // Or return current user data, or throw error
        return findUserById(userId);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);

    const sql = `
        UPDATE "Users"
        SET ${fields.join(', ')}
        WHERE id = $${paramCount}
        RETURNING *;
    `;
    values.push(userId);

    try {
        const { rows } = await query(sql, values);
        return mapRowToUser(rows[0]);
    } catch (error) {
        console.error(`Error updating user (${userId}):`, error);
        throw error;
    }
};
