const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { setUserSession, deleteUserSession } = require('../config/redis');

const router = express.Router();

// Validation middleware
const validateRegistration = [
  body('email').isEmail().normalizeEmail(),
  body('username').isLength({ min: 3, max: 30 }).matches(/^[a-zA-Z0-9_]+$/),
  body('password').isLength({ min: 8 }),
  body('firstName').isLength({ min: 1, max: 100 }).trim(),
  body('lastName').optional().isLength({ max: 100 }).trim(),
  body('dateOfBirth').optional().isISO8601().toDate(),
  body('gender').optional().isIn(['male', 'female', 'other'])
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 1 })
];

// Register new user
router.post('/register', validateRegistration, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, username, password, firstName, lastName, dateOfBirth, gender } = req.body;

    // Check if user already exists
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        message: 'User with this email already exists',
        code: 'EMAIL_EXISTS'
      });
    }

    const existingUsername = await User.findByUsername(username);
    if (existingUsername) {
      return res.status(409).json({
        message: 'Username already taken',
        code: 'USERNAME_EXISTS'
      });
    }

    // Create new user
    const newUser = await User.create({
      email,
      username,
      password,
      firstName,
      lastName,
      dateOfBirth,
      gender
    });

    // Generate JWT token
    const token = User.generateToken(newUser);

    // Create session in Redis
    await setUserSession(newUser.id, {
      userId: newUser.id,
      email: newUser.email,
      username: newUser.username,
      loginTime: new Date().toISOString()
    });

    // Add daily signup bonus coins
    await User.updateCoins(newUser.id, 50, 'earn', 'Welcome bonus');

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        firstName: newUser.first_name,
        lastName: newUser.last_name,
        coins: newUser.coins + 50,
        isVerified: newUser.is_verified,
        createdAt: newUser.created_at
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Registration failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Login user
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify password
    const isValidPassword = await User.verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate JWT token
    const token = User.generateToken(user);

    // Create session in Redis
    await setUserSession(user.id, {
      userId: user.id,
      email: user.email,
      username: user.username,
      loginTime: new Date().toISOString()
    });

    // Check for daily login bonus (simplified)
    const today = new Date().toDateString();
    const lastActive = new Date(user.last_active).toDateString();
    
    let bonusCoins = 0;
    if (today !== lastActive) {
      bonusCoins = 10; // Daily login bonus
      await User.updateCoins(user.id, bonusCoins, 'earn', 'Daily login bonus');
    }

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        profilePicture: user.profile_picture,
        coins: user.coins + bonusCoins,
        isVerified: user.is_verified,
        isPremium: user.is_premium
      },
      ...(bonusCoins > 0 && { bonusCoins })
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Google OAuth login/register
router.post('/google', async (req, res) => {
  try {
    const { googleId, email, firstName, lastName, profilePicture } = req.body;

    if (!googleId || !email) {
      return res.status(400).json({
        message: 'Google ID and email are required'
      });
    }

    // Check if user exists with Google ID
    let user = await User.findByGoogleId(googleId);
    
    if (!user) {
      // Check if user exists with email
      user = await User.findByEmail(email);
      
      if (user) {
        // Link Google account to existing user
        await User.updateProfile(user.id, { googleId });
      } else {
        // Create new user
        const username = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        user = await User.create({
          email,
          username,
          firstName,
          lastName,
          googleId
        });

        // Welcome bonus
        await User.updateCoins(user.id, 50, 'earn', 'Welcome bonus');
      }
    }

    // Generate JWT token
    const token = User.generateToken(user);

    // Create session
    await setUserSession(user.id, {
      userId: user.id,
      email: user.email,
      username: user.username,
      loginTime: new Date().toISOString(),
      provider: 'google'
    });

    res.json({
      message: 'Google authentication successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        profilePicture: user.profile_picture || profilePicture,
        coins: user.coins,
        isVerified: user.is_verified,
        isPremium: user.is_premium
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({
      message: 'Google authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Facebook OAuth login/register
router.post('/facebook', async (req, res) => {
  try {
    const { facebookId, email, firstName, lastName, profilePicture } = req.body;

    if (!facebookId) {
      return res.status(400).json({
        message: 'Facebook ID is required'
      });
    }

    // Check if user exists with Facebook ID
    let user = await User.findByFacebookId(facebookId);
    
    if (!user && email) {
      // Check if user exists with email
      user = await User.findByEmail(email);
      
      if (user) {
        // Link Facebook account to existing user
        await User.updateProfile(user.id, { facebookId });
      }
    }
    
    if (!user) {
      // Create new user
      const username = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      user = await User.create({
        email: email || `${facebookId}@facebook.local`,
        username,
        firstName,
        lastName,
        facebookId
      });

      // Welcome bonus
      await User.updateCoins(user.id, 50, 'earn', 'Welcome bonus');
    }

    // Generate JWT token
    const token = User.generateToken(user);

    // Create session
    await setUserSession(user.id, {
      userId: user.id,
      email: user.email,
      username: user.username,
      loginTime: new Date().toISOString(),
      provider: 'facebook'
    });

    res.json({
      message: 'Facebook authentication successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        profilePicture: user.profile_picture || profilePicture,
        coins: user.coins,
        isVerified: user.is_verified,
        isPremium: user.is_premium
      }
    });
  } catch (error) {
    console.error('Facebook auth error:', error);
    res.status(500).json({
      message: 'Facebook authentication failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Logout user
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    // Delete session from Redis
    await deleteUserSession(req.user.id);

    res.json({
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      message: 'Logout failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get current user profile
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    const interests = await User.getUserInterests(req.user.id);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        dateOfBirth: user.date_of_birth,
        gender: user.gender,
        bio: user.bio,
        profilePicture: user.profile_picture,
        locationCity: user.location_city,
        locationCountry: user.location_country,
        languagePreference: user.language_preference,
        coins: user.coins,
        isVerified: user.is_verified,
        isPremium: user.is_premium,
        privacySettings: user.privacy_settings,
        matchingPreferences: user.matching_preferences,
        interests,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      message: 'Failed to get profile',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Refresh token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        message: 'User not found'
      });
    }

    const newToken = User.generateToken(user);

    res.json({
      message: 'Token refreshed',
      token: newToken
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      message: 'Token refresh failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;