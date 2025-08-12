// controllers/roleController.js
const prisma = require("../config/db");

const createRole = async (req, res) => {
  const workspaceId = req.params.id;
  const { name, desc, permissions = [] } = req.body;

  if (!name) return res.status(400).json({ message: "Role name is required" });

  try {
    const role = await prisma.role.create({
      data: { name, desc: desc || null, workspace_id: workspaceId },
    });

    if (permissions.length) {
      const permRecords = await Promise.all(
        permissions.map(({ entity, operation }) =>
          prisma.permission.upsert({
            where: { entity_operation: { entity, operation } }, 
            update: {},
            create: { entity, operation },
          })
        )
      );

      await prisma.rolePermission.createMany({
        data: permRecords.map((p) => ({
          role_id: role.id,
          permission_id: p.id,
        })),
        skipDuplicates: true,
      });
    }

    const fullRole = await prisma.role.findUnique({
      where: { id: role.id },
      include: {
        permissions: { include: { permission: true } },
      },
    });

    res.status(201).json({ message: "Role created", role: fullRole });
  } catch (err) {
    console.error("createRole error:", err);
    res.status(500).json({ message: "Failed to create role" });
  }
};

const addPermissionsToRole = async (req, res) => {
  const { id: workspaceId, roleId } = req.params;
  const { permissions = [] } = req.body;

  if (!permissions.length) {
    return res.status(400).json({ message: "permissions array is required" });
  }

  try {
    // Ensure role belongs to workspace
    const role = await prisma.role.findFirst({
      where: { id: roleId, workspace_id: workspaceId },
    });
    if (!role) return res.status(404).json({ message: "Role not found in workspace" });

    const permRecords = await Promise.all(
      permissions.map(({ entity, operation }) =>
        prisma.permission.upsert({
          where: { entity_operation: { entity, operation } },
          update: {},
          create: { entity, operation },
        })
      )
    );

    await prisma.rolePermission.createMany({
      data: permRecords.map((p) => ({
        role_id: roleId,
        permission_id: p.id,
      })),
      skipDuplicates: true,
    });

    const updated = await prisma.role.findUnique({
      where: { id: roleId },
      include: { permissions: { include: { permission: true } } },
    });

    res.status(200).json({ message: "Permissions added", role: updated });
  } catch (err) {
    console.error("addPermissionsToRole error:", err);
    res.status(500).json({ message: "Failed to add permissions" });
  }
};

const assignRoleToUser = async (req, res) => {
  const workspaceId = req.params.id;
  const { userId } = req.params;
  const { roleId } = req.body;

  if (!roleId) return res.status(400).json({ message: "roleId is required" });

  try {
    // Ensure role belongs to that workspace
    const role = await prisma.role.findFirst({
      where: { id: roleId, workspace_id: workspaceId },
    });
    if (!role) return res.status(404).json({ message: "Role not found in workspace" });

    // Ensure user exists
    const user = await prisma.users.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ message: "User not found" });

    // Assign (or upsert) membership
    const userRole = await prisma.userRole.upsert({
      where: {
        // composite uniqueness not set on model, so emulate with a synthetic key (or use create with findFirst + conditional)
        // If you do want strong idempotency, create a unique index on [user_id, workspace_id] in schema and then here use that.
        id: `${userId}-${workspaceId}-${roleId}`.substring(0, 36), // fallback if you don’t have composite unique (optional)
      },
      update: { role_id: roleId },
      create: {
        user_id: userId,
        role_id: roleId,
        workspace_id: workspaceId,
      },
    });

    res.status(200).json({ message: "Role assigned to user", userRole });
  } catch (err) {
    console.error("assignRoleToUser error:", err);
    res.status(500).json({ message: "Failed to assign role" });
  }
};

const listWorkspaceRoles = async (req, res) => {
  const workspaceId = req.params.id;
  try {
    const roles = await prisma.role.findMany({
      where: { workspace_id: workspaceId },
      include: {
        permissions: { include: { permission: true } },
        users: true, // userRole rows
      },
      orderBy: { name: "asc" },
    });
    res.status(200).json(roles);
  } catch (err) {
    console.error("listWorkspaceRoles error:", err);
    res.status(500).json({ message: "Failed to fetch roles" });
  }
};

const deleteRole = async (req, res) => {
  const { id: workspaceId, roleId } = req.params;

  try {
    const role = await prisma.role.findFirst({
      where: { id: roleId, workspace_id: workspaceId },
      include: { users: true },
    });
    if (!role) return res.status(404).json({ message: "Role not found in workspace" });

    if (role.name === "ADMIN") {
      const adminRole = await prisma.role.findFirst({
        where: { workspace_id: workspaceId, name: "ADMIN" },
      });

      if (adminRole) {
        const adminAssignments = await prisma.userRole.count({
          where: { role_id: adminRole.id, workspace_id: workspaceId },
        });

        if (adminAssignments > 0) {
          return res.status(400).json({
            message:
              "Cannot delete ADMIN role while there are admin assignments. Reassign admin privileges first.",
          });
        }
      }
    }

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { role_id: roleId } }),
      prisma.userRole.deleteMany({ where: { role_id: roleId, workspace_id: workspaceId } }),
      prisma.role.delete({ where: { id: roleId } }),
    ]);

    res.status(200).json({ message: "Role deleted" });
  } catch (err) {
    console.error("deleteRole error:", err);
    res.status(500).json({ message: "Failed to delete role" });
  }
};

// controllers/roleController.js
const bulkAssignRolesToUsers = async (req, res) => {
  const workspaceId = req.params.id;
  const { users = [], roles = [] } = req.body;

  // Basic validation
  if (!Array.isArray(users) || !Array.isArray(roles) || users.length !== roles.length || users.length === 0) {
    return res.status(400).json({
      message: "Provide non-empty 'users' and 'roles' arrays of equal length",
    });
  }

  try {
    // 1) Validate roles belong to the workspace
    const roleIds = [...new Set(roles)];
    const wsRoles = await prisma.role.findMany({
      where: { id: { in: roleIds }, workspace_id: workspaceId },
      select: { id: true },
    });
    const validRoleIdSet = new Set(wsRoles.map(r => r.id));
    const invalidRoleIds = roleIds.filter(rid => !validRoleIdSet.has(rid));
    if (invalidRoleIds.length) {
      return res.status(404).json({
        message: "Some roles do not belong to this workspace",
        invalidRoleIds,
      });
    }

    // 2) Validate users exist
    const userIds = [...new Set(users)];
    const foundUsers = await prisma.users.findMany({
      where: { id: { in: userIds } },
      select: { id: true },
    });
    const foundUserIdSet = new Set(foundUsers.map(u => u.id));
    const missingUsers = userIds.filter(uid => !foundUserIdSet.has(uid));
    if (missingUsers.length) {
      return res.status(404).json({
        message: "Some users were not found",
        missingUsers,
      });
    }

    // 3) Upsert each (user, workspace) with the given role
    // Requires @@unique([user_id, workspace_id]) on UserRole
    const ops = users.map((userId, i) =>
      prisma.userRole.upsert({
        where: {
          user_id_workspace_id: { user_id: userId, workspace_id: workspaceId },
        },
        update: { role_id: roles[i] },
        create: {
          user_id: userId,
          workspace_id: workspaceId,
          role_id: roles[i],
        },
      })
    );

    const results = await prisma.$transaction(ops);

    // Optional: return enriched view
    const enriched = await prisma.userRole.findMany({
      where: { workspace_id: workspaceId, user_id: { in: userIds } },
      include: {
        role: true,
        user: true,
      },
    });

    res.status(200).json({
      message: "Roles assigned",
      count: results.length,
      assignments: enriched,
    });
  } catch (err) {
    console.error("bulkAssignRolesToUsers error:", err);
    res.status(500).json({ message: "Failed to assign roles in bulk" });
  }
};

module.exports = {
  createRole,
  addPermissionsToRole,
  assignRoleToUser,
  listWorkspaceRoles,
  deleteRole,
  bulkAssignRolesToUsers, // <- export
};

