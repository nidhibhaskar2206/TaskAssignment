// middlewares/authorize.js
const prisma = require("../config/db");

/**
 * Resolve workspaceId from:
 *  1) /workspaces/:id/*
 *  2) /tickets/:ticketId  (via Tickets lookup)
 *  3) /comments/:commentId (via Comments -> Tickets lookup)
 */
async function resolveWorkspaceId(req) {
  if (req.ctx?.workspaceId) return req.ctx.workspaceId;

  const { id, workspaceId, ticketId, commentId } = req.params;

  if (workspaceId || id) return workspaceId || id;

  if (ticketId) {
    const t = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: { workspace_id: true },
    });
    return t?.workspace_id || null;
  }

  if (commentId) {
    const c = await prisma.comments.findUnique({
      where: { id: commentId },
      select: { ticket_id: true },
    });
    if (!c) return null;
    const t = await prisma.tickets.findUnique({
      where: { id: c.ticket_id },
      select: { workspace_id: true },
    });
    return t?.workspace_id || null;
  }

  return null;
}

/**
 * authorize(entity, operation)
 * entity: 'Workspace' | 'Ticket' | 'Comment' | 'Role' | 'UserRole' (must match your Permission.entity values)
 * operation: 'CREATE' | 'READ' | 'UPDATE' | 'DELETE' | 'COMMENT' | 'MANAGE' (must match your Operation enum)
 */
function authorize(entity, operation) {
  return async (req, res, next) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ message: "Unauthorized" });

      // Special-case: only SUPER_ADMIN can CREATE workspaces
      if (entity === "Workspace" && operation === "CREATE") {
        if (user.user_type === "SUPER_ADMIN") return next();
        return res.status(403).json({ message: "Only SUPER_ADMIN can create workspaces" });
      }

      // Resolve workspaceId for all other workspace-scoped operations
      const workspaceId = await resolveWorkspaceId(req);
      if (!workspaceId) {
        return res.status(400).json({ message: "workspaceId could not be resolved for authorization" });
      }

      // Global SUPER_ADMIN override (you can restrict this if you prefer stricter isolation)
      if (user.user_type === "SUPER_ADMIN") {
        return next();
      }

      // Ensure user is a member of the workspace
      const isMember = await prisma.userRole.count({
        where: { user_id: user.id, workspace_id: workspaceId },
      });
      if (!isMember) {
        return res.status(403).json({ message: "Not a member of this workspace" });
      }

      // Check permission via role → rolePermission → permission
      const hasPermission = await prisma.userRole.count({
        where: {
          user_id: user.id,
          workspace_id: workspaceId,
          role: {
            permissions: {
              some: {
                permission: {
                  entity,       // e.g., 'Ticket'
                  operation,    // e.g., 'UPDATE'
                },
              },
            },
          },
        },
      });

      if (!hasPermission) {
        return res.status(403).json({ message: "Access denied: insufficient permissions" });
      }

      // Save workspaceId into context for downstream handlers
      req.ctx = { ...(req.ctx || {}), workspaceId };
      next();
    } catch (err) {
      console.error("authorize middleware error:", err);
      res.status(500).json({ message: "Authorization check failed" });
    }
  };
}

module.exports = authorize;
