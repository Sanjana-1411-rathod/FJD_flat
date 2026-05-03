const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'authentijob_secret_key_2024';

// POST /api/auth/signup
router.post('/signup', (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields are required' });

  // Check if email already exists
  db.get('SELECT id FROM users WHERE email = ?', [email], (err, row) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (row) return res.status(400).json({ error: 'Email already registered' });

    // Hash password and insert
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run(
      'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
      [name, email, hashedPassword, 'user'],
      function (err) {
        if (err) return res.status(500).json({ error: 'Failed to create user' });

        const userData = { id: this.lastID, name, email, role: 'user' };
        const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '7d' });
        res.status(201).json({ user: userData, token });
      }
    );
  });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: 'Email and password are required' });

  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) return res.status(401).json({ error: 'Invalid email or password' });

    const userData = { id: user.id, name: user.name, email: user.email, role: user.role };
    const token = jwt.sign(userData, JWT_SECRET, { expiresIn: '7d' });
    res.json({ user: userData, token });
  });
});

// GET /api/auth/me  (verify token)
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ user: decoded });
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
