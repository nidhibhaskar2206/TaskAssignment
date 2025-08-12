// middlewares/authenticate.js
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function parseBearer(header) {
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (!/^Bearer$/i.test(scheme) || !token) return null;
  return token;
}

async function authenticate(req, res, next) {
  try {
    const token = parseBearer(req.headers.authorization);
    if (!token) {
      return res
        .status(401)
        .json({ message: "Authentication token is required" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Accept tokens signed either with sub or userId; fallback to email
    const idFromToken = payload.sub || payload.userId || payload.id || null;
    let user = null;

    if (idFromToken) {
      user = await prisma.users.findUnique({ where: { id: idFromToken } });
    } else if (payload.email) {
      user = await prisma.users.findUnique({ where: { email: payload.email } });
    }

    if (!user) {
      return res.status(401).json({ message: "Invalid authentication token" });
    }
    if (!user.is_active || !user.is_verified) {
      return res.status(401).json({ message: "Invalid or inactive user" });
    }

    req.user = user;

    // (optional) prefill RBAC context so your controllers can use req.ctx
    req.ctx = req.ctx || {};
    req.ctx.isSuperAdmin = user.user_type === "SUPER_ADMIN";

    return next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(401).json({ message: "Invalid authentication token" });
  }
}

module.exports = { authenticate };
