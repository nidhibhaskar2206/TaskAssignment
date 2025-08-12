const express = require("express");
const { authenticate } = require("../middlewares/authenticate");
const { workspaceContext } = require("../middlewares/workspaceContext");
const {
  loadUserRoleInWorkspace,
} = require("../middlewares/loadUserRoleInWorkspace");
const {
  createWorkspace,
  assignUsersToWorkspace,
  listRoles,
  createRole,
  updateRole,
  deleteRole,
  addUsersToRole,
} = require("../controllers/workspaceController");

const router = express.Router();

router.post("/workspaces", authenticate, createWorkspace);

router.post(
  "/workspaces/:wid/assign",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  assignUsersToWorkspace
);

router.get(
  "/workspaces/:wid/roles",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  listRoles
);

router.post(
  "/workspaces/:wid/roles",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  createRole
);

router.put(
  "/workspaces/:wid/roles/:roleName",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  updateRole
);

router.delete(
  "/workspaces/:wid/roles/:roleId",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  deleteRole
);

router.post(
  "/workspaces/:wid/roles/:roleId/users",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  addUsersToRole
);

module.exports = router;
