const bcrypt = require("bcrypt");
const generateOTP = require("../utils/otpGenerator");
const emailQueue = require("../queues/emailQueue");
const prisma = require("../config/db");
const redis = require("../config/redis");

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

    await redis.setex(`otp:register:${email}`, 600, JSON.stringify(tempUser)); 

    const otp = generateOTP();

    await redis.setex(`otp:code:${email}`, 600, otp);

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

  // Clean up Redis
  await redis.del(`otp:code:${email}`);
  await redis.del(`otp:register:${email}`);

  res.status(201).json({ message: "Email verified and user created successfully", userId: user.id });
};


module.exports = { registerUser, verifyOTP };
