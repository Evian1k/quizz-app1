const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireVerified } = require('../middleware/auth');
const { query, transaction } = require('../config/database');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const router = express.Router();

// Get user's coin balance
router.get('/balance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await query(
      'SELECT coins FROM users WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ 
      balance: result.rows[0].coins || 0,
      userId: userId
    });
  } catch (error) {
    console.error('Error fetching coin balance:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get coin transaction history
router.get('/transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const result = await query(`
      SELECT 
        id,
        type,
        amount,
        description,
        reference_id,
        created_at
      FROM coin_transactions 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2 OFFSET $3
    `, [userId, limit, offset]);

    const countResult = await query(
      'SELECT COUNT(*) FROM coin_transactions WHERE user_id = $1',
      [userId]
    );

    res.json({
      transactions: result.rows,
      pagination: {
        page,
        limit,
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Daily login reward
router.post('/daily-reward', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const today = new Date().toDateString();

    await transaction(async (client) => {
      // Check if user already claimed today's reward
      const lastClaim = await client.query(`
        SELECT created_at FROM coin_transactions 
        WHERE user_id = $1 AND type = 'daily_reward' 
        ORDER BY created_at DESC LIMIT 1
      `, [userId]);

      if (lastClaim.rows.length > 0) {
        const lastClaimDate = new Date(lastClaim.rows[0].created_at).toDateString();
        if (lastClaimDate === today) {
          return res.status(400).json({ 
            message: 'Daily reward already claimed today',
            nextReward: new Date(new Date().setDate(new Date().getDate() + 1))
          });
        }
      }

      // Calculate reward amount (base 10 coins, with streak bonuses)
      let rewardAmount = 10;
      
      // Check streak
      const streak = await calculateStreak(client, userId);
      if (streak >= 7) rewardAmount += 5; // Weekly bonus
      if (streak >= 30) rewardAmount += 10; // Monthly bonus

      // Add coins to user account
      await client.query(
        'UPDATE users SET coins = COALESCE(coins, 0) + $1 WHERE id = $2',
        [rewardAmount, userId]
      );

      // Record transaction
      await client.query(`
        INSERT INTO coin_transactions (user_id, type, amount, description, created_at)
        VALUES ($1, 'daily_reward', $2, $3, NOW())
      `, [userId, rewardAmount, `Daily login reward (streak: ${streak} days)`]);

      // Get updated balance
      const balanceResult = await client.query(
        'SELECT coins FROM users WHERE id = $1',
        [userId]
      );

      res.json({
        success: true,
        reward: rewardAmount,
        streak: streak,
        newBalance: balanceResult.rows[0].coins,
        message: `Claimed ${rewardAmount} coins! ${streak} day streak`
      });
    });
  } catch (error) {
    console.error('Error claiming daily reward:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Purchase coins with Stripe
router.post('/purchase', [
  authenticateToken,
  body('packageId').isIn(['small', 'medium', 'large', 'mega']).withMessage('Valid package required'),
  body('paymentMethodId').notEmpty().withMessage('Payment method required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { packageId, paymentMethodId } = req.body;
    const userId = req.user.id;

    // Define coin packages
    const packages = {
      small: { coins: 100, price: 99, name: '100 Coins' },
      medium: { coins: 500, price: 499, name: '500 Coins' },
      large: { coins: 1200, price: 999, name: '1200 Coins' },
      mega: { coins: 2500, price: 1999, name: '2500 Coins' }
    };

    const selectedPackage = packages[packageId];
    if (!selectedPackage) {
      return res.status(400).json({ message: 'Invalid package selected' });
    }

    await transaction(async (client) => {
      // Create Stripe payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: selectedPackage.price,
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: true,
        description: `ChatzOne - ${selectedPackage.name}`,
        metadata: {
          userId: userId,
          packageId: packageId,
          coins: selectedPackage.coins.toString()
        }
      });

      if (paymentIntent.status === 'succeeded') {
        // Add coins to user account
        await client.query(
          'UPDATE users SET coins = COALESCE(coins, 0) + $1 WHERE id = $2',
          [selectedPackage.coins, userId]
        );

        // Record transaction
        await client.query(`
          INSERT INTO coin_transactions (user_id, type, amount, description, reference_id, created_at)
          VALUES ($1, 'purchase', $2, $3, $4, NOW())
        `, [userId, selectedPackage.coins, `Purchased ${selectedPackage.name}`, paymentIntent.id]);

        // Get updated balance
        const balanceResult = await client.query(
          'SELECT coins FROM users WHERE id = $1',
          [userId]
        );

        res.json({
          success: true,
          coins: selectedPackage.coins,
          newBalance: balanceResult.rows[0].coins,
          paymentIntentId: paymentIntent.id
        });
      } else {
        res.status(400).json({ 
          message: 'Payment failed',
          status: paymentIntent.status 
        });
      }
    });
  } catch (error) {
    console.error('Error processing coin purchase:', error);
    res.status(500).json({ message: 'Payment processing failed' });
  }
});

// Spend coins (for internal use by other services)
router.post('/spend', [
  authenticateToken,
  body('amount').isInt({ min: 1 }).withMessage('Valid amount required'),
  body('description').notEmpty().withMessage('Description required'),
  body('type').isIn(['message', 'call', 'boost', 'premium_match']).withMessage('Valid type required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { amount, description, type, referenceId } = req.body;
    const userId = req.user.id;

    await transaction(async (client) => {
      // Check current balance
      const balanceResult = await client.query(
        'SELECT coins FROM users WHERE id = $1',
        [userId]
      );

      const currentBalance = balanceResult.rows[0].coins || 0;
      if (currentBalance < amount) {
        return res.status(400).json({ 
          message: 'Insufficient coins',
          required: amount,
          current: currentBalance
        });
      }

      // Deduct coins
      await client.query(
        'UPDATE users SET coins = coins - $1 WHERE id = $2',
        [amount, userId]
      );

      // Record transaction
      await client.query(`
        INSERT INTO coin_transactions (user_id, type, amount, description, reference_id, created_at)
        VALUES ($1, $2, -$3, $4, $5, NOW())
      `, [userId, type, amount, description, referenceId]);

      // Get updated balance
      const newBalanceResult = await client.query(
        'SELECT coins FROM users WHERE id = $1',
        [userId]
      );

      res.json({
        success: true,
        spent: amount,
        newBalance: newBalanceResult.rows[0].coins,
        transaction: {
          type,
          amount: -amount,
          description
        }
      });
    });
  } catch (error) {
    console.error('Error spending coins:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Earn coins through referrals
router.post('/earn-referral', [
  authenticateToken,
  body('referredUserId').isUUID().withMessage('Valid referred user ID required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { referredUserId } = req.body;
    const referrerId = req.user.id;
    const rewardAmount = 50; // Referral reward

    await transaction(async (client) => {
      // Check if referral already exists
      const existingReferral = await client.query(
        'SELECT id FROM referrals WHERE referrer_id = $1 AND referred_id = $2',
        [referrerId, referredUserId]
      );

      if (existingReferral.rows.length > 0) {
        return res.status(400).json({ message: 'Referral already processed' });
      }

      // Create referral record
      await client.query(`
        INSERT INTO referrals (referrer_id, referred_id, reward_amount, created_at)
        VALUES ($1, $2, $3, NOW())
      `, [referrerId, referredUserId, rewardAmount]);

      // Add coins to referrer
      await client.query(
        'UPDATE users SET coins = COALESCE(coins, 0) + $1 WHERE id = $2',
        [rewardAmount, referrerId]
      );

      // Record transaction
      await client.query(`
        INSERT INTO coin_transactions (user_id, type, amount, description, reference_id, created_at)
        VALUES ($1, 'referral', $2, 'Referral bonus', $3, NOW())
      `, [referrerId, rewardAmount, referredUserId]);

      // Get updated balance
      const balanceResult = await client.query(
        'SELECT coins FROM users WHERE id = $1',
        [referrerId]
      );

      res.json({
        success: true,
        reward: rewardAmount,
        newBalance: balanceResult.rows[0].coins,
        message: 'Referral bonus earned!'
      });
    });
  } catch (error) {
    console.error('Error processing referral:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get coin packages for purchase
router.get('/packages', (req, res) => {
  const packages = [
    {
      id: 'small',
      coins: 100,
      price: 0.99,
      name: '100 Coins',
      description: 'Perfect for casual chatting',
      popular: false
    },
    {
      id: 'medium',
      coins: 500,
      price: 4.99,
      name: '500 Coins',
      description: 'Great value for active users',
      popular: true
    },
    {
      id: 'large',
      coins: 1200,
      price: 9.99,
      name: '1200 Coins',
      description: 'Best value - 20% bonus!',
      popular: false
    },
    {
      id: 'mega',
      coins: 2500,
      price: 19.99,
      name: '2500 Coins',
      description: 'Ultimate package - 25% bonus!',
      popular: false
    }
  ];

  res.json({ packages });
});

// Helper function to calculate login streak
async function calculateStreak(client, userId) {
  try {
    const streakResult = await client.query(`
      WITH RECURSIVE date_series AS (
        SELECT CURRENT_DATE as check_date, 0 as days_back
        UNION ALL
        SELECT check_date - 1, days_back + 1
        FROM date_series
        WHERE days_back < 365
      ),
      daily_rewards AS (
        SELECT DATE(created_at) as reward_date
        FROM coin_transactions
        WHERE user_id = $1 AND type = 'daily_reward'
        ORDER BY created_at DESC
      )
      SELECT COUNT(*) as streak
      FROM date_series ds
      WHERE EXISTS (
        SELECT 1 FROM daily_rewards dr 
        WHERE dr.reward_date = ds.check_date
      )
      AND ds.check_date >= (
        SELECT MIN(sub.check_date)
        FROM (
          SELECT ds2.check_date
          FROM date_series ds2
          WHERE NOT EXISTS (
            SELECT 1 FROM daily_rewards dr2 
            WHERE dr2.reward_date = ds2.check_date
          )
          ORDER BY ds2.check_date DESC
          LIMIT 1
        ) sub
      )
    `, [userId]);

    return parseInt(streakResult.rows[0].streak) || 0;
  } catch (error) {
    console.error('Error calculating streak:', error);
    return 0;
  }
}

module.exports = router;