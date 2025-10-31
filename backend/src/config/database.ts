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

// Helper function to create or get a private chat
export const createOrGetPrivateChat = async (user1Id: string, user2Id: string) => {
  // Generate chat ID using sorted user IDs (same as Android app logic)
  const sortedUsers = [user1Id, user2Id].sort();
  const chatId = `private_${sortedUsers[0]}_${sortedUsers[1]}`;

  // Check if chat already exists
  const checkQuery = 'SELECT * FROM chats WHERE id = $1';
  const checkResult = await pool.query(checkQuery, [chatId]);

  if (checkResult.rows.length > 0) {
    return checkResult.rows[0];
  }

  // Create new private chat
  const createQuery = `
    INSERT INTO chats (id, name, chat_type, is_private)
    VALUES ($1, $2, $3, $4)
    RETURNING *
  `;
  const chatName = `Private: ${user1Id} & ${user2Id}`;
  const createResult = await pool.query(createQuery, [chatId, chatName, 'private', true]);

  // Add both users as participants
  const participantQuery = `
    INSERT INTO chat_participants (chat_id, user_id, role)
    VALUES ($1, $2, $3)
  `;
  await pool.query(participantQuery, [chatId, user1Id, 'member']);
  await pool.query(participantQuery, [chatId, user2Id, 'member']);

  console.log(`✅ Created private chat: ${chatId} for users ${user1Id} and ${user2Id}`);

  return createResult.rows[0];
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
  created_at?: string;
}) => {
  const query = messageData.created_at
    ? `
      INSERT INTO messages (chat_id, sender_id, content, content_type, original_language, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `
    : `
      INSERT INTO messages (chat_id, sender_id, content, content_type, original_language)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

  const values = messageData.created_at
    ? [
        messageData.chat_id,
        messageData.sender_id,
        messageData.content,
        messageData.content_type || 'text',
        messageData.original_language || 'en',
        messageData.created_at
      ]
    : [
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

// Helper function to mark messages as read
export const markMessagesAsRead = async (chatId: string, userId: string) => {
  // Get all unread messages in this chat for this user
  const unreadMessagesQuery = `
    SELECT m.id
    FROM messages m
    LEFT JOIN message_read_receipts mrr ON m.id = mrr.message_id AND mrr.user_id = $2
    WHERE m.chat_id = $1
      AND m.sender_id != $2
      AND mrr.id IS NULL
  `;
  const unreadMessages = await pool.query(unreadMessagesQuery, [chatId, userId]);

  // Insert read receipts for all unread messages
  if (unreadMessages.rows.length > 0) {
    const insertQuery = `
      INSERT INTO message_read_receipts (message_id, user_id, read_at)
      VALUES ($1, $2, CURRENT_TIMESTAMP)
      ON CONFLICT (message_id, user_id) DO NOTHING
    `;

    const insertPromises = unreadMessages.rows.map(row =>
      pool.query(insertQuery, [row.id, userId])
    );

    await Promise.all(insertPromises);
  }

  return unreadMessages.rows.length;
};

// Helper function to get unread count for a specific chat
export const getUnreadCountForChat = async (chatId: string, userId: string) => {
  const query = `
    SELECT COUNT(*) as unread_count
    FROM messages m
    LEFT JOIN message_read_receipts mrr ON m.id = mrr.message_id AND mrr.user_id = $2
    WHERE m.chat_id = $1
      AND m.sender_id != $2
      AND mrr.id IS NULL
  `;
  const result = await pool.query(query, [chatId, userId]);

  return parseInt(result.rows[0].unread_count);
};

// Helper function to get unread counts for all chats for a user
export const getUnreadCountsForUser = async (userId: string) => {
  const query = `
    SELECT
      c.id as chat_id,
      COUNT(m.id) as unread_count
    FROM chats c
    JOIN chat_participants cp ON c.id = cp.chat_id
    LEFT JOIN messages m ON c.id = m.chat_id AND m.sender_id != $1
    LEFT JOIN message_read_receipts mrr ON m.id = mrr.message_id AND mrr.user_id = $1
    WHERE cp.user_id = $1
      AND mrr.id IS NULL
    GROUP BY c.id
    HAVING COUNT(m.id) > 0
  `;
  const result = await pool.query(query, [userId]);

  // Convert to object for easy lookup: { chatId: unreadCount }
  const unreadCounts: { [key: string]: number } = {};
  result.rows.forEach(row => {
    unreadCounts[row.chat_id] = parseInt(row.unread_count);
  });

  return unreadCounts;
};

// Helper function to get all active users' preferred languages
export const getActiveUsersLanguages = async () => {
  const query = `
    SELECT DISTINCT language
    FROM users
    WHERE language IS NOT NULL
      AND language != ''
  `;
  const result = await pool.query(query);

  // Return array of language codes
  const languages = result.rows.map(row => row.language);

  console.log('Active users languages:', languages);
  return languages;
}; 