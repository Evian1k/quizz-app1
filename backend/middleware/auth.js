const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getUserSession } = require('../config/redis');

// JWT Authentication middleware
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ 
        message: 'Access token required',
        code: 'NO_TOKEN' 
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ 
        message: 'User not found',
        code: 'USER_NOT_FOUND' 
      });
    }

    // Check Redis session (optional additional security layer)
    const session = await getUserSession(decoded.id);
    if (!session && process.env.STRICT_SESSION_CHECK === 'true') {
      return res.status(401).json({ 
        message: 'Session expired',
        code: 'SESSION_EXPIRED' 
      });
    }

    // Update last active timestamp
    await User.updateLastActive(decoded.id);

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      username: user.username,
      firstName: user.first_name,
      lastName: user.last_name,
      isVerified: user.is_verified,
      isPremium: user.is_premium,
      coins: user.coins
    };

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ 
        message: 'Invalid token',
        code: 'INVALID_TOKEN' 
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'Token expired',
        code: 'TOKEN_EXPIRED' 
      });
    }

    return res.status(500).json({ 
      message: 'Authentication error',
      code: 'AUTH_ERROR' 
    });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      
      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.first_name,
          lastName: user.last_name,
          isVerified: user.is_verified,
          isPremium: user.is_premium,
          coins: user.coins
        };
        
        await User.updateLastActive(decoded.id);
      }
    }

    next();
  } catch (error) {
    // Silently continue without authentication
    next();
  }
};

// Require verified user
const requireVerified = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED' 
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({ 
      message: 'Account verification required',
      code: 'VERIFICATION_REQUIRED' 
    });
  }

  next();
};

// Require premium user
const requirePremium = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ 
      message: 'Authentication required',
      code: 'AUTH_REQUIRED' 
    });
  }

  if (!req.user.isPremium) {
    return res.status(403).json({ 
      message: 'Premium subscription required',
      code: 'PREMIUM_REQUIRED' 
    });
  }

  next();
};

// Check if user has enough coins
const requireCoins = (minCoins) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        message: 'Authentication required',
        code: 'AUTH_REQUIRED' 
      });
    }

    if (req.user.coins < minCoins) {
      return res.status(402).json({ 
        message: `Insufficient coins. Required: ${minCoins}, Available: ${req.user.coins}`,
        code: 'INSUFFICIENT_COINS',
        required: minCoins,
        available: req.user.coins
      });
    }

    next();
  };
};

// Socket.io authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.userId = user.id;
    socket.user = {
      id: user.id,
      username: user.username,
      firstName: user.first_name,
      profilePicture: user.profile_picture
    };

    next();
  } catch (error) {
    console.error('Socket auth error:', error);
    next(new Error('Authentication failed'));
  }
};

// Check if user has enough coins (alias for requireCoins)
const checkCoins = (requiredCoins) => requireCoins(requiredCoins);

module.exports = {
  authenticateToken,
  optionalAuth,
  requireVerified,
  requirePremium,
  requireCoins,
  checkCoins,
  authenticateSocket
};