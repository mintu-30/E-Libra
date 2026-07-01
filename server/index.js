require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const path    = require('path');

// Import routes
const authRouter  = require('./routes/auth');
const booksRouter = require('./routes/books');

const app  = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ────────────────────────────────────────────────────────────
app.use(cors({
  origin: [`http://localhost:${PORT}`, 'http://127.0.0.1:' + PORT],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── API Routes ─────────────────────────────────────────────────────────────
app.use('/api/auth',  authRouter);
app.use('/api/books', booksRouter);

// ── Health check ───────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', ts: new Date() }));

// ── Serve frontend static files ────────────────────────────────────────────
// The server sits in /server, the frontend root is one level up
const frontendRoot = path.join(__dirname, '..');
app.use(express.static(frontendRoot));

// All non-API routes → serve index.html (SPA fallback)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found.' });
  }
  res.sendFile(path.join(frontendRoot, 'index.html'));
});

// ── Global error handler ───────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error.' });
});

// ── Start ──────────────────────────────────────────────────────────────────
// db.js verifies the connection on require — if it fails the process exits.
require('./db');

app.listen(PORT, () => {
  console.log(`\n🚀  E-Libra server running at http://localhost:${PORT}`);
  console.log(`   API health: http://localhost:${PORT}/api/health\n`);
});
