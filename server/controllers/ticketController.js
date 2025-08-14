// controllers/ticketController.js
const {
  PrismaClient,
  Operation,
  TicketStatus,
  TicketType,
  TicketPriority,
} = require("@prisma/client");
const { z } = require("zod");
const prisma = new PrismaClient();

/* ============ tiny helpers ============ */
const httpError = (res, code, msg, details) =>
  res.status(code).json({ error: msg, details });

const boolQ = (v) => (typeof v === "string" ? v.toLowerCase() === "true" : !!v);

/** Write a single history/audit record */
async function auditLogger({
  tx = prisma,
  workspace_id,
  ticket_id,
  action,
  field_changed,
  old_value,
  new_value,
  changed_by,
}) {
  await tx.history.create({
    data: {
      workspace_id,
      ticket_id,
      action,
      field_changed: field_changed ?? action, // for CREATE/DELETE/CLOSE etc.
      old_value: old_value ?? null,
      new_value: new_value ?? null,
      changed_by,
    },
  });
}

/** Ensures the assignee belongs to workspace (admin or appears in UserRole) */
async function ensureAssigneeInWorkspace(tx, { workspace_id, assigned_to }) {
  if (!assigned_to) return; // allow unassigned
  // Check if user is workspace admin
  const ws = await tx.workspace.findUnique({
    where: { id: workspace_id },
    select: { admin_id: true },
  });
  if (!ws)
    throw Object.assign(new Error("Workspace not found"), { status: 404 });

  if (ws.admin_id === assigned_to) return;

  const exists = await tx.userRole.findFirst({
    where: { workspace_id, user_id: assigned_to },
    select: { id: true },
  });
  if (!exists) {
    throw Object.assign(
      new Error("Assigned user is not a member/admin of this workspace"),
      { status: 422 }
    );
  }
}

/** Ensures parent ticket (if provided) exists in same workspace */
async function ensureParentInWorkspace(tx, { workspace_id, parent_id }) {
  if (!parent_id) return;
  const parent = await tx.tickets.findFirst({
    where: { id: parent_id, workspace_id },
    select: { id: true },
  });
  if (!parent) {
    throw Object.assign(
      new Error("Parent ticket not found in this workspace"),
      {
        status: 422,
      }
    );
  }
}

/** Compute diffs for history on update */
function computeTicketDiffs(before, after) {
  const FIELDS = [
    "title",
    "desc",
    "status",
    "priority",
    "assigned_to",
    "due_date",
    "parent_id",
    "ticket_type",
  ];
  const diffs = [];
  for (const f of FIELDS) {
    const ov = before[f];
    const nv = after[f];
    // normalize dates
    const ovS = ov instanceof Date ? ov.toISOString() : ov;
    const nvS = nv instanceof Date ? nv.toISOString() : nv;
    if (ovS !== nvS) {
      diffs.push({
        field_changed: f,
        old_value: ovS == null ? null : String(ovS),
        new_value: nvS == null ? null : String(nvS),
      });
    }
  }
  return diffs;
}

/* ============ validations ============ */

const createTicketBody = z.object({
  ticket_type: z.nativeEnum(TicketType),
  title: z.string().min(1),
  desc: z.string().min(1),
  status: z.nativeEnum(TicketStatus).default(TicketStatus.OPEN),
  priority: z.nativeEnum(TicketPriority).default(TicketPriority.MEDIUM),
  assigned_to: z.string().uuid().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  due_date: z.coerce.date().nullable().optional(),
});

const listQuery = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  ticket_type: z.nativeEnum(TicketType).optional(),
  assignee: z.string().uuid().optional(),
  parent: z.enum(["root", "child"]).optional(), // root => parent_id null, child => parent_id not null
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  includeSubtasks: z.string().optional(), // "true"/"false"
  includeComments: z.string().optional(),
  includeHistory: z.string().optional(),
});

const updateTicketBody = z.object({
  title: z.string().min(1).optional(),
  desc: z.string().min(1).optional(),
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
  due_date: z.coerce.date().nullable().optional(),
  ticket_type: z.nativeEnum(TicketType).optional(),
});

/* ============ controllers ============ */

/** 1) POST /workspaces/:wid/tickets  */
async function createTicket(req, res) {
  try {
    const wid = req.params.wid || req?.ctx?.workspaceId;
    if (!wid) return httpError(res, 400, "Missing workspace id");

    // validate body
    const body = createTicketBody.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      await ensureAssigneeInWorkspace(tx, {
        workspace_id: wid,
        assigned_to: body.assigned_to ?? null,
      });
      await ensureParentInWorkspace(tx, {
        workspace_id: wid,
        parent_id: body.parent_id ?? null,
      });

      const t = await tx.tickets.create({
        data: {
          workspace_id: wid,
          ticket_type: body.ticket_type,
          title: body.title,
          desc: body.desc,
          status: body.status,
          priority: body.priority,
          created_by: req.user.id,
          assigned_to: body.assigned_to ?? req.user.id, // or null if you prefer unassigned
          parent_id: body.parent_id ?? null,
          due_date: body.due_date ?? null,
        },
      });

      await auditLogger({
        tx,
        workspace_id: wid,
        ticket_id: t.id,
        action: "CREATE",
        changed_by: req.user.id,
      });

      return t;
    });

    res.status(201).json(result);
  } catch (err) {
    const code = err.status ?? 500;
    res.status(code).json({ error: err.message || "Internal Server Error" });
  }
}

/** 2) GET /workspaces/:wid/tickets  */
async function listTickets(req, res) {
  try {
    const wid = req.params.wid || req?.ctx?.workspaceId;
    if (!wid) return httpError(res, 400, "Missing workspace id");

    const q = listQuery.parse(req.query);

    const where = { workspace_id: wid };
    if (q.status) where.status = q.status;
    if (q.ticket_type) where.ticket_type = q.ticket_type;
    if (q.assignee) where.assigned_to = q.assignee;
    if (q.parent === "root") where.parent_id = null;
    if (q.parent === "child") where.parent_id = { not: null };
    if (q.search) {
      where.OR = [
        { title: { contains: q.search, mode: "insensitive" } },
        { desc: { contains: q.search, mode: "insensitive" } },
      ];
    }

    const skip = (q.page - 1) * q.limit;
    const take = q.limit;

    const [items, total] = await Promise.all([
      prisma.tickets.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take,
        include: {
          subtasks: boolQ(q.includeSubtasks),
          comments: boolQ(q.includeComments)
            ? { orderBy: { created_at: "desc" } }
            : false,
          History: boolQ(q.includeHistory)
            ? { orderBy: { changed_at: "desc" } }
            : false,
        },
      }),
      prisma.tickets.count({ where }),
    ]);

    res.json({
      page: q.page,
      limit: q.limit,
      total,
      items,
    });
  } catch (err) {
    const code = err.status ?? 500;
    res.status(code).json({ error: err.message || "Internal Server Error" });
  }
}

/** 3) GET /workspaces/:wid/tickets/:id */
async function getTicket(req, res) {
  try {
    const wid = req.params.wid || req?.ctx?.workspaceId;
    const id = req.params.id;
    if (!wid || !id) return httpError(res, 400, "Missing ids");

    const includeHistory = boolQ(req.query.includeHistory);
    const includeComments = boolQ(req.query.includeComments);
    const includeSubtasks = boolQ(req.query.includeSubtasks);

    const t = await prisma.tickets.findFirst({
      where: { id, workspace_id: wid },
      include: {
        subtasks: includeSubtasks,
        comments: includeComments ? { orderBy: { created_at: "desc" } } : false,
        History: includeHistory ? { orderBy: { changed_at: "desc" } } : false,
      },
    });

    if (!t) return httpError(res, 404, "Ticket not found");
    res.json(t);
  } catch (err) {
    const code = err.status ?? 500;
    res.status(code).json({ error: err.message || "Internal Server Error" });
  }
}

/** ownership helper for update/delete/close (owner or assignee allowed) */
async function isTicketOwnerOrAssignee(
  tx,
  { ticket_id, user_id, workspace_id }
) {
  const t = await tx.tickets.findFirst({
    where: { id: ticket_id, workspace_id },
    select: { created_by: true, assigned_to: true },
  });
  if (!t) return false;
  return t.created_by === user_id || t.assigned_to === user_id;
}

/** 4) PUT /workspaces/:wid/tickets/:id */
async function updateTicket(req, res) {
  try {
    const wid = req.params.wid || req?.ctx?.workspaceId;
    const id = req.params.id;
    if (!wid || !id) return httpError(res, 400, "Missing ids");

    const patch = updateTicketBody.parse(req.body);

    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.tickets.findFirst({
        where: { id, workspace_id: wid },
      });
      if (!before)
        throw Object.assign(new Error("Ticket not found"), { status: 404 });

      // ownership shortcut (if your authorize middleware provides allowOwner via opts;
      // if not, we enforce owner/assignee rule here in addition to ROLE:UPDATE)
      const isOwnerOrAssignee = await isTicketOwnerOrAssignee(tx, {
        ticket_id: id,
        user_id: req.user.id,
        workspace_id: wid,
      });
      // If you want to enforce only via RBAC, remove this check.
      if (
        !req?.ctx?.perms?.has(`TICKET:${Operation.MANAGE}`) &&
        !isOwnerOrAssignee
      ) {
        throw Object.assign(new Error("Forbidden: not owner/assignee"), {
          status: 403,
        });
      }

      // validations
      if (patch.assigned_to) {
        await ensureAssigneeInWorkspace(tx, {
          workspace_id: wid,
          assigned_to: patch.assigned_to,
        });
      }
      if ("parent_id" in patch) {
        await ensureParentInWorkspace(tx, {
          workspace_id: wid,
          parent_id: patch.parent_id ?? null,
        });
        if (patch.parent_id === id) {
          throw Object.assign(new Error("Ticket cannot be its own parent"), {
            status: 422,
          });
        }
      }

      const updated = await tx.tickets.update({
        where: { id },
        data: {
          title: patch.title ?? before.title,
          desc: patch.desc ?? before.desc,
          status: patch.status ?? before.status,
          priority: patch.priority ?? before.priority,
          assigned_to:
            patch.assigned_to === undefined
              ? before.assigned_to
              : patch.assigned_to,
          parent_id:
            patch.parent_id === undefined ? before.parent_id : patch.parent_id,
          due_date:
            patch.due_date === undefined ? before.due_date : patch.due_date,
          ticket_type: patch.ticket_type ?? before.ticket_type,
          updated_by: req.user.id,
        },
      });

      const diffs = computeTicketDiffs(before, updated);
      for (const d of diffs) {
        await auditLogger({
          tx,
          workspace_id: wid,
          ticket_id: id,
          action: "UPDATE",
          field_changed: d.field_changed,
          old_value: d.old_value,
          new_value: d.new_value,
          changed_by: req.user.id,
        });
      }

      return updated;
    });

    res.json(result);
  } catch (err) {
    const code = err.status ?? 500;
    res.status(code).json({ error: err.message || "Internal Server Error" });
  }
}

/** 5) POST /workspaces/:wid/tickets/:id/close */
async function closeTicket(req, res) {
  try {
    const wid = req.params.wid || req?.ctx?.workspaceId;
    const id = req.params.id;
    if (!wid || !id) return httpError(res, 400, "Missing ids");

    const ticket = await prisma.tickets.findFirst({
      where: { id, workspace_id: wid },
    });
    if (!ticket) return httpError(res, 404, "Ticket not found");

    // Optional: enforce owner/assignee or MANAGE
    const allowed =
      req?.ctx?.perms?.has(`TICKET:${Operation.MANAGE}`) ||
      (await isTicketOwnerOrAssignee(prisma, {
        ticket_id: id,
        user_id: req.user.id,
        workspace_id: wid,
      }));
    if (!allowed) return httpError(res, 403, "Forbidden: not owner/assignee");

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.tickets.update({
        where: { id },
        data: { status: TicketStatus.CLOSED, updated_by: req.user.id },
      });

      await auditLogger({
        tx,
        workspace_id: wid,
        ticket_id: id,
        action: "CLOSE",
        changed_by: req.user.id,
      });

      return u;
    });

    res.json(updated);
  } catch (err) {
    const code = err.status ?? 500;
    res.status(code).json({ error: err.message || "Internal Server Error" });
  }
}

/** 6) DELETE /workspaces/:wid/tickets/:id */
async function deleteTicket(req, res) {
  try {
    const wid = req.params.wid || req?.ctx?.workspaceId;
    const id = req.params.id;
    if (!wid || !id) return httpError(res, 400, "Missing ids");

    // Optional: enforce owner/assignee or MANAGE
    const allowed =
      req?.ctx?.perms?.has(`TICKET:${Operation.MANAGE}`) ||
      (await isTicketOwnerOrAssignee(prisma, {
        ticket_id: id,
        user_id: req.user.id,
        workspace_id: wid,
      }));
    if (!allowed) return httpError(res, 403, "Forbidden: not owner/assignee");

    await prisma.$transaction(async (tx) => {
      // hard delete; if you want soft delete add a boolean field instead
      await tx.comments.deleteMany({
        where: { ticket_id: id, workspace_id: wid },
      });
      await tx.history.deleteMany({
        where: { ticket_id: id, workspace_id: wid },
      });
      await tx.tickets.delete({ where: { id } });

      await auditLogger({
        tx,
        workspace_id: wid,
        ticket_id: id,
        action: "DELETE",
        changed_by: req.user.id,
      });
    });

    res.status(204).send();
  } catch (err) {
    const code = err.status ?? 500;
    res.status(code).json({ error: err.message || "Internal Server Error" });
  }
}

module.exports = {
  createTicket,
  listTickets,
  getTicket,
  updateTicket,
  closeTicket,
  deleteTicket,
};
