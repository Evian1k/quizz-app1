const { query, transaction } = require('../config/database');

class Conversation {
  // Create a new conversation
  static async create(conversationData) {
    const { matchId, participant1Id, participant2Id, settings } = conversationData;

    const result = await query(
      `INSERT INTO conversations (match_id, participant1_id, participant2_id, settings)
       VALUES ($1, $2, $3, $4)
       RETURNING id, match_id, participant1_id, participant2_id, settings, created_at`,
      [matchId, participant1Id, participant2Id, settings ? JSON.stringify(settings) : null]
    );

    return result.rows[0];
  }

  // Find conversation by ID
  static async findById(id) {
    const result = await query(
      `SELECT id, match_id, participant1_id, participant2_id, last_message_id, 
              last_activity, settings, created_at
       FROM conversations WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Find conversation between two users
  static async findByParticipants(user1Id, user2Id) {
    const result = await query(
      `SELECT id, match_id, participant1_id, participant2_id, last_message_id,
              last_activity, settings, created_at
       FROM conversations 
       WHERE (participant1_id = $1 AND participant2_id = $2) 
          OR (participant1_id = $2 AND participant2_id = $1)`,
      [user1Id, user2Id]
    );

    return result.rows[0] || null;
  }

  // Find conversation by match ID
  static async findByMatchId(matchId) {
    const result = await query(
      `SELECT id, match_id, participant1_id, participant2_id, last_message_id,
              last_activity, settings, created_at
       FROM conversations WHERE match_id = $1`,
      [matchId]
    );

    return result.rows[0] || null;
  }

  // Get user's conversations with details
  static async getUserConversations(userId, limit = 50, offset = 0) {
    const result = await query(
      `SELECT c.id, c.match_id, c.participant1_id, c.participant2_id, c.last_activity,
              c.settings, c.created_at,
              CASE 
                WHEN c.participant1_id = $1 THEN u2.id
                ELSE u1.id
              END as other_user_id,
              CASE 
                WHEN c.participant1_id = $1 THEN u2.username
                ELSE u1.username
              END as other_username,
              CASE 
                WHEN c.participant1_id = $1 THEN u2.first_name
                ELSE u1.first_name
              END as other_first_name,
              CASE 
                WHEN c.participant1_id = $1 THEN u2.last_name
                ELSE u1.last_name
              END as other_last_name,
              CASE 
                WHEN c.participant1_id = $1 THEN u2.profile_picture
                ELSE u1.profile_picture
              END as other_profile_picture,
              CASE 
                WHEN c.participant1_id = $1 THEN u2.is_verified
                ELSE u1.is_verified
              END as other_is_verified,
              lm.content as last_message_content,
              lm.message_type as last_message_type,
              lm.sender_id as last_message_sender_id,
              lm.created_at as last_message_time,
              COALESCE(unread.count, 0) as unread_count
       FROM conversations c
       JOIN users u1 ON c.participant1_id = u1.id
       JOIN users u2 ON c.participant2_id = u2.id
       LEFT JOIN messages lm ON c.last_message_id = lm.id
       LEFT JOIN (
         SELECT conversation_id, COUNT(*) as count
         FROM messages
         WHERE sender_id != $1 AND is_read = false AND is_deleted = false
         GROUP BY conversation_id
       ) unread ON c.id = unread.conversation_id
       WHERE c.participant1_id = $1 OR c.participant2_id = $1
       ORDER BY c.last_activity DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  // Update conversation settings
  static async updateSettings(conversationId, userId, settings) {
    // Verify user is participant
    const conversation = await this.findById(conversationId);
    if (!conversation) return null;

    const isParticipant = conversation.participant1_id === userId || 
                         conversation.participant2_id === userId;
    
    if (!isParticipant) return null;

    const result = await query(
      `UPDATE conversations 
       SET settings = $2, last_activity = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, settings`,
      [conversationId, JSON.stringify(settings)]
    );

    return result.rows[0] || null;
  }

  // Update last activity
  static async updateLastActivity(conversationId) {
    await query(
      `UPDATE conversations 
       SET last_activity = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [conversationId]
    );
  }

  // Get conversation with participant details
  static async getWithDetails(conversationId, userId) {
    const result = await query(
      `SELECT c.id, c.match_id, c.participant1_id, c.participant2_id, c.last_activity,
              c.settings, c.created_at,
              CASE 
                WHEN c.participant1_id = $2 THEN u2.id
                ELSE u1.id
              END as other_user_id,
              CASE 
                WHEN c.participant1_id = $2 THEN u2.username
                ELSE u1.username
              END as other_username,
              CASE 
                WHEN c.participant1_id = $2 THEN u2.first_name
                ELSE u1.first_name
              END as other_first_name,
              CASE 
                WHEN c.participant1_id = $2 THEN u2.profile_picture
                ELSE u1.profile_picture
              END as other_profile_picture,
              CASE 
                WHEN c.participant1_id = $2 THEN u2.bio
                ELSE u1.bio
              END as other_bio,
              CASE 
                WHEN c.participant1_id = $2 THEN u2.is_verified
                ELSE u1.is_verified
              END as other_is_verified,
              CASE 
                WHEN c.participant1_id = $2 THEN u2.last_active
                ELSE u1.last_active
              END as other_last_active
       FROM conversations c
       JOIN users u1 ON c.participant1_id = u1.id
       JOIN users u2 ON c.participant2_id = u2.id
       WHERE c.id = $1 AND (c.participant1_id = $2 OR c.participant2_id = $2)`,
      [conversationId, userId]
    );

    return result.rows[0] || null;
  }

  // Check if user is participant in conversation
  static async isParticipant(conversationId, userId) {
    const result = await query(
      `SELECT 1 FROM conversations 
       WHERE id = $1 AND (participant1_id = $2 OR participant2_id = $2)`,
      [conversationId, userId]
    );

    return result.rows.length > 0;
  }

  // Get conversation statistics
  static async getStats(conversationId) {
    const result = await query(
      `SELECT 
         COUNT(m.id) as total_messages,
         COUNT(CASE WHEN m.message_type = 'text' THEN 1 END) as text_messages,
         COUNT(CASE WHEN m.message_type = 'image' THEN 1 END) as image_messages,
         COUNT(CASE WHEN m.message_type = 'audio' THEN 1 END) as audio_messages,
         COUNT(CASE WHEN m.message_type = 'video' THEN 1 END) as video_messages,
         COUNT(CASE WHEN m.sender_id = c.participant1_id THEN 1 END) as participant1_messages,
         COUNT(CASE WHEN m.sender_id = c.participant2_id THEN 1 END) as participant2_messages,
         MIN(m.created_at) as first_message_at,
         MAX(m.created_at) as last_message_at,
         c.created_at as conversation_started_at
       FROM conversations c
       LEFT JOIN messages m ON c.id = m.conversation_id AND m.is_deleted = false
       WHERE c.id = $1
       GROUP BY c.id, c.created_at`,
      [conversationId]
    );

    return result.rows[0] || null;
  }

  // Archive conversation (soft delete)
  static async archive(conversationId, userId) {
    // Note: This would require adding an archived field to the conversations table
    // For now, we'll just update the settings to mark it as archived for the user
    const conversation = await this.findById(conversationId);
    if (!conversation) return null;

    const settings = conversation.settings || {};
    const archivedBy = settings.archived_by || [];
    
    if (!archivedBy.includes(userId)) {
      archivedBy.push(userId);
    }
    
    settings.archived_by = archivedBy;

    const result = await query(
      `UPDATE conversations 
       SET settings = $2
       WHERE id = $1
       RETURNING id`,
      [conversationId, JSON.stringify(settings)]
    );

    return result.rows[0] || null;
  }

  // Unarchive conversation
  static async unarchive(conversationId, userId) {
    const conversation = await this.findById(conversationId);
    if (!conversation) return null;

    const settings = conversation.settings || {};
    const archivedBy = settings.archived_by || [];
    
    settings.archived_by = archivedBy.filter(id => id !== userId);

    const result = await query(
      `UPDATE conversations 
       SET settings = $2
       WHERE id = $1
       RETURNING id`,
      [conversationId, JSON.stringify(settings)]
    );

    return result.rows[0] || null;
  }

  // Get active conversations (not archived)
  static async getActiveConversations(userId, limit = 50, offset = 0) {
    const result = await query(
      `SELECT c.id, c.match_id, c.participant1_id, c.participant2_id, c.last_activity,
              c.settings, c.created_at,
              CASE 
                WHEN c.participant1_id = $1 THEN u2.id
                ELSE u1.id
              END as other_user_id,
              CASE 
                WHEN c.participant1_id = $1 THEN u2.username
                ELSE u1.username
              END as other_username,
              CASE 
                WHEN c.participant1_id = $1 THEN u2.first_name
                ELSE u1.first_name
              END as other_first_name,
              CASE 
                WHEN c.participant1_id = $1 THEN u2.profile_picture
                ELSE u1.profile_picture
              END as other_profile_picture,
              lm.content as last_message_content,
              lm.message_type as last_message_type,
              lm.created_at as last_message_time,
              COALESCE(unread.count, 0) as unread_count
       FROM conversations c
       JOIN users u1 ON c.participant1_id = u1.id
       JOIN users u2 ON c.participant2_id = u2.id
       LEFT JOIN messages lm ON c.last_message_id = lm.id
       LEFT JOIN (
         SELECT conversation_id, COUNT(*) as count
         FROM messages
         WHERE sender_id != $1 AND is_read = false AND is_deleted = false
         GROUP BY conversation_id
       ) unread ON c.id = unread.conversation_id
       WHERE (c.participant1_id = $1 OR c.participant2_id = $1)
         AND (c.settings IS NULL OR 
              c.settings->>'archived_by' IS NULL OR 
              NOT (c.settings->>'archived_by')::jsonb ? $1::text)
       ORDER BY c.last_activity DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  // Delete conversation (hard delete - use with caution)
  static async delete(conversationId, userId) {
    // Only allow if user is participant and conversation has no messages
    return await transaction(async (client) => {
      const conversation = await client.query(
        `SELECT id, participant1_id, participant2_id FROM conversations WHERE id = $1`,
        [conversationId]
      );

      if (conversation.rows.length === 0) {
        throw new Error('Conversation not found');
      }

      const conv = conversation.rows[0];
      if (conv.participant1_id !== userId && conv.participant2_id !== userId) {
        throw new Error('Not authorized to delete this conversation');
      }

      // Check if conversation has messages
      const messageCount = await client.query(
        `SELECT COUNT(*) as count FROM messages WHERE conversation_id = $1`,
        [conversationId]
      );

      if (parseInt(messageCount.rows[0].count) > 0) {
        throw new Error('Cannot delete conversation with messages');
      }

      // Delete conversation
      await client.query('DELETE FROM conversations WHERE id = $1', [conversationId]);

      return { deleted: true };
    });
  }
}

module.exports = Conversation;