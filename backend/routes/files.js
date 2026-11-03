const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const AdmZip = require('adm-zip');
const XLSX = require('xlsx');

const db = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Files are saved in Backend/uploads (created automatically)
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

  const ALLOWED = [
  '.pdf', '.docx', '.pptx', '.xlsx', '.xls',
  '.txt', '.md', '.csv', '.json',
  '.png', '.jpg', '.jpeg', '.gif', '.webp',
];  

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) =>
      cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED.includes(ext)) {
      return cb(new Error('Allowed files: PDF, DOCX, PPTX, XLSX, XLS, TXT, MD, CSV, JSON, PNG, JPG. Please save old .ppt/.doc files as .pptx/.docx.'));
    }
    cb(null, true);
  },
});

// PPTX: read text from each slide's XML
function extractPptx(filePath) {
  const zip = new AdmZip(filePath);
  const num = (name) => parseInt(name.match(/slide(\d+)\.xml$/)[1], 10);
  const decode = (s) => s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

  return zip.getEntries()
    .filter(e => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => num(a.entryName) - num(b.entryName))
    .map(e => {
      const xml = e.getData().toString('utf8');
      return [...xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)]
        .map(m => decode(m[1])).join(' ');
    })
    .join('\n\n');
}

// PDF fallback when pdf-parse fails
async function extractPdfFallback(filePath) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const data = new Uint8Array(fs.readFileSync(filePath));
  const doc = await pdfjs.getDocument({ data }).promise;
  let out = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out += content.items.map(it => it.str).join(' ') + '\n';
  }
  return out;
}

// Reads the text inside a file so it can be searched and shown
async function extractText(filePath, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  try {
    let text = null;
    if (ext === '.pdf') {
      try {
        text = (await pdfParse(fs.readFileSync(filePath))).text;
      } catch (e) {
        console.error('pdf-parse failed, trying fallback:', e.message);
        text = await extractPdfFallback(filePath);
      }
    } else if (ext === '.docx') {
      text = (await mammoth.extractRawText({ path: filePath })).value;
    } else if (ext === '.pptx') {
      text = extractPptx(filePath);
} else if (['.txt', '.md', '.csv', '.json'].includes(ext)) {
  text = fs.readFileSync(filePath, 'utf8');
} else if (ext === '.xlsx' || ext === '.xls') {
  const wb = XLSX.readFile(filePath);
  text = wb.SheetNames
    .map(name => name + '\n' + XLSX.utils.sheet_to_csv(wb.Sheets[name]))
    .join('\n\n');
}    
    if (!text) return null;
    // Postgres rejects null characters, so remove them; cap the length
    return text.replace(/\u0000/g, '').trim().slice(0, 500000) || null;
  } catch (err) {
    console.error('Text extraction failed:', err.message);
    return null;
  }
}
// POST /api/files   (form-data: file, optional subject_id)
router.post('/', (req, res) => {
  upload.single('file')(req, res, async (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    try {
      let subjectId = req.body.subject_id || null;
      if (subjectId) {
        const own = await db.query(
          'select 1 from subjects where subject_id = $1 and user_id = $2',
          [subjectId, req.user.id]
        );
        if (own.rowCount === 0) subjectId = null;
      }

      const text = await extractText(req.file.path, req.file.originalname);

      const { rows } = await db.query(
        `insert into note_files
           (user_id, subject_id, original_name, stored_name, mime_type, size_bytes, extracted_text)
         values ($1, $2, $3, $4, $5, $6, $7)
         returning file_id, subject_id, original_name, mime_type, size_bytes, created_at,
                   (extracted_text is not null) as has_text`,
        [
          req.user.id,
          subjectId,
          req.file.originalname,
          req.file.filename,
          req.file.mimetype,
          req.file.size,
          text,
        ]
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Server error' });
    }
  });
});

// GET /api/files?subject_id=1&q=search
router.get('/', async (req, res) => {
  try {
    const { subject_id, q } = req.query;
    const params = [req.user.id];
    let sql = `select file_id, subject_id, original_name, mime_type, size_bytes, created_at,
                      (extracted_text is not null) as has_text
               from note_files where user_id = $1`;
    if (subject_id) {
      params.push(subject_id);
      sql += ` and subject_id = $${params.length}`;
    }
    if (q) {
      params.push(q);
      sql += ` and to_tsvector('english', coalesce(extracted_text, '') || ' ' || original_name)
                   @@ plainto_tsquery('english', $${params.length})`;
    }
    sql += ' order by created_at desc';
    const { rows } = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/files/:id/text  -> the extracted text
router.get('/:id/text', async (req, res) => {
  const { rows } = await db.query(
    'select original_name, extracted_text from note_files where file_id = $1 and user_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'File not found' });
  res.json({ name: rows[0].original_name, text: rows[0].extracted_text });
});

// GET /api/files/:id/content  -> the file itself (only its owner can open it)
router.get('/:id/content', async (req, res) => {
  const { rows } = await db.query(
    'select stored_name, mime_type from note_files where file_id = $1 and user_id = $2',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'File not found' });
  res.sendFile(path.join(UPLOAD_DIR, rows[0].stored_name), {
    headers: {
      'Content-Type': rows[0].mime_type || 'application/octet-stream',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

// DELETE /api/files/:id
router.delete('/:id', async (req, res) => {
  const { rows } = await db.query(
    'delete from note_files where file_id = $1 and user_id = $2 returning stored_name',
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'File not found' });
  fs.promises.unlink(path.join(UPLOAD_DIR, rows[0].stored_name)).catch(() => {});
  res.status(204).end();
});

module.exports = router;