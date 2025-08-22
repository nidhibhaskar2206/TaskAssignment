const prisma = require("../config/db");

async function assertUserInWorkspace(userId, workspaceId) {
  const m = await prisma.userRole.findFirst({
    where: { user_id: userId, workspace_id: workspaceId },
    select: { id: true },
  });
  if (!m) {
    const e = new Error("User is not a member of this workspace");
    e.status = 403;
    throw e;
  }
}

async function getTicketAndAssertAccess(ticketId, userId) {
  const t = await prisma.tickets.findUnique({ where: { id: ticketId } });
  if (!t) {
    const e = new Error("Ticket not found");
    e.status = 404;
    throw e;
  }
  await assertUserInWorkspace(userId, t.workspace_id);
  return t;
}

function normalizeForCompare(field, val) {
  if (val === undefined) return undefined;
  if (val === null) return null;

  if (field === "due_date") {
    const d = val instanceof Date ? val : new Date(val);
    return isNaN(d) ? null : d.toISOString();
  }

  // enums: keep compare case-insensitive
  if (field === "status" || field === "priority" || field === "ticket_type") {
    return String(val).toUpperCase();
  }

  // ids and strings
  return String(val);
}

function diffTicket(oldT, data) {
  const fields = [
    "title",
    "desc",
    "status",
    "priority",
    "assigned_to",
    "due_date",
    "parent_id",
    "ticket_type",
  ];

  const changes = [];
  for (const f of fields) {
    // only consider fields that the request actually sent
    if (!Object.prototype.hasOwnProperty.call(data, f)) continue;

    // normalize old & new for stable comparison
    const oldNorm =
      f === "due_date"
        ? oldT.due_date
          ? new Date(oldT.due_date).toISOString()
          : null
        : normalizeForCompare(f, oldT[f] ?? null);

    const newNorm = normalizeForCompare(f, data[f]);

    if (newNorm !== oldNorm) {
      changes.push({
        field: f,
        old: oldNorm,
        val: newNorm,
      });
    }
  }
  return changes;
}

async function writeHistory(
  tx,
  workspaceId,
  ticketId,
  userId,
  changes,
  action = "UPDATE"
) {
  if (!changes.length) return;
  await tx.history.createMany({
    data: changes.map((c) => ({
      workspace_id: workspaceId,
      ticket_id: ticketId,
      field_changed: c.field,
      old_value: c.old !== null ? String(c.old) : null,
      new_value: c.val !== null ? String(c.val) : null,
      action,
      changed_by: userId,
    })),
  });
}

// POST /:wid/tickets
const createTicket = async (req, res) => {
  const workspaceId = req.params.wid || req?.ctx?.workspaceId;
  const userId = req.user.id;

  try {
    if (!workspaceId) {
      return res.status(400).json({ message: "Workspace ID is required" });
    }
    await assertUserInWorkspace(userId, workspaceId);

    const {
      title,
      desc,
      priority,
      ticket_type,
      due_date,
      assigned_to,
      parent_id,
      status = "OPEN",
    } = req.body;

    if (!title || !desc || !priority || !ticket_type) {
      return res
        .status(400)
        .json({ message: "title, desc, priority, ticket_type are required" });
    }

    if (parent_id) {
      const parent = await prisma.tickets.findUnique({
        where: { id: parent_id },
      });
      if (!parent || parent.workspace_id !== workspaceId) {
        return res
          .status(400)
          .json({ message: "Invalid parent ticket for this workspace" });
      }
    }

    if (assigned_to) {
      const member = await prisma.userRole.findFirst({
        where: { user_id: assigned_to, workspace_id: workspaceId },
      });
      if (!member) {
        return res
          .status(400)
          .json({ message: "Assignee is not a member of this workspace" });
      }
    }

    const ticket = await prisma.$transaction(async (tx) => {
      const created = await tx.tickets.create({
        data: {
          workspace_id: workspaceId,
          ticket_type,
          title,
          desc,
          status,
          priority,
          created_by: userId,
          due_date: due_date ? new Date(due_date) : null,
          assigned_to: assigned_to || userId,
          parent_id: parent_id || null,
        },
      });

      // history: creation snapshot
      await writeHistory(
        tx,
        workspaceId,
        created.id,
        userId,
        [
          { field: "title", old: null, val: title },
          { field: "desc", old: null, val: desc },
          { field: "status", old: null, val: status },
          { field: "priority", old: null, val: priority },
          { field: "assigned_to", old: null, val: assigned_to || userId },
          { field: "ticket_type", old: null, val: ticket_type },
          { field: "due_date", old: null, val: due_date || null },
          { field: "parent_id", old: null, val: parent_id || null },
        ],
        "CREATE"
      );

      return created;
    });

    res.status(201).json({ message: "Ticket created", ticket });
  } catch (err) {
    console.error("createTicket error:", err);
    res.status(500).json({ message: "Failed to create ticket" });
  }
};

/**
 * GET /workspaces/:id/tickets?status=&priority=&assignee=&q=&page=1&pageSize=20
 */
const listTickets = async (req, res) => {
  const workspaceId = req.params.wid || req?.ctx?.workspaceId;
  const { status, priority, assignee, q, page = 1, pageSize = 20 } = req.query;

  try {
    // inside listTickets, before querying:
    await assertUserInWorkspace(req.user.id, workspaceId);

    const where = {
      workspace_id: workspaceId,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(assignee ? { assigned_to: assignee } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: String(q), mode: "insensitive" } },
              { desc: { contains: String(q), mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.tickets.count({ where }),
      prisma.tickets.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (Number(page) - 1) * Number(pageSize),
        take: Number(pageSize),
        include: {
          created_by_user: true,
          updated_by_user: true,
          assignee: true,
        },
      }),
    ]);

    res.status(200).json({
      page: Number(page),
      pageSize: Number(pageSize),
      total,
      items,
    });
  } catch (err) {
    console.error("listTickets error:", err);
    res.status(500).json({ message: "Failed to fetch tickets" });
  }
};

const getSubTasks = async (req, res) => {
  const { ticketId } = req.params;
  try {
    const parent = await getTicketAndAssertAccess(ticketId, req.user.id);

    const subtasks = await prisma.tickets.findMany({
      where: { parent_id: ticketId, workspace_id: parent.workspace_id },
      include: {
        created_by_user: true,
        updated_by_user: true,
        assignee: true,
      },
    });
    res.status(200).json(subtasks);
  } catch (err) {
    console.error("getSubTasks error:", err);
    res.status(500).json({ message: "Failed to fetch subtasks" });
  }
};

/**
 * GET /tickets/:ticketId
 */
const getTicketById = async (req, res) => {
  const { ticketId } = req.params;
  try {
    const ticket = await prisma.tickets.findUnique({
      where: { id: ticketId },
      include: {
        created_by_user: true,
        updated_by_user: true,
        assignee: true,
        comments: true,
        History: true,
      },
    });
    if (!ticket) return res.status(404).json({ message: "Ticket not found" });

    await assertUserInWorkspace(req.user.id, ticket.workspace_id); // ⬅️ add this

    res.status(200).json(ticket);
  } catch (err) {
    console.error("getTicketById error:", err);
    res
      .status(err.status ?? 500)
      .json({ message: err.message || "Failed to fetch ticket" });
  }
};

/**
 * PUT /tickets/:ticketId
 * Body: partial fields: { title?, desc?, status?, priority?, due_date?, assigned_to?, parent_id?, type? }
 */
const updateTicket = async (req, res) => {
  const { ticketId } = req.params;
  const userId = req.user.id;
  try {
    const current = await getTicketAndAssertAccess(ticketId, userId);

    // validations using current.workspace_id (unchanged)
    if (req.body.parent_id) {
      const parent = await prisma.tickets.findUnique({
        where: { id: req.body.parent_id },
      });
      if (!parent || parent.workspace_id !== current.workspace_id) {
        return res
          .status(400)
          .json({ message: "Invalid parent ticket for this workspace" });
      }
    }
    if (req.body.assigned_to) {
      const member = await prisma.userRole.findFirst({
        where: {
          user_id: req.body.assigned_to,
          workspace_id: current.workspace_id,
        },
      });
      if (!member)
        return res
          .status(400)
          .json({ message: "Assignee is not a member of this workspace" });
    }

    // ⬇️ ONLY allow columns that exist on Tickets
    const allowed = new Set([
      "title",
      "desc",
      "status",
      "priority",
      "assigned_to",
      "due_date",
      "parent_id",
      "ticket_type",
    ]);

    const updateData = {};
    for (const k of Object.keys(req.body || {})) {
      if (!allowed.has(k)) continue;
      if (k === "due_date") {
        updateData.due_date = req.body.due_date
          ? new Date(req.body.due_date)
          : null;
      } else {
        updateData[k] = req.body[k];
      }
    }

    // compute precise diff ONLY on fields we will actually write
    const changes = diffTicket(current, updateData);
    if (!changes.length) {
      return res.status(200).json({ message: "No changes", ticket: current });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const t = await tx.tickets.update({
        where: { id: ticketId },
        data: {
          ...updateData,
          updated_by: userId,
        },
      });

      await writeHistory(tx, t.workspace_id, t.id, userId, changes, "UPDATE");
      return t;
    });

    res.status(200).json({ message: "Ticket updated", ticket: updated });
  } catch (err) {
    console.error("updateTicket error:", err);
    res
      .status(err.status ?? 500)
      .json({ message: err.message || "Failed to update ticket" });
  }
};

/**
 * DELETE /tickets/:ticketId
 * - Also deletes subtasks (ON CASCADE handled by app here)
 */
const deleteTicket = async (req, res) => {
  const { ticketId } = req.params;
  const userId = req.user.id;
  try {
    const current = await getTicketAndAssertAccess(ticketId, userId);

    await prisma.$transaction(async (tx) => {
      await writeHistory(
        tx,
        current.workspace_id,
        current.id,
        userId,
        [{ field: "deleted", old: "false", val: "true" }],
        "DELETE"
      );
      await tx.comments.deleteMany({ where: { ticket_id: ticketId } });
      await tx.tickets.deleteMany({ where: { parent_id: ticketId } });
      await tx.tickets.delete({ where: { id: ticketId } });
    });

    res.status(200).json({ message: "Ticket deleted" });
  } catch (err) {
    console.error("deleteTicket error:", err);
    res
      .status(err.status ?? 500)
      .json({ message: err.message || "Failed to delete ticket" });
  }
};

module.exports = {
  createTicket,
  listTickets,
  getTicketById,
  updateTicket,
  deleteTicket,
  getSubTasks,
};
