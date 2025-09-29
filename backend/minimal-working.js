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

// Simple test route
app.get('/', (req, res) => {
  res.json({ message: 'Minimal working Socket.IO server!' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('🎉 === USER CONNECTED ===');
  console.log('Socket ID:', socket.id);
  console.log('Query params:', socket.handshake.query);
  console.log('Total connected sockets:', io.engine.clientsCount);
  console.log('All socket IDs:', Array.from(io.sockets.sockets.keys()));
  
  // Test event
  console.log('📡 Sending test event to new connection...');
  socket.emit('test-event', 'hello from minimal server');
  console.log('✅ Test event sent to socket:', socket.id);
  
  // Listen for join-chat events
  socket.on('join-chat', (chatId) => {
    console.log('🚪 === USER JOINING CHAT ROOM ===');
    console.log('Socket ID:', socket.id);
    console.log('User ID:', socket.handshake.query.userId);
    console.log('Joining room:', chatId);
    
    socket.join(chatId);
    console.log('✅ User joined room:', chatId);
    console.log('User rooms after join:', Array.from(socket.rooms));
  });
  
  // Debug: Log all incoming events
  console.log('🔍 === SETTING UP EVENT LISTENERS ===');
  console.log('Socket ID:', socket.id);
  console.log('User ID:', socket.handshake.query.userId);
  
  // Catch-all event listener to debug what's actually coming through
  socket.onAny = (eventName, ...args) => {
    console.log('🔍 === CATCH-ALL EVENT RECEIVED ===');
    console.log('Event name:', eventName);
    console.log('Event args:', args);
    console.log('Socket ID:', socket.id);
  };
  
  // Test event listener to verify events are working
  socket.on('test-send', (data) => {
    console.log('🧪 === TEST EVENT RECEIVED ===');
    console.log('Test data:', data);
    console.log('Socket ID:', socket.id);
    console.log('User ID:', socket.handshake.query.userId);
    
    // Echo back
    socket.emit('test-received', { message: 'Test event received!', data });
  });
  
  // Listen for send-message
  socket.on('send-message', (data) => {
    console.log('📨 === MESSAGE RECEIVED ===');
    console.log('Message data:', data);
    console.log('Socket ID:', socket.id);
    console.log('Socket connected state:', socket.connected);
    console.log('Socket rooms:', Array.from(socket.rooms));
    console.log('User ID from query:', socket.handshake.query.userId);
    
    // Echo back to confirm
    console.log('🔄 Echoing message back to sender...');
    const echoMessage = { 
      id: Date.now(),
      content: data.content,
      chatId: data.chatId,
      sender: {
        id: socket.handshake.query.userId || 'unknown',
        displayName: socket.handshake.query.userId || 'Unknown'
      },
      createdAt: new Date().toISOString()
    };
    
    socket.emit('new-message', echoMessage);
    console.log('✅ Message echoed back to sender');
    console.log('📤 Echo message sent:', echoMessage);
    
    // Also emit to the chat room for other users
    if (data.chatId) {
      console.log('📡 Broadcasting message to chat room:', data.chatId);
      socket.to(data.chatId).emit('chat-message-received', echoMessage);
      console.log('✅ Message broadcasted to room:', data.chatId);
    }
  });
  
  socket.on('disconnect', (reason) => {
    console.log('🔌 === USER DISCONNECTED ===');
    console.log('Socket ID:', socket.id);
    console.log('Disconnect reason:', reason);
    console.log('Total connected sockets after disconnect:', io.engine.clientsCount);
    console.log('All socket IDs after disconnect:', Array.from(io.sockets.sockets.keys()));
  });
  
  // Add error handling
  socket.on('error', (error) => {
    console.error('💥 === SOCKET ERROR ===');
    console.error('Socket ID:', socket.id);
    console.error('Error:', error);
  });
});

const PORT = 5001;
server.listen(PORT, () => {
  console.log(`Minimal working server running on port ${PORT}`);
  console.log('This should work with the existing frontend');
});
