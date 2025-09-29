import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { findUserByEmail, findUserByUsername, createUser, updateUserLastSeen } from '../config/database';
import { generateToken } from '../middleware/auth';
import { CreateUserRequest, LoginRequest, AuthResponse } from '../types';

export class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, username, displayName, language }: CreateUserRequest = req.body;

      // Validate input
      if (!email || !password || !username || !displayName || !language) {
        res.status(400).json({ error: 'All fields are required' });
        return;
      }

      // Check if user already exists by email
      const existingUserByEmail = await findUserByEmail(email);
      if (existingUserByEmail) {
        res.status(400).json({ error: 'User with this email already exists' });
        return;
      }

      // Check if user already exists by username
      const existingUserByUsername = await findUserByUsername(username);
      if (existingUserByUsername) {
        res.status(400).json({ error: 'Username already taken' });
        return;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = await createUser({
        email,
        password: hashedPassword,
        username,
        display_name: displayName,
        language,
      });

      // Generate token
      const token = generateToken(user.id);

      const response: AuthResponse = {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          language: user.language,
          createdAt: user.created_at,
          lastSeen: user.last_seen,
        },
        token,
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password }: LoginRequest = req.body;

      // Validate input
      if (!email || !password) {
        res.status(400).json({ error: 'Email and password are required' });
        return;
      }

      // Get user by email
      const user = await findUserByEmail(email);

      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Check password
      const isValidPassword = await bcrypt.compare(password, user.password);
      if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Update last seen
      await updateUserLastSeen(user.id);

      // Generate token
      const token = generateToken(user.id);

      const response: AuthResponse = {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          language: user.language,
          createdAt: user.created_at,
          lastSeen: user.last_seen,
        },
        token,
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get user profile
   */
  static async getProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const user = await findUserByEmail(userId);

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const response = {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          language: user.language,
          createdAt: user.created_at,
          lastSeen: user.last_seen,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { displayName, language, avatarUrl } = req.body;

      if (!userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Update user profile
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (displayName !== undefined) {
        updateFields.push(`display_name = $${paramIndex}`);
        updateValues.push(displayName);
        paramIndex++;
      }

      if (language !== undefined) {
        updateFields.push(`language = $${paramIndex}`);
        updateValues.push(language);
        paramIndex++;
      }

      if (avatarUrl !== undefined) {
        updateFields.push(`avatar_url = $${paramIndex}`);
        updateValues.push(avatarUrl);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        res.status(400).json({ error: 'No fields to update' });
        return;
      }

      updateValues.push(userId);
      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      const { pool } = await import('../config/database');
      const result = await pool.query(query, updateValues);

      if (result.rows.length === 0) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const user = result.rows[0];

      const response = {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.display_name,
          avatarUrl: user.avatar_url,
          language: user.language,
          createdAt: user.created_at,
          lastSeen: user.last_seen,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
} 