const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '7d' });

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { username, first_name, last_name, email, password } = req.body;
    if (!username || !first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const exists = await db.query(
      'select 1 from users where email = $1 or username = $2',
      [email.toLowerCase(), username]
    );
    if (exists.rowCount > 0) {
      return res.status(409).json({ error: 'Email or username already in use' });
    }

    const hash = await bcrypt.hash(password, 10);
    const { rows } = await db.query(
      `insert into users (username, first_name, last_name, email, password_hash)
       values ($1, $2, $3, $4, $5)
       returning user_id, username, first_name, last_name, email, role`,
      [username, first_name, last_name, email.toLowerCase(), hash]
    );

    // Create default dashboard settings
    await db.query('insert into user_settings (user_id) values ($1)', [rows[0].user_id]);

    res.status(201).json({ user: rows[0], token: signToken(rows[0].user_id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { rows } = await db.query('select * from users where email = $1', [
      email.toLowerCase(),
    ]);
    const user = rows[0];
    const ok = user && (await bcrypt.compare(password, user.password_hash));
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    delete user.password_hash;
    res.json({ user, token: signToken(user.user_id) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/auth/me  (needs token)
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await db.query(
    'select user_id, username, first_name, last_name, email, role from users where user_id = $1',
    [req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
});

module.exports = router;