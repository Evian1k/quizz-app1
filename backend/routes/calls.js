const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireVerified } = require('../middleware/auth');
const { query, transaction } = require('../config/database');

const router = express.Router();

// Initiate a call
router.post('/initiate', [
  authenticateToken,
  requireVerified,
  body('recipientId').isUUID().withMessage('Valid recipient ID required'),
  body('callType').isIn(['voice', 'video']).withMessage('Call type must be voice or video')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { recipientId, callType } = req.body;
    const callerId = req.user.id;

    if (callerId === recipientId) {
      return res.status(400).json({ message: 'Cannot call yourself' });
    }

    await transaction(async (client) => {
      // Check if caller has enough coins
      const callerResult = await client.query(
        'SELECT coins FROM users WHERE id = $1',
        [callerId]
      );

      const callerCoins = callerResult.rows[0].coins || 0;
      const requiredCoins = callType === 'video' ? 5 : 3; // Video calls cost more

      if (callerCoins < requiredCoins) {
        return res.status(400).json({
          message: 'Insufficient coins for call',
          required: requiredCoins,
          current: callerCoins,
          callType
        });
      }

      // Check if recipient exists and is verified
      const recipientResult = await client.query(
        'SELECT id, name, avatar, is_online FROM users WHERE id = $1 AND is_verified = true',
        [recipientId]
      );

      if (recipientResult.rows.length === 0) {
        return res.status(404).json({ message: 'Recipient not found or not verified' });
      }

      const recipient = recipientResult.rows[0];

      // Check if recipient is blocked
      const blockResult = await client.query(
        'SELECT id FROM blocked_users WHERE (blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1)',
        [callerId, recipientId]
      );

      if (blockResult.rows.length > 0) {
        return res.status(403).json({ message: 'Cannot call this user' });
      }

      // Check if there's already an active call
      const activeCallResult = await client.query(`
        SELECT id FROM calls 
        WHERE (caller_id = $1 OR recipient_id = $1 OR caller_id = $2 OR recipient_id = $2) 
        AND status IN ('ringing', 'connected')
      `, [callerId, recipientId]);

      if (activeCallResult.rows.length > 0) {
        return res.status(409).json({ message: 'User is already in a call' });
      }

      // Create call record
      const callResult = await client.query(`
        INSERT INTO calls (caller_id, recipient_id, call_type, status, created_at)
        VALUES ($1, $2, $3, 'ringing', NOW())
        RETURNING id, caller_id, recipient_id, call_type, status, created_at
      `, [callerId, recipientId, callType]);

      const call = callResult.rows[0];

      // Get caller info
      const callerInfo = await client.query(
        'SELECT id, name, avatar FROM users WHERE id = $1',
        [callerId]
      );

      const callData = {
        ...call,
        caller: callerInfo.rows[0],
        recipient: recipient
      };

      res.status(201).json({
        call: callData,
        message: 'Call initiated successfully'
      });

      // Emit socket event to recipient
      req.io?.to(`user_${recipientId}`).emit('incoming_call', {
        call: callData,
        caller: callerInfo.rows[0]
      });

      // Set call timeout (30 seconds)
      setTimeout(async () => {
        try {
          const timeoutResult = await client.query(`
            UPDATE calls 
            SET status = 'missed', ended_at = NOW() 
            WHERE id = $1 AND status = 'ringing'
            RETURNING id
          `, [call.id]);

          if (timeoutResult.rows.length > 0) {
            req.io?.to(`user_${callerId}`).emit('call_timeout', { callId: call.id });
            req.io?.to(`user_${recipientId}`).emit('call_timeout', { callId: call.id });
          }
        } catch (error) {
          console.error('Call timeout error:', error);
        }
      }, 30000);
    });
  } catch (error) {
    console.error('Error initiating call:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Answer a call
router.post('/:callId/answer', [
  authenticateToken,
  requireVerified
], async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    await transaction(async (client) => {
      // Get call details
      const callResult = await client.query(`
        SELECT c.*, u1.name as caller_name, u1.avatar as caller_avatar,
               u2.name as recipient_name, u2.avatar as recipient_avatar
        FROM calls c
        JOIN users u1 ON c.caller_id = u1.id
        JOIN users u2 ON c.recipient_id = u2.id
        WHERE c.id = $1 AND c.recipient_id = $2 AND c.status = 'ringing'
      `, [callId, userId]);

      if (callResult.rows.length === 0) {
        return res.status(404).json({ message: 'Call not found or cannot be answered' });
      }

      const call = callResult.rows[0];

      // Update call status
      await client.query(`
        UPDATE calls 
        SET status = 'connected', answered_at = NOW() 
        WHERE id = $1
      `, [callId]);

      // Deduct coins from caller
      const requiredCoins = call.call_type === 'video' ? 5 : 3;
      
      await client.query(
        'UPDATE users SET coins = coins - $1 WHERE id = $2',
        [requiredCoins, call.caller_id]
      );

      // Record coin transaction
      await client.query(`
        INSERT INTO coin_transactions (user_id, type, amount, description, reference_id, created_at)
        VALUES ($1, 'call', -$2, $3, $4, NOW())
      `, [call.caller_id, requiredCoins, `${call.call_type} call`, callId]);

      res.json({
        call: {
          id: call.id,
          caller_id: call.caller_id,
          recipient_id: call.recipient_id,
          call_type: call.call_type,
          status: 'connected',
          caller: {
            id: call.caller_id,
            name: call.caller_name,
            avatar: call.caller_avatar
          },
          recipient: {
            id: call.recipient_id,
            name: call.recipient_name,
            avatar: call.recipient_avatar
          }
        },
        message: 'Call answered successfully'
      });

      // Emit socket event to caller
      req.io?.to(`user_${call.caller_id}`).emit('call_answered', {
        callId: callId,
        recipient: {
          id: call.recipient_id,
          name: call.recipient_name,
          avatar: call.recipient_avatar
        }
      });
    });
  } catch (error) {
    console.error('Error answering call:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Decline a call
router.post('/:callId/decline', [
  authenticateToken,
  requireVerified
], async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    const result = await query(`
      UPDATE calls 
      SET status = 'declined', ended_at = NOW() 
      WHERE id = $1 AND recipient_id = $2 AND status = 'ringing'
      RETURNING caller_id, recipient_id
    `, [callId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Call not found or cannot be declined' });
    }

    const { caller_id } = result.rows[0];

    res.json({ message: 'Call declined successfully' });

    // Emit socket event to caller
    req.io?.to(`user_${caller_id}`).emit('call_declined', { callId });
  } catch (error) {
    console.error('Error declining call:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// End a call
router.post('/:callId/end', [
  authenticateToken,
  requireVerified
], async (req, res) => {
  try {
    const { callId } = req.params;
    const userId = req.user.id;

    await transaction(async (client) => {
      // Get call details and update status
      const callResult = await client.query(`
        UPDATE calls 
        SET status = 'ended', ended_at = NOW(),
            duration = EXTRACT(EPOCH FROM (NOW() - COALESCE(answered_at, created_at)))
        WHERE id = $1 AND (caller_id = $2 OR recipient_id = $2) 
        AND status IN ('ringing', 'connected')
        RETURNING caller_id, recipient_id, duration, call_type, answered_at
      `, [callId, userId]);

      if (callResult.rows.length === 0) {
        return res.status(404).json({ message: 'Call not found or already ended' });
      }

      const call = callResult.rows[0];
      const otherUserId = call.caller_id === userId ? call.recipient_id : call.caller_id;

      // If call was connected, record the actual duration
      let actualDuration = 0;
      if (call.answered_at && call.duration) {
        actualDuration = Math.floor(call.duration);
      }

      res.json({
        message: 'Call ended successfully',
        duration: actualDuration,
        callType: call.call_type
      });

      // Emit socket event to other participant
      req.io?.to(`user_${otherUserId}`).emit('call_ended', {
        callId,
        duration: actualDuration,
        endedBy: userId
      });
    });
  } catch (error) {
    console.error('Error ending call:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get call history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await query(`
      SELECT 
        c.id,
        c.call_type,
        c.status,
        c.duration,
        c.created_at,
        c.answered_at,
        c.ended_at,
        CASE 
          WHEN c.caller_id = $1 THEN 'outgoing'
          ELSE 'incoming'
        END as direction,
        CASE 
          WHEN c.caller_id = $1 THEN 
            json_build_object('id', u2.id, 'name', u2.name, 'avatar', u2.avatar)
          ELSE 
            json_build_object('id', u1.id, 'name', u1.name, 'avatar', u1.avatar)
        END as other_participant
      FROM calls c
      JOIN users u1 ON c.caller_id = u1.id
      JOIN users u2 ON c.recipient_id = u2.id
      WHERE c.caller_id = $1 OR c.recipient_id = $1
      ORDER BY c.created_at DESC
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const countResult = await query(
      'SELECT COUNT(*) FROM calls WHERE caller_id = $1 OR recipient_id = $1',
      [userId]
    );

    res.json({
      calls: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching call history:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// WebRTC signaling endpoints
router.post('/:callId/offer', [
  authenticateToken,
  body('offer').notEmpty().withMessage('WebRTC offer required')
], async (req, res) => {
  try {
    const { callId } = req.params;
    const { offer } = req.body;
    const userId = req.user.id;

    // Verify user is part of this call
    const callResult = await query(
      'SELECT caller_id, recipient_id FROM calls WHERE id = $1 AND status = \'connected\'',
      [callId]
    );

    if (callResult.rows.length === 0) {
      return res.status(404).json({ message: 'Call not found or not connected' });
    }

    const call = callResult.rows[0];
    if (call.caller_id !== userId && call.recipient_id !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const otherUserId = call.caller_id === userId ? call.recipient_id : call.caller_id;

    res.json({ message: 'Offer sent successfully' });

    // Forward offer to other participant
    req.io?.to(`user_${otherUserId}`).emit('webrtc_offer', {
      callId,
      offer,
      from: userId
    });
  } catch (error) {
    console.error('Error handling WebRTC offer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:callId/answer', [
  authenticateToken,
  body('answer').notEmpty().withMessage('WebRTC answer required')
], async (req, res) => {
  try {
    const { callId } = req.params;
    const { answer } = req.body;
    const userId = req.user.id;

    // Verify user is part of this call
    const callResult = await query(
      'SELECT caller_id, recipient_id FROM calls WHERE id = $1 AND status = \'connected\'',
      [callId]
    );

    if (callResult.rows.length === 0) {
      return res.status(404).json({ message: 'Call not found or not connected' });
    }

    const call = callResult.rows[0];
    if (call.caller_id !== userId && call.recipient_id !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const otherUserId = call.caller_id === userId ? call.recipient_id : call.caller_id;

    res.json({ message: 'Answer sent successfully' });

    // Forward answer to other participant
    req.io?.to(`user_${otherUserId}`).emit('webrtc_answer', {
      callId,
      answer,
      from: userId
    });
  } catch (error) {
    console.error('Error handling WebRTC answer:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

router.post('/:callId/ice-candidate', [
  authenticateToken,
  body('candidate').notEmpty().withMessage('ICE candidate required')
], async (req, res) => {
  try {
    const { callId } = req.params;
    const { candidate } = req.body;
    const userId = req.user.id;

    // Verify user is part of this call
    const callResult = await query(
      'SELECT caller_id, recipient_id FROM calls WHERE id = $1 AND status = \'connected\'',
      [callId]
    );

    if (callResult.rows.length === 0) {
      return res.status(404).json({ message: 'Call not found or not connected' });
    }

    const call = callResult.rows[0];
    if (call.caller_id !== userId && call.recipient_id !== userId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const otherUserId = call.caller_id === userId ? call.recipient_id : call.caller_id;

    res.json({ message: 'ICE candidate sent successfully' });

    // Forward ICE candidate to other participant
    req.io?.to(`user_${otherUserId}`).emit('ice_candidate', {
      callId,
      candidate,
      from: userId
    });
  } catch (error) {
    console.error('Error handling ICE candidate:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get call statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const statsResult = await query(`
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN status = 'ended' AND duration > 0 THEN 1 END) as successful_calls,
        COUNT(CASE WHEN caller_id = $1 THEN 1 END) as outgoing_calls,
        COUNT(CASE WHEN recipient_id = $1 THEN 1 END) as incoming_calls,
        COUNT(CASE WHEN call_type = 'voice' THEN 1 END) as voice_calls,
        COUNT(CASE WHEN call_type = 'video' THEN 1 END) as video_calls,
        COALESCE(SUM(duration), 0) as total_duration,
        COALESCE(AVG(duration), 0) as avg_duration
      FROM calls 
      WHERE caller_id = $1 OR recipient_id = $1
    `, [userId]);

    const stats = statsResult.rows[0];

    // Convert durations to minutes
    stats.total_duration_minutes = Math.floor(stats.total_duration / 60);
    stats.avg_duration_minutes = Math.floor(stats.avg_duration / 60);

    res.json({ stats });
  } catch (error) {
    console.error('Error fetching call stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current call status
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(`
      SELECT 
        c.*,
        u1.name as caller_name,
        u1.avatar as caller_avatar,
        u2.name as recipient_name,
        u2.avatar as recipient_avatar
      FROM calls c
      JOIN users u1 ON c.caller_id = u1.id
      JOIN users u2 ON c.recipient_id = u2.id
      WHERE (c.caller_id = $1 OR c.recipient_id = $1) 
      AND c.status IN ('ringing', 'connected')
      ORDER BY c.created_at DESC
      LIMIT 1
    `, [userId]);

    if (result.rows.length === 0) {
      return res.json({ currentCall: null });
    }

    const call = result.rows[0];
    
    res.json({
      currentCall: {
        id: call.id,
        call_type: call.call_type,
        status: call.status,
        created_at: call.created_at,
        answered_at: call.answered_at,
        caller: {
          id: call.caller_id,
          name: call.caller_name,
          avatar: call.caller_avatar
        },
        recipient: {
          id: call.recipient_id,
          name: call.recipient_name,
          avatar: call.recipient_avatar
        },
        is_caller: call.caller_id === userId
      }
    });
  } catch (error) {
    console.error('Error fetching current call:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;