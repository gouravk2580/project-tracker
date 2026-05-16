const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const requireProjectAdmin = require('../middleware/projectAuth');

// All routes here require a valid token
router.use(authenticateToken);

// ────────────────────────────────────────
// 1. Create a new project
//    Automatically adds the creator as "admin" member
router.post('/', (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const userId = req.user.id;

  const stmt = db.prepare('INSERT INTO projects (name, description, created_by) VALUES (?, ?, ?)');
  const result = stmt.run(name, description || '', userId);
  const projectId = result.lastInsertRowid;

  // Add creator as project admin
  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
    .run(projectId, userId, 'admin');

  res.status(201).json({ message: 'Project created', projectId });
});

// ────────────────────────────────────────
// 2. Get all projects where the user is a member
router.get('/', (req, res) => {
  const userId = req.user.id;
  const projects = db.prepare(`
    SELECT p.id, p.name, p.description, p.created_by, p.created_at,
           pm.role AS member_role
    FROM projects p
    INNER JOIN project_members pm ON p.id = pm.project_id
    WHERE pm.user_id = ?
    ORDER BY p.created_at DESC
  `).all(userId);
  res.json({ projects });
});

// ────────────────────────────────────────
// 3. Get a single project (only if member)
router.get('/:projectId', (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;

  const project = db.prepare(`
    SELECT p.id, p.name, p.description, p.created_by, p.created_at,
           pm.role AS member_role
    FROM projects p
    INNER JOIN project_members pm ON p.id = pm.project_id
    WHERE p.id = ? AND pm.user_id = ?
  `).get(projectId, userId);

  if (!project) {
    return res.status(404).json({ error: 'Project not found or access denied' });
  }

  // Get team members
  const members = db.prepare(`
    SELECT u.id, u.name, u.email, pm.role, pm.joined_at
    FROM project_members pm
    JOIN users u ON pm.user_id = u.id
    WHERE pm.project_id = ?
  `).all(projectId);

  res.json({ project, members });
});

// ────────────────────────────────────────
// 4. Update project (admin only)
router.put('/:projectId', requireProjectAdmin, (req, res) => {
  const { projectId } = req.params;
  const { name, description } = req.body;

  if (!name && !description) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const fields = [];
  const values = [];
  if (name) { fields.push('name = ?'); values.push(name); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  values.push(projectId);

  db.prepare(`UPDATE projects SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  res.json({ message: 'Project updated' });
});

// ────────────────────────────────────────
// 5. Delete project (only creator, or leave as project admin)
router.delete('/:projectId', requireProjectAdmin, (req, res) => {
  const { projectId } = req.params;
  // Project members are deleted automatically (CASCADE)
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId);
  res.json({ message: 'Project deleted' });
});

// ────────────────────────────────────────
// 6. Add a member to a project (admin only)
router.post('/:projectId/members', requireProjectAdmin, (req, res) => {
  const { projectId } = req.params;
  const { email, role } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'User email is required' });
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const memberRole = role === 'admin' ? 'admin' : 'member';

  try {
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)')
      .run(projectId, user.id, memberRole);
    res.json({ message: 'Member added successfully' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(400).json({ error: 'User is already a member of this project' });
    }
    throw err;
  }
});

// ────────────────────────────────────────
// 7. Remove a member from a project (admin only)
router.delete('/:projectId/members/:userId', requireProjectAdmin, (req, res) => {
  const { projectId, userId } = req.params;

  // Prevent removing the last admin? Optional, we'll just remove
  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?')
    .run(projectId, userId);
  res.json({ message: 'Member removed' });
});

module.exports = router;