const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function loadUserRoleInWorkspace(req, res, next) {
    if (req.user.user_type === "SUPER_ADMIN") {
        req.ctx.isSuperAdmin = true;
        req.ctx.perms = new Set();
        return next();
    }
    const roles = await prisma.userRole.findMany({
      where: { user_id: req.user.id, workspace_id: req.ctx.workspaceId },
      select: {
        role: {
          select: {
            name: true,
            permissions: {
              select: {
                permission: { select: { entity: true, operation: true } },
              },
            },
          },
        },
      },
    });
    const perms = new Set();
    roles.forEach((r) => {
      r.role.permissions.forEach((p) => {
        perms.add(`${p.permission.entity}:${p.permission.operation}`);
      });
    });
     req.ctx.perms = perms;
     req.ctx.roles = roles.map((r) => r.role.name);
     next();
}

module.exports = { loadUserRoleInWorkspace };