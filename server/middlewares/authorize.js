function authorize(entity, operation) {
  return (req, res, next) => {
    if (req.ctx.isSuperAdmin) return next();
    if (req.ctx.perms?.has(`${entity}:${operation}`)) return next();
    return res.status(403).json({ error: "Access Denied" });
  };
}

module.exports = { authorize };
