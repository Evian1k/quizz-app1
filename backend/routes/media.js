const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Placeholder media routes
router.post('/upload', authenticateToken, (req, res) => {
  res.json({ message: 'Media upload endpoint' });
});

module.exports = router;