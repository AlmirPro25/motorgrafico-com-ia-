import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { findUserByEmail, findUserByHandle, createUserInDB, findUserById } from '../models/user.db';
import { createDefaultUserSettings } from '../models/user.settings.db'; // Updated import
import { NewUserDTO, User, AuthenticatedUser } from '../models/user.types';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;
const BCRYPT_SALT_ROUNDS = 10; // As per requirement

if (!JWT_SECRET) {
  console.error("FATAL ERROR: JWT_SECRET is not defined in .env file");
  process.exit(1);
}

interface RegistrationData extends Omit<NewUserDTO, 'password_hash'> {
  password_raw: string;
}

interface LoginCredentials {
  emailOrHandle: string;
  password_raw: string;
}

interface AuthResponse {
  user: AuthenticatedUser;
  token: string;
}

export const registerUser = async (userData: RegistrationData): Promise<AuthResponse> => {
  const { email, handle, password_raw, first_name, last_name } = userData;

  // 1. Check if email or handle already exists
  const existingUserByEmail = await findUserByEmail(email);
  if (existingUserByEmail) {
    throw new Error('User with this email already exists.');
  }
  const existingUserByHandle = await findUserByHandle(handle);
  if (existingUserByHandle) {
    throw new Error('User with this handle already exists.');
  }

  // 2. Hash the password
  const password_hash = await bcrypt.hash(password_raw, BCRYPT_SALT_ROUNDS);

  // 3. Insert the new user into the Users table
  const newUserInput: NewUserDTO = { email, handle, password_hash, first_name, last_name };
  const createdUser = await createUserInDB(newUserInput);

  // 4. Insert default settings into the UserSettings table
  try {
    await createDefaultUserSettings(createdUser.id);
  } catch (settingsError) {
    // Optional: Decide if user creation should be rolled back if settings fail.
    // For now, log error and continue. User can update settings later.
    console.error(`Failed to create default settings for user ${createdUser.id}:`, settingsError);
    // Potentially, you might want to delete the user created in the step above if settings are critical
    // await deleteUserById(createdUser.id); // (if such a function exists and is needed)
    // throw new Error('User registration failed during settings creation.');
  }

  // 5. Generate a JWT
  const tokenPayload = { userId: createdUser.id, email: createdUser.email, handle: createdUser.handle };
  const token = jwt.sign(tokenPayload, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN || '1d' });

  // 6. Return user details (excluding password) and token
  const { password_hash: _, ...userWithoutPassword } = createdUser;
  return {
    user: userWithoutPassword,
    token,
  };
};

export const loginUser = async (credentials: LoginCredentials): Promise<AuthResponse> => {
  const { emailOrHandle, password_raw } = credentials;

  // 1. Find user by email or handle
  let user: User | null = null;
  // Basic check if it looks like an email
  if (emailOrHandle.includes('@')) {
    user = await findUserByEmail(emailOrHandle);
  } else {
    user = await findUserByHandle(emailOrHandle);
  }

  if (!user) {
    throw new Error('Invalid credentials. User not found.');
  }

  // 2. Compare submitted password with stored hash
  const isPasswordMatch = await bcrypt.compare(password_raw, user.password_hash);
  if (!isPasswordMatch) {
    throw new Error('Invalid credentials. Password incorrect.');
  }

  // 3. Generate a JWT
  const tokenPayload = { userId: user.id, email: user.email, handle: user.handle };
  const token = jwt.sign(tokenPayload, JWT_SECRET!, { expiresIn: JWT_EXPIRES_IN || '1d' });

  // 4. Return user details (excluding password) and token
  const { password_hash: _, ...userWithoutPassword } = user;
  return {
    user: userWithoutPassword,
    token,
  };
};
