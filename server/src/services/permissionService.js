const userService = require("./userService");
const taskService = require("./taskService");

// Check if user has a permission on a task
exports.hasPermission = async (task_id, user_id, permissionName) => {
  // Allow superuser bypass
  if (await userService.isSuperUser(user_id)) return true;

  // Load user's task role and permissions
  const taskRole = await taskService.getUserTaskRole(task_id, user_id);

  if (!taskRole || !taskRole.role) return false;

  return taskRole.role.permissions.some((p) => p.name === permissionName);
};
