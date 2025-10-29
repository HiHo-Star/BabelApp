import { Pool } from 'pg';
import { Database } from '../types';

// PostgreSQL connection configuration
// Supports both DATABASE_URL (Railway) and individual config vars (local development)
const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: {
          rejectUnauthorized: false, // Required for Railway and other cloud providers
        },
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000, // Increased for cloud connections
      }
    : {
        host: process.env.DB_HOST || 'postgres',
        port: parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'babelapp',
        user: process.env.DB_USER || 'babelapp_user',
        password: process.env.DB_PASSWORD || 'babelapp_password',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
);

// Test database connection
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err: Error) => {
  console.error('❌ Database connection error:', err);
});

export { pool };

// Helper function to get user by ID
export const getUserById = async (userId: string) => {
  const query = 'SELECT * FROM users WHERE id = $1';
  const result = await pool.query(query, [userId]);
  
  if (result.rows.length === 0) {
    throw new Error('User not found');
  }
  
  return result.rows[0];
};

// Helper function to get task by ID
export const getTaskById = async (taskId: string) => {
  const query = 'SELECT * FROM tasks WHERE id = $1';
  const result = await pool.query(query, [taskId]);
  
  if (result.rows.length === 0) {
    throw new Error('Task not found');
  }
  
  return result.rows[0];
};

// Helper function to get chat by ID
export const getChatById = async (chatId: string) => {
  const query = 'SELECT * FROM chats WHERE id = $1';
  const result = await pool.query(query, [chatId]);
  
  if (result.rows.length === 0) {
    throw new Error('Chat not found');
  }
  
  return result.rows[0];
};

// Helper function to get messages by chat ID
export const getMessagesByChatId = async (chatId: string) => {
  const query = `
    SELECT m.*, u.username, u.display_name, u.avatar_url
    FROM messages m
    LEFT JOIN users u ON m.sender_id = u.id
    WHERE m.chat_id = $1
    ORDER BY m.created_at ASC
  `;
  const result = await pool.query(query, [chatId]);
  
  return result.rows;
};

// Helper function to create a new user
export const createUser = async (userData: {
  email: string;
  password: string;
  username: string;
  display_name: string;
  language: string;
}) => {
  const query = `
    INSERT INTO users (email, password, username, display_name, language)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const values = [userData.email, userData.password, userData.username, userData.display_name, userData.language];
  const result = await pool.query(query, values);
  
  return result.rows[0];
};

// Helper function to find user by email
export const findUserByEmail = async (email: string) => {
  const query = 'SELECT * FROM users WHERE email = $1';
  const result = await pool.query(query, [email]);
  
  return result.rows[0] || null;
};

// Helper function to find user by username
export const findUserByUsername = async (username: string) => {
  const query = 'SELECT * FROM users WHERE username = $1';
  const result = await pool.query(query, [username]);
  
  return result.rows[0] || null;
};

// Helper function to update user last seen
export const updateUserLastSeen = async (userId: string) => {
  const query = 'UPDATE users SET last_seen = NOW() WHERE id = $1';
  await pool.query(query, [userId]);
};

// Helper function to create a new message
export const createMessage = async (messageData: {
  chat_id: string;
  sender_id: string;
  content: string;
  content_type?: string;
  original_language?: string;
}) => {
  const query = `
    INSERT INTO messages (chat_id, sender_id, content, content_type, original_language)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `;
  const values = [
    messageData.chat_id,
    messageData.sender_id,
    messageData.content,
    messageData.content_type || 'text',
    messageData.original_language || 'en'
  ];
  const result = await pool.query(query, values);
  
  return result.rows[0];
};

// Helper function to create message translation
export const createMessageTranslation = async (translationData: {
  message_id: string;
  target_language: string;
  translated_content: string;
}) => {
  const query = `
    INSERT INTO message_translations (message_id, target_language, translated_content)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const values = [translationData.message_id, translationData.target_language, translationData.translated_content];
  const result = await pool.query(query, values);
  
  return result.rows[0];
};

// Helper function to get chat participants
export const getChatParticipants = async (chatId: string) => {
  const query = `
    SELECT u.*
    FROM users u
    JOIN chat_participants cp ON u.id = cp.user_id
    WHERE cp.chat_id = $1
  `;
  const result = await pool.query(query, [chatId]);
  
  return result.rows;
}; 