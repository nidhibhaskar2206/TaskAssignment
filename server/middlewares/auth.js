const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
require('dotenv').config();

const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1] || req.header('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.users.findUnique({
      where: { id: decoded.id },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

const isSuperAdmin = (req, res, next) => {
  if (req.user?.user_type !== 'SUPERADMIN') {
    return res.status(403).json({ message: 'Access denied: Only Super Admin is authorized to create workspace.' });
  }
  next();
}


module.exports = {authMiddleware, isSuperAdmin};
