const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth); // every notes route needs a logged-in user

// GET /api/notes?subject_id=1&q=search+text
router.get('/', async (req, res) => {
  try {
    const { subject_id, q } = req.query;
    const params = [req.user.id];
    let sql = 'select * from notes where user_id = $1 and is_archived = false';

    if (subject_id) {
      params.push(subject_id);
      sql += ` and subject_id = $${params.length}`;
    }
    if (q) {
      params.push(q);
      sql += ` and to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', $${params.length})`;
    }
    sql += ' order by is_pinned desc, updated_at desc';

    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/notes/:id
router.get('/:id', async (req, res) => {
  const { rows } = await db.query(
    'select * from notes where note_id = $1 and user_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Note not found' });
  res.json(rows[0]);
});

// POST /api/notes
router.post('/', async (req, res) => {
  try {
    const { title, content, subject_id } = req.body;
    const { rows } = await db.query(
      `insert into notes (user_id, title, content, subject_id)
       values ($1, coalesce($2, 'Untitled'), coalesce($3, ''), $4)
       returning *`,
      [req.user.id, title, content, subject_id || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/notes/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, content, subject_id, is_pinned, is_archived } = req.body;
    const { rows } = await db.query(
      `update notes set
         title       = coalesce($1, title),
         content     = coalesce($2, content),
         subject_id  = coalesce($3, subject_id),
         is_pinned   = coalesce($4, is_pinned),
         is_archived = coalesce($5, is_archived),
         updated_at  = now()
       where note_id = $6 and user_id = $7
       returning *`,
      [title, content, subject_id, is_pinned, is_archived, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Note not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/notes/:id
router.delete('/:id', async (req, res) => {
  const result = await db.query(
    'delete from notes where note_id = $1 and user_id = $2',
    [req.params.id, req.user.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Note not found' });
  res.status(204).end();
});

module.exports = router;