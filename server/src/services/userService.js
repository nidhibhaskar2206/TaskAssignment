const prisma = require("../config/db");

//  Get user by ID
exports.getUserById = async (user_id) => {
  return await prisma.user.findUnique({
    where: { user_id },
  });
};

//  Check if user is a super admin
exports.isSuperUser = async (user_id) => {
  const user = await prisma.user.findUnique({
    where: { user_id },
    select: { is_super: true },
  });

  return user?.is_super === true;
};
