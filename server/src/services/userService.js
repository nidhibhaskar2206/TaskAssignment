const prisma = require("../config/db");

exports.getUserById = async (user_id) => {
  return await prisma.user.findUnique({ where: { user_id } });
};

exports.isSuperUser = async (user_id) => {
  const user = await prisma.user.findUnique({ where: { user_id } });
  return user?.is_super || false;
};
