const prisma = require("../config/db");

const createWorkspace = async (req, res) => {
  try {
    const { name, adminId } = req.body;

    if (!name || !adminId) {
      return res.status(400).json({ message: "Name and adminId are required" });
    }

    if (req.user.user_type !== "SUPER_ADMIN") {
      return res
        .status(403)
        .json({ message: "Only SUPER_ADMIN can create workspaces" });
    }

    const adminUser = await prisma.users.findUnique({ where: { id: adminId } });
    if (!adminUser) {
      return res.status(404).json({ message: "Admin user not found" });
    }
    if (adminUser.user_type !== "OTHER") {
      return res.status(400).json({
        message: "Super Admin cannot be the admin of the workspace",
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1️ Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name,
          created_by: req.user.id,
          admin_id: adminId,
        },
      });

      // 2️ Create ADMIN role for workspace
      const adminRole = await tx.role.create({
        data: {
          name: "ADMIN",
          desc: "Full access to manage workspace",
          workspace_id: workspace.id,
        },
      });

      // 3️ Fetch all global permissions
      const permissions = await tx.permission.findMany();

      // 4️ Assign all permissions to ADMIN role
      await tx.rolePermission.createMany({
        data: permissions.map((perm) => ({
          role_id: adminRole.id,
          permission_id: perm.id,
        })),
      });

      // 5 Assign selected admin user to ADMIN role
      await tx.userRole.create({
        data: {
          user_id: adminId,
          role_id: adminRole.id,
          workspace_id: workspace.id,
        },
      });

      return workspace;
    });

    res.status(201).json({
      message: "Workspace created successfully",
      workspace: result,
    });
  } catch (error) {
    console.error("Create workspace error:", error);
    res
      .status(500)
      .json({ message: "Something went wrong while creating workspace" });
  }
};

const getUserWorkspaces = async (req, res) => {
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
    console.error("Get Workspaces Error:", error);
    res.status(500).json({ message: "Failed to fetch workspaces" });
  }
};

const getWorkspaceById = async (req, res) => {
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

module.exports = {
  createWorkspace,
  getUserWorkspaces,
  getWorkspaceById
};
