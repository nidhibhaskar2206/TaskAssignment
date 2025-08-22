const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function workspaceContext(req, res, next) {
  let wid =
      req.params?.wid ??
      req.params?.id ??
      req.query?.wid ??
      req.body?.workspace_id;
      
  if (!wid) {
    return res.status(400).json({ message: "Workspace ID is required" });
  }
  const workspace = await prisma.workspace.findUnique({
    where: { id: wid },
    select: { id: true, admin_id: true },
  });

  if (!workspace) {
    return res.status(404).json({ message: "Workspace not found" });
  }

  req.ctx = req.ctx || {};
  req.ctx.workspace = workspace;
  req.ctx.workspaceId = workspace.id;
  next();
}

module.exports = { workspaceContext };
