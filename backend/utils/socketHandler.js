const jwt = require('jsonwebtoken');
const { query } = require('../config/database');
const { setUserOnline, setUserOffline, getUserOnlineStatus } = require('../config/redis');

// Store active connections
const activeConnections = new Map();
const callRooms = new Map();
const conversationRooms = new Map();

function socketHandler(io) {
  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      // Get user details
      const userResult = await query(
        'SELECT id, name, email, avatar, is_verified, is_online FROM users WHERE id = $1',
        [decoded.userId]
      );

      if (userResult.rows.length === 0) {
        return next(new Error('User not found'));
      }

      const user = userResult.rows[0];
      if (!user.is_verified) {
        return next(new Error('User not verified'));
      }

      socket.userId = user.id;
      socket.user = user;
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    const user = socket.user;
    
    console.log(`✅ User ${user.name} (${userId}) connected with socket ${socket.id}`);
    
    try {
      // Store connection
      activeConnections.set(userId, {
        socketId: socket.id,
        user: user,
        lastSeen: new Date(),
        rooms: new Set()
      });

      // Set user online in Redis and database
      await setUserOnline(userId, socket.id);
      await query('UPDATE users SET is_online = true, last_seen = NOW() WHERE id = $1', [userId]);

      // Join user to their personal room for notifications
      socket.join(`user_${userId}`);

      // Emit online status to user's matches and conversations
      const matchesResult = await query(`
        SELECT DISTINCT 
          CASE 
            WHEN user1_id = $1 THEN user2_id 
            ELSE user1_id 
          END as other_user_id
        FROM matches 
        WHERE (user1_id = $1 OR user2_id = $1) 
        AND user1_liked = true AND user2_liked = true
      `, [userId]);

      // Notify matches that user is online
      matchesResult.rows.forEach(match => {
        socket.to(`user_${match.other_user_id}`).emit('user_online', {
          userId: userId,
          name: user.name,
          avatar: user.avatar
        });
      });

      // Send user their current online status and unread counts
      const unreadResult = await query(`
        SELECT 
          c.id as conversation_id,
          COUNT(m.id) as unread_count
        FROM conversations c
        LEFT JOIN messages m ON c.id = m.conversation_id
        LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
        WHERE $1 = ANY(c.participants) 
        AND m.sender_id != $1 
        AND mr.user_id IS NULL
        GROUP BY c.id
      `, [userId]);

      socket.emit('connection_established', {
        user: {
          id: user.id,
          name: user.name,
          avatar: user.avatar
        },
        unreadCounts: unreadResult.rows.reduce((acc, row) => {
          acc[row.conversation_id] = parseInt(row.unread_count);
          return acc;
        }, {}),
        timestamp: new Date().toISOString()
      });

      // Handle joining conversation rooms
      socket.on('join_conversation', async (data) => {
        try {
          const { conversationId } = data;
          
          if (!conversationId) {
            socket.emit('error', { message: 'Conversation ID required' });
            return;
          }

          // Verify user is participant in conversation
          const conversationResult = await query(
            'SELECT participants FROM conversations WHERE id = $1',
            [conversationId]
          );

          if (conversationResult.rows.length === 0) {
            socket.emit('error', { message: 'Conversation not found' });
            return;
          }

          const participants = conversationResult.rows[0].participants;
          if (!participants.includes(userId)) {
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          // Join conversation room
          socket.join(conversationId);
          activeConnections.get(userId).rooms.add(conversationId);

          // Track conversation room
          if (!conversationRooms.has(conversationId)) {
            conversationRooms.set(conversationId, new Set());
          }
          conversationRooms.get(conversationId).add(userId);

          socket.emit('joined_conversation', { conversationId });
          
          // Notify other participants that user joined
          socket.to(conversationId).emit('user_joined_conversation', {
            conversationId,
            userId,
            userName: user.name
          });

        } catch (error) {
          console.error('Join conversation error:', error);
          socket.emit('error', { message: 'Failed to join conversation' });
        }
      });

      // Handle leaving conversation rooms
      socket.on('leave_conversation', (data) => {
        try {
          const { conversationId } = data;
          
          if (!conversationId) return;

          socket.leave(conversationId);
          activeConnections.get(userId)?.rooms.delete(conversationId);

          if (conversationRooms.has(conversationId)) {
            conversationRooms.get(conversationId).delete(userId);
            if (conversationRooms.get(conversationId).size === 0) {
              conversationRooms.delete(conversationId);
            }
          }

          socket.to(conversationId).emit('user_left_conversation', {
            conversationId,
            userId,
            userName: user.name
          });

        } catch (error) {
          console.error('Leave conversation error:', error);
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        try {
          const { conversationId } = data;
          if (!conversationId) return;

          socket.to(conversationId).emit('user_typing', {
            conversationId,
            userId,
            userName: user.name,
            isTyping: true
          });
        } catch (error) {
          console.error('Typing start error:', error);
        }
      });

      socket.on('typing_stop', (data) => {
        try {
          const { conversationId } = data;
          if (!conversationId) return;

          socket.to(conversationId).emit('user_typing', {
            conversationId,
            userId,
            userName: user.name,
            isTyping: false
          });
        } catch (error) {
          console.error('Typing stop error:', error);
        }
      });

      // Handle call signaling
      socket.on('call_offer', async (data) => {
        try {
          const { callId, recipientId, offer } = data;
          
          if (!callId || !recipientId || !offer) {
            socket.emit('error', { message: 'Missing call data' });
            return;
          }

          // Verify call exists and user is participant
          const callResult = await query(
            'SELECT * FROM calls WHERE id = $1 AND (caller_id = $2 OR recipient_id = $2)',
            [callId, userId]
          );

          if (callResult.rows.length === 0) {
            socket.emit('error', { message: 'Call not found or access denied' });
            return;
          }

          // Forward offer to recipient
          io.to(`user_${recipientId}`).emit('call_offer', {
            callId,
            offer,
            from: userId,
            caller: {
              id: user.id,
              name: user.name,
              avatar: user.avatar
            }
          });

        } catch (error) {
          console.error('Call offer error:', error);
          socket.emit('error', { message: 'Failed to send call offer' });
        }
      });

      socket.on('call_answer', async (data) => {
        try {
          const { callId, callerId, answer } = data;
          
          if (!callId || !callerId || !answer) {
            socket.emit('error', { message: 'Missing call data' });
            return;
          }

          // Forward answer to caller
          io.to(`user_${callerId}`).emit('call_answer', {
            callId,
            answer,
            from: userId,
            recipient: {
              id: user.id,
              name: user.name,
              avatar: user.avatar
            }
          });

        } catch (error) {
          console.error('Call answer error:', error);
          socket.emit('error', { message: 'Failed to send call answer' });
        }
      });

      socket.on('ice_candidate', async (data) => {
        try {
          const { callId, candidate, targetUserId } = data;
          
          if (!callId || !candidate || !targetUserId) {
            socket.emit('error', { message: 'Missing ICE candidate data' });
            return;
          }

          // Forward ICE candidate to target user
          io.to(`user_${targetUserId}`).emit('ice_candidate', {
            callId,
            candidate,
            from: userId
          });

        } catch (error) {
          console.error('ICE candidate error:', error);
          socket.emit('error', { message: 'Failed to send ICE candidate' });
        }
      });

      // Handle user presence updates
      socket.on('update_presence', async (data) => {
        try {
          const { status } = data; // 'online', 'away', 'busy'
          
          if (!['online', 'away', 'busy'].includes(status)) {
            socket.emit('error', { message: 'Invalid presence status' });
            return;
          }

          // Update presence in database
          await query('UPDATE users SET presence_status = $1 WHERE id = $2', [status, userId]);

          // Notify matches about presence change
          const matchesResult = await query(`
            SELECT DISTINCT 
              CASE 
                WHEN user1_id = $1 THEN user2_id 
                ELSE user1_id 
              END as other_user_id
            FROM matches 
            WHERE (user1_id = $1 OR user2_id = $1) 
            AND user1_liked = true AND user2_liked = true
          `, [userId]);

          matchesResult.rows.forEach(match => {
            socket.to(`user_${match.other_user_id}`).emit('presence_update', {
              userId: userId,
              status: status,
              timestamp: new Date().toISOString()
            });
          });

        } catch (error) {
          console.error('Presence update error:', error);
          socket.emit('error', { message: 'Failed to update presence' });
        }
      });

      // Handle message read receipts
      socket.on('mark_messages_read', async (data) => {
        try {
          const { conversationId, messageIds } = data;
          
          if (!conversationId || !Array.isArray(messageIds)) {
            socket.emit('error', { message: 'Invalid read receipt data' });
            return;
          }

          // Mark messages as read
          for (const messageId of messageIds) {
            await query(`
              INSERT INTO message_reads (message_id, user_id, read_at)
              VALUES ($1, $2, NOW())
              ON CONFLICT (message_id, user_id) DO NOTHING
            `, [messageId, userId]);
          }

          // Notify other participants about read receipts
          socket.to(conversationId).emit('messages_read', {
            conversationId,
            messageIds,
            readBy: userId,
            readAt: new Date().toISOString()
          });

        } catch (error) {
          console.error('Mark messages read error:', error);
          socket.emit('error', { message: 'Failed to mark messages as read' });
        }
      });

      // Handle location sharing (for matching)
      socket.on('update_location', async (data) => {
        try {
          const { latitude, longitude } = data;
          
          if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            socket.emit('error', { message: 'Invalid location data' });
            return;
          }

          // Update user location
          await query(`
            UPDATE users 
            SET latitude = $1, longitude = $2, location_updated_at = NOW() 
            WHERE id = $3
          `, [latitude, longitude, userId]);

          socket.emit('location_updated', { 
            message: 'Location updated successfully',
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          console.error('Location update error:', error);
          socket.emit('error', { message: 'Failed to update location' });
        }
      });

      // Handle disconnect
      socket.on('disconnect', async (reason) => {
        console.log(`❌ User ${user.name} (${userId}) disconnected: ${reason}`);
        
        try {
          // Remove from active connections
          activeConnections.delete(userId);

          // Clean up conversation rooms
          for (const conversationId of activeConnections.get(userId)?.rooms || []) {
            if (conversationRooms.has(conversationId)) {
              conversationRooms.get(conversationId).delete(userId);
              if (conversationRooms.get(conversationId).size === 0) {
                conversationRooms.delete(conversationId);
              }
            }
          }

          // Set user offline
          await setUserOffline(userId);
          await query('UPDATE users SET is_online = false, last_seen = NOW() WHERE id = $1', [userId]);

          // Notify matches that user is offline
          const matchesResult = await query(`
            SELECT DISTINCT 
              CASE 
                WHEN user1_id = $1 THEN user2_id 
                ELSE user1_id 
              END as other_user_id
            FROM matches 
            WHERE (user1_id = $1 OR user2_id = $1) 
            AND user1_liked = true AND user2_liked = true
          `, [userId]);

          matchesResult.rows.forEach(match => {
            socket.to(`user_${match.other_user_id}`).emit('user_offline', {
              userId: userId,
              name: user.name,
              lastSeen: new Date().toISOString()
            });
          });

        } catch (error) {
          console.error('Disconnect cleanup error:', error);
        }
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error('Socket error for user', userId, ':', error);
      });

    } catch (error) {
      console.error('Socket connection error:', error);
      socket.emit('error', { message: 'Connection setup failed' });
      socket.disconnect();
    }
  });

  // Handle connection errors
  io.on('connect_error', (error) => {
    console.error('Socket.io connection error:', error);
  });

  return io;
}

// Helper functions
function getActiveConnections() {
  return Array.from(activeConnections.values());
}

function getUserConnection(userId) {
  return activeConnections.get(userId);
}

function isUserConnected(userId) {
  return activeConnections.has(userId);
}

function getConversationParticipants(conversationId) {
  return Array.from(conversationRooms.get(conversationId) || []);
}

function broadcastToMatches(userId, event, data) {
  // This would need to be called from outside with the io instance
  // Implementation would query user's matches and emit to them
}

module.exports = {
  socketHandler,
  getActiveConnections,
  getUserConnection,
  isUserConnected,
  getConversationParticipants,
  broadcastToMatches
};