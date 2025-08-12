const express = require('express');
const { createWorkspace, getUserWorkspaces, getWorkspaceById } = require('../controllers/workspaceController');
const { authMiddleware, isSuperAdmin } = require('../middlewares/auth');
const authorize = require('../middlewares/authorize');

const router = express.Router();

router.post('/create', authMiddleware, isSuperAdmin, createWorkspace);
router.get('/get-user-workspace', authMiddleware, getUserWorkspaces);
router.get('/:workspaceId', authMiddleware, getWorkspaceById);

module.exports = router;
