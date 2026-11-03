const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/subjects  -> my subjects with note counts
router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      `select s.subject_id, s.name, s.color, s.created_at,
              count(n.note_id)::int as note_count
       from subjects s
       left join notes n
         on n.subject_id = s.subject_id and n.is_archived = false
       where s.user_id = $1
       group by s.subject_id
       order by s.name`,
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/subjects
router.post('/', async (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }
    const { rows } = await db.query(
      `insert into subjects (user_id, name, color)
       values ($1, $2, coalesce($3, '#6366f1'))
       returning *`,
      [req.user.id, name.trim(), color]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'You already have a subject with that name' });
    }
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/subjects/:id  -> rename or recolor
router.put('/:id', async (req, res) => {
  try {
    const { name, color } = req.body;
    const { rows } = await db.query(
      `update subjects set
         name  = coalesce($1, name),
         color = coalesce($2, color)
       where subject_id = $3 and user_id = $4
       returning *`,
      [name, color, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Subject not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/subjects/:id  (its notes are kept, just unassigned)
router.delete('/:id', async (req, res) => {
  const result = await db.query(
    'delete from subjects where subject_id = $1 and user_id = $2',
    [req.params.id, req.user.id]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Subject not found' });
  res.status(204).end();
});

module.exports = router;