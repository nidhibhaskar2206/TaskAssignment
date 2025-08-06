const userService = require("./userService");
const taskService = require("./taskService");

// ✅ Check if a user has a specific permission on a task
exports.hasPermission = async (task_id, user_id, permissionName) => {
  // 1. Super admin shortcut
  const isSuper = await userService.isSuperUser(user_id);
  if (isSuper) return true;

  // 2. Load TaskUser with role and permissions
  const taskUser = await taskService.getUserTaskRole(task_id, user_id);

  if (
    !taskUser ||
    !taskUser.role ||
    !Array.isArray(taskUser.role.permissions)
  ) {
    return false;
  }

  // 3. Check if any permission matches
  return taskUser.role.permissions.some((perm) => perm.name === permissionName);
};
