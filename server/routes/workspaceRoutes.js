const express = require("express");
const { authenticate } = require("../middlewares/authenticate");
const { workspaceContext } = require("../middlewares/workspaceContext");
const {
  loadUserRoleInWorkspace,
} = require("../middlewares/loadUserRoleInWorkspace");
const { authorize } = require("../middlewares/authorize");

const {
  createWorkspace,
  assignRolestoUsers,
  updateAssignedRoleForUser,
  removeAssignedRolesForUser,
  getUserWorkspaces,
  getWorkspaceById,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
} = require("../controllers/workspaceController");

const router = express.Router();

router.post(
  "/workspaces",
  authenticate,
  authorize("WORKSPACE", "CREATE"),
  createWorkspace
);

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


module.exports = router;
