const prisma = require("../config/db");

// Log an action for auditing
exports.logTaskAction = async ({ task_id, user_id = null, action }) => {
  try {
    await prisma.log.create({
      data: { task_id, user_id, action },
    });
  } catch (err) {
    console.error("Log error:", err.message);
  }
};
