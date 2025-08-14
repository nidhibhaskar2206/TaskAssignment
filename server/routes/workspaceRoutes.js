const express = require("express");
const { authenticate } = require("../middlewares/authenticate");
const { workspaceContext } = require("../middlewares/workspaceContext");
const {
  loadUserRoleInWorkspace,
} = require("../middlewares/loadUserRoleInWorkspace");
const { authorize } = require("../middlewares/authorize");
const { Operation } = require("../constants");
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

router.post(
  "/workspaces",
  authenticate,
  authorize("WORKSPACE", Operation.CREATE), // Only SUPER_ADMIN or those with permission
  createWorkspace
);

router.post(
  "/workspaces/:wid/assign",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("USERROLE", Operation.CREATE),
  assignUsersToWorkspace
);

router.get(
  "/workspaces/:wid/roles",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("ROLE", Operation.READ),
  listRoles
);

router.post(
  "/workspaces/:wid/roles",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("ROLE", Operation.CREATE),
  createRole
);

router.put(
  "/workspaces/:wid/roles/:roleName",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("ROLE", Operation.UPDATE),
  updateRole
);

router.delete(
  "/workspaces/:wid/roles/:roleId",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("ROLE", Operation.DELETE),
  deleteRole
);

router.post(
  "/workspaces/:wid/roles/:roleId/users",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("USERROLE", Operation.CREATE),
  addUsersToRole
);

module.exports = router;
