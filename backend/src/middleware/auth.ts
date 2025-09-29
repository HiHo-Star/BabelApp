import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { findUserByEmail } from '../config/database';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        username: string;
        displayName: string;
        language: string;
      };
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Access token required' });
    return;
  }

  try {
    // Verify JWT token
    const secret = process.env.JWT_SECRET || 'dev_secret_key_for_testing';
    const decoded = jwt.verify(token, secret) as any;
    
    // Get user from database
    const user = await findUserByEmail(decoded.userId);

    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // Add user to request object
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.display_name,
      language: user.language,
    };

    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

export const generateToken = (userId: string): string => {
  const secret = process.env.JWT_SECRET || 'dev_secret_key_for_testing';
  return jwt.sign({ userId }, secret, {
    expiresIn: '7d',
  });
}; 