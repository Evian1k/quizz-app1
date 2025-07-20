const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Placeholder coin routes
router.get('/balance', authenticateToken, (req, res) => {
  res.json({ balance: 100 });
});

router.get('/transactions', authenticateToken, (req, res) => {
  res.json({ transactions: [] });
});

module.exports = router;