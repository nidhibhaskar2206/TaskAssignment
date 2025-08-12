// routes/tickets.js
const express = require('express');
const { createTicket, listTickets, getTicketById, updateTicket, deleteTicket } = require('../controllers/ticketController');
const {authMiddleware} = require('../middlewares/auth');

const router = express.Router();

// workspace-scoped
router.post('/workspaces/:id/tickets', authMiddleware, createTicket);
router.get('/workspaces/:id/tickets', authMiddleware, listTickets);

// ticket-scoped
router.get('/tickets/:ticketId', authMiddleware, getTicketById);
router.patch('/tickets/:ticketId', authMiddleware, updateTicket);
router.delete('/tickets/:ticketId', authMiddleware, deleteTicket);

module.exports = router;
