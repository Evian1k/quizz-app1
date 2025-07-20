const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const { authenticateToken, requireVerified } = require('../middleware/auth');
const { query, transaction } = require('../config/database');
const { translateText } = require('../utils/translation');
const { uploadToCloudinary } = require('../utils/cloudinary');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/chat/';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow images, videos, and audio files
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|mp3|wav|m4a/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Get chat conversations for a user
router.get('/conversations', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await query(`
      SELECT DISTINCT
        c.id,
        c.participants,
        c.created_at,
        c.updated_at,
        (
          SELECT json_build_object(
            'id', m.id,
            'content', m.content,
            'type', m.type,
            'sender_id', m.sender_id,
            'created_at', m.created_at,
            'is_read', CASE WHEN mr.user_id IS NOT NULL THEN true ELSE false END
          )
          FROM messages m
          LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
          WHERE m.conversation_id = c.id
          ORDER BY m.created_at DESC
          LIMIT 1
        ) as last_message,
        (
          SELECT COUNT(*)
          FROM messages m2
          LEFT JOIN message_reads mr2 ON m2.id = mr2.message_id AND mr2.user_id = $1
          WHERE m2.conversation_id = c.id 
          AND m2.sender_id != $1 
          AND mr2.user_id IS NULL
        ) as unread_count,
        (
          SELECT json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name,
              'avatar', u.avatar,
              'is_online', u.is_online,
              'last_seen', u.last_seen
            )
          )
          FROM users u
          WHERE u.id = ANY(c.participants) AND u.id != $1
        ) as other_participants
      FROM conversations c
      WHERE $1 = ANY(c.participants)
      ORDER BY c.updated_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    res.json({
      conversations: result.rows,
      pagination: {
        page,
        limit,
        hasMore: result.rows.length === limit
      }
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get messages for a conversation
router.get('/:conversationId/messages', authenticateToken, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Verify user is part of conversation
    const conversationResult = await query(
      'SELECT participants FROM conversations WHERE id = $1',
      [conversationId]
    );

    if (conversationResult.rows.length === 0) {
      return res.status(404).json({ message: 'Conversation not found' });
    }

    const participants = conversationResult.rows[0].participants;
    if (!participants.includes(userId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get messages
    const messagesResult = await query(`
      SELECT 
        m.id,
        m.content,
        m.type,
        m.media_url,
        m.media_type,
        m.translation,
        m.sender_id,
        m.created_at,
        m.updated_at,
        u.name as sender_name,
        u.avatar as sender_avatar,
        CASE WHEN mr.user_id IS NOT NULL THEN true ELSE false END as is_read
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      LEFT JOIN message_reads mr ON m.id = mr.message_id AND mr.user_id = $1
      WHERE m.conversation_id = $2
      ORDER BY m.created_at DESC
      LIMIT $3 OFFSET $4
    `, [userId, conversationId, limit, offset]);

    // Mark messages as read
    await query(`
      INSERT INTO message_reads (message_id, user_id, read_at)
      SELECT m.id, $1, NOW()
      FROM messages m
      WHERE m.conversation_id = $2 
      AND m.sender_id != $1
      AND NOT EXISTS (
        SELECT 1 FROM message_reads mr 
        WHERE mr.message_id = m.id AND mr.user_id = $1
      )
    `, [userId, conversationId]);

    res.json({
      messages: messagesResult.rows.reverse(), // Return in chronological order
      pagination: {
        page,
        limit,
        hasMore: messagesResult.rows.length === limit
      }
    });
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Send a text message
router.post('/:conversationId/messages', [
  authenticateToken,
  requireVerified,
  body('content').trim().isLength({ min: 1, max: 1000 }).withMessage('Message content required'),
  body('translate_to').optional().isLength({ min: 2, max: 5 }).withMessage('Invalid language code')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { conversationId } = req.params;
    const { content, translate_to } = req.body;
    const userId = req.user.id;

    await transaction(async (client) => {
      // Verify user is part of conversation
      const conversationResult = await client.query(
        'SELECT participants FROM conversations WHERE id = $1',
        [conversationId]
      );

      if (conversationResult.rows.length === 0) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      const participants = conversationResult.rows[0].participants;
      if (!participants.includes(userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if user has enough coins (1 coin per message)
      const userResult = await client.query(
        'SELECT coins FROM users WHERE id = $1',
        [userId]
      );

      const userCoins = userResult.rows[0].coins || 0;
      if (userCoins < 1) {
        return res.status(400).json({ 
          message: 'Insufficient coins',
          required: 1,
          current: userCoins
        });
      }

      // Deduct coin
      await client.query(
        'UPDATE users SET coins = coins - 1 WHERE id = $1',
        [userId]
      );

      // Record coin transaction
      await client.query(`
        INSERT INTO coin_transactions (user_id, type, amount, description, reference_id, created_at)
        VALUES ($1, 'message', -1, 'Sent message', $2, NOW())
      `, [userId, conversationId]);

      // Translate message if requested
      let translation = null;
      if (translate_to) {
        try {
          translation = await translateText(content, translate_to);
        } catch (translationError) {
          console.error('Translation error:', translationError);
          // Continue without translation
        }
      }

      // Create message
      const messageResult = await client.query(`
        INSERT INTO messages (conversation_id, sender_id, content, type, translation, created_at)
        VALUES ($1, $2, $3, 'text', $4, NOW())
        RETURNING id, content, type, translation, sender_id, created_at
      `, [conversationId, userId, content, translation]);

      // Update conversation timestamp
      await client.query(
        'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
        [conversationId]
      );

      const message = messageResult.rows[0];

      // Get sender info
      const senderResult = await client.query(
        'SELECT name, avatar FROM users WHERE id = $1',
        [userId]
      );

      const messageWithSender = {
        ...message,
        sender_name: senderResult.rows[0].name,
        sender_avatar: senderResult.rows[0].avatar,
        is_read: false
      };

      res.status(201).json({
        message: messageWithSender,
        coins_spent: 1,
        new_balance: userCoins - 1
      });

      // Emit socket event for real-time updates
      req.io?.to(conversationId).emit('new_message', messageWithSender);
    });
  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Send media message
router.post('/:conversationId/media', [
  authenticateToken,
  requireVerified,
  upload.single('media')
], async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'Media file required' });
    }

    await transaction(async (client) => {
      // Verify user is part of conversation
      const conversationResult = await client.query(
        'SELECT participants FROM conversations WHERE id = $1',
        [conversationId]
      );

      if (conversationResult.rows.length === 0) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      const participants = conversationResult.rows[0].participants;
      if (!participants.includes(userId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Check if user has enough coins (2 coins per media message)
      const userResult = await client.query(
        'SELECT coins FROM users WHERE id = $1',
        [userId]
      );

      const userCoins = userResult.rows[0].coins || 0;
      if (userCoins < 2) {
        return res.status(400).json({ 
          message: 'Insufficient coins for media message',
          required: 2,
          current: userCoins
        });
      }

      // Upload to cloud storage
      let mediaUrl;
      try {
        mediaUrl = await uploadToCloudinary(file.path);
        // Delete local file after upload
        await fs.unlink(file.path);
      } catch (uploadError) {
        console.error('Media upload error:', uploadError);
        return res.status(500).json({ message: 'Media upload failed' });
      }

      // Deduct coins
      await client.query(
        'UPDATE users SET coins = coins - 2 WHERE id = $1',
        [userId]
      );

      // Record coin transaction
      await client.query(`
        INSERT INTO coin_transactions (user_id, type, amount, description, reference_id, created_at)
        VALUES ($1, 'message', -2, 'Sent media message', $2, NOW())
      `, [userId, conversationId]);

      // Determine media type
      const mediaType = file.mimetype.startsWith('image/') ? 'image' : 
                       file.mimetype.startsWith('video/') ? 'video' : 'audio';

      // Create message
      const messageResult = await client.query(`
        INSERT INTO messages (conversation_id, sender_id, content, type, media_url, media_type, created_at)
        VALUES ($1, $2, '', $3, $4, $5, NOW())
        RETURNING id, content, type, media_url, media_type, sender_id, created_at
      `, [conversationId, userId, mediaType, mediaUrl, mediaType]);

      // Update conversation timestamp
      await client.query(
        'UPDATE conversations SET updated_at = NOW() WHERE id = $1',
        [conversationId]
      );

      const message = messageResult.rows[0];

      // Get sender info
      const senderResult = await client.query(
        'SELECT name, avatar FROM users WHERE id = $1',
        [userId]
      );

      const messageWithSender = {
        ...message,
        sender_name: senderResult.rows[0].name,
        sender_avatar: senderResult.rows[0].avatar,
        is_read: false
      };

      res.status(201).json({
        message: messageWithSender,
        coins_spent: 2,
        new_balance: userCoins - 2
      });

      // Emit socket event for real-time updates
      req.io?.to(conversationId).emit('new_message', messageWithSender);
    });
  } catch (error) {
    console.error('Error sending media message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Start a new conversation
router.post('/conversations', [
  authenticateToken,
  requireVerified,
  body('participantId').isUUID().withMessage('Valid participant ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { participantId } = req.body;
    const userId = req.user.id;

    if (participantId === userId) {
      return res.status(400).json({ message: 'Cannot start conversation with yourself' });
    }

    await transaction(async (client) => {
      // Check if conversation already exists
      const existingConversation = await client.query(`
        SELECT id FROM conversations 
        WHERE participants @> $1 AND participants @> $2 
        AND array_length(participants, 1) = 2
      `, [`[${userId}]`, `[${participantId}]`]);

      if (existingConversation.rows.length > 0) {
        return res.json({ 
          conversation: { id: existingConversation.rows[0].id },
          message: 'Conversation already exists'
        });
      }

      // Verify both users exist and are verified
      const usersResult = await client.query(
        'SELECT id, name, avatar FROM users WHERE id = ANY($1) AND is_verified = true',
        [[userId, participantId]]
      );

      if (usersResult.rows.length !== 2) {
        return res.status(400).json({ message: 'One or both users not found or not verified' });
      }

      // Create new conversation
      const conversationResult = await client.query(`
        INSERT INTO conversations (participants, created_at, updated_at)
        VALUES ($1, NOW(), NOW())
        RETURNING id, participants, created_at
      `, [[userId, participantId]]);

      const conversation = conversationResult.rows[0];

      res.status(201).json({
        conversation: {
          ...conversation,
          other_participants: usersResult.rows.filter(u => u.id !== userId)
        }
      });
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Delete a message (soft delete)
router.delete('/messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const result = await query(`
      UPDATE messages 
      SET content = '[Message deleted]', 
          media_url = NULL,
          updated_at = NOW()
      WHERE id = $1 AND sender_id = $2
      RETURNING id
    `, [messageId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Message not found or unauthorized' });
    }

    res.json({ message: 'Message deleted successfully' });
  } catch (error) {
    console.error('Error deleting message:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Block a user from conversation
router.post('/:conversationId/block', [
  authenticateToken,
  body('userId').isUUID().withMessage('Valid user ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { conversationId } = req.params;
    const { userId: blockedUserId } = req.body;
    const blockerId = req.user.id;

    await transaction(async (client) => {
      // Verify conversation exists and user is participant
      const conversationResult = await client.query(
        'SELECT participants FROM conversations WHERE id = $1',
        [conversationId]
      );

      if (conversationResult.rows.length === 0) {
        return res.status(404).json({ message: 'Conversation not found' });
      }

      const participants = conversationResult.rows[0].participants;
      if (!participants.includes(blockerId) || !participants.includes(blockedUserId)) {
        return res.status(403).json({ message: 'Access denied' });
      }

      // Add to blocked users
      await client.query(`
        INSERT INTO blocked_users (blocker_id, blocked_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT (blocker_id, blocked_id) DO NOTHING
      `, [blockerId, blockedUserId]);

      // Mark conversation as blocked
      await client.query(
        'UPDATE conversations SET is_blocked = true WHERE id = $1',
        [conversationId]
      );

      res.json({ message: 'User blocked successfully' });
    });
  } catch (error) {
    console.error('Error blocking user:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Report inappropriate content
router.post('/messages/:messageId/report', [
  authenticateToken,
  body('reason').isIn(['spam', 'harassment', 'inappropriate', 'fake', 'other']).withMessage('Valid reason required'),
  body('description').optional().isLength({ max: 500 }).withMessage('Description too long')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { messageId } = req.params;
    const { reason, description } = req.body;
    const reporterId = req.user.id;

    await query(`
      INSERT INTO reports (reporter_id, reported_content_type, reported_content_id, reason, description, created_at)
      VALUES ($1, 'message', $2, $3, $4, NOW())
    `, [reporterId, messageId, reason, description || '']);

    res.json({ message: 'Report submitted successfully' });
  } catch (error) {
    console.error('Error submitting report:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;