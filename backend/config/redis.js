const redis = require('redis');

let redisClient;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      retry_strategy: (options) => {
        if (options.error && options.error.code === 'ECONNREFUSED') {
          return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
          return new Error('Retry time exhausted');
        }
        if (options.attempt > 10) {
          return undefined;
        }
        return Math.min(options.attempt * 100, 3000);
      }
    });

    redisClient.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('Redis connected successfully');
    });

    redisClient.on('ready', () => {
      console.log('Redis ready to receive commands');
    });

    redisClient.on('end', () => {
      console.log('Redis connection ended');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    console.error('Redis connection error:', error);
    throw error;
  }
};

// Cache helper functions
const setCache = async (key, value, expireInSeconds = 3600) => {
  try {
    const serializedValue = JSON.stringify(value);
    await redisClient.setEx(key, expireInSeconds, serializedValue);
  } catch (error) {
    console.error('Redis SET error:', error);
  }
};

const getCache = async (key) => {
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Redis GET error:', error);
    return null;
  }
};

const deleteCache = async (key) => {
  try {
    await redisClient.del(key);
  } catch (error) {
    console.error('Redis DELETE error:', error);
  }
};

const setUserSession = async (userId, sessionData, expireInSeconds = 86400) => {
  const key = `session:${userId}`;
  await setCache(key, sessionData, expireInSeconds);
};

const getUserSession = async (userId) => {
  const key = `session:${userId}`;
  return await getCache(key);
};

const deleteUserSession = async (userId) => {
  const key = `session:${userId}`;
  await deleteCache(key);
};

// Online users tracking
const setUserOnline = async (userId, socketId) => {
  const key = `online:${userId}`;
  await setCache(key, { socketId, timestamp: Date.now() }, 3600);
};

const setUserOffline = async (userId) => {
  const key = `online:${userId}`;
  await deleteCache(key);
};

const isUserOnline = async (userId) => {
  const key = `online:${userId}`;
  const data = await getCache(key);
  return data !== null;
};

module.exports = {
  connectRedis,
  redisClient: () => redisClient,
  setCache,
  getCache,
  deleteCache,
  setUserSession,
  getUserSession,
  deleteUserSession,
  setUserOnline,
  setUserOffline,
  isUserOnline
};