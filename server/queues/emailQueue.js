// queues/emailQueue.js
const { Queue } = require('bullmq');
const IORedis = require('ioredis');

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,   // <-- required by BullMQ
  // enableReadyCheck: false,   // optional, sometimes helpful with managed Redis
});

const emailQueue = new Queue('emailQueue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: true,
    removeOnFail: 50,
  },
});

module.exports = emailQueue;
