const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireVerified, checkCoins } = require('../middleware/auth');
const { query, transaction } = require('../config/database');

const router = express.Router();

// Record a like
router.post('/like', [
  authenticateToken,
  requireVerified,
  body('userId').isUUID().withMessage('Valid user ID is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId } = req.body;
    const currentUserId = req.user.id;

    if (userId === currentUserId) {
      return res.status(400).json({ message: 'Cannot like yourself' });
    }

    await transaction(async (client) => {
      // Check if already liked
      const existingLike = await client.query(
        'SELECT id FROM matches WHERE user1_id = $1 AND user2_id = $2',
        [currentUserId, userId]
      );

      if (existingLike.rows.length > 0) {
        return res.status(400).json({ message: 'Already liked this user' });
      }

      // Record the like
      await client.query(`
        INSERT INTO matches (user1_id, user2_id, user1_liked, created_at)
        VALUES ($1, $2, true, NOW())
        ON CONFLICT (user1_id, user2_id) 
        DO UPDATE SET user1_liked = true, updated_at = NOW()
      `, [currentUserId, userId]);

      // Check if it's a mutual match
      const mutualMatch = await client.query(`
        SELECT m1.id as match1_id, m2.id as match2_id
        FROM matches m1
        JOIN matches m2 ON m1.user1_id = m2.user2_id AND m1.user2_id = m2.user1_id
        WHERE m1.user1_id = $1 AND m1.user2_id = $2 
        AND m1.user1_liked = true AND m2.user1_liked = true
      `, [currentUserId, userId]);

      let conversationId = null;
      let matched = false;

      if (mutualMatch.rows.length > 0) {
        matched = true;

        // Update both match records to show they're matched
        await client.query(`
          UPDATE matches SET matched = true, matched_at = NOW()
          WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)
        `, [currentUserId, userId]);

        // Create conversation
        const conversation = await client.query(`
          INSERT INTO conversations (participant1_id, participant2_id, created_at)
          VALUES ($1, $2, NOW())
          RETURNING id
        `, [currentUserId, userId]);

        conversationId = conversation.rows[0].id;

        // Send match notification via socket
        const io = req.app.get('io');
        if (io) {
          io.to(`user_${userId}`).emit('match_found', {
            matchId: mutualMatch.rows[0].match1_id,
            user: {
              id: currentUserId,
              firstName: req.user.firstName,
              lastName: req.user.lastName,
              profilePicture: req.user.profilePicture,
            },
            conversationId,
          });
        }
      }

      res.json({
        message: matched ? 'It\'s a match!' : 'Like recorded',
        matched,
        conversationId,
      });
    });

  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ message: 'Failed to record like' });
  }
});

// Record a pass
router.post('/pass', [
  authenticateToken,
  requireVerified,
  body('userId').isUUID().withMessage('Valid user ID is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId } = req.body;
    const currentUserId = req.user.id;

    if (userId === currentUserId) {
      return res.status(400).json({ message: 'Cannot pass yourself' });
    }

    // Record the pass
    await query(`
      INSERT INTO matches (user1_id, user2_id, user1_liked, created_at)
      VALUES ($1, $2, false, NOW())
      ON CONFLICT (user1_id, user2_id) 
      DO UPDATE SET user1_liked = false, updated_at = NOW()
    `, [currentUserId, userId]);

    res.json({ message: 'Pass recorded' });

  } catch (error) {
    console.error('Pass error:', error);
    res.status(500).json({ message: 'Failed to record pass' });
  }
});

// Get user's matches
router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const matches = await query(`
      SELECT 
        m.id as match_id,
        m.matched_at,
        u.id,
        u.username,
        u.first_name,
        u.last_name,
        u.profile_picture,
        u.bio,
        u.is_verified,
        u.is_premium,
        c.id as conversation_id,
        c.last_message_at,
        c.last_message_content
      FROM matches m
      JOIN users u ON (
        CASE 
          WHEN m.user1_id = $1 THEN u.id = m.user2_id
          ELSE u.id = m.user1_id
        END
      )
      LEFT JOIN conversations c ON (
        (c.participant1_id = $1 AND c.participant2_id = u.id) OR
        (c.participant2_id = $1 AND c.participant1_id = u.id)
      )
      WHERE (m.user1_id = $1 OR m.user2_id = $1) 
      AND m.matched = true
      ORDER BY m.matched_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);

    res.json({ matches: matches.rows });

  } catch (error) {
    console.error('Get matches error:', error);
    res.status(500).json({ message: 'Failed to get matches' });
  }
});

// Unmatch a user
router.delete('/:matchId', [
  authenticateToken,
  requireVerified,
], async (req, res) => {
  try {
    const { matchId } = req.params;
    const currentUserId = req.user.id;

    await transaction(async (client) => {
      // Get match details
      const match = await client.query(`
        SELECT user1_id, user2_id FROM matches 
        WHERE id = $1 AND (user1_id = $2 OR user2_id = $2)
      `, [matchId, currentUserId]);

      if (match.rows.length === 0) {
        return res.status(404).json({ message: 'Match not found' });
      }

      const { user1_id, user2_id } = match.rows[0];
      const otherUserId = user1_id === currentUserId ? user2_id : user1_id;

      // Delete the match records
      await client.query(`
        DELETE FROM matches 
        WHERE (user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1)
      `, [currentUserId, otherUserId]);

      // Delete the conversation
      await client.query(`
        DELETE FROM conversations 
        WHERE (participant1_id = $1 AND participant2_id = $2) OR 
              (participant1_id = $2 AND participant2_id = $1)
      `, [currentUserId, otherUserId]);

      res.json({ message: 'Successfully unmatched' });
    });

  } catch (error) {
    console.error('Unmatch error:', error);
    res.status(500).json({ message: 'Failed to unmatch' });
  }
});

// Super like (premium feature)
router.post('/super-like', [
  authenticateToken,
  requireVerified,
  checkCoins(10), // Super like costs 10 coins
  body('userId').isUUID().withMessage('Valid user ID is required'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { userId } = req.body;
    const currentUserId = req.user.id;

    if (userId === currentUserId) {
      return res.status(400).json({ message: 'Cannot super like yourself' });
    }

    await transaction(async (client) => {
      // Check if already liked/super liked
      const existingMatch = await client.query(
        'SELECT id, is_super_like FROM matches WHERE user1_id = $1 AND user2_id = $2',
        [currentUserId, userId]
      );

      if (existingMatch.rows.length > 0 && existingMatch.rows[0].is_super_like) {
        return res.status(400).json({ message: 'Already super liked this user' });
      }

      // Deduct coins
      await client.query(
        'UPDATE users SET coins = coins - 10 WHERE id = $1',
        [currentUserId]
      );

      // Record coin transaction
      await client.query(`
        INSERT INTO coin_transactions (user_id, amount, type, description, created_at)
        VALUES ($1, -10, 'spent', 'Super like', NOW())
      `, [currentUserId]);

      // Record the super like
      await client.query(`
        INSERT INTO matches (user1_id, user2_id, user1_liked, is_super_like, created_at)
        VALUES ($1, $2, true, true, NOW())
        ON CONFLICT (user1_id, user2_id) 
        DO UPDATE SET user1_liked = true, is_super_like = true, updated_at = NOW()
      `, [currentUserId, userId]);

      // Send super like notification
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${userId}`).emit('super_like_received', {
          user: {
            id: currentUserId,
            firstName: req.user.firstName,
            lastName: req.user.lastName,
            profilePicture: req.user.profilePicture,
          },
        });
      }

      res.json({ 
        message: 'Super like sent!',
        coinsRemaining: req.user.coins - 10 
      });
    });

  } catch (error) {
    console.error('Super like error:', error);
    res.status(500).json({ message: 'Failed to send super like' });
  }
});

// Get match statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await query(`
      SELECT 
        COUNT(CASE WHEN user1_liked = true THEN 1 END) as likes_sent,
        COUNT(CASE WHEN user1_liked = false THEN 1 END) as passes_sent,
        COUNT(CASE WHEN matched = true THEN 1 END) as total_matches,
        COUNT(CASE WHEN is_super_like = true THEN 1 END) as super_likes_sent
      FROM matches 
      WHERE user1_id = $1
    `, [req.user.id]);

    const receivedLikes = await query(`
      SELECT COUNT(*) as likes_received
      FROM matches 
      WHERE user2_id = $1 AND user1_liked = true
    `, [req.user.id]);

    res.json({
      stats: {
        ...stats.rows[0],
        likes_received: receivedLikes.rows[0].likes_received,
      }
    });

  } catch (error) {
    console.error('Get match stats error:', error);
    res.status(500).json({ message: 'Failed to get match statistics' });
  }
});

module.exports = router;