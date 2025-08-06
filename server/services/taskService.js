const prisma = require("../config/db");

//  Check if a user is the admin of a specific task
exports.isTaskAdmin = async (task_id, user_id) => {
  const record = await prisma.taskAdmin.findFirst({
    where: {
      task_id,
      admin_id: user_id,
    },
  });

  return !!record; // returns true or false
};

//  Get a user's role (with permissions) on a specific task
exports.getUserTaskRole = async (task_id, user_id) => {
  return await prisma.taskUser.findUnique({
    where: {
      task_id_user_id: {
        task_id,
        user_id,
      },
    },
    include: {
      role: {
        include: {
          permissions: true, // ensure this is correctly related in your schema
        },
      },
    },
  });
};
