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
import { TranslationService } from './services/translation';
import path from 'path';

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'BabelApp API is running!' });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/upload', uploadRoutes);

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

    // Create message ID
    const messageId = `${Date.now()}-${socket.id}-${Math.random().toString(36).substr(2, 9)}`;

    // Get sender language from query or default to 'en'
    const senderLanguage = (socket.handshake.query.userLanguage as string) || 'en';
    console.log('Sender language:', senderLanguage);

    // Create message data with original content
    const messageData: any = {
      ...data,
      id: messageId,
      createdAt: new Date().toISOString(),
      sender: {
        id: socket.handshake.query.userId || 'unknown',
        displayName: socket.handshake.query.userId || 'Unknown User'
      },
      originalLanguage: senderLanguage,
      translations: {} as { [key: string]: string }
    };

    // Translate message to common languages (en, he)
    console.log('=== TRANSLATING MESSAGE ===');
    const targetLanguages = ['en', 'he', 'iw'];

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

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('=== SERVER STARTED - CLEANING UP ALL ROOMS ===');
  
  // Clean up any existing rooms on server start
  io.sockets.adapter.rooms.clear();
  console.log('All rooms cleared on server start');
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