// workers/emailWorker.js
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { sendOTPEmail } = require('../services/emailService');

const connection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,   // <-- required by BullMQ
  // enableReadyCheck: false,   // optional
});

const emailWorker = new Worker(
  'emailQueue',
  async (job) => {
    const { to, otp, type } = job.data;
    await sendOTPEmail(to, otp, type);
  },
  { connection }
);

emailWorker.on('completed', (job) => {
  console.log(`✅ Email job ${job.id} completed`);
});
emailWorker.on('failed', (job, err) => {
  console.error(`❌ Email job ${job?.id} failed:`, err?.message);
});
