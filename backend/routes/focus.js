const express = require('express');
const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// POST /api/focus  -> save a finished (or cancelled) session
router.post('/', async (req, res) => {
  try {
    const { planned_min, actual_min, status } = req.body;
    if (!planned_min || planned_min < 1) {
      return res.status(400).json({ error: 'planned_min is required' });
    }
    const minutes = actual_min ?? planned_min;
    const finalStatus = status === 'cancelled' ? 'cancelled' : 'completed';

    const { rows } = await db.query(
      `insert into focus_sessions
         (user_id, planned_min, actual_min, status, started_at, ended_at)
       values ($1, $2, $3, $4, now() - make_interval(mins => $3::int), now())
       returning *`,
      [req.user.id, planned_min, minutes, finalStatus]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/focus/today  -> minutes focused + sessions done today
router.get('/today', async (req, res) => {
  try {
    const { rows } = await db.query(
      `select coalesce(sum(actual_min), 0)::int as minutes,
              count(*)::int as sessions
       from focus_sessions
       where user_id = $1
         and status = 'completed'
         and (started_at at time zone 'UTC' at time zone 'Asia/Manila')::date
             = (now() at time zone 'Asia/Manila')::date`,
      [req.user.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;