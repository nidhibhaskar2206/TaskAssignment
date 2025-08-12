// workspace.controller.js
const { PrismaClient, Operation } = require('@prisma/client');
const { z } = require('zod');

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


const assignPairsBody = z.object({
  usernames: z.array(z.string().min(1)).nonempty(),
  role_names: z.array(z.string().min(1)).nonempty(),
});

const createWorkspaceBody = z.object({
  name: z.string().min(2),
  admin_id: z.string().uuid(),
});

const inviteBody = z.object({
  email: z.string().email(),
  role_ids: z.array(z.string().uuid()).nonempty(),
});

const createRoleBody = z.object({
  name: z.string().min(2),
  desc: z.string().optional(),
  permissions: z
    .array(
      z.object({
        entity: z.string().min(1),
        operation: z.nativeEnum(Operation),
      })
    )
    .nonempty(),
});

const updateRoleBody = z.object({
  name: z.string().min(2).optional(),
  desc: z.string().optional(),
  permissions: z
    .array(
      z.object({
        entity: z.string().min(1),
        operation: z.nativeEnum(Operation),
      })
    )
    .optional(),
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
      { entity: "ROLE", operation: Operation.CREATE },
      { entity: "ROLE", operation: Operation.READ },
      { entity: "ROLE", operation: Operation.UPDATE },
      { entity: "ROLE", operation: Operation.DELETE },
      { entity: "USER", operation: Operation.CREATE },
      { entity: "USER", operation: Operation.READ },
      { entity: "USERROLE", operation: Operation.CREATE },
      { entity: "TICKET", operation: Operation.CREATE },
      { entity: "TICKET", operation: Operation.READ },
      { entity: "TICKET", operation: Operation.UPDATE },
      { entity: "TICKET", operation: Operation.DELETE },
      { entity: "COMMENT", operation: Operation.CREATE },
      { entity: "COMMENT", operation: Operation.READ },
      { entity: "COMMENT", operation: Operation.DELETE },
      { entity: "HISTORY", operation: Operation.READ },
      { entity: "TICKET", operation: Operation.MANAGE },
    ],
  },
  {
    name: "Designer",
    permissions: [
      { entity: "TICKET", operation: Operation.CREATE },
      { entity: "TICKET", operation: Operation.READ },
      { entity: "TICKET", operation: Operation.UPDATE },
      { entity: "COMMENT", operation: Operation.CREATE },
      { entity: "COMMENT", operation: Operation.READ },
    ],
  },
  {
    name: "Developer",
    permissions: [
      { entity: "TICKET", operation: Operation.CREATE },
      { entity: "TICKET", operation: Operation.READ },
      { entity: "TICKET", operation: Operation.UPDATE },
      { entity: "COMMENT", operation: Operation.CREATE },
      { entity: "COMMENT", operation: Operation.READ },
    ],
  },
  {
    name: "DevOps",
    permissions: [
      { entity: "TICKET", operation: Operation.CREATE },
      { entity: "TICKET", operation: Operation.READ },
      { entity: "TICKET", operation: Operation.UPDATE },
      { entity: "COMMENT", operation: Operation.CREATE },
      { entity: "COMMENT", operation: Operation.READ },
    ],
  },
  {
    name: "Lead",
    permissions: [
      { entity: "TICKET", operation: Operation.CREATE },
      { entity: "TICKET", operation: Operation.READ },
      { entity: "TICKET", operation: Operation.UPDATE },
      { entity: "TICKET", operation: Operation.DELETE },
      { entity: "COMMENT", operation: Operation.CREATE },
      { entity: "COMMENT", operation: Operation.READ },
    ],
  },
  {
    name: "Reviewer",
    permissions: [
      { entity: "TICKET", operation: Operation.READ },
      { entity: "COMMENT", operation: Operation.CREATE },
      { entity: "COMMENT", operation: Operation.READ },
    ],
  },
];

/* ------------------------- controllers ------------------------- */

// POST /workspaces  (SUPER_ADMIN only)
async function createWorkspace(req, res) {
  try {
    requireSuperAdmin(req);
    const body = createWorkspaceBody.parse(req.body);

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
        DEFAULT_ROLES.map((r) =>
          tx.role.create({
            data: {
              workspace_id: workspace.id,
              name: r.name,
              desc: r.desc ?? null,
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
async function assignUsersToWorkspace(req, res) {
  try {
    const wid = req.params.wid || req?.ctx?.workspaceId;
    if (!wid) return res.status(400).json({ error: "Missing workspace id" });

    if (
      !req?.ctx?.isSuperAdmin &&
      !req?.ctx?.perms?.has(`USERROLE:${Operation.CREATE}`)
    ) {
      return res
        .status(403)
        .json({ error: "Forbidden: USERROLE:CREATE required" });
    }

    const { usernames, role_names } = assignPairsBody.parse(req.body);

    if (usernames.length !== role_names.length) {
      return res.status(400).json({
        error:
          "usernames and role_names must have the same length (pairwise assignment)",
      });
    }

    // Fetch roles for this workspace
    const roles = await prisma.role.findMany({
      where: {
        workspace_id: wid,
        name: { in: role_names, mode: "insensitive" },
      },
      select: { id: true, name: true },
    });
    const roleByLowerName = new Map(
      roles.map((r) => [r.name.toLowerCase(), r])
    );

    const missingRoles = role_names.filter(
      (n) => !roleByLowerName.has(n.toLowerCase())
    );
    if (missingRoles.length) {
      return res.status(422).json({
        error: "One or more roles do not belong to this workspace",
        details: { missing_roles: missingRoles },
      });
    }

    // Fetch users by name
    const users = await prisma.users.findMany({
      where: { name: { in: usernames, mode: "insensitive" } },
      select: { id: true, name: true, is_active: true, is_verified: true },
    });
    const userByLowerName = new Map(
      users.map((u) => [u.name.toLowerCase(), u])
    );

    const missingUsers = usernames.filter(
      (n) => !userByLowerName.has(n.toLowerCase())
    );
    if (missingUsers.length) {
      return res.status(404).json({
        error: "One or more users not found",
        details: { missing_users: missingUsers },
      });
    }

    const inactive = usernames
      .map((n) => userByLowerName.get(n.toLowerCase()))
      .filter((u) => !u.is_active || !u.is_verified)
      .map((u) => u.name);
    if (inactive.length) {
      return res.status(422).json({
        error: "Users must be active & verified",
        details: { inactive_users: inactive },
      });
    }

    // ✅ Pairwise mapping
    const rows = usernames.map((uname, i) => {
      const u = userByLowerName.get(uname.toLowerCase());
      const r = roleByLowerName.get(role_names[i].toLowerCase());
      return { user_id: u.id, role_id: r.id, workspace_id: wid };
    });

    await prisma.userRole.createMany({ data: rows, skipDuplicates: true });

    return res.status(200).json({
      assigned: rows.length,
      pairs: usernames.map((u, i) => ({ user: u, role: role_names[i] })),
    });
  } catch (err) {
    const code = err.status ?? 500;
    res.status(code).json({ error: err.message || "Internal Server Error" });
  }
}



// GET /workspaces/:wid/roles
async function listRoles(req, res) {
  try {
    const wid = req.params.wid || req?.ctx?.workspaceId;
    if (!wid) return httpError(res, 400, "Missing workspace id");
    if (!hasPerm(req, "ROLE", Operation.READ))
      return httpError(res, 403, "Forbidden: ROLE:READ required");

    const roles = await prisma.role.findMany({
      where: { workspace_id: wid },
      include: { permissions: { include: { permission: true } } },
      orderBy: { name: "asc" },
    });

    res.json(
      roles.map((r) => ({
        id: r.id,
        name: r.name,
        desc: r.desc,
        permissions: r.permissions.map((p) => ({
          id: p.permission_id,
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
    const roleName = req.params.roleName; // changed param
    if (!wid || !roleName)
      return httpError(res, 400, "Missing workspace id or role name");

    if (!hasPerm(req, "ROLE", Operation.UPDATE)) {
      return httpError(res, 403, "Forbidden: ROLE:UPDATE required");
    }

    const patch = updateRoleBody.parse(req.body);

    const updated = await prisma.$transaction(async (tx) => {
      // find role by name & workspace
      const role = await tx.role.findFirst({
        where: {
          name: { equals: roleName, mode: "insensitive" }, // case-insensitive match
          workspace_id: wid,
        },
      });

      if (!role) {
        throw Object.assign(new Error("Role not found"), { status: 404 });
      }

      const r2 = await tx.role.update({
        where: { id: role.id },
        data: {
          name: patch.name ?? role.name,
          desc: patch.desc ?? role.desc,
        },
      });

      if (patch.permissions) {
        const permRows = await Promise.all(
          patch.permissions.map((p) =>
            ensurePermission(p.entity, p.operation, tx)
          )
        );
        await tx.rolePermission.deleteMany({ where: { role_id: role.id } });
        await tx.rolePermission.createMany({
          data: permRows.map((p) => ({
            role_id: role.id,
            permission_id: p.id,
          })),
        });
      }

      return r2;
    });

    res.json(updated);
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
      return httpError(res, 403, "Forbidden: ROLE:DELETE required");

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
      return httpError(res, 403, "Forbidden: USERROLE:CREATE required");

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
    assignUsersToWorkspace,
    listRoles,
    createRole,
    updateRole,
    deleteRole,
    addUsersToRole,
}

/* ------------------------- example bindings (for reference)
import { Router } from 'express';
const router = Router();

router.post('/workspaces', authenticate, createWorkspace);
router.post('/workspaces/:wid/invite', authenticate, workspaceContext, loadUserRoleInWorkspace, inviteUser);
router.get('/workspaces/:wid/roles', authenticate, workspaceContext, loadUserRoleInWorkspace, listRoles);
router.post('/workspaces/:wid/roles', authenticate, workspaceContext, loadUserRoleInWorkspace, createRole);
router.put('/workspaces/:wid/roles/:roleId', authenticate, workspaceContext, loadUserRoleInWorkspace, updateRole);
router.delete('/workspaces/:wid/roles/:roleId', authenticate, workspaceContext, loadUserRoleInWorkspace, deleteRole);
router.post('/workspaces/:wid/roles/:roleId/users', authenticate, workspaceContext, loadUserRoleInWorkspace, addUsersToRole);
export default router;
----------------------------------------------------------------- */
