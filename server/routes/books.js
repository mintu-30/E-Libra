const express     = require('express');
const multer      = require('multer');
const pool        = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();

// ── Multer: store PDF in memory (max 50 MB) ────────────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf') {
      return cb(new Error('Only PDF files are allowed.'));
    }
    cb(null, true);
  },
});

// All book routes require a valid JWT
router.use(requireAuth);

// ── GET /api/books ─────────────────────────────────────────────────────────
// Returns all books belonging to the authenticated user (no PDF binary).
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, author, genre, year, rating, description,
              color, pdf_filename, pdf_size, created_at
       FROM books
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('GET /api/books error:', err);
    return res.status(500).json({ error: 'Failed to fetch books.' });
  }
});

// ── Multer upload wrapper (compatible with multer v2) ──────────────────────
function handleUpload(req, res, next) {
  upload.single('pdf')(req, res, (err) => {
    if (err) {
      // multer v2 passes MulterError or generic Error here
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'PDF is too large. Maximum size is 50 MB.' });
      }
      if (err.message === 'Only PDF files are allowed.') {
        return res.status(400).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message || 'Upload failed.' });
    }
    next();
  });
}

// ── POST /api/books ────────────────────────────────────────────────────────
// Accepts multipart/form-data with a "pdf" file field + metadata fields.
router.post('/', handleUpload, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'A PDF file is required.' });
  }

  const { title, author, genre, year, rating, description, color } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Book title is required.' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO books
         (user_id, title, author, genre, year, rating, description,
          color, pdf_filename, pdf_size, pdf_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, title, author, genre, year, rating, description,
                 color, pdf_filename, pdf_size, created_at`,
      [
        req.user.id,
        title.trim(),
        (author || 'Unknown Author').trim(),
        (genre  || 'Uncategorised').trim(),
        year ? parseInt(year) : null,
        rating ? parseFloat(rating) : 4.0,
        (description || '').trim(),
        color || '#6C63FF',
        req.file.originalname,
        req.file.size,
        req.file.buffer,   // raw PDF bytes → BYTEA
      ]
    );

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /api/books error:', err);
    return res.status(500).json({ error: 'Failed to save book.' });
  }
});

// ── PUT /api/books/:id ─────────────────────────────────────────────────────
// Update metadata only (no PDF re-upload). User must own the book.
router.put('/:id', async (req, res) => {
  const bookId = parseInt(req.params.id);
  if (isNaN(bookId)) return res.status(400).json({ error: 'Invalid book ID.' });

  const { title, author, genre, year, rating, description, color } = req.body;

  try {
    // Verify ownership
    const own = await pool.query(
      'SELECT id FROM books WHERE id = $1 AND user_id = $2',
      [bookId, req.user.id]
    );
    if (own.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found.' });
    }

    const result = await pool.query(
      `UPDATE books
       SET title       = COALESCE(NULLIF($1,''), title),
           author      = COALESCE(NULLIF($2,''), author),
           genre       = COALESCE(NULLIF($3,''), genre),
           year        = COALESCE($4, year),
           rating      = COALESCE($5, rating),
           description = COALESCE($6, description),
           color       = COALESCE(NULLIF($7,''), color)
       WHERE id = $8 AND user_id = $9
       RETURNING id, title, author, genre, year, rating, description,
                 color, pdf_filename, pdf_size, created_at`,
      [
        title       || '',
        author      || '',
        genre       || '',
        year        ? parseInt(year)     : null,
        rating      ? parseFloat(rating) : null,
        description !== undefined ? description.trim() : null,
        color       || '',
        bookId,
        req.user.id,
      ]
    );

    return res.json(result.rows[0]);
  } catch (err) {
    console.error('PUT /api/books/:id error:', err);
    return res.status(500).json({ error: 'Failed to update book.' });
  }
});

// ── DELETE /api/books/:id ──────────────────────────────────────────────────
// Deletes the book + its PDF. User must own the book.
router.delete('/:id', async (req, res) => {
  const bookId = parseInt(req.params.id);
  if (isNaN(bookId)) return res.status(400).json({ error: 'Invalid book ID.' });

  try {
    const result = await pool.query(
      'DELETE FROM books WHERE id = $1 AND user_id = $2 RETURNING id, title',
      [bookId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found.' });
    }
    return res.json({ message: `"${result.rows[0].title}" deleted.` });
  } catch (err) {
    console.error('DELETE /api/books/:id error:', err);
    return res.status(500).json({ error: 'Failed to delete book.' });
  }
});

// ── GET /api/books/:id/pdf ─────────────────────────────────────────────────
// Streams the PDF binary back to the client. User must own the book.
router.get('/:id/pdf', async (req, res) => {
  const bookId = parseInt(req.params.id);
  if (isNaN(bookId)) return res.status(400).json({ error: 'Invalid book ID.' });

  try {
    const result = await pool.query(
      'SELECT pdf_filename, pdf_data FROM books WHERE id = $1 AND user_id = $2',
      [bookId, req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Book not found.' });
    }

    const { pdf_filename, pdf_data } = result.rows[0];
    if (!pdf_data) {
      return res.status(404).json({ error: 'No PDF stored for this book.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(pdf_filename || 'book.pdf')}"`
    );
    res.setHeader('Content-Length', pdf_data.length);
    return res.send(pdf_data);
  } catch (err) {
    console.error('GET /api/books/:id/pdf error:', err);
    return res.status(500).json({ error: 'Failed to retrieve PDF.' });
  }
});

// ── Multer error handler ───────────────────────────────────────────────────
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'PDF is too large. Maximum size is 50 MB.' });
  }
  if (err.message === 'Only PDF files are allowed.') {
    return res.status(400).json({ error: err.message });
  }
  console.error('Books router error:', err);
  return res.status(500).json({ error: 'An unexpected error occurred.' });
});

module.exports = router;
