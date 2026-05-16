const db = require('../db');

// Middleware: only admins of the project (from project_members) can proceed
function requireProjectAdmin(req, res, next) {
  const projectId = req.params.projectId || req.body.projectId;
  const userId = req.user.id;  // from previous authenticateToken

  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  const member = db.prepare(
    'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, userId);

  if (!member || member.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Only project admins can perform this action.' });
  }

  next();
}

module.exports = requireProjectAdmin;