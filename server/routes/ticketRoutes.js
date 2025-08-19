const router = require("express").Router();
const { authenticate } = require("../middlewares/authenticate");
const { workspaceContext } = require("../middlewares/workspaceContext");
const {
  loadUserRoleInWorkspace,
} = require("../middlewares/loadUserRoleInWorkspace");
const { authorize } = require("../middlewares/authorize"); 
const {
  createTicket,
  listTickets,
  getTicket,
  updateTicket,
  closeTicket,
  deleteTicket,
} = require("../controllers/ticketController");

// POST /tickets/:wid/tickets
router.post(
  "/:wid/tickets",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("TICKET", "CREATE"),
  // validateSubtaskConstraint, inputGuard  // optional if you keep them
  createTicket
);

// GET /tickets/:wid/tickets
router.get(
  "/:wid/tickets",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("TICKET", "READ"),
  listTickets
);

// GET /tickets/:wid/tickets/:id
router.get(
  "/:wid/tickets/:id",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("TICKET", "READ"),
  getTicket
);

// PUT /tickets/:wid/tickets/:id
router.put(
  "/:wid/tickets/:id",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("TICKET", "UPDATE"), // your authorize can support allowOwner via opts
  updateTicket
);

// POST /tickets/:wid/tickets/:id/close
router.post(
  "/:wid/tickets/:id/close",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("TICKET", "UPDATE"), // or MANAGE depending on your policy
  closeTicket
);

// DELETE /tickets/:wid/tickets/:id
router.delete(
  "/:wid/tickets/:id",
  authenticate,
  workspaceContext,
  loadUserRoleInWorkspace,
  authorize("TICKET", "DELETE"),
  deleteTicket
);

module.exports = router;
