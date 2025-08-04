const prisma = require("../config/db");
const { isSuperUser } = require("../services/userService");
const { isTaskAdmin } = require("../services/taskService");
const { hasPermission } = require("../services/permissionService");
const { logTaskAction } = require("../utils/logger");

// Create a new task
exports.createTask = async (req, res) => {
  try {
    const { title, description, admin_id, parent_task_id } = req.body;
    const creatorId = req.user.user_id;
    const isSuper = req.user.is_super;

    let ownerId;
    let taskAdminId = null;

    // If it's a sub-task
    if (parent_task_id) {
      const parentTask = await prisma.task.findUnique({
        where: { task_id: parent_task_id },
        include: { admin: true },
      });

      if (!parentTask) {
        return res.status(400).json({ message: "Parent task not found" });
      }

      if (!parentTask.admin) {
        return res
          .status(400)
          .json({ message: "Parent task does not have an admin" });
      }

      // Enforce admin consistency for sub-tasks
      if (admin_id && admin_id !== parentTask.admin.admin_id) {
        return res
          .status(400)
          .json({ message: "Sub-task admin must match parent task admin" });
      }

      ownerId = creatorId;
      taskAdminId = parentTask.admin.admin_id;
    } else {
      // Major task
      if (!isSuper) {
        return res
          .status(403)
          .json({ message: "Only super admins can assign task admins" });
      }

      if (!admin_id) {
        return res
          .status(400)
          .json({ message: "Admin ID is required for major tasks" });
      }

      ownerId = admin_id;
      taskAdminId = admin_id;
    }

    const task = await prisma.task.create({
      data: {
        title,
        description,
        created_by: creatorId,
        owner_id: ownerId,
        parent_task_id: parent_task_id || null,
      },
    });

    // Create TaskAdmin if needed (only for major task)
    if (!parent_task_id && taskAdminId) {
      await prisma.taskAdmin.create({
        data: {
          task_id: task.task_id,
          admin_id: taskAdminId,
        },
      });
    }

    // Attach admin/owner to task_user with admin role
    const adminRole = await prisma.role.findUnique({
      where: { role_name: "admin" },
    });

    await prisma.taskUser.create({
      data: {
        task_id: task.task_id,
        user_id: taskAdminId,
        role_id: adminRole.role_id,
      },
    });

    await logTaskAction({
      task_id: task.task_id,
      user_id: creatorId,
      action: `Task created. Owner: ${ownerId}, Admin: ${taskAdminId}`,
    });

    res.status(201).json({ message: "Task created", task });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create task", error });
  }
};
  

//  Assign user to task
exports.assignUser = async (req, res) => {
  try {
    const { task_id, user_id, role_id } = req.body;
    const requesterId = req.user.user_id;

    // 1. Check permission
    const allowed = await hasPermission(task_id, requesterId, "ASSIGN_USERS");
    if (!allowed) {
      return res
        .status(403)
        .json({ message: "Forbidden: insufficient permission" });
    }

    // 2. Check if role exists
    const role = await prisma.role.findUnique({
      where: { role_id },
    });

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    // 3. Check if user already assigned
    const existing = await prisma.taskUser.findUnique({
      where: {
        task_id_user_id: { task_id, user_id },
      },
    });

    if (existing) {
      return res.status(400).json({ message: "User already assigned to task" });
    }

    // 4. Check if user is already admin of the task
    const taskAdmin = await prisma.taskAdmin.findUnique({
      where: { task_id },
    });

    if (taskAdmin?.admin_id === user_id) {
      return res
        .status(400)
        .json({ message: "User is already the task admin" });
    }

    // 5. Assign user to task with role
    await prisma.taskUser.create({
      data: { task_id, user_id, role_id },
    });

    // 6. Log the assignment
    await logTaskAction({
      task_id,
      user_id: requesterId,
      action: `Assigned user ${user_id} to role ${role.role_name}`,
    });

    res.status(200).json({ message: "User assigned successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to assign user", error });
  }
};
  

// View all tasks (basic)
exports.getTasks = async (req, res) => {
  try {
    const tasks = await prisma.task.findMany({
      include: {
        admin: { include: { admin: true } },
        taskUsers: { include: { user: true, role: true } },
        logs: true,
      },
    });

    res.status(200).json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch tasks", error });
  }
};
