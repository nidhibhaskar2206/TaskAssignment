const express = require('express');
const {createRole, addPermissionsToRole, assignRoleToUser, listWorkspaceRoles, deleteRole} = require('../controllers/roleController');

const router = express.Router();

router.post('/:id/create', createRole);
router.post('/:id/:roleId/add-permissions', addPermissionsToRole);
router.post('/:id/users/:userId/roles', assignRoleToUser);
router.get('/:id/all-roles', listWorkspaceRoles);
router.delete('/:id/roles/:roleId', deleteRole);

module.exports = router;