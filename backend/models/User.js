const { query, transaction } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class User {
  // Create a new user
  static async create(userData) {
    const {
      email,
      username,
      password,
      firstName,
      lastName,
      dateOfBirth,
      gender,
      googleId,
      facebookId
    } = userData;

    const hashedPassword = password ? await bcrypt.hash(password, 12) : null;

    const result = await query(
      `INSERT INTO users (email, username, password_hash, first_name, last_name, date_of_birth, gender, google_id, facebook_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, email, username, first_name, last_name, date_of_birth, gender, coins, is_verified, created_at`,
      [email, username, hashedPassword, firstName, lastName, dateOfBirth, gender, googleId, facebookId]
    );

    return result.rows[0];
  }

  // Find user by ID
  static async findById(id) {
    const result = await query(
      `SELECT id, email, username, first_name, last_name, date_of_birth, gender, bio, profile_picture,
              location_city, location_country, latitude, longitude, language_preference, coins,
              is_verified, is_premium, last_active, privacy_settings, matching_preferences, created_at
       FROM users WHERE id = $1`,
      [id]
    );

    return result.rows[0] || null;
  }

  // Find user by email
  static async findByEmail(email) {
    const result = await query(
      `SELECT id, email, username, password_hash, first_name, last_name, date_of_birth, gender,
              bio, profile_picture, coins, is_verified, is_premium, google_id, facebook_id, created_at
       FROM users WHERE email = $1`,
      [email]
    );

    return result.rows[0] || null;
  }

  // Find user by username
  static async findByUsername(username) {
    const result = await query(
      `SELECT id, email, username, first_name, last_name, profile_picture, is_verified
       FROM users WHERE username = $1`,
      [username]
    );

    return result.rows[0] || null;
  }

  // Find user by Google ID
  static async findByGoogleId(googleId) {
    const result = await query(
      `SELECT id, email, username, first_name, last_name, google_id, created_at
       FROM users WHERE google_id = $1`,
      [googleId]
    );

    return result.rows[0] || null;
  }

  // Find user by Facebook ID
  static async findByFacebookId(facebookId) {
    const result = await query(
      `SELECT id, email, username, first_name, last_name, facebook_id, created_at
       FROM users WHERE facebook_id = $1`,
      [facebookId]
    );

    return result.rows[0] || null;
  }

  // Update user profile
  static async updateProfile(id, updateData) {
    const {
      firstName,
      lastName,
      bio,
      dateOfBirth,
      gender,
      locationCity,
      locationCountry,
      latitude,
      longitude,
      languagePreference,
      privacySettings,
      matchingPreferences
    } = updateData;

    const result = await query(
      `UPDATE users 
       SET first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           bio = COALESCE($4, bio),
           date_of_birth = COALESCE($5, date_of_birth),
           gender = COALESCE($6, gender),
           location_city = COALESCE($7, location_city),
           location_country = COALESCE($8, location_country),
           latitude = COALESCE($9, latitude),
           longitude = COALESCE($10, longitude),
           language_preference = COALESCE($11, language_preference),
           privacy_settings = COALESCE($12, privacy_settings),
           matching_preferences = COALESCE($13, matching_preferences),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, email, username, first_name, last_name, bio, profile_picture, updated_at`,
      [id, firstName, lastName, bio, dateOfBirth, gender, locationCity, locationCountry, 
       latitude, longitude, languagePreference, privacySettings, matchingPreferences]
    );

    return result.rows[0] || null;
  }

  // Update profile picture
  static async updateProfilePicture(id, pictureUrl) {
    const result = await query(
      `UPDATE users SET profile_picture = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING id, profile_picture`,
      [id, pictureUrl]
    );

    return result.rows[0] || null;
  }

  // Update last active timestamp
  static async updateLastActive(id) {
    await query(
      `UPDATE users SET last_active = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
  }

  // Verify password
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Generate JWT token
  static generateToken(user) {
    return jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        username: user.username 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }

  // Get user's interests
  static async getUserInterests(userId) {
    const result = await query(
      `SELECT i.id, i.name, i.category
       FROM interests i
       JOIN user_interests ui ON i.id = ui.interest_id
       WHERE ui.user_id = $1`,
      [userId]
    );

    return result.rows;
  }

  // Update user interests
  static async updateUserInterests(userId, interestIds) {
    return await transaction(async (client) => {
      // Remove existing interests
      await client.query('DELETE FROM user_interests WHERE user_id = $1', [userId]);

      // Add new interests
      if (interestIds && interestIds.length > 0) {
        const values = interestIds.map((_, index) => 
          `($1, $${index + 2})`
        ).join(', ');

        await client.query(
          `INSERT INTO user_interests (user_id, interest_id) VALUES ${values}`,
          [userId, ...interestIds]
        );
      }

      return true;
    });
  }

  // Update coins balance
  static async updateCoins(userId, amount, transactionType, description, referenceId = null) {
    return await transaction(async (client) => {
      // Update user's coin balance
      const userResult = await client.query(
        `UPDATE users SET coins = coins + $2 WHERE id = $1 RETURNING coins`,
        [userId, amount]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      // Record transaction
      await client.query(
        `INSERT INTO coin_transactions (user_id, transaction_type, amount, description, reference_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, transactionType, amount, description, referenceId]
      );

      return userResult.rows[0].coins;
    });
  }

  // Get coin transaction history
  static async getCoinTransactions(userId, limit = 50, offset = 0) {
    const result = await query(
      `SELECT transaction_type, amount, description, reference_id, created_at
       FROM coin_transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return result.rows;
  }

  // Find potential matches for user
  static async findPotentialMatches(userId, limit = 20) {
    const user = await this.findById(userId);
    if (!user) return [];

    const { matching_preferences: prefs } = user;
    const minAge = prefs?.min_age || 18;
    const maxAge = prefs?.max_age || 65;
    const maxDistance = prefs?.max_distance || 50;
    const preferredGender = prefs?.preferred_gender || 'any';

    let genderCondition = '';
    let genderParam = [];
    
    if (preferredGender !== 'any') {
      genderCondition = 'AND u.gender = $6';
      genderParam = [preferredGender];
    }

    const result = await query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.profile_picture, u.bio,
              u.location_city, u.location_country, u.latitude, u.longitude,
              EXTRACT(YEAR FROM AGE(u.date_of_birth)) as age,
              CASE 
                WHEN u.latitude IS NOT NULL AND u.longitude IS NOT NULL AND $4 IS NOT NULL AND $5 IS NOT NULL
                THEN ROUND(
                  6371 * acos(
                    cos(radians($4)) * cos(radians(u.latitude)) * 
                    cos(radians(u.longitude) - radians($5)) + 
                    sin(radians($4)) * sin(radians(u.latitude))
                  )
                )
                ELSE NULL
              END as distance_km
       FROM users u
       WHERE u.id != $1
         AND u.is_verified = true
         AND EXTRACT(YEAR FROM AGE(u.date_of_birth)) BETWEEN $2 AND $3
         AND u.id NOT IN (
           SELECT CASE WHEN user1_id = $1 THEN user2_id ELSE user1_id END
           FROM matches WHERE user1_id = $1 OR user2_id = $1
         )
         AND u.id NOT IN (
           SELECT blocked_id FROM user_blocks WHERE blocker_id = $1
         )
         AND u.id NOT IN (
           SELECT blocker_id FROM user_blocks WHERE blocked_id = $1
         )
         ${genderCondition}
       HAVING distance_km IS NULL OR distance_km <= $${genderParam.length ? 7 : 6}
       ORDER BY 
         CASE WHEN distance_km IS NOT NULL THEN distance_km ELSE 999999 END,
         u.last_active DESC
       LIMIT $${genderParam.length ? 8 : 7}`,
      [userId, minAge, maxAge, user.latitude, user.longitude, maxDistance, ...genderParam, limit]
    );

    return result.rows;
  }

  // Block a user
  static async blockUser(blockerId, blockedId) {
    await query(
      `INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, blockedId]
    );
  }

  // Unblock a user
  static async unblockUser(blockerId, blockedId) {
    await query(
      `DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`,
      [blockerId, blockedId]
    );
  }

  // Report a user
  static async reportUser(reporterId, reportedId, reason, description) {
    const result = await query(
      `INSERT INTO user_reports (reporter_id, reported_id, reason, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [reporterId, reportedId, reason, description]
    );

    return result.rows[0];
  }

  // Delete user account
  static async deleteAccount(id) {
    await query(`DELETE FROM users WHERE id = $1`, [id]);
  }

  // Search users
  static async searchUsers(query_text, limit = 20, offset = 0) {
    const result = await query(
      `SELECT id, username, first_name, last_name, profile_picture, bio, is_verified
       FROM users
       WHERE (username ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1)
         AND is_verified = true
       ORDER BY
         CASE 
           WHEN username ILIKE $1 THEN 1
           WHEN first_name ILIKE $1 THEN 2
           ELSE 3
         END,
         last_active DESC
       LIMIT $2 OFFSET $3`,
      [`%${query_text}%`, limit, offset]
    );

    return result.rows;
  }
}

module.exports = User;