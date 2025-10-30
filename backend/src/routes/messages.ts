import { Router } from 'express';
import { pool, getMessagesByChatId, markMessagesAsRead, getUnreadCountForChat, getUnreadCountsForUser } from '../config/database';

const router = Router();

// Get messages for a specific chat
router.get('/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    console.log('Loading messages for chat:', chatId);

    // Get messages with user info
    const messages = await getMessagesByChatId(chatId);

    // For each message, get its translations
    const messagesWithTranslations = await Promise.all(
      messages.map(async (message) => {
        const translationsResult = await pool.query(
          'SELECT target_language, translated_content FROM message_translations WHERE message_id = $1',
          [message.id]
        );

        const translations: { [key: string]: string } = {};

        // Add original content in original language
        translations[message.original_language || 'en'] = message.content;

        // Add all translations
        translationsResult.rows.forEach((tr) => {
          translations[tr.target_language] = tr.translated_content;
        });

        return {
          id: message.id,
          chatId: message.chat_id,
          content: message.content,
          contentType: message.content_type,
          createdAt: message.created_at,
          originalLanguage: message.original_language,
          sender: {
            id: message.sender_id,
            username: message.username,
            displayName: message.display_name,
            avatarUrl: message.avatar_url
          },
          translations
        };
      })
    );

    console.log(`Loaded ${messagesWithTranslations.length} messages for chat ${chatId}`);
    res.json(messagesWithTranslations);
  } catch (error: any) {
    console.error('Error loading messages:', error);
    res.status(500).json({ error: 'Failed to load messages', details: error.message });
  }
});

// Get translations for a specific message
router.get('/messages/:messageId/translations', async (req, res) => {
  try {
    const { messageId } = req.params;

    const result = await pool.query(
      'SELECT * FROM message_translations WHERE message_id = $1',
      [messageId]
    );

    res.json(result.rows);
  } catch (error: any) {
    console.error('Error loading translations:', error);
    res.status(500).json({ error: 'Failed to load translations', details: error.message });
  }
});

// Mark all messages in a chat as read for a user
router.post('/chats/:chatId/mark-read', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }

    console.log(`Marking messages as read in chat ${chatId} for user ${userId}`);

    const markedCount = await markMessagesAsRead(chatId, userId);

    console.log(`Marked ${markedCount} messages as read`);

    res.json({ success: true, markedCount });
  } catch (error: any) {
    console.error('Error marking messages as read:', error);
    res.status(500).json({ error: 'Failed to mark messages as read', details: error.message });
  }
});

// Get unread count for a specific chat
router.get('/chats/:chatId/unread-count', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({ error: 'userId query parameter is required' });
      return;
    }

    const unreadCount = await getUnreadCountForChat(chatId, userId as string);

    res.json({ chatId, unreadCount });
  } catch (error: any) {
    console.error('Error getting unread count:', error);
    res.status(500).json({ error: 'Failed to get unread count', details: error.message });
  }
});

// Get unread counts for all chats for a user
router.get('/unread-counts', async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      res.status(400).json({ error: 'userId query parameter is required' });
      return;
    }

    const unreadCounts = await getUnreadCountsForUser(userId as string);

    res.json({ unreadCounts });
  } catch (error: any) {
    console.error('Error getting unread counts:', error);
    res.status(500).json({ error: 'Failed to get unread counts', details: error.message });
  }
});

export default router;
