// services/emailService.js

const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Sends an email using nodemailer
 * @param {string} to - Recipient email
 * @param {string} subject - Email subject
 * @param {string} html - Email content (HTML)
 */
async function sendEmail({ to, subject, html }) {
  return await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
}

/**
 * Sends an OTP email (reusable for verification, reset, etc.)
 * @param {string} email 
 * @param {string} otp 
 * @param {string} type 
 */
async function sendOTPEmail(email, otp, type = 'verification') {
  const subjectMap = {
    verification: 'Verify Your Email',
    reset: 'Reset Your Password',
  };

  const messageMap = {
    verification: `Your email verification code is <strong>${otp}</strong>.`,
    reset: `Your password reset code is <strong>${otp}</strong>.`,
  };

  const subject = subjectMap[type] || 'OTP Code';
  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5;">
      <h2>${subject}</h2>
      <p>${messageMap[type] || `Your code is <strong>${otp}</strong>`}</p>
      <p>This OTP will expire in 10 minutes.</p>
    </div>
  `;

  return await sendEmail({ to: email, subject, html });
}

module.exports = {
  sendEmail,
  sendOTPEmail,
};
