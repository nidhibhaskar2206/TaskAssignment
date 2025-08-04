const express = require("express");
const router = express.Router();
const taskController = require("../controllers/taskController");
const { mockAuth } = require("../middlewares/auth");

// Inject dummy user (until real auth is added)
router.use(mockAuth);

router.post("/", taskController.createTask); // Create Task
router.post("/assign", taskController.assignUser); // Assign User to Task
router.get("/", taskController.getTasks); // List All Tasks

module.exports = router;
