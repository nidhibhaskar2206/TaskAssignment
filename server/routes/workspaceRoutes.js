const express = require("express");
const { authenticate } = require("../middlewares/authenticate");
const { workspaceContext } = require("../middlewares/workspaceContext");
const {
  loadUserRoleInWorkspace,
} = require("../middlewares/loadUserRoleInWorkspace");
const { authorize } = require("../middlewares/authorize");

const {
  createWorkspace,
  getAllWorkspaces,
  getAllUsers,
  assignRolestoUsers,
  updateAssignedRoleForUser,
  removeAssignedRolesForUser,
  getUserWorkspaces,
  getWorkspaceById,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  updateRolePermissions,
  removePermissionsFromRole,
} = require("../controllers/workspaceController");

const router = express.Router();

router.post(
  "/workspaces",
  authenticate,
  authorize("WORKSPACE", "CREATE"),
  createWorkspace
);

router.get(
  "/get-workspaces",
  authenticate,
  authorize("WORKSPACE", "READ"),
  getAllWorkspaces
)

router.get(
  "/get-users",
  authenticate,
  getAllUsers
)

router.post(
  "/workspaces/:wid/assign",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("USER_ROLE", "CREATE"),
  assignRolestoUsers
);

router.put(
  "/workspaces/:wid/user-roles",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("USER_ROLE", "UPDATE"),
  updateAssignedRoleForUser
)

router.delete(
  "/workspaces/:wid/user-roles",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("USER_ROLE", "DELETE"),
  removeAssignedRolesForUser
)

router.get(
  "/workspaces/:wid/roles",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("ROLE", "READ"),
  listRoles
);

router.get("/all-workspaces", authenticate, getUserWorkspaces);

router.get("/workspaces/:wid", authenticate, getWorkspaceById);

router.post(
  "/workspaces/:wid/roles",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("ROLE", "CREATE"),
  createRole
);

router.put(
  "/workspaces/:wid/roles/:roleId",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("ROLE", "UPDATE"),
  updateRole
);

router.delete(
  "/workspaces/:wid/roles/:roleId",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("ROLE", "DELETE"),
  deleteRole
);

router.patch(
  "/workspaces/:wid/roles/:roleId/permissions",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("ROLE", "UPDATE"),
  updateRolePermissions
)

router.patch(
  "/workspaces/:wid/roles/:roleId/permissions/remove",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("ROLE", "UPDATE"),
  removePermissionsFromRole
);

module.exports = router;
