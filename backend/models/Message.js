const { query, transaction } = require('../config/database');

class Message {
  // Create a new message
  static async create(messageData) {
    const {
      conversationId,
      senderId,
      content,
      messageType = 'text',
      mediaUrl,
      mediaMetadata,
      originalLanguage
    } = messageData;

    const result = await query(
      `INSERT INTO messages (conversation_id, sender_id, content, message_type, media_url, media_metadata, original_language)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, conversation_id, sender_id, content, message_type, media_url, media_metadata, 
                 original_language, is_read, created_at`,
      [conversationId, senderId, content, messageType, mediaUrl, 
       mediaMetadata ? JSON.stringify(mediaMetadata) : null, originalLanguage]
    );

    return result.rows[0];
  }

  // Get message by ID
  static async findById(id) {
    const result = await query(
      `SELECT id, conversation_id, sender_id, content, message_type, media_url, media_metadata,
              original_language, translated_content, is_read, read_at, is_deleted, created_at
       FROM messages WHERE id = $1 AND is_deleted = false`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Get message with sender information
  static async getWithSender(messageId) {
    const result = await query(
      `SELECT m.id, m.conversation_id, m.sender_id, m.content, m.message_type, m.media_url, 
              m.media_metadata, m.original_language, m.translated_content, m.is_read, m.created_at,
              u.username, u.first_name, u.last_name, u.profile_picture
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.id = $1 AND m.is_deleted = false`,
      [messageId]
    );

    return result.rows[0] || null;
  }

  // Get messages for a conversation
  static async getByConversation(conversationId, limit = 50, offset = 0) {
    const result = await query(
      `SELECT m.id, m.conversation_id, m.sender_id, m.content, m.message_type, m.media_url,
              m.media_metadata, m.original_language, m.translated_content, m.is_read, m.created_at,
              u.username, u.first_name, u.last_name, u.profile_picture
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1 AND m.is_deleted = false
       ORDER BY m.created_at DESC
       LIMIT $2 OFFSET $3`,
      [conversationId, limit, offset]
    );

    return result.rows.reverse(); // Return in chronological order
  }

  // Mark messages as read
  static async markAsRead(conversationId, userId) {
    await query(
      `UPDATE messages 
       SET is_read = true, read_at = CURRENT_TIMESTAMP
       WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false`,
      [conversationId, userId]
    );
  }

  // Get unread message count for user
  static async getUnreadCount(userId) {
    const result = await query(
      `SELECT COUNT(*) as unread_count
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       WHERE (c.participant1_id = $1 OR c.participant2_id = $1)
         AND m.sender_id != $1
         AND m.is_read = false
         AND m.is_deleted = false`,
      [userId]
    );

    return parseInt(result.rows[0].unread_count);
  }

  // Add translation to message
  static async addTranslation(messageId, language, translatedText) {
    const message = await this.findById(messageId);
    if (!message) return null;

    const translatedContent = message.translated_content || {};
    translatedContent[language] = translatedText;

    const result = await query(
      `UPDATE messages 
       SET translated_content = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, translated_content`,
      [messageId, JSON.stringify(translatedContent)]
    );

    return result.rows[0] || null;
  }

  // Get translated message content
  static getTranslatedContent(message, targetLanguage) {
    if (!message.translated_content) return message.content;
    
    const translations = typeof message.translated_content === 'string' 
      ? JSON.parse(message.translated_content) 
      : message.translated_content;
    
    return translations[targetLanguage] || message.content;
  }

  // Add reaction to message
  static async addReaction(messageId, userId, reaction) {
    return await transaction(async (client) => {
      // Remove existing reaction from this user
      await client.query(
        'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2',
        [messageId, userId]
      );

      // Add new reaction
      const result = await client.query(
        `INSERT INTO message_reactions (message_id, user_id, reaction)
         VALUES ($1, $2, $3)
         RETURNING id, reaction, created_at`,
        [messageId, userId, reaction]
      );

      return result.rows[0];
    });
  }

  // Remove reaction from message
  static async removeReaction(messageId, userId) {
    await query(
      'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2',
      [messageId, userId]
    );
  }

  // Get reactions for message
  static async getReactions(messageId) {
    const result = await query(
      `SELECT mr.reaction, mr.created_at, u.id as user_id, u.username, u.first_name
       FROM message_reactions mr
       JOIN users u ON mr.user_id = u.id
       WHERE mr.message_id = $1
       ORDER BY mr.created_at`,
      [messageId]
    );

    return result.rows;
  }

  // Delete message (soft delete)
  static async deleteMessage(messageId, userId) {
    const result = await query(
      `UPDATE messages 
       SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND sender_id = $2
       RETURNING id, is_deleted`,
      [messageId, userId]
    );

    return result.rows[0] || null;
  }

  // Search messages in conversation
  static async searchInConversation(conversationId, searchTerm, limit = 20) {
    const result = await query(
      `SELECT m.id, m.conversation_id, m.sender_id, m.content, m.message_type, m.created_at,
              u.username, u.first_name, u.profile_picture,
              ts_rank(to_tsvector('english', m.content), plainto_tsquery('english', $2)) as rank
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.conversation_id = $1 
         AND m.is_deleted = false
         AND to_tsvector('english', m.content) @@ plainto_tsquery('english', $2)
       ORDER BY rank DESC, m.created_at DESC
       LIMIT $3`,
      [conversationId, searchTerm, limit]
    );

    return result.rows;
  }

  // Get message statistics for conversation
  static async getConversationStats(conversationId) {
    const result = await query(
      `SELECT 
         COUNT(*) as total_messages,
         COUNT(CASE WHEN message_type = 'text' THEN 1 END) as text_messages,
         COUNT(CASE WHEN message_type = 'image' THEN 1 END) as image_messages,
         COUNT(CASE WHEN message_type = 'audio' THEN 1 END) as audio_messages,
         COUNT(CASE WHEN message_type = 'video' THEN 1 END) as video_messages,
         COUNT(CASE WHEN is_read = false THEN 1 END) as unread_messages,
         MIN(created_at) as first_message_at,
         MAX(created_at) as last_message_at
       FROM messages
       WHERE conversation_id = $1 AND is_deleted = false`,
      [conversationId]
    );

    return result.rows[0];
  }

  // Get recent messages for user (across all conversations)
  static async getRecentMessages(userId, limit = 20) {
    const result = await query(
      `SELECT DISTINCT ON (m.conversation_id) 
              m.id, m.conversation_id, m.sender_id, m.content, m.message_type, m.created_at,
              u.username, u.first_name, u.profile_picture,
              CASE 
                WHEN c.participant1_id = $1 THEN p2.first_name
                ELSE p1.first_name
              END as other_participant_name,
              CASE 
                WHEN c.participant1_id = $1 THEN p2.profile_picture
                ELSE p1.profile_picture
              END as other_participant_picture
       FROM messages m
       JOIN conversations c ON m.conversation_id = c.id
       JOIN users u ON m.sender_id = u.id
       JOIN users p1 ON c.participant1_id = p1.id
       JOIN users p2 ON c.participant2_id = p2.id
       WHERE (c.participant1_id = $1 OR c.participant2_id = $1)
         AND m.is_deleted = false
       ORDER BY m.conversation_id, m.created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    return result.rows;
  }

  // Update message content (for editing)
  static async updateContent(messageId, userId, newContent) {
    const result = await query(
      `UPDATE messages 
       SET content = $3, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND sender_id = $2 AND message_type = 'text'
       RETURNING id, content, updated_at`,
      [messageId, userId, newContent]
    );

    return result.rows[0] || null;
  }
}

module.exports = Message;