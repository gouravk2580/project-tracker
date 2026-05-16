const jwt = require('jsonwebtoken');
const JWT_SECRET = 'your_super_secret_key_change_later'; // same as in routes/auth.js

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  // Expect header: "Bearer <token>"
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.user = user; // attach the user payload (id, email, role)
    next();
  });
}

module.exports = authenticateToken;