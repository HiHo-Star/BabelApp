const { io } = require('socket.io-client');

// Connect to our own backend
const socket = io('http://localhost:5001', {
  query: { userId: 'test-user' }
});

socket.on('connect', () => {
  console.log('✅ Connected to backend with ID:', socket.id);
  
  // Listen for the test event that the backend should emit
  socket.on('test-event', (data) => {
    console.log('🎉 RECEIVED TEST EVENT FROM BACKEND:', data);
  });
  
  // Send a test message to trigger backend processing
  console.log('📤 Sending test message to backend...');
  socket.emit('send-message', {
    chatId: 'test-chat',
    content: 'test message from test script',
    contentType: 'text'
  });
  
  // Wait a bit then disconnect
  setTimeout(() => {
    console.log('🔌 Disconnecting...');
    socket.disconnect();
    process.exit(0);
  }, 3000);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection error:', error);
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('🔌 Disconnected from backend');
});
