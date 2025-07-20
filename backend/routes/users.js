const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const { authenticateToken, requireVerified } = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/profiles/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
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
    res.status(500).json({ message: 'Failed to get profile' });
  }
});

// Update user profile
router.put('/profile', [
  authenticateToken,
  body('firstName').optional().isLength({ min: 1, max: 100 }).trim(),
  body('lastName').optional().isLength({ max: 100 }).trim(),
  body('bio').optional().isLength({ max: 500 }).trim(),
  body('dateOfBirth').optional().isISO8601().toDate(),
  body('gender').optional().isIn(['male', 'female', 'other']),
  body('locationCity').optional().isLength({ max: 100 }).trim(),
  body('locationCountry').optional().isLength({ max: 100 }).trim(),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('languagePreference').optional().isLength({ min: 2, max: 10 }),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const updatedUser = await User.updateProfile(req.user.id, req.body);
    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// Upload profile picture
router.post('/profile/picture', [authenticateToken, upload.single('profilePicture')], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const pictureUrl = `/uploads/profiles/${req.file.filename}`;
    const updatedUser = await User.updateProfilePicture(req.user.id, pictureUrl);

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      message: 'Profile picture updated successfully',
      profilePicture: pictureUrl
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ message: 'Failed to upload profile picture' });
  }
});

// Get user interests
router.get('/interests', authenticateToken, async (req, res) => {
  try {
    const interests = await User.getUserInterests(req.user.id);
    res.json({ interests });
  } catch (error) {
    console.error('Get interests error:', error);
    res.status(500).json({ message: 'Failed to get interests' });
  }
});

// Update user interests
router.put('/interests', [
  authenticateToken,
  body('interestIds').isArray().withMessage('Interest IDs must be an array'),
  body('interestIds.*').isInt().withMessage('Each interest ID must be an integer'),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    await User.updateUserInterests(req.user.id, req.body.interestIds);
    const updatedInterests = await User.getUserInterests(req.user.id);

    res.json({
      message: 'Interests updated successfully',
      interests: updatedInterests
    });
  } catch (error) {
    console.error('Update interests error:', error);
    res.status(500).json({ message: 'Failed to update interests' });
  }
});

// Get potential matches
router.get('/matches/potential', [authenticateToken, requireVerified], async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const matches = await User.findPotentialMatches(req.user.id, limit);

    res.json({ matches });
  } catch (error) {
    console.error('Get potential matches error:', error);
    res.status(500).json({ message: 'Failed to get potential matches' });
  }
});

// Search users
router.get('/search', [
  authenticateToken,
  requireVerified,
], async (req, res) => {
  try {
    const { q, limit = 20, offset = 0 } = req.query;
    
    if (!q || q.trim().length < 2) {
      return res.status(400).json({ message: 'Search query must be at least 2 characters' });
    }

    const users = await User.searchUsers(q.trim(), parseInt(limit), parseInt(offset));
    res.json({ users });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ message: 'Failed to search users' });
  }
});

// Get user by ID (public profile)
router.get('/:id', [authenticateToken, requireVerified], async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Return limited public profile info
    const publicProfile = {
      id: user.id,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      bio: user.bio,
      profilePicture: user.profile_picture,
      isVerified: user.is_verified,
      age: user.date_of_birth ? new Date().getFullYear() - new Date(user.date_of_birth).getFullYear() : null,
    };

    // Add location if privacy settings allow
    if (user.privacy_settings?.show_location) {
      publicProfile.locationCity = user.location_city;
      publicProfile.locationCountry = user.location_country;
    }

    // Get interests
    const interests = await User.getUserInterests(req.params.id);
    publicProfile.interests = interests;

    res.json({ user: publicProfile });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ message: 'Failed to get user' });
  }
});

// Block user
router.post('/:id/block', [authenticateToken, requireVerified], async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    await User.blockUser(req.user.id, req.params.id);
    res.json({ message: 'User blocked successfully' });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Failed to block user' });
  }
});

// Unblock user
router.delete('/:id/block', [authenticateToken, requireVerified], async (req, res) => {
  try {
    await User.unblockUser(req.user.id, req.params.id);
    res.json({ message: 'User unblocked successfully' });
  } catch (error) {
    console.error('Unblock user error:', error);
    res.status(500).json({ message: 'Failed to unblock user' });
  }
});

// Report user
router.post('/:id/report', [
  authenticateToken,
  requireVerified,
  body('reason').isLength({ min: 1, max: 50 }).trim(),
  body('description').optional().isLength({ max: 500 }).trim(),
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: 'Cannot report yourself' });
    }

    const report = await User.reportUser(
      req.user.id,
      req.params.id,
      req.body.reason,
      req.body.description
    );

    res.json({
      message: 'User reported successfully',
      reportId: report.id
    });
  } catch (error) {
    console.error('Report user error:', error);
    res.status(500).json({ message: 'Failed to report user' });
  }
});

// Get coin transaction history
router.get('/coins/transactions', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const transactions = await User.getCoinTransactions(req.user.id, limit, offset);
    res.json({ transactions });
  } catch (error) {
    console.error('Get coin transactions error:', error);
    res.status(500).json({ message: 'Failed to get coin transactions' });
  }
});

// Delete account
router.delete('/account', authenticateToken, async (req, res) => {
  try {
    await User.deleteAccount(req.user.id);
    res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: 'Failed to delete account' });
  }
});

module.exports = router;