const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Test Server is running!' });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id, 'with query params:', socket.handshake.query);
  
  socket.on('join-chat', (chatId) => {
    socket.join(chatId);
    console.log(`User ${socket.id} joined chat ${chatId}`);
    console.log('All rooms:', Array.from(io.sockets.adapter.rooms.keys()));
  });
  
  socket.on('leave-chat', (chatId) => {
    socket.leave(chatId);
    console.log(`User ${socket.id} left chat ${chatId}`);
  });
  
  socket.on('send-message', (data) => {
    console.log('=== SEND-MESSAGE EVENT TRIGGERED ===');
    console.log('=== MESSAGE RECEIVED ===');
    console.log('Socket ID:', socket.id);
    console.log('Query params:', socket.handshake.query);
    console.log('User ID from query:', socket.handshake.query.userId);
    console.log('Message data:', data);
    console.log('Chat ID:', data.chatId);
    
    const roomSize = io.sockets.adapter.rooms.get(data.chatId)?.size || 0;
    console.log('Users in room:', roomSize);
    console.log('All rooms:', Array.from(io.sockets.adapter.rooms.keys()));
    
    // Create message data
    const messageData = {
      ...data,
      id: `${Date.now()}-${socket.id}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      sender: {
        id: socket.handshake.query.userId || 'unknown',
        displayName: socket.handshake.query.userId || 'Unknown User'
      }
    };
    
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
    console.log('User disconnected:', socket.id);
  });
});

const PORT = 5001;

server.listen(PORT, () => {
  console.log(`Test Server running on port ${PORT}`);
});
