const express = require("express");
const authenticate = require("../middlewares/authenticate");
const authorize = require("../middlewares/authorize");
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
  authorize("Comment", "CREATE"),
  createComment
);

// Update a comment
router.patch(
  "/comments/:commentId",
  authenticate,
  authorize("Comment", "UPDATE"),
  updateComment
);

// Delete a comment
router.delete(
  "/comments/:commentId",
  authenticate,
  authorize("Comment", "DELETE"),
  deleteComment
);

// Get all comments for a ticket
router.get(
  "/tickets/:ticketId/comments",
  authenticate,
  authorize("Comment", "READ"),
  getTicketComments
);

module.exports = router;
