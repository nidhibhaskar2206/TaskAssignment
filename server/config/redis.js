const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on('connect', () => {
  console.log('🔌 Redis: connection established.');
});

redis.on('ready', () => {
  console.log('✅ Redis: ready to use.');
});

redis.on('error', (err) => {
  console.error('❌ Redis: connection error ->', err.message);
});

redis.on('end', () => {
  console.log('🛑 Redis: connection closed.');
});

module.exports = redis;
