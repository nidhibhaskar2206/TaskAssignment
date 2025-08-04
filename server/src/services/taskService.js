const prisma = require("../config/db");

exports.isTaskAdmin = async (task_id, user_id) => {
  const record = await prisma.taskAdmin.findFirst({
    where: { task_id, admin_id: user_id },
  });
  return !!record;
};

exports.getUserTaskRole = async (task_id, user_id) => {
  return await prisma.taskUser.findUnique({
    where: {
      task_id_user_id: { task_id, user_id },
    },
    include: { role: { include: { permissions: true } } },
  });
};
