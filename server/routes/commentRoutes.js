const express = require("express");
const { authenticate } = require("../middlewares/authenticate");
const { workspaceContext } = require("../middlewares/workspaceContext");
const {
  loadUserRoleInWorkspace,
} = require("../middlewares/loadUserRoleInWorkspace");
const { authorize } = require("../middlewares/authorize");
const {
  createComment,
  updateComment,
  deleteComment,
  getTicketComments,
} = require("../controllers/commentController");

const router = express.Router();

// Create a comment on a ticket
router.post(
  "/tickets/:ticketId/comments",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("COMMENT", "CREATE"),
  createComment
);

// Update a comment
router.patch(
  "/comments/:commentId",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("COMMENT", "UPDATE"),
  updateComment
);

// Delete a comment
router.delete(
  "/comments/:commentId",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("COMMENT", "DELETE"),
  deleteComment
);

// Get all comments for a ticket
router.get(
  "/tickets/:ticketId/comments",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("COMMENT", "READ"),
  getTicketComments
);

module.exports = router;