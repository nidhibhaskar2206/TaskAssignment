const express = require("express");
const router = express.Router();
const {
  createTicket,
  listTickets,
  getSubTasks,
  getTicketById,
  updateTicket,
  deleteTicket,
} = require("../controllers/ticketController");
const { authenticate } = require("../middlewares/authenticate");
const { workspaceContext } = require("../middlewares/workspaceContext");
const {
  loadUserRoleInWorkspace,
} = require("../middlewares/loadUserRoleInWorkspace");
const { authorize } = require("../middlewares/authorize");

// workpace-id
router.post(
  "/:wid/create-tickets",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("TICKET", "CREATE"),
  createTicket
);

router.get(
  "/:wid/tickets",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("TICKET", "READ"),
  listTickets
);

// ticket-scoped
router.get(
  "/:ticketId/getTicket",
  authenticate,
  // workspaceContext,
  loadUserRoleInWorkspace,
  authorize("TICKET", "READ"),
  getTicketById
);

router.get(
  "/:ticketId/subtickets",
  authenticate,
  // workspaceContext,
  loadUserRoleInWorkspace,
  authorize("TICKET", "READ"),
  getSubTasks
);

router.put(
  "/:ticketId/updateTicket",
  authenticate,
  // workspaceContext,
  loadUserRoleInWorkspace,
  authorize("TICKET", "UPDATE"),
  updateTicket
);

router.delete(
  "/:ticketId/deleteTicket",
  authenticate,
  // workspaceContext,
  loadUserRoleInWorkspace,
  authorize("TICKET", "DELETE"),
  deleteTicket
);

module.exports = router;
