require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');

const app = express();
app.use(cors());
app.use(express.json());

// Health check: confirms the server AND the Neon connection work
app.get('/api/health', async (req, res) => {
  try {
    const { rows } = await db.query('select now() as time');
    res.json({ status: 'ok', db_time: rows[0].time });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/notes', require('./routes/notes'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/focus', require('./routes/focus'));
app.use('/api/subjects', require('./routes/subjects'));
app.use('/api/files', require('./routes/files'));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));