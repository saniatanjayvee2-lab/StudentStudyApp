const express = require('express');
const db = require('../db');

const router = express.Router();

// GET /api/dashboard/quote  -> random quote (refresh button)
router.get('/quote', async (req, res) => {
  const { rows } = await db.query(
    'select quote_id, text, author from quotes where is_active order by random() limit 1'
  );
  res.json(rows[0] || null);
});

// GET /api/dashboard/verse  -> random Bible verse (refresh button)
router.get('/verse', async (req, res) => {
  const { rows } = await db.query(
    `select verse_id, book, chapter, verse_start, verse_end, text, version
     from bible_verses where is_active order by random() limit 1`
  );
  res.json(rows[0] || null);
});

module.exports = router;