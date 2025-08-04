const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { authMiddleware } = require("../middlewares/auth");

// Protect all user routes with JWT
router.use(authMiddleware);

// 🛡️ List users — restricted to super admins
router.get("/", async (req, res, next) => {
  if (!req.user?.is_super) {
    return res
      .status(403)
      .json({ message: "Forbidden: Super admin access only" });
  }

  return userController.getUsers(req, res, next);
});

module.exports = router;
