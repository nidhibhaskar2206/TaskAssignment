const prisma = require("../config/db");

// Create a comment on a ticket
const createComment = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message, parentId } = req.body;
    const userId = req.user.id;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    // Ensure ticket exists
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
    });
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    const comment = await prisma.comments.create({
      data: {
        workspace_id: ticket.workspace_id,
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

// Update a comment (only author or someone with MANAGE permission can do this)
const updateComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    const comment = await prisma.comments.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
    }

    // If not the author, require MANAGE permission (authorize middleware should already cover this)
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

// Delete a comment (only author or someone with MANAGE permission can do this)
const deleteComment = async (req, res) => {
  try {
    const { commentId } = req.params;
    const userId = req.user.id;

    const comment = await prisma.comments.findUnique({
      where: { id: commentId },
    });
    if (!comment) {
      return res.status(404).json({ message: "Comment not found" });
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
    const { ticketId } = req.params;

    const comments = await prisma.comments.findMany({
      where: { ticket_id: ticketId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        replies: true,
      },
      orderBy: { created_at: "asc" },
    });

    res.status(200).json(comments);
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
