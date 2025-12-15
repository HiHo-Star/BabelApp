import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allow connections from any origin for development
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true,
  transports: ['websocket', 'polling'],
  upgradeTimeout: 30000,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(morgan('combined'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import routes and services
import authRoutes from './routes/auth';
import uploadRoutes from './routes/upload';
import ttsRoutes from './routes/tts';
import databaseRoutes from './routes/database';
import messagesRoutes from './routes/messages';
import taskManagementRoutes from './routes/taskmanagement';
import projectsRoutes from './routes/projects';
import tasksRoutes from './routes/tasks';
import missionsRoutes from './routes/missions';
import staffRoutes from './routes/staff';
import { TranslationService } from './services/translation';
import { babelBotService } from './services/babelbot';
import { taskManagementService } from './services/taskmanagement';
import { createMessage, createMessageTranslation, createOrGetPrivateChat, getActiveUsersLanguages } from './config/database';
import path from 'path';

// Cache for active users' languages (refreshed every 5 minutes)
let cachedTargetLanguages: string[] = ['en']; // Default to English
let lastLanguageCacheUpdate = 0;
const LANGUAGE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Function to detect language from text content
function detectLanguageFromText(text: string): string {
  if (!text || text.trim().length === 0) {
    return 'en'; // Default to English for empty text
  }

  // Check for Hebrew characters (Unicode range U+0590 to U+05FF)
  const hebrewPattern = /[\u0590-\u05FF]/;
  if (hebrewPattern.test(text)) {
    return 'he';
  }

  // Check for Arabic characters (Unicode range U+0600 to U+06FF)
  const arabicPattern = /[\u0600-\u06FF]/;
  if (arabicPattern.test(text)) {
    return 'ar';
  }

  // Check for Chinese characters (Unicode range U+4E00 to U+9FFF)
  const chinesePattern = /[\u4E00-\u9FFF]/;
  if (chinesePattern.test(text)) {
    return 'zh';
  }

  // Check for Cyrillic characters (Unicode range U+0400 to U+04FF)
  const cyrillicPattern = /[\u0400-\u04FF]/;
  if (cyrillicPattern.test(text)) {
    return 'ru';
  }

  // Default to English if no specific script detected
  return 'en';
}

// Function to get target languages with caching
async function getTargetLanguages(): Promise<string[]> {
  const now = Date.now();

  // Refresh cache if expired
  if (now - lastLanguageCacheUpdate > LANGUAGE_CACHE_TTL) {
    try {
      const languages = await getActiveUsersLanguages();

      // Filter out duplicates and ensure we always have English
      const uniqueLanguages = Array.from(new Set(languages));
      if (!uniqueLanguages.includes('en')) {
        uniqueLanguages.push('en');
      }

      cachedTargetLanguages = uniqueLanguages;
      lastLanguageCacheUpdate = now;

      console.log('✅ Language cache refreshed:', cachedTargetLanguages);
    } catch (error) {
      console.error('❌ Failed to refresh language cache:', error);
      // Keep using cached languages on error
    }
  }

  return cachedTargetLanguages;
}

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'BabelApp API is running!' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/database', databaseRoutes);
app.use('/api', messagesRoutes);
app.use('/api/taskmanagement', taskManagementRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/missions', missionsRoutes);
app.use('/api/staff', staffRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('=== NEW SOCKET CONNECTION ===');
  console.log('Socket ID:', socket.id);
  console.log('Query params:', socket.handshake.query);
  console.log('Total connected sockets:', io.engine.clientsCount);
  console.log('All socket IDs:', Array.from(io.sockets.sockets.keys()));

  // Debug: Test if socket events are working
  console.log('=== TESTING SOCKET EVENTS ===');
  socket.emit('test-event', 'hello from backend');
  console.log('Test event sent to socket:', socket.id);

  // Debug: Log ALL incoming events from this socket
  const originalOn = socket.on.bind(socket);
  socket.on = function(eventName: string, listener: Function) {
    console.log(`🔧 Registering listener for event: ${eventName}`);
    return originalOn(eventName, (...args: any[]) => {
      console.log(`📨 === RECEIVED EVENT: ${eventName} ===`);
      console.log('From socket:', socket.id);
      console.log('Event data:', args);
      return listener(...args);
    });
  };
  


  socket.on('join-chat', (chatId: string) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat ${chatId}`);
    console.log('User rooms:', Array.from(socket.rooms));
    console.log('All rooms:', Array.from(io.sockets.adapter.rooms.keys()));
    console.log(`Users in room ${chatId}:`, io.sockets.adapter.rooms.get(chatId)?.size || 0);
  });

  socket.on('leave-chat', (chatId: string) => {
    socket.leave(chatId);
    console.log(`User ${socket.id} left chat ${chatId}`);
  });

  // Add a simple test event handler
  socket.on('test-send', (data) => {
    console.log('🎯 === TEST EVENT RECEIVED ===');
    console.log('Test data:', data);
    console.log('Received on socket:', socket.id);
    console.log('From user:', socket.handshake.query.userId);
    socket.emit('test-received', { message: 'Test received successfully!', original: data });
  });


  socket.on('send-message', async (data) => {
    console.log('=== SEND-MESSAGE EVENT TRIGGERED (WITH TRANSLATION) ===');
    console.log('=== MESSAGE RECEIVED ===');
    console.log('Socket ID:', socket.id);
    console.log('Query params:', socket.handshake.query);
    console.log('User ID from query:', socket.handshake.query.userId);
    console.log('Message data:', data);
    console.log('Chat ID:', data.chatId);
    console.log('🔥 TRANSLATION FEATURE ENABLED - Version: 2.5 🔥');

    // Add more debugging
    console.log('=== SOCKET DEBUG INFO ===');
    console.log('Socket connected:', socket.connected);
    console.log('Socket rooms:', Array.from(socket.rooms));

    const roomSize = io.sockets.adapter.rooms.get(data.chatId)?.size || 0;
    console.log('Users in room:', roomSize);
    console.log('All rooms:', Array.from(io.sockets.adapter.rooms.keys()));

    // Create message ID and capture timestamp BEFORE translation starts
    const messageTimestamp = new Date().toISOString();
    const messageId = `${Date.now()}-${socket.id}-${Math.random().toString(36).substr(2, 9)}`;

    // Get sender language from query or default to 'en'
    const senderLanguage = (socket.handshake.query.userLanguage as string) || 'en';
    console.log('Sender language:', senderLanguage);

    // Check if this is a BabelBot chat
    const isBabelBotChat = data.chatId && data.chatId.startsWith('babelbot-');
    
    if (isBabelBotChat) {
      console.log('=== BABELBOT CHAT DETECTED ===');
      console.log('Chat ID:', data.chatId);
      console.log('User message:', data.content);
      
      // Detect language from message content for BabelBot
      const contentToDetect = data.transcription && data.transcription.trim() !== ''
        ? data.transcription
        : data.content || '';
      const detectedLanguage = detectLanguageFromText(contentToDetect);
      
      // Use detected language if different from socket language, otherwise use socket language
      const babelBotLanguage = detectedLanguage !== 'en' || senderLanguage === 'en' 
        ? detectedLanguage 
        : senderLanguage;
      
      console.log('Language detection:', {
        socketLanguage: senderLanguage,
        detectedLanguage: detectedLanguage,
        usingLanguage: babelBotLanguage,
        messageContent: contentToDetect.substring(0, 50)
      });
      
      // Save user message first
      const userId = socket.handshake.query.userId as string || 'unknown';
      const userMessageData: any = {
        ...data,
        id: messageId,
        createdAt: messageTimestamp,
        sender: {
          id: userId,
          displayName: userId
        },
        originalLanguage: babelBotLanguage,
        translations: {} as { [key: string]: string }
      };

      // Save user message to database
      try {
        const contentToSave = data.transcription && data.transcription.trim() !== ''
          ? data.transcription
          : data.content;

        const savedUserMessage = await createMessage({
          chat_id: data.chatId,
          sender_id: userId,
          content: contentToSave,
          content_type: data.contentType || 'text',
          original_language: babelBotLanguage,
          created_at: messageTimestamp
        });

        userMessageData.id = savedUserMessage.id;
        userMessageData.createdAt = savedUserMessage.created_at;

        // Broadcast user message
        io.to(data.chatId).emit('new-message', userMessageData);
        io.emit('chat-message-received', userMessageData);
      } catch (dbError) {
        console.error('❌ Failed to save user message to database:', dbError);
      }

      // Forward to BabelBot service and get response
      try {
        const botResponse = await babelBotService.chat(
          data.content || data.transcription || '',
          userId,
          data.chatId,
          { language: babelBotLanguage }
        );

        console.log('=== BABELBOT RESPONSE RECEIVED ===');
        console.log('Bot response:', botResponse.message);

        // Create bot response message
        const botMessageTimestamp = new Date().toISOString();
        const botMessageId = `${Date.now()}-babelbot-${Math.random().toString(36).substr(2, 9)}`;
        
        const botMessageData: any = {
          chatId: data.chatId,
          content: botResponse.message,
          contentType: 'text',
          id: botMessageId,
          createdAt: botMessageTimestamp,
          sender: {
            id: 'babelbot',
            displayName: 'Babel Bot'
          },
          originalLanguage: babelBotLanguage,
          translations: {} as { [key: string]: string }
        };

        // Save bot response to database
        try {
          const savedBotMessage = await createMessage({
            chat_id: data.chatId,
            sender_id: 'babelbot',
            content: botResponse.message,
            content_type: 'text',
            original_language: senderLanguage,
            created_at: botMessageTimestamp
          });

          botMessageData.id = savedBotMessage.id;
          botMessageData.createdAt = savedBotMessage.created_at;

          // Broadcast bot response
          io.to(data.chatId).emit('new-message', botMessageData);
          io.emit('chat-message-received', botMessageData);
          console.log('=== BABELBOT RESPONSE SENT ===');
        } catch (dbError) {
          console.error('❌ Failed to save bot message to database:', dbError);
          // Still broadcast even if database save fails
          io.to(data.chatId).emit('new-message', botMessageData);
          io.emit('chat-message-received', botMessageData);
        }
      } catch (botError: any) {
        console.error('❌ Failed to get BabelBot response:', botError);
        
        // Send error message to user
        const errorMessageData: any = {
          chatId: data.chatId,
          content: 'Sorry, I\'m having trouble responding right now. Please try again later.',
          contentType: 'text',
          id: `${Date.now()}-babelbot-error-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          sender: {
            id: 'babelbot',
            displayName: 'Babel Bot'
          },
          originalLanguage: senderLanguage,
          translations: {} as { [key: string]: string }
        };

        io.to(data.chatId).emit('new-message', errorMessageData);
        io.emit('chat-message-received', errorMessageData);
      }

      // Return early - don't process as regular message
      return;
    }

    // Create message data with original content
    const messageData: any = {
      ...data,
      id: messageId,
      createdAt: messageTimestamp,
      sender: {
        id: socket.handshake.query.userId || 'unknown',
        displayName: socket.handshake.query.userId || 'Unknown User'
      },
      originalLanguage: senderLanguage,
      translations: {} as { [key: string]: string }
    };

    // Translate message to languages used by active users
    console.log('=== TRANSLATING MESSAGE ===');
    const targetLanguages = await getTargetLanguages();
    console.log('Target languages (from active users):', targetLanguages);

    // Determine what text to translate (use transcription for audio messages if available)
    const textToTranslate = data.transcription && data.transcription.trim() !== ''
      ? data.transcription
      : data.content;

    console.log('Text to translate:', textToTranslate);

    try {
      // Create translations for all target languages
      const translationPromises = targetLanguages
        .filter(lang => lang !== senderLanguage) // Don't translate to same language
        .map(async (targetLang) => {
          try {
            const translated = await TranslationService.translateMessage(
              messageId,
              targetLang,
              textToTranslate,
              senderLanguage
            );
            return { lang: targetLang, text: translated };
          } catch (error) {
            console.error(`Failed to translate to ${targetLang}:`, error);
            return { lang: targetLang, text: textToTranslate }; // Fallback to original
          }
        });

      const translations = await Promise.all(translationPromises);

      // Build translations object
      messageData.translations[senderLanguage] = textToTranslate; // Original
      translations.forEach(({ lang, text }) => {
        messageData.translations[lang] = text;
      });

      console.log('Translations created:', messageData.translations);

      // Also translate caption if present (for image/video messages)
      if (data.caption && data.caption.trim() !== '') {
        console.log('=== TRANSLATING CAPTION ===');
        console.log('Caption to translate:', data.caption);

        messageData.captionTranslations = {} as { [key: string]: string };

        const captionTranslationPromises = targetLanguages
          .filter(lang => lang !== senderLanguage)
          .map(async (targetLang) => {
            try {
              const translated = await TranslationService.translateMessage(
                messageId + '-caption',
                targetLang,
                data.caption,
                senderLanguage
              );
              return { lang: targetLang, text: translated };
            } catch (error) {
              console.error(`Failed to translate caption to ${targetLang}:`, error);
              return { lang: targetLang, text: data.caption }; // Fallback to original
            }
          });

        const captionTranslations = await Promise.all(captionTranslationPromises);

        // Build caption translations object
        messageData.captionTranslations[senderLanguage] = data.caption; // Original
        captionTranslations.forEach(({ lang, text }) => {
          messageData.captionTranslations[lang] = text;
        });

        console.log('Caption translations created:', messageData.captionTranslations);
      }
    } catch (error) {
      console.error('Translation error:', error);
      // If translation fails, just use original content
      messageData.translations[senderLanguage] = textToTranslate;
    }

    // Save message to database
    console.log('=== SAVING MESSAGE TO DATABASE ===');
    try {
      // Check if this is a private chat and create it if it doesn't exist
      if (data.chatId.startsWith('private_')) {
        console.log('=== PRIVATE CHAT DETECTED ===');
        console.log('Chat ID:', data.chatId);

        // Extract user IDs from chat ID format: private_user1_user2
        const parts = data.chatId.split('_');
        if (parts.length >= 3) {
          const user1Id = parts[1];
          const user2Id = parts[2];
          console.log(`Creating/getting private chat for users: ${user1Id} and ${user2Id}`);

          // Create or get the chat - this MUST succeed before saving the message
          await createOrGetPrivateChat(user1Id, user2Id);
          console.log('✅ Private chat ensured in database');
        } else {
          console.error('❌ Invalid private chat ID format:', data.chatId);
          throw new Error('Invalid private chat ID format');
        }
      }

      // Determine content to save (use transcription for audio, content for text/images)
      const contentToSave = data.transcription && data.transcription.trim() !== ''
        ? data.transcription
        : data.content;

      const savedMessage = await createMessage({
        chat_id: data.chatId,
        sender_id: socket.handshake.query.userId as string || 'unknown',
        content: contentToSave,
        content_type: data.contentType || 'text',
        original_language: senderLanguage,
        created_at: messageTimestamp
      });

      console.log('Message saved with ID:', savedMessage.id);

      // Update messageData with database-generated ID
      messageData.id = savedMessage.id;
      messageData.createdAt = savedMessage.created_at;

      // Save all translations to database
      console.log('=== SAVING TRANSLATIONS TO DATABASE ===');
      const translationPromises = Object.entries(messageData.translations)
        .filter(([lang]) => lang !== senderLanguage) // Don't save original as translation
        .map(([lang, text]) =>
          createMessageTranslation({
            message_id: savedMessage.id,
            target_language: lang,
            translated_content: text as string
          })
        );

      await Promise.all(translationPromises);
      console.log('All translations saved to database');

      // Save caption translations if present
      if (messageData.captionTranslations) {
        console.log('=== SAVING CAPTION TRANSLATIONS TO DATABASE ===');
        const captionTranslationPromises = Object.entries(messageData.captionTranslations)
          .filter(([lang]) => lang !== senderLanguage)
          .map(([lang, text]) =>
            createMessageTranslation({
              message_id: savedMessage.id + '-caption',
              target_language: lang,
              translated_content: text as string
            })
          );

        await Promise.all(captionTranslationPromises);
        console.log('All caption translations saved');
      }

      console.log('=== DATABASE SAVE COMPLETE ===');
    } catch (dbError) {
      console.error('❌ Failed to save message to database:', dbError);
      // Continue with broadcast even if database save fails
    }

    console.log('Broadcasting message to room:', messageData);
    console.log('Room to broadcast to:', data.chatId);
    console.log('Number of sockets in room:', io.sockets.adapter.rooms.get(data.chatId)?.size || 0);

    io.to(data.chatId).emit('new-message', messageData);
    console.log('Message emitted to room');

    // Also broadcast to all connected users for chat list updates
    console.log('Broadcasting to all users for chat list updates');
    io.emit('chat-message-received', messageData);
    console.log('=== MESSAGE BROADCASTED ===');
  });

  socket.on('disconnect', () => {
    console.log('=== SOCKET DISCONNECTED ===');
    console.log('Socket ID:', socket.id);
    console.log('Total connected sockets after disconnect:', io.engine.clientsCount);
    console.log('All socket IDs after disconnect:', Array.from(io.sockets.sockets.keys()));
    
    // Get all rooms this socket was in and remove them
    const rooms = Array.from(socket.rooms);
    console.log('Rooms this socket was in:', rooms);
    rooms.forEach(roomId => {
      if (roomId !== socket.id) { // socket.id is always in the list, skip it
        socket.leave(roomId);
        console.log(`User ${socket.id} automatically left room ${roomId} on disconnect`);
      }
    });
    
    console.log('All rooms after disconnect:', Array.from(io.sockets.adapter.rooms.keys()));
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  console.log('=== SERVER STARTED - CLEANING UP ALL ROOMS ===');

  // Clean up any existing rooms on server start
  io.sockets.adapter.rooms.clear();
  console.log('All rooms cleared on server start');

  // Initialize language cache on startup
  console.log('=== INITIALIZING LANGUAGE CACHE ===');
  await getTargetLanguages();
  console.log('Language cache initialized:', cachedTargetLanguages);
});

// Handle server shutdown gracefully
process.on('SIGINT', () => {
  console.log('=== SERVER SHUTTING DOWN - CLEANING UP ===');
  io.sockets.adapter.rooms.clear();
  server.close(() => {
    console.log('Server closed gracefully');
    process.exit(0);
  });
}); 