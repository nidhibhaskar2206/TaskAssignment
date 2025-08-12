const express = require('express');
const {createRole, addPermissionsToRole, assignRoleToUser, listWorkspaceRoles, deleteRole, bulkAssignRolesToUsers} = require('../controllers/roleController');
const {authMiddleware} = require('../middlewares/auth');

const router = express.Router();

router.post('/:id/create',authMiddleware, createRole);
router.post('/:id/:roleId/add-permissions',authMiddleware, addPermissionsToRole);
router.post('/:id/users/:userId/assign',authMiddleware, assignRoleToUser);
router.get('/:id/all-roles',authMiddleware, listWorkspaceRoles);
router.delete('/:id/roles/:roleId',authMiddleware, deleteRole);
router.post('/:id/users/:userId/assign-multiple',authMiddleware, assignRoleToUser);

module.exports = router;