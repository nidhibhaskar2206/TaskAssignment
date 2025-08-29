// middlewares/authenticate.js
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function parseBearer(header) {
  if (!header) return null;
  const [scheme, token] = header.split(" ").filter(Boolean);
  if (!/^Bearer$/i.test(scheme)) return null;
  if (!token || token === "undefined" || token === "null") return null;
  return token.replace(/^"(.+)"$/, "$1").trim();
}


async function authenticate(req, res, next) {
  try {
    if (!process.env.JWT_SECRET) {
      console.error("JWT_SECRET is not set");
      return res.status(500).json({ message: "Server misconfigured" });
    }

    const token = parseBearer(req.headers.authorization);
    if (!token) {
      return res.status(401).json({ message: "Authentication token is required" });
    }

    if (token.split(".").length !== 3) {
      console.warn("Malformed token (segment count != 3):", token.slice(0, 12) + "…");
      return res.status(401).json({ message: "Malformed token" });
    }

    // 3) Verify (match algorithm to how you sign; HS256 is default for a shared secret)
    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET /* , { algorithms: ['HS256'] } */);
    } catch (e) {
      console.error("JWT verify failed:", e.name, e.message);
      return res.status(401).json({ message: "Invalid authentication token" });
    }

    // 4) Resolve user from token
    const idFromToken = payload.sub || payload.userId || payload.id || null;
    let user = null;

    if (idFromToken) {
      user = await prisma.users.findUnique({ where: { id: String(idFromToken) } });
    } else if (payload.email) {
      // requires email to be unique in your schema
      user = await prisma.users.findUnique({ where: { email: payload.email } });
    }

    if (!user) {
      return res.status(401).json({ message: "Invalid authentication token" });
    }
    if (user.is_active === false || user.is_verified === false) {
      return res.status(401).json({ message: "Invalid or inactive user" });
    }

    // 5) Attach to request
    req.user = user;
    req.ctx = req.ctx || {};
    req.ctx.isSuperAdmin = user.user_type === "SUPER_ADMIN";

    return next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ message: "Unauthorized" });
  }
}

module.exports = { authenticate };
