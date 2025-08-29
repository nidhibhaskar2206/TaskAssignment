const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const generateOTP = require("../utils/otpGenerator");
const emailQueue = require("../queues/emailQueue");
const prisma = require("../config/db");
const redis = require("../config/redis");

const THROTTLE_SECONDS = 15; 
const OTP_TTL_SECONDS = 600;  

const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "Please fill up all fields" });
    }

    const existingUser = await prisma.users.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const tempUser = { name, email, password: hashedPassword };

    await redis.setex(`otp:register:${email}`, OTP_TTL_SECONDS, JSON.stringify(tempUser)); 

    const otp = generateOTP();

    await redis.setex(`otp:code:${email}`, OTP_TTL_SECONDS, otp);

    await emailQueue.add("sendOtpEmail", {
      to: email,
      otp,
      type: "verification",
    });

    res.status(200).json({
      message: "OTP sent to email. Please verify to complete registration.",
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({ message: "Email and OTP are required" });
  }

  const storedOtp = await redis.get(`otp:code:${email}`);

  if (!storedOtp || storedOtp !== otp) {
    return res.status(401).json({ message: "Invalid or expired OTP" });
  }

  const tempUserJson = await redis.get(`otp:register:${email}`);
  if (!tempUserJson) {
    return res.status(400).json({ message: "User data not found or expired" });
  }

  const tempUser = JSON.parse(tempUserJson);

  // Create user in database
  const user = await prisma.users.create({
    data: {
      name: tempUser.name,
      email: tempUser.email,
      password: tempUser.password,
      user_type: "OTHER",
      mfa_enabled: false,
      is_verified: true,
    },
  });


  await redis.del(`otp:code:${email}`);
  await redis.del(`otp:register:${email}`);

  res.status(201).json({ message: "Email verified and user created successfully", Email: user.email });
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const user = await prisma.users.findUnique({ where: { email } });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ userId: user.id, email: user.email},process.env.JWT_SECRET);

    res.status(200).json({ message: "Login successful", token, user: { name: user.name, email: user.email, role: user.user_type  } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
}

/* =========================
 * PASSWORD RESET
 * ========================= */

/**
 * Step 1: requestPasswordReset
 * - Check user exists
 * - Throttle requests
 * - Generate & save OTP in Redis with TTL
 * - Queue email
 */
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) {
      return res.status(200).json({ message: "If the email exists, an OTP has been sent." });
    }

    const throttleKey = `otp:reset:throttle:${email}`;
    const throttled = await redis.set(throttleKey, "1", "EX", THROTTLE_SECONDS, "NX");
    if (!throttled) return res.status(429).json({ message: "Please wait a bit before requesting another OTP." });

    const otp = generateOTP();
    await redis.setex(`otp:reset:code:${email}`, OTP_TTL_SECONDS, otp);

    await emailQueue.add("sendOtpEmail", { to: email, otp, type: "reset" });

    res.status(200).json({ message: "If the email exists, an OTP has been sent." });
  } catch (error) {
    console.error("requestPasswordReset error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

/**
 * Step 2: resetPassword
 * - Validate OTP from Redis
 * - Hash new password and update user
 * - Cleanup Redis keys
 */
const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Email, OTP and newPassword are required" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    const storedOtp = await redis.get(`otp:reset:code:${email}`);
    if (!storedOtp || storedOtp !== otp) {
      return res.status(401).json({ message: "Invalid or expired OTP" });
    }

    const user = await prisma.users.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "User not found" });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.users.update({ where: { id: user.id }, data: { password: hashed } });

    // cleanup
    await redis.del(`otp:reset:code:${email}`);

    // (optional) invalidate sessions / tokens here if you keep a token blacklist

    res.status(200).json({ message: "Password has been reset successfully." });
  } catch (error) {
    console.error("resetPassword error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};


module.exports = { registerUser, verifyOTP, loginUser, requestPasswordReset, resetPassword};
