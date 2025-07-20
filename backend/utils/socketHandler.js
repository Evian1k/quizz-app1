const { authenticateSocket } = require('../middleware/auth');
const { setUserOnline, setUserOffline, isUserOnline } = require('../config/redis');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// Store active connections
const activeConnections = new Map();
const videoCallRooms = new Map();

function socketHandler(io) {
  // Authentication middleware
  io.use(authenticateSocket);

  io.on('connection', async (socket) => {
    console.log(`User ${socket.user.username} connected with socket ${socket.id}`);
    
    // Store connection
    activeConnections.set(socket.userId, {
      socketId: socket.id,
      user: socket.user,
      lastSeen: new Date()
    });

    // Set user online in Redis
    await setUserOnline(socket.userId, socket.id);

    // Join user to their personal room for notifications
    socket.join(`user_${socket.userId}`);

    // Emit online status to friends/matches
    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      username: socket.user.username
    });

    // Handle joining conversation rooms
    socket.on('join_conversation', async (data) => {
      try {
        const { conversationId } = data;
        
        // Verify user is participant in conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit('error', { message: 'Conversation not found' });
          return;
        }

        const isParticipant = conversation.participant1_id === socket.userId || 
                             conversation.participant2_id === socket.userId;
        
        if (!isParticipant) {
          socket.emit('error', { message: 'Not authorized to join this conversation' });
          return;
        }

        socket.join(`conversation_${conversationId}`);
        socket.currentConversation = conversationId;
        
        // Mark messages as read
        await Message.markAsRead(conversationId, socket.userId);
        
        socket.emit('joined_conversation', { conversationId });
        
        // Notify other participant that user is online in conversation
        socket.to(`conversation_${conversationId}`).emit('user_joined_conversation', {
          userId: socket.userId,
          username: socket.user.username
        });
      } catch (error) {
        console.error('Join conversation error:', error);
        socket.emit('error', { message: 'Failed to join conversation' });
      }
    });

    // Handle leaving conversation
    socket.on('leave_conversation', (data) => {
      const { conversationId } = data;
      socket.leave(`conversation_${conversationId}`);
      socket.currentConversation = null;
      
      socket.to(`conversation_${conversationId}`).emit('user_left_conversation', {
        userId: socket.userId,
        username: socket.user.username
      });
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        const { conversationId, content, messageType = 'text', mediaUrl, mediaMetadata } = data;
        
        // Verify user is in conversation
        if (socket.currentConversation !== conversationId) {
          socket.emit('error', { message: 'Join conversation first' });
          return;
        }

        // Create message
        const message = await Message.create({
          conversationId,
          senderId: socket.userId,
          content,
          messageType,
          mediaUrl,
          mediaMetadata
        });

        // Get full message with sender info
        const fullMessage = await Message.getWithSender(message.id);

        // Emit to conversation room
        io.to(`conversation_${conversationId}`).emit('new_message', fullMessage);

        // Send push notification to offline users
        const conversation = await Conversation.findById(conversationId);
        const recipientId = conversation.participant1_id === socket.userId ? 
                           conversation.participant2_id : conversation.participant1_id;
        
        const isRecipientOnline = await isUserOnline(recipientId);
        if (!isRecipientOnline) {
          // Send push notification (implement with FCM)
          // await sendPushNotification(recipientId, {
          //   title: `New message from ${socket.user.firstName}`,
          //   body: content,
          //   data: { conversationId, messageId: message.id }
          // });
        }

      } catch (error) {
        console.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle typing indicators
    socket.on('typing_start', (data) => {
      const { conversationId } = data;
      if (socket.currentConversation === conversationId) {
        socket.to(`conversation_${conversationId}`).emit('user_typing', {
          userId: socket.userId,
          username: socket.user.username,
          isTyping: true
        });
      }
    });

    socket.on('typing_stop', (data) => {
      const { conversationId } = data;
      if (socket.currentConversation === conversationId) {
        socket.to(`conversation_${conversationId}`).emit('user_typing', {
          userId: socket.userId,
          username: socket.user.username,
          isTyping: false
        });
      }
    });

    // Handle message reactions
    socket.on('react_to_message', async (data) => {
      try {
        const { messageId, reaction } = data;
        
        await Message.addReaction(messageId, socket.userId, reaction);
        
        // Get message to find conversation
        const message = await Message.findById(messageId);
        if (message) {
          io.to(`conversation_${message.conversation_id}`).emit('message_reaction', {
            messageId,
            userId: socket.userId,
            username: socket.user.username,
            reaction
          });
        }
      } catch (error) {
        console.error('Message reaction error:', error);
        socket.emit('error', { message: 'Failed to add reaction' });
      }
    });

    // Video call signaling
    socket.on('call_user', async (data) => {
      try {
        const { recipientId, conversationId, offer, callType = 'video' } = data;
        
        // Verify conversation exists and user is participant
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) {
          socket.emit('call_error', { message: 'Conversation not found' });
          return;
        }

        const isParticipant = conversation.participant1_id === socket.userId || 
                             conversation.participant2_id === socket.userId;
        
        if (!isParticipant) {
          socket.emit('call_error', { message: 'Not authorized' });
          return;
        }

        // Create call room
        const callId = `call_${Date.now()}_${socket.userId}`;
        videoCallRooms.set(callId, {
          callerId: socket.userId,
          recipientId,
          conversationId,
          callType,
          status: 'ringing',
          startTime: new Date()
        });

        // Notify recipient
        io.to(`user_${recipientId}`).emit('incoming_call', {
          callId,
          callerId: socket.userId,
          callerName: socket.user.firstName,
          callerPicture: socket.user.profilePicture,
          conversationId,
          callType,
          offer
        });

        socket.emit('call_initiated', { callId });

        // Auto-decline after 30 seconds
        setTimeout(() => {
          const call = videoCallRooms.get(callId);
          if (call && call.status === 'ringing') {
            videoCallRooms.delete(callId);
            socket.emit('call_declined', { callId, reason: 'timeout' });
            io.to(`user_${recipientId}`).emit('call_ended', { callId, reason: 'timeout' });
          }
        }, 30000);

      } catch (error) {
        console.error('Call user error:', error);
        socket.emit('call_error', { message: 'Failed to initiate call' });
      }
    });

    socket.on('answer_call', (data) => {
      const { callId, answer } = data;
      const call = videoCallRooms.get(callId);
      
      if (call && call.recipientId === socket.userId) {
        call.status = 'active';
        
        // Join both users to call room
        socket.join(callId);
        const callerSocket = [...activeConnections.entries()]
          .find(([userId, conn]) => userId === call.callerId);
        
        if (callerSocket) {
          io.sockets.sockets.get(callerSocket[1].socketId)?.join(callId);
        }

        io.to(callId).emit('call_answered', { callId, answer });
      }
    });

    socket.on('decline_call', (data) => {
      const { callId } = data;
      const call = videoCallRooms.get(callId);
      
      if (call && call.recipientId === socket.userId) {
        videoCallRooms.delete(callId);
        io.to(`user_${call.callerId}`).emit('call_declined', { callId });
      }
    });

    socket.on('end_call', (data) => {
      const { callId } = data;
      const call = videoCallRooms.get(callId);
      
      if (call && (call.callerId === socket.userId || call.recipientId === socket.userId)) {
        videoCallRooms.delete(callId);
        io.to(callId).emit('call_ended', { callId });
        
        // Leave call room
        socket.leave(callId);
      }
    });

    // WebRTC signaling for peer-to-peer connection
    socket.on('webrtc_offer', (data) => {
      const { callId, offer } = data;
      socket.to(callId).emit('webrtc_offer', { offer, from: socket.userId });
    });

    socket.on('webrtc_answer', (data) => {
      const { callId, answer } = data;
      socket.to(callId).emit('webrtc_answer', { answer, from: socket.userId });
    });

    socket.on('webrtc_ice_candidate', (data) => {
      const { callId, candidate } = data;
      socket.to(callId).emit('webrtc_ice_candidate', { candidate, from: socket.userId });
    });

    // Handle match notifications
    socket.on('new_match', async (data) => {
      const { matchId, otherUserId } = data;
      
      // Notify both users about the match
      io.to(`user_${otherUserId}`).emit('match_found', {
        matchId,
        userId: socket.userId,
        user: socket.user
      });
    });

    // Handle disconnect
    socket.on('disconnect', async (reason) => {
      console.log(`User ${socket.user.username} disconnected: ${reason}`);
      
      // Remove from active connections
      activeConnections.delete(socket.userId);
      
      // Set user offline
      await setUserOffline(socket.userId);
      
      // Notify others user went offline
      socket.broadcast.emit('user_offline', {
        userId: socket.userId,
        username: socket.user.username
      });

      // Leave current conversation
      if (socket.currentConversation) {
        socket.to(`conversation_${socket.currentConversation}`).emit('user_left_conversation', {
          userId: socket.userId,
          username: socket.user.username
        });
      }

      // End any active calls
      for (const [callId, call] of videoCallRooms.entries()) {
        if (call.callerId === socket.userId || call.recipientId === socket.userId) {
          videoCallRooms.delete(callId);
          io.to(callId).emit('call_ended', { callId, reason: 'user_disconnected' });
        }
      }
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Cleanup inactive connections periodically
  setInterval(() => {
    const now = new Date();
    for (const [userId, connection] of activeConnections.entries()) {
      const timeDiff = now - connection.lastSeen;
      if (timeDiff > 5 * 60 * 1000) { // 5 minutes
        activeConnections.delete(userId);
        setUserOffline(userId);
      }
    }
  }, 60000); // Check every minute
}

module.exports = socketHandler;