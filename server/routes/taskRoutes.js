// routes/taskRoutes.js
const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");
const { authMiddleware } = require("../middlewares/auth");

// Use real JWT-based auth
router.use(authMiddleware);

router.post("/", taskController.createTask); // Create Task
router.post("/assign", taskController.assignUser); // Assign User to Task
router.get("/", taskController.getTasks); // List All Tasks

module.exports = router;