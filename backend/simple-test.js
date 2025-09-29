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
  res.json({ message: 'Simple Socket.IO test server running!' });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('=== SIMPLE TEST: User connected ===');
  console.log('Socket ID:', socket.id);
  console.log('Query params:', socket.handshake.query);
  
  // Test event
  socket.emit('test-event', 'hello from simple test server');
  
  // Listen for send-message
  socket.on('send-message', (data) => {
    console.log('=== SIMPLE TEST: MESSAGE RECEIVED ===');
    console.log('Data:', data);
    console.log('Socket ID:', socket.id);
    
    // Echo back to confirm
    socket.emit('message-received', { 
      status: 'success', 
      message: 'Message received by simple test server',
      originalData: data 
    });
  });
  
  socket.on('disconnect', () => {
    console.log('=== SIMPLE TEST: User disconnected ===');
    console.log('Socket ID:', socket.id);
  });
});

const PORT = 5002;
server.listen(PORT, () => {
  console.log(`Simple test server running on port ${PORT}`);
  console.log('This will help isolate if the issue is in the main backend or Socket.IO itself');
});
