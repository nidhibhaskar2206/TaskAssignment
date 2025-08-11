const { createClient } = require("redis");

const redisClient = createClient({
  url: process.env.REDIS_URL, 
  socket: {
    reconnectStrategy: (retries) => {
      console.warn(` Redis reconnect attempt: ${retries}`);
      if (retries > 5) return false;
      return Math.min(retries * 200, 5000);
    },
  },
});

redisClient.on("connect", () => console.log("✅ Redis Client Connected"));
redisClient.on("error", (err) => console.error("❌ Redis Client Error:", err));

(async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    await redisClient.ping();
  } catch (err) {
    console.error("🔥 Redis connection failed:", err);
    process.exit(1);
  }
})();

const shutdownRedis = async () => {
  if (redisClient?.isOpen) {
    try {
      await redisClient.quit();
      console.log("✅ Redis disconnected.");
    } catch (err) {
      console.error("❌ Redis disconnect error:", err);
    }
  }
};

// Graceful shutdown handling
const shutdown = async (signal) => {
  console.log(`🛑 Received ${signal}, shutting down...`);
  await shutdownRedis();
  process.exit(0);
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = redisClient;