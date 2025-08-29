const prisma = require("../config/db");

// Create a comment on a ticket
const createComment = async (req, res) => {
  try {
    const workspaceId = req.params.wid || req.ctx.workspaceId;
    const { ticketId } = req.params;
    console.log(workspaceId, ticketId);
    console.log(req.body);
    const { message, parentId } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: { id: true, workspace_id: true },
    });

    if (!ticket || ticket.workspace_id !== workspaceId) {
      console.log(ticket.workspace_id, workspaceId);
      return res.status(404).json({ message: "Ticket not found in this workspace" });
    }
    

    const comment = await prisma.comments.create({
      data: {
        ticket_id: ticketId,
        user_id: userId,
        message,
        parent_id: parentId || null,
      },
    });
    

    res.status(201).json({ message: "Comment created successfully", comment });
  } catch (err) {
    console.error("createComment error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Update a comment
const updateComment = async (req, res) => {
  try {
    const workspaceId = req.params.wid || req.ctx.workspaceId;
    const { commentId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    const comment = await prisma.comments.findUnique({
      where: { id: commentId },
      include: { ticket: { select: { workspace_id: true } } },
    });

    if (!comment || comment.ticket.workspace_id !== workspaceId) {
      return res.status(404).json({ message: "Comment not found in this workspace" });
    }

    if (comment.user_id !== userId && req.user.user_type !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Not allowed to edit this comment" });
    }

    const updated = await prisma.comments.update({
      where: { id: commentId },
      data: { message },
    });

    res.status(200).json({ message: "Comment updated", comment: updated });
  } catch (err) {
    console.error("updateComment error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Delete a comment
const deleteComment = async (req, res) => {
  try {
    const workspaceId = req.ctx.workspaceId;
    const { commentId } = req.params;
    const userId = req.user.id;

    const comment = await prisma.comments.findUnique({
      where: { id: commentId },
      include: { ticket: { select: { workspace_id: true } } },
    });

    if (!comment || comment.ticket.workspace_id !== workspaceId) {
      return res.status(404).json({ message: "Comment not found in this workspace" });
    }

    if (comment.user_id !== userId && req.user.user_type !== "SUPER_ADMIN") {
      return res.status(403).json({ message: "Not allowed to delete this comment" });
    }

    await prisma.comments.delete({ where: { id: commentId } });

    res.status(200).json({ message: "Comment deleted successfully" });
  } catch (err) {
    console.error("deleteComment error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Get all comments for a ticket
const getTicketComments = async (req, res) => {
  try {
    const workspaceId = req.ctx.workspaceId;
    const { ticketId } = req.params;

    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      select: { id: true, workspace_id: true },
    });

    if (!ticket || ticket.workspace_id !== workspaceId) {
      return res.status(404).json({ message: "Ticket not found in this workspace" });
    }

    const flatComments = await prisma.comments.findMany({
      where: { ticket_id: ticketId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { created_at: "asc" },
    });

    const commentMap = {};
    flatComments.forEach((comment) => {
      comment.replies = [];
      commentMap[comment.id] = comment;
    });

    const nestedComments = [];
    flatComments.forEach((comment) => {
      if (comment.parent_id) {
        const parent = commentMap[comment.parent_id];
        if (parent) parent.replies.push(comment);
      } else {
        nestedComments.push(comment);
      }
    });

    res.status(200).json(nestedComments);
  } catch (err) {
    console.error("getTicketComments error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
};


module.exports = {
  createComment,
  updateComment,
  deleteComment,
  getTicketComments,
};
