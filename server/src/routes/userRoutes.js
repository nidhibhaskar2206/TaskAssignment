const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { mockAuth } = require("../middlewares/auth");

router.use(mockAuth);

router.post("/", userController.createUser); // Create User
router.get("/", userController.getUsers); // List Users

module.exports = router;
