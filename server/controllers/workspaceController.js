// workspace.controller.js
const { PrismaClient } = require("@prisma/client");
const { z } = require("zod");

const prisma = new PrismaClient();

/* ------------------------- helpers ------------------------- */

const httpError = (res, code, msg, details) =>
  res.status(code).json({ error: msg, details });

const requireSuperAdmin = (req) => {
  if (req?.user?.user_type !== "SUPER_ADMIN") {
    const e = new Error("Only SUPER_ADMIN can perform this action");
    e.status = 403;
    throw e;
  }
};

const hasPerm = (req, entity, op) =>
  req?.ctx?.isSuperAdmin || req?.ctx?.perms?.has(`${entity}:${op}`);

/* ------------------------- validation ------------------------- */

const createRoleBody = z.object({
  name: z.string().min(2),
  desc: z.string().optional(),
  permissions: z
    .array(
      z.object({
        entity: z.string().min(1),
        operation: z.string(),
      })
    )
    .nonempty(),
});

const usersToRoleBody = z.object({
  user_ids: z.array(z.string().uuid()).nonempty(),
});

/* ------------------------- permission helpers ------------------------- */

async function ensurePermission(entity, operation, tx = prisma) {
  return tx.permission.upsert({
    where: { entity_operation: { entity, operation } },
    update: {},
    create: { entity, operation },
  });
}

async function grantPermissionsToRole(roleId, perms, tx = prisma) {
  const permRows = await Promise.all(
    perms.map((p) => ensurePermission(p.entity, p.operation, tx))
  );
  await tx.rolePermission.createMany({
    data: permRows.map((p) => ({ role_id: roleId, permission_id: p.id })),
    skipDuplicates: true,
  });
}

const DEFAULT_ROLES = [
  {
    name: "Admin",
    permissions: [
      { entity: "ROLE", operation: "CREATE" },
      { entity: "ROLE", operation: "READ" },
      { entity: "ROLE", operation: "UPDATE" },
      { entity: "ROLE", operation: "DELETE" },
      { entity: "USER", operation: "CREATE" },
      { entity: "USER", operation: "READ" },
      { entity: "USER", operation: "UPDATE" },
      { entity: "USER", operation: "DELETE" },
      { entity: "USER_ROLE", operation: "CREATE" },
      { entity: "USER_ROLE", operation: "READ" },
      { entity: "USER_ROLE", operation: "UPDATE" },
      { entity: "USER_ROLE", operation: "DELETE" },
      { entity: "ROLE_PERMISSION", operation: "CREATE" },
      { entity: "ROLE_PERMISSION", operation: "READ" },
      { entity: "ROLE_PERMISSION", operation: "UPDATE" },
      { entity: "ROLE_PERMISSION", operation: "DELETE" },
      { entity: "TICKET", operation: "CREATE" },
      { entity: "TICKET", operation: "READ" },
      { entity: "TICKET", operation: "UPDATE" },
      { entity: "TICKET", operation: "DELETE" },
      { entity: "COMMENT", operation: "CREATE" },
      { entity: "COMMENT", operation: "READ" },
      { entity: "COMMENT", operation: "UPDATE" },
      { entity: "COMMENT", operation: "DELETE" },
      { entity: "HISTORY", operation: "READ" },
    ],
  },
];

/* ------------------------- controllers ------------------------- */

// POST /workspaces  (SUPER_ADMIN only)
async function createWorkspace(req, res) {
  try {
    requireSuperAdmin(req);
    const body = req.body;

    if (!body.name || !body.admin_id) {
      return httpError(res, 400, "All fields are required");
    }

    const existingWorkspace = await prisma.workspace.findFirst({
      where: { name: { equals: body.name, mode: "insensitive" } },
    });

    if (existingWorkspace) {
      return httpError(res, 409, "Workspace with this name already exists");
    }

    const admin = await prisma.users.findUnique({
      where: { id: body.admin_id },
    });

    if (!admin) return httpError(res, 404, "Admin user not found");

    const ws = await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: {
          name: body.name,
          created_by: req.user.id,
          admin_id: body.admin_id,
        },
      });

      const roles = await Promise.all(
        DEFAULT_ROLES.map((role) =>
          tx.role.create({
            data: {
              workspace_id: workspace.id,
              name: role.name,
              desc: role.desc ?? null,
            },
          })
        )
      );

      await Promise.all(
        roles.map((roleRow, i) =>
          grantPermissionsToRole(roleRow.id, DEFAULT_ROLES[i].permissions, tx)
        )
      );

      const adminRole = roles.find((r) => r.name === "Admin");
      if (adminRole) {
        await tx.userRole.create({
          data: {
            user_id: body.admin_id,
            role_id: adminRole.id,
            workspace_id: workspace.id,
          },
        });
      }

      return workspace;
    });

    res.status(201).json(ws);
  } catch (err) {
    const code = err.status ?? 500;
    res.status(code).json({ error: err.message || "Internal Server Error" });
  }
}

// POST /workspaces/:wid/assign
async function assignRolestoUsers(req, res) {
  const workspaceId = req.params.id;
  const { users = [], roles = [] } = req.body;

  // Basic validation
  if (
    !Array.isArray(users) ||
    !Array.isArray(roles) ||
    users.length !== roles.length ||
    users.length === 0
  ) {
    return res.status(400).json({
      message: "Provide non-empty 'users' and 'roles' arrays of equal length",
    });
  }

  if (!hasPerm(req, "USER_ROLE", "CREATE"))
    return httpError(res, 403, "Access Denied : USER_ROLE:CREATE required");

  try {
    // 1) Validate roles belong to the workspace
    const roleIds = [...new Set(roles)];
    const wsRoles = await prisma.role.findMany({
      where: { id: { in: roleIds }, workspace_id: workspaceId },
      select: { id: true },
    });
    const validRoleIdSet = new Set(wsRoles.map((r) => r.id));
    const invalidRoleIds = roleIds.filter((rid) => !validRoleIdSet.has(rid));
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
    const foundUserIdSet = new Set(foundUsers.map((u) => u.id));
    const missingUsers = userIds.filter((uid) => !foundUserIdSet.has(uid));
    if (missingUsers.length) {
      return res.status(404).json({
        message: "Some users were not found",
        missingUsers,
      });
    }

    // 3) Upsert each (user, workspace) with the given role
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
}

// GET /workspaces/:wid/roles
async function listRoles(req, res) {
  try {
    const wid = req.params.wid || req?.ctx?.workspaceId;
    if (!wid) return httpError(res, 400, "Missing workspace id");
    if (!hasPerm(req, "ROLE", Operation.READ))
      return httpError(res, 403, "Access Denied: ROLE:READ required");
    const roles = await prisma.role.findMany({
      where: { workspace_id: wid },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });
    res.json(
      roles.map((r) => ({
        name: r.name,
        desc: r.desc,
        permissions: r.permissions.map((p) => ({
          entity: p.permission.entity,
          operation: p.permission.operation,
        })),
      }))
    );
  } catch (err) {
    const code = err.status ?? 500;
    res.status(code).json({ error: err.message || "Internal Server Error" });
  }
}

async function getUserWorkspaces(req, res) {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: {
        users: {
          some: {
            user_id: req.user.id,
          },
        },
      },
      include: { admin: true },
    });
    res.status(200).json(workspaces);
  } catch (error) {
    const code = error.status ?? 500;
    res.status(code).json({ error: error.message || "Internal Server Error" });
  }
}

async function getWorkspaceById(req, res) {
  try {
    const { workspaceId } = req.params;

    if (!workspaceId) {
      return res.status(400).json({ message: "Workspace ID is required" });
    }

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { admin: true, users: true, roles: true },
    });

    if (!workspace) {
      return res.status(404).json({ message: "Workspace not found" });
    }

    res.status(200).json(workspace);
  } catch (error) {
    console.error("Get Workspace By ID Error:", error);
    res.status(500).json({ message: "Failed to fetch workspace" });
  }
}

// POST /workspaces/:wid/roles
async function createRole(req, res) {
  try {
    const wid = req.params.wid || req?.ctx?.workspaceId;
    if (!wid) return httpError(res, 400, "Missing workspace id");
    if (!hasPerm(req, "ROLE", Operation.CREATE))
      return httpError(res, 403, "Forbidden: ROLE:CREATE required");

    const { name, desc, permissions } = createRoleBody.parse(req.body);

    const role = await prisma.$transaction(async (tx) => {
      const r = await tx.role.create({
        data: { workspace_id: wid, name, desc: desc ?? null },
      });
      await grantPermissionsToRole(
        r.id,
        permissions.map((p) => ({ entity: p.entity, operation: p.operation })),
        tx
      );
      return r;
    });

    res.status(201).json(role);
  } catch (err) {
    if (err.code === "P2002") {
      return httpError(res, 409, "Role name already exists in this workspace");
    }
    const code = err.status ?? 500;
    res.status(code).json({ error: err.message || "Internal Server Error" });
  }
}

// PUT /workspaces/:wid/roles/:roleId
async function updateRole(req, res) {
  try {
    const wid = req.params.wid || req?.ctx?.workspaceId;

    const roleId = req.params.roleId;

    if (!wid || !roleId) return httpError(res, 400, "Missing workspace id");

    if (!hasPerm(req, "ROLE", "UPDATE")) {
      return httpError(res, 403, "Access denied: ROLE:UPDATE required");
    }

    const body = req.body;

    const updated = await prisma.$transaction(async (tx) => {
      const role = await tx.role.findFirst({
        where: { id: roleId, workspace_id: wid },
      });

      if (!role) {
        throw Object.assign(new Error("Role not found"), { status: 404 });
      }

      const r2 = await tx.role.update({
        where: { id: role.id },
        data: {
          name: body.name || role.name,
          desc: body.desc || role.desc,
        },
      });

      // Removing all permissions
      if (Array.isArray(body.permissions)) {
        const permRows = await Promise.all(
          body.permissions.map((p) =>
            ensurePermission(p.entity, p.operation, tx)
          )
        );

        await tx.rolePermission.deleteMany({ where: { role_id: role.id } });

        if (permRows.length) {
          await tx.rolePermission.createMany({
            data: permRows.map((p) => ({
              role_id: role.id,
              permission_id: p.id,
            })),
            skipDuplicates: true,
          });
        }
      }
      return r2;
    });

    res.status(200).json(updated);
  } catch (err) {
    if (err.code === "P2002") {
      return httpError(res, 409, "Role name already exists in this workspace");
    }
    const code = err.status ?? 500;
    res.status(code).json({ error: err.message || "Internal Server Error" });
  }
}

// DELETE /workspaces/:wid/roles/:roleId
async function deleteRole(req, res) {
  try {
    const wid = req.params.wid || req?.ctx?.workspaceId;
    const roleId = req.params.roleId;
    if (!wid || !roleId) return httpError(res, 400, "Missing ids");
    if (!hasPerm(req, "ROLE", Operation.DELETE))
      return httpError(res, 403, "Access Denied: ROLE:DELETE required");

    const inUse = await prisma.userRole.findFirst({
      where: { role_id: roleId, workspace_id: wid },
      select: { id: true },
    });
    if (inUse)
      return httpError(
        res,
        409,
        "Cannot delete a role that is assigned to users"
      );

    const role = await prisma.role.findFirst({
      where: { id: roleId, workspace_id: wid },
    });
    if (!role) return httpError(res, 404, "Role not found");

    await prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { role_id: roleId } });
      await tx.role.delete({ where: { id: roleId } });
    });

    res.status(204).send();
  } catch (err) {
    const code = err.status ?? 500;
    res.status(code).json({ error: err.message || "Internal Server Error" });
  }
}

// POST /workspaces/:wid/roles/:roleId/users
async function addUsersToRole(req, res) {
  try {
    const wid = req.params.wid || req?.ctx?.workspaceId;
    const roleId = req.params.roleId;
    if (!wid || !roleId) return httpError(res, 400, "Missing ids");
    if (!hasPerm(req, "USERROLE", Operation.CREATE))
      return httpError(res, 403, "Access Denied : USER_ROLE:CREATE required");

    const { user_ids } = usersToRoleBody.parse(req.body);

    const role = await prisma.role.findFirst({
      where: { id: roleId, workspace_id: wid },
    });
    if (!role) return httpError(res, 404, "Role not found in this workspace");

    const users = await prisma.users.findMany({
      where: { id: { in: user_ids } },
      select: { id: true },
    });
    if (users.length !== user_ids.length)
      return httpError(res, 404, "One or more users not found");

    await prisma.userRole.createMany({
      data: users.map((u) => ({
        user_id: u.id,
        role_id: roleId,
        workspace_id: wid,
      })),
      skipDuplicates: true,
    });

    res.status(200).json({ assigned: users.length });
  } catch (err) {
    const code = err.status ?? 500;
    res.status(code).json({ error: err.message || "Internal Server Error" });
  }
}

module.exports = {
  createWorkspace,
  assignRolestoUsers,
  getUserWorkspaces,
  getWorkspaceById,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  addUsersToRole,
};
