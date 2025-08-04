const jwt = require("jsonwebtoken");
const { JWT_SECRET } = process.env;

// Actual authentication middleware
exports.verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).json({ message: "No token provided" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid or expired token" });
  }
};

// Actual authentication middleware (same as verifyToken, for compatibility)
exports.mockAuth = (req, res, next) => {
  exports.verifyToken(req, res, next);
};
