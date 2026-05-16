const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');

// All task routes require a valid JWT
router.use(authenticateToken);

// ────────────────────────────────────────
// Helper: check if user is a member of the project
function isProjectMember(projectId, userId) {
  const member = db.prepare(
    'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?'
  ).get(projectId, userId);
  return !!member;
}

// ────────────────────────────────────────
// 1. Create a new task inside a project
//    Only project members can create tasks
router.post('/', (req, res) => {
  const { projectId, title, description, assignedTo, dueDate } = req.body;
  const userId = req.user.id;

  if (!projectId || !title) {
    return res.status(400).json({ error: 'Project ID and title are required' });
  }

  // Check project membership
  if (!isProjectMember(projectId, userId)) {
    return res.status(403).json({ error: 'You are not a member of this project' });
  }

  // If assigning to someone, they must also be a project member
  if (assignedTo && !isProjectMember(projectId, assignedTo)) {
    return res.status(400).json({ error: 'Assigned user is not a member of this project' });
  }

  const stmt = db.prepare(`
    INSERT INTO tasks (project_id, title, description, status, assigned_to, created_by, due_date)
    VALUES (?, ?, ?, 'todo', ?, ?, ?)
  `);
  const result = stmt.run(projectId, title, description || '', assignedTo || null, userId, dueDate || null);

  res.status(201).json({ message: 'Task created', taskId: result.lastInsertRowid });
});

// ────────────────────────────────────────
// 2. Get all tasks for a project (only project members)
router.get('/project/:projectId', (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;

  if (!isProjectMember(projectId, userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Get tasks with assignee name
  const tasks = db.prepare(`
    SELECT t.*, u.name AS assignee_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.project_id = ?
    ORDER BY t.due_date ASC, t.created_at DESC
  `).all(projectId);

  res.json({ tasks });
});

// ────────────────────────────────────────
// 3. Get tasks assigned to the current user (across all projects)
router.get('/my', (req, res) => {
  const userId = req.user.id;
  const tasks = db.prepare(`
    SELECT t.*, p.name AS project_name, u.name AS assignee_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.assigned_to = ?
    ORDER BY t.due_date ASC
  `).all(userId);
  res.json({ tasks });
});

// ────────────────────────────────────────
// 4. Get a single task (only if member of its project)
router.get('/:taskId', (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.id;

  const task = db.prepare(`
    SELECT t.*, p.name AS project_name, u.name AS assignee_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.id = ?
  `).get(taskId);

  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  if (!isProjectMember(task.project_id, userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({ task });
});

// ────────────────────────────────────────
// 5. Update task (status, assignment, title, description, due date)
//    Only project members can update (admin can restrict later)
router.put('/:taskId', (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.id;
  const { title, description, status, assignedTo, dueDate } = req.body;

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (!isProjectMember(task.project_id, userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Validate status if provided
  if (status && !['todo', 'in-progress', 'done'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status. Allowed: todo, in-progress, done' });
  }
  // Validate assigned user if provided
  if (assignedTo && !isProjectMember(task.project_id, assignedTo)) {
    return res.status(400).json({ error: 'Assigned user is not a member of this project' });
  }

  const fields = [];
  const values = [];
  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (status) { fields.push('status = ?'); values.push(status); }
  if (assignedTo !== undefined) { fields.push('assigned_to = ?'); values.push(assignedTo); }
  if (dueDate !== undefined) { fields.push('due_date = ?'); values.push(dueDate); }
  fields.push('updated_at = CURRENT_TIMESTAMP');

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(taskId);
  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);

  res.json({ message: 'Task updated' });
});

// ────────────────────────────────────────
// 6. Delete task (any project member can delete for now)
router.delete('/:taskId', (req, res) => {
  const { taskId } = req.params;
  const userId = req.user.id;

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (!isProjectMember(task.project_id, userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(taskId);
  res.json({ message: 'Task deleted' });
});

// ────────────────────────────────────────
// 7. Get overdue tasks for a project (member only)
router.get('/project/:projectId/overdue', (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.id;

  if (!isProjectMember(projectId, userId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const overdue = db.prepare(`
    SELECT t.*, u.name AS assignee_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    WHERE t.project_id = ? AND t.status != 'done' AND t.due_date < date('now')
    ORDER BY t.due_date ASC
  `).all(projectId);

  res.json({ overdue });
});

module.exports = router;