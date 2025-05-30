import { query } from '../config/db';
import { User, NewUserDTO, UserSettings } from './user.types';

export const findUserByEmail = async (email: string): Promise<User | null> => {
  const sql = 'SELECT * FROM "Users" WHERE email = $1';
  try {
    const { rows } = await query(sql, [email]);
    return rows[0] || null;
  } catch (error) {
    console.error(`Error finding user by email (${email}):`, error);
    throw error; // Re-throw to be handled by service layer
  }
};

export const findUserByHandle = async (handle: string): Promise<User | null> => {
  const sql = 'SELECT * FROM "Users" WHERE handle = $1';
  try {
    const { rows } = await query(sql, [handle]);
    return rows[0] || null;
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
    return rows[0] || null;
  } catch (error) {
    console.error(`Error finding user by id (${id}):`, error);
    throw error;
  }
};

export const createUserInDB = async (userData: NewUserDTO): Promise<User> => {
  const { email, handle, password_hash, first_name, last_name } = userData;
  // Note: The Users table schema provided in the main prompt uses auto-generated id (UUID) and created_at/updated_at.
  const sql = `
    INSERT INTO "Users" (email, handle, password_hash, first_name, last_name)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;
  try {
    const { rows } = await query(sql, [email, handle, password_hash, first_name, last_name]);
    if (rows.length === 0) {
      throw new Error('User creation failed, no rows returned.');
    }
    return rows[0];
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


export const updateUserInDB = async (userId: string, updateData: Partial<Omit<User, 'id' | 'email' | 'handle' | 'password_hash' | 'created_at' | 'updated_at'>>): Promise<User | null> => {
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
        return rows[0] || null;
    } catch (error) {
        console.error(`Error updating user (${userId}):`, error);
        throw error;
    }
};
