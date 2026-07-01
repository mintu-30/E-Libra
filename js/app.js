// ─── Config ──────────────────────────────────────────────────────────────────
const API = '/api';   // same origin — no CORS needed

// ─── State ───────────────────────────────────────────────────────────────────
const STATE = {
  currentUser:    null,   // { id, username, displayName }
  token:          null,   // JWT string
  books:          [],
  filteredBooks:  [],
  activeGenre:    'All',
  editingBookId:  null,
  pendingPdfFile: null,   // File object while on metadata step
  activeBlobUrl:  null,   // Blob URL for current reader session
  popularBooks:   [],     // Books loaded from public/books/books.json
};

// ─── DOM Refs ─────────────────────────────────────────────────────────────────
const authScreen     = document.getElementById('auth-screen');
const appEl          = document.getElementById('app');
const loginForm      = document.getElementById('login-form');
const registerForm   = document.getElementById('register-form');
const loginTab       = document.getElementById('login-tab');
const registerTab    = document.getElementById('register-tab');
const loginError     = document.getElementById('login-error');
const registerError  = document.getElementById('register-error');
const booksGrid      = document.getElementById('books-grid');
const searchInput    = document.getElementById('search-input');
const genreFilters   = document.getElementById('genre-filters');
const navUsernameEl  = document.getElementById('nav-username');
const navAvatarEl    = document.getElementById('nav-avatar');
const bookModal      = document.getElementById('book-modal');
const bookFormModal  = document.getElementById('book-form-modal');
const readerModal    = document.getElementById('reader-modal');
const toastContainer = document.getElementById('toast-container');

// Upload modal sub-steps
const uploadStep    = document.getElementById('upload-step');
const metadataStep  = document.getElementById('metadata-step');
const editStep      = document.getElementById('edit-step');
const dropZone      = document.getElementById('pdf-drop-zone');
const fileInput     = document.getElementById('pdf-file-input');
const progressWrap  = document.getElementById('upload-progress-wrap');
const progressFill  = document.getElementById('upload-progress-fill');
const uploadPct     = document.getElementById('upload-pct');
const uploadFilename= document.getElementById('upload-filename');
const sizeWarning   = document.getElementById('size-warning');

// ─── Utilities ────────────────────────────────────────────────────────────────
function toast(msg, type = 'info', duration = 3500) {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  toastContainer.appendChild(el);
  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

function getInitials(name) {
  return (name || '?').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / (1024 * 1024)).toFixed(2) + ' MB';
}

function titleFromFilename(filename) {
  return filename
    .replace(/\.pdf$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

// Normalise a book coming from the API — IDs are always strings for safe comparison
function normaliseBook(b) {
  return { ...b, id: String(b.id) };
}

// ─── API Helpers ──────────────────────────────────────────────────────────────
function authHeaders(extra = {}) {
  return { 'Authorization': `Bearer ${STATE.token}`, ...extra };
}

/**
 * Wrapper around fetch for API calls.
 * isJson=true  → sends/receives JSON
 * isJson=false → sends FormData (don't set Content-Type, browser sets boundary)
 * Throws a plain Error with a human-readable message on network failure.
 */
async function apiRequest(method, path, body = null, isJson = true) {
  const opts = {
    method,
    headers: isJson
      ? authHeaders({ 'Content-Type': 'application/json' })
      : authHeaders(),
  };
  if (body !== null) {
    opts.body = isJson ? JSON.stringify(body) : body; // body is FormData when !isJson
  }

  try {
    return await fetch(`${API}${path}`, opts);
  } catch (networkErr) {
    throw new Error('Cannot connect to the server. Make sure it is running on port 3001.');
  }
}

// ─── Auth Logic ───────────────────────────────────────────────────────────────
function switchAuthTab(tab) {
  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginError.classList.add('hidden');
  } else {
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerError.classList.add('hidden');
  }
}

loginTab.addEventListener('click',    () => switchAuthTab('login'));
registerTab.addEventListener('click', () => switchAuthTab('register'));

document.querySelectorAll('.toggle-password').forEach(btn => {
  btn.addEventListener('click', () => {
    const inp = btn.previousElementSibling;
    inp.type = inp.type === 'password' ? 'text' : 'password';
    btn.textContent = inp.type === 'password' ? '👁️' : '🙈';
  });
});

// ── Login ─────────────────────────────────────────────────────────────────────
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username  = document.getElementById('login-username').value.trim();
  const password  = document.getElementById('login-password').value;
  const submitBtn = loginForm.querySelector('.form-submit');

  loginError.classList.add('hidden');
  submitBtn.disabled    = true;
  submitBtn.textContent = 'Signing in…';

  try {
    const res  = await fetch(`${API}/auth/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      loginError.classList.remove('hidden');
      document.getElementById('login-error-msg').textContent =
        data.error || 'Invalid username or password.';
      return;
    }

    persistSession(data.token, data.user);
    loginForm.reset();
    enterApp(data.user);
  } catch {
    loginError.classList.remove('hidden');
    document.getElementById('login-error-msg').textContent =
      'Cannot connect to the server. Make sure it is running on port 3001.';
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Sign In to E-Libra';
  }
});

// ── Register ──────────────────────────────────────────────────────────────────
registerForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const displayName = document.getElementById('reg-name').value.trim();
  const username    = document.getElementById('reg-username').value.trim();
  const password    = document.getElementById('reg-password').value;
  const confirm     = document.getElementById('reg-confirm').value;
  const submitBtn   = registerForm.querySelector('.form-submit');

  registerError.classList.add('hidden');

  if (password !== confirm) {
    registerError.classList.remove('hidden');
    document.getElementById('register-error-msg').textContent = 'Passwords do not match!';
    return;
  }

  submitBtn.disabled    = true;
  submitBtn.textContent = 'Creating account…';

  try {
    const res  = await fetch(`${API}/auth/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ username, displayName, password }),
    });
    const data = await res.json();

    if (!res.ok) {
      registerError.classList.remove('hidden');
      document.getElementById('register-error-msg').textContent =
        data.error || 'Registration failed.';
      return;
    }

    persistSession(data.token, data.user);
    registerForm.reset();
    toast('Account created! Welcome to E-Libra 🎉', 'success');
    enterApp(data.user);
  } catch {
    registerError.classList.remove('hidden');
    document.getElementById('register-error-msg').textContent =
      'Cannot connect to the server. Make sure it is running on port 3001.';
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Create Account';
  }
});

// ── Session ───────────────────────────────────────────────────────────────────
function persistSession(token, user) {
  STATE.token       = token;
  STATE.currentUser = user;
  localStorage.setItem('elib_token', token);
  localStorage.setItem('elib_user',  JSON.stringify(user));
}

function clearSession() {
  STATE.token       = null;
  STATE.currentUser = null;
  localStorage.removeItem('elib_token');
  localStorage.removeItem('elib_user');
}

function enterApp(user, skipAnimation = false) {
  navUsernameEl.textContent = user.displayName || user.username;
  navAvatarEl.textContent   = getInitials(user.displayName || user.username);

  if (skipAnimation) {
    authScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    loadBooks();
    loadPopularBooks();
    return;
  }

  authScreen.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  authScreen.style.opacity    = '0';
  authScreen.style.transform  = 'scale(0.95)';
  setTimeout(() => {
    authScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    loadBooks();
    loadPopularBooks();
  }, 500);
}

function logout() {
  clearSession();
  STATE.books         = [];
  STATE.filteredBooks = [];
  STATE.activeGenre   = 'All';
  if (STATE.activeBlobUrl) { URL.revokeObjectURL(STATE.activeBlobUrl); STATE.activeBlobUrl = null; }
  appEl.classList.add('hidden');
  authScreen.classList.remove('hidden');
  authScreen.style.opacity   = '1';
  authScreen.style.transform = 'scale(1)';
  booksGrid.innerHTML = '';
  switchAuthTab('login');
  loginForm.reset();
  toast('Logged out successfully', 'info');
}

document.getElementById('logout-btn').addEventListener('click', logout);

// ─── Books: Load & Render ─────────────────────────────────────────────────────
async function loadBooks() {
  booksGrid.innerHTML = `
    <div class="empty-state">
      <span class="empty-icon">⏳</span>
      <p>Loading your library…</p>
    </div>`;

  try {
    const res = await apiRequest('GET', '/books');

    if (res.status === 401) {
      toast('Session expired. Please log in again.', 'error');
      logout();
      return;
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast(err.error || 'Failed to load books.', 'error');
      booksGrid.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">⚠️</span>
          <p>Could not load books. Please refresh.</p>
        </div>`;
      return;
    }

    const books  = await res.json();
    STATE.books  = books.map(normaliseBook);
    applyFilters();
    renderGenreFilters();
    updateStats();
  } catch (err) {
    toast(err.message, 'error');
    booksGrid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">🔌</span>
        <p>Server not reachable. Start the server then refresh.</p>
      </div>`;
  }
}

const popBooksHeader = document.getElementById('popular-books-header');
const popBooksGrid = document.getElementById('popular-books-grid');
const popBooksToggle = document.getElementById('popular-books-toggle');
if (popBooksHeader && popBooksGrid && popBooksToggle) {
  popBooksHeader.addEventListener('click', () => {
    popBooksGrid.classList.toggle('hidden');
    const isHidden = popBooksGrid.classList.contains('hidden');
    popBooksToggle.textContent = isHidden ? '▶' : '▼';
    popBooksHeader.setAttribute('aria-expanded', !isHidden);
  });
}

async function loadPopularBooks() {
  const grid = document.getElementById('popular-books-grid');
  try {
    const res = await fetch('/public/books/books.json');
    if (!res.ok) return;
    STATE.popularBooks = await res.json();
    renderBooks(STATE.popularBooks, grid, 'No popular books available.');
  } catch (e) {
    console.error('Failed to load popular books:', e);
  }
}

function updateStats() {
  const totalBooksEl = document.getElementById('total-books');
  if (totalBooksEl) totalBooksEl.textContent = STATE.books.length;
  const genresCount = document.getElementById('total-genres');
  if (genresCount) genresCount.textContent = new Set(STATE.books.map(b => b.genre)).size;
}

// ─── Book Rendering ────────────────────────────────────────────────────────────
function getBookEmoji(genre = '') {
  const map = {
    'Classic Fiction': '📖', 'Romance': '💕', 'Social Drama': '🏛️',
    'Dystopian Fiction': '🌑', 'Epic Poetry': '⚚', 'Gothic Horror': '🕯️',
    'Science Fiction': '🚀', 'Mystery': '🔍', 'Fantasy': '🧙',
    'Biography': '👤', 'History': '📜', 'Self Help': '🌟',
    'Adventure': '⛵', 'Academic': '🎓',
    'Historical Fiction': '🏰', 'Psychological Fiction': '🧠',
    'Python': '🐍', 'Java': '☕', 'JavaScript': '⚡',
    'Rust': '⚙️', 'Go': '🐹', 'C Programming': '🔧',
    'DevOps': '🛠️', 'Data Science': '📊', 'Computer Science': '💻',
  };
  return map[genre] || '📚';
}

const COVER_COLORS = [
  'linear-gradient(135deg, #6C63FF, #FF6B9D)',
  'linear-gradient(135deg, #00BFA6, #6C63FF)',
  'linear-gradient(135deg, #FF8C42, #FDCB6E)',
  'linear-gradient(135deg, #A855F7, #6C63FF)',
  'linear-gradient(135deg, #FF6B9D, #FF8C42)',
  'linear-gradient(135deg, #00BFA6, #FDCB6E)',
];

function renderBooks(books, targetGrid = booksGrid, emptyMessage = 'No books yet. Click "Upload PDF" to add your first book!') {
  targetGrid.innerHTML = '';
  if (!books.length) {
    targetGrid.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📭</span>
        <p>${emptyMessage}</p>
      </div>`;
    return;
  }

  books.forEach((book, idx) => {
    const card = document.createElement('div');
    card.className = 'book-card';
    card.setAttribute('data-id', book.id);
    card.setAttribute('role', 'listitem');

    const colorStyle = book.color
      ? `background: linear-gradient(135deg, ${book.color}aa, ${book.color}44);`
      : COVER_COLORS[idx % COVER_COLORS.length].replace('linear-gradient', 'background: linear-gradient');

    const hasPdf = !!book.pdf_filename || !!book.file;
    const pdfTag = hasPdf ? `<span class="book-pdf-tag">📄 PDF</span>` : '';
    const isPreload = String(book.id).startsWith('preload-');

    const actionsHtml = isPreload ? `
      <div class="book-quick-actions">
        <button class="quick-action-btn qab-read" data-id="${book.id}" title="Read">📖</button>
      </div>
    ` : `
      <div class="book-quick-actions">
        <button class="quick-action-btn qab-read"   data-id="${book.id}" title="Read">📖</button>
        <button class="quick-action-btn qab-edit"   data-id="${book.id}" title="Edit">✏️</button>
        <button class="quick-action-btn qab-delete" data-id="${book.id}" title="Delete">🗑️</button>
      </div>
    `;

    // Use data-id so the id is safely passed to handlers without XSS risk
    card.innerHTML = `
      <div class="book-cover-wrapper">
        <div class="book-cover-placeholder" style="${colorStyle}">
          <span style="font-size:3rem">${getBookEmoji(book.genre)}</span>
        </div>
        <div class="book-cover-overlay"></div>
        <span class="book-genre-tag" style="color:${book.color || 'var(--clr-purple)'}">
          ${book.genre || 'Uncategorised'}
        </span>
        ${pdfTag}
        ${actionsHtml}
      </div>
      <div class="book-info">
        <div class="book-title" title="${book.title}">${book.title}</div>
        <div class="book-author">${book.author || 'Unknown Author'}</div>
        <div class="book-meta">
          <span class="book-rating">⭐ ${(Number(book.rating) || 0).toFixed(1)}</span>
          <span class="book-pages">${hasPdf ? (book.pdf_size ? formatBytes(book.pdf_size) : `${book.pages} pages`) : ''}</span>
        </div>
      </div>`;

    // Attach handlers via JS (not inline onclick) — avoids any quoting issues with titles
    card.querySelector('.qab-read').addEventListener('click', (e) => {
      e.stopPropagation(); openReader(book.id);
    });
    if (!isPreload) {
      card.querySelector('.qab-edit').addEventListener('click', (e) => {
        e.stopPropagation(); openEditBook(book.id);
      });
      card.querySelector('.qab-delete').addEventListener('click', (e) => {
        e.stopPropagation(); deleteBook(book.id);
      });
    }
    card.addEventListener('click', () => openBookDetail(book.id));

    targetGrid.appendChild(card);
  });
}

function applyFilters() {
  let filtered = [...STATE.books];
  const query  = searchInput?.value.toLowerCase() || '';
  if (query) {
    filtered = filtered.filter(b =>
      b.title?.toLowerCase().includes(query) ||
      b.author?.toLowerCase().includes(query) ||
      b.genre?.toLowerCase().includes(query)
    );
  }
  if (STATE.activeGenre !== 'All') {
    filtered = filtered.filter(b => b.genre === STATE.activeGenre);
  }
  STATE.filteredBooks = filtered;
  renderBooks(filtered);
}

function renderGenreFilters() {
  const genres = ['All', ...new Set(STATE.books.map(b => b.genre).filter(Boolean))];
  genreFilters.innerHTML = genres.map(g => `
    <button class="genre-chip ${g === STATE.activeGenre ? 'active' : ''}"
            onclick="setGenreFilter('${g}')">${g}</button>
  `).join('');
}

window.setGenreFilter = function(genre) {
  STATE.activeGenre = genre;
  applyFilters();
  renderGenreFilters();
};

searchInput?.addEventListener('input', () => applyFilters());

// ─── Book Detail Modal ─────────────────────────────────────────────────────────
function openBookDetail(id) {
  const book = STATE.books.find(b => b.id === String(id)) || STATE.popularBooks.find(b => b.id === String(id));
  if (!book) return;

  const colorStyle = book.color
    ? `background: linear-gradient(135deg, ${book.color}55, ${book.color}22);`
    : COVER_COLORS[0];

  document.getElementById('modal-cover-section').innerHTML =
    `<div class="modal-cover-placeholder" style="${colorStyle}">
       <span style="font-size:5rem">${getBookEmoji(book.genre)}</span>
     </div>
     <div class="modal-cover-gradient"></div>
     <button class="modal-close-btn" onclick="document.getElementById('book-modal').close()">✕</button>`;

  document.getElementById('modal-title').textContent  = book.title;
  document.getElementById('modal-author').textContent = `by ${book.author || 'Unknown'}`;
  document.getElementById('modal-badges').innerHTML   = `
    ${book.genre ? `<span class="modal-badge">${book.genre}</span>` : ''}
    <span class="modal-badge yellow">⭐ ${(Number(book.rating) || 0).toFixed(1)} / 5</span>
    ${book.year  ? `<span class="modal-badge">${book.year < 0 ? Math.abs(book.year) + ' BC' : book.year}</span>` : ''}
    ${book.pdf_filename || book.file
      ? `<span class="modal-badge" style="background:rgba(108,99,255,.15);color:var(--clr-purple)">📄 PDF · ${book.pdf_size ? formatBytes(book.pdf_size) : `${book.pages} pages`}</span>`
      : ''}
  `;
  document.getElementById('modal-description').textContent = book.description || 'No description available.';
  document.getElementById('modal-read-btn').onclick  = () => openReader(id);

  const isPreload = String(id).startsWith('preload-');
  document.getElementById('modal-edit-btn').style.display = isPreload ? 'none' : 'inline-flex';
  if (!isPreload) {
    document.getElementById('modal-edit-btn').onclick  = () => { bookModal.close(); openEditBook(id); };
  }

  bookModal.showModal();
  addLightDismiss(bookModal);
}

// ─── Reader Modal ──────────────────────────────────────────────────────────────
async function openReader(id) {
  const book = STATE.books.find(b => b.id === String(id)) || STATE.popularBooks.find(b => b.id === String(id));
  if (!book) return;

  if (book.file) {
    window.open(book.file, '_blank');
    return;
  }

  document.getElementById('reader-book-title').textContent = book.title;

  const iframe  = document.getElementById('reader-iframe');
  const loading = document.getElementById('reader-loading');

  // Revoke previous blob to free memory
  if (STATE.activeBlobUrl) {
    URL.revokeObjectURL(STATE.activeBlobUrl);
    STATE.activeBlobUrl = null;
  }

  loading.innerHTML     = `<div class="spinner"></div><p>Loading book…</p>`;
  loading.style.display = 'flex';
  iframe.style.display  = 'none';
  iframe.src            = 'about:blank';

  readerModal.showModal();
  addLightDismiss(readerModal);

  if (!book.pdf_filename && !book.file) {
    loading.innerHTML = `<span style="font-size:3rem">📭</span><p>No PDF available for this book.</p>`;
    return;
  }

  try {
    const res = await apiRequest('GET', `/books/${id}/pdf`, null, false);
    if (res.status === 401) { toast('Session expired. Please log in again.', 'error'); logout(); return; }
    if (!res.ok) {
      loading.innerHTML = `<span style="font-size:3rem">⚠️</span><p>Could not load PDF from server.</p>`;
      return;
    }
    const blob = await res.blob();
    const url  = URL.createObjectURL(blob);
    STATE.activeBlobUrl = url;
    iframe.src  = url;
    loading.style.display = 'none'; 
    iframe.style.display = 'block';
  } catch (err) {
    loading.innerHTML = `<span style="font-size:3rem">❌</span><p>${err.message}</p>`;
  }
}

// Expose as window function for modal-read-btn onclick wiring
window.openReader = openReader;

document.getElementById('reader-open-new').addEventListener('click', () => {
  if (STATE.activeBlobUrl) window.open(STATE.activeBlobUrl, '_blank');
});

document.getElementById('reader-close').addEventListener('click', () => {
  readerModal.close();
  document.getElementById('reader-iframe').src = 'about:blank';
  if (STATE.activeBlobUrl) {
    URL.revokeObjectURL(STATE.activeBlobUrl);
    STATE.activeBlobUrl = null;
  }
});

// ─── Upload Modal helpers ─────────────────────────────────────────────────────
function showUploadStep() {
  uploadStep.classList.remove('hidden');
  metadataStep.classList.add('hidden');
  editStep.classList.add('hidden');
  progressWrap.classList.add('hidden');
  sizeWarning.classList.add('hidden');
  progressFill.style.width  = '0%';
  uploadPct.textContent     = '0%';
  uploadFilename.textContent= 'Reading file…';
  dropZone.classList.remove('drag-over');
  fileInput.value           = '';
  STATE.pendingPdfFile      = null;
}

window.closeUploadModal = function() {
  bookFormModal.close();
  STATE.editingBookId = null;
  showUploadStep();
};

// ─── PDF Drop Zone ────────────────────────────────────────────────────────────
['dragenter', 'dragover'].forEach(evt =>
  dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); })
);
['dragleave', 'drop'].forEach(evt =>
  dropZone.addEventListener(evt, (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); })
);
dropZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handlePdfFile(file);
});
fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handlePdfFile(fileInput.files[0]);
});

// Click on drop zone → open file picker (unless clicking the hidden input directly)
dropZone.addEventListener('click', (e) => {
  if (e.target !== fileInput) fileInput.click();
});
dropZone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
});

function handlePdfFile(file) {
  if (file.type !== 'application/pdf') {
    toast('Please select a valid PDF file.', 'error');
    return;
  }
  if (file.size > 50 * 1024 * 1024) {
    toast('File exceeds the 50 MB server limit.', 'error');
    return;
  }

  sizeWarning.classList.toggle('hidden', file.size <= 20 * 1024 * 1024);
  progressWrap.classList.remove('hidden');
  uploadFilename.textContent = file.name;
  progressFill.style.width  = '0%';
  uploadPct.textContent     = '0%';

  // Animate progress bar while reading the file
  let pct   = 0;
  const timer = setInterval(() => {
    pct = Math.min(pct + 15, 90);
    progressFill.style.width = pct + '%';
    uploadPct.textContent    = pct + '%';
  }, 60);

  const reader = new FileReader();
  reader.onload = () => {
    clearInterval(timer);
    progressFill.style.width = '100%';
    uploadPct.textContent    = '100%';
    STATE.pendingPdfFile     = file;
    setTimeout(() => showMetadataStep(file), 350);
  };
  reader.onerror = () => { clearInterval(timer); toast('Failed to read the file.', 'error'); };
  reader.readAsArrayBuffer(file);
}

function showMetadataStep(file) {
  uploadStep.classList.add('hidden');
  metadataStep.classList.remove('hidden');

  document.getElementById('meta-filename').textContent   = file.name;
  document.getElementById('meta-filesize').textContent   = formatBytes(file.size);
  document.getElementById('form-title').value            = titleFromFilename(file.name);
  document.getElementById('form-author').value           = '';
  document.getElementById('form-genre').value            = '';
  document.getElementById('form-year').value             = '';
  document.getElementById('form-rating').value           = '4.0';
  document.getElementById('form-color').value            = '#6C63FF';
  document.getElementById('form-description').value      = '';

  setTimeout(() => document.getElementById('form-title').focus(), 100);
}

document.getElementById('back-to-upload').addEventListener('click', () => {
  metadataStep.classList.add('hidden');
  uploadStep.classList.remove('hidden');
  progressWrap.classList.add('hidden');
  STATE.pendingPdfFile = null;
});

// ─── Open Upload Modal ────────────────────────────────────────────────────────
// Exposed as window.openAddBook so the inline onclick in HTML can call it
window.openAddBook = function openAddBook() {
  STATE.editingBookId = null;
  showUploadStep();
  bookFormModal.showModal();
  addLightDismiss(bookFormModal);
};

// Wire nav "Upload PDF" button
document.getElementById('nav-add-btn')?.addEventListener('click', window.openAddBook);

// ─── New Book Form Submit ─────────────────────────────────────────────────────
document.getElementById('book-form').addEventListener('submit', async (e) => {
  e.preventDefault();

  if (!STATE.pendingPdfFile) { toast('No PDF selected.', 'error'); return; }

  const submitBtn = e.target.querySelector('[type="submit"]');
  submitBtn.disabled    = true;
  submitBtn.textContent = '⏳ Uploading…';

  const fd = new FormData();
  fd.append('pdf',         STATE.pendingPdfFile);
  fd.append('title',       document.getElementById('form-title').value.trim()       || 'Untitled');
  fd.append('author',      document.getElementById('form-author').value.trim()      || 'Unknown Author');
  fd.append('genre',       document.getElementById('form-genre').value.trim()       || 'Uncategorised');
  fd.append('year',        document.getElementById('form-year').value               || '');
  fd.append('rating',      document.getElementById('form-rating').value             || '4.0');
  fd.append('color',       document.getElementById('form-color').value              || '#6C63FF');
  fd.append('description', document.getElementById('form-description').value.trim() || '');

  try {
    const res  = await apiRequest('POST', '/books', fd, false);
    const data = await res.json();

    if (res.status === 401) { toast('Session expired. Please log in again.', 'error'); logout(); return; }
    if (!res.ok) {
      toast(data.error || 'Upload failed.', 'error');
      return;
    }

    STATE.books.unshift(normaliseBook(data));
    applyFilters();
    renderGenreFilters();
    updateStats();
    bookFormModal.close();
    showUploadStep();
    toast(`"${data.title}" added to your library 📚`, 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = '📚 Add to Library';
  }
});

document.getElementById('cancel-form-btn').addEventListener('click', closeUploadModal);

// ─── Edit Book ─────────────────────────────────────────────────────────────────
function openEditBook(id) {
  const book = STATE.books.find(b => b.id === String(id));
  if (!book) return;
  STATE.editingBookId = String(id);

  uploadStep.classList.add('hidden');
  metadataStep.classList.add('hidden');
  editStep.classList.remove('hidden');

  document.getElementById('edit-form-id').value      = book.id;
  document.getElementById('edit-title').value        = book.title      || '';
  document.getElementById('edit-author').value       = book.author     || '';
  document.getElementById('edit-genre').value        = book.genre      || '';
  document.getElementById('edit-year').value         = book.year       || '';
  document.getElementById('edit-rating').value       = book.rating     || 4.0;
  document.getElementById('edit-color').value        = book.color      || '#6C63FF';
  document.getElementById('edit-description').value  = book.description || '';

  bookFormModal.showModal();
  addLightDismiss(bookFormModal);
}

window.openEditBook = openEditBook;

document.getElementById('edit-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id  = document.getElementById('edit-form-id').value;
  const idx = STATE.books.findIndex(b => b.id === String(id));
  if (idx === -1) return;

  const submitBtn = e.target.querySelector('[type="submit"]');
  submitBtn.disabled    = true;
  submitBtn.textContent = '⏳ Saving…';

  const payload = {
    title:       document.getElementById('edit-title').value.trim(),
    author:      document.getElementById('edit-author').value.trim(),
    genre:       document.getElementById('edit-genre').value.trim(),
    year:        document.getElementById('edit-year').value      || null,
    rating:      document.getElementById('edit-rating').value    || null,
    color:       document.getElementById('edit-color').value,
    description: document.getElementById('edit-description').value.trim(),
  };

  try {
    const res  = await apiRequest('PUT', `/books/${id}`, payload);
    const data = await res.json();

    if (res.status === 401) { toast('Session expired. Please log in again.', 'error'); logout(); return; }
    if (!res.ok) { toast(data.error || 'Update failed.', 'error'); return; }

    STATE.books[idx] = normaliseBook(data);
    applyFilters();
    renderGenreFilters();
    updateStats();
    bookFormModal.close();
    STATE.editingBookId = null;
    toast(`"${data.title}" updated!`, 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    submitBtn.disabled    = false;
    submitBtn.textContent = '💾 Save Changes';
  }
});

document.getElementById('cancel-edit-btn').addEventListener('click', closeUploadModal);

// ─── Delete Book ───────────────────────────────────────────────────────────────
async function deleteBook(id) {
  const book = STATE.books.find(b => b.id === String(id));
  if (!book) return;
  if (!confirm(`Delete "${book.title}"? This cannot be undone.`)) return;

  try {
    const res = await apiRequest('DELETE', `/books/${id}`);
    if (res.status === 401) { toast('Session expired. Please log in again.', 'error'); logout(); return; }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast(data.error || 'Delete failed.', 'error');
      return;
    }
    STATE.books = STATE.books.filter(b => b.id !== String(id));
    applyFilters();
    renderGenreFilters();
    updateStats();
    toast(`"${book.title}" deleted`, 'info');
  } catch (err) {
    toast(err.message, 'error');
  }
}

window.deleteBook = deleteBook;

// ─── Light Dismiss Fallback ────────────────────────────────────────────────────
function addLightDismiss(dialog) {
  if ('closedBy' in HTMLDialogElement.prototype) return;
  const handler = (event) => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inside = (
      rect.top  <= event.clientY && event.clientY <= rect.top  + rect.height &&
      rect.left <= event.clientX && event.clientX <= rect.left + rect.width
    );
    if (!inside) dialog.close();
  };
  dialog.addEventListener('click', handler);
  dialog.addEventListener('close', () => dialog.removeEventListener('click', handler), { once: true });
}

[bookModal, bookFormModal, readerModal].forEach(d => {
  if (d && 'closedBy' in HTMLDialogElement.prototype) d.setAttribute('closedby', 'any');
});

// ─── Init ─────────────────────────────────────────────────────────────────────
appEl.classList.add('hidden');
showUploadStep();

// Restore JWT session from localStorage
(function restoreSession() {
  const token = localStorage.getItem('elib_token');
  const user  = localStorage.getItem('elib_user');
  if (!token || !user) return;
  try {
    const u = JSON.parse(user);
    if (u?.username) {
      STATE.token       = token;
      STATE.currentUser = u;
      enterApp(u, true);   // skip animation on page reload
    }
  } catch {
    clearSession();
  }
})();

// Auth screen floating particles
(function initParticles() {
  const bg = document.querySelector('.auth-bg');
  if (!bg) return;
  for (let i = 0; i < 20; i++) {
    const p = document.createElement('div');
    const size = Math.random() * 4 + 2;
    p.style.cssText = `
      position:absolute;width:${size}px;height:${size}px;
      background:hsl(${Math.random()*60+240},80%,70%);
      border-radius:50%;top:${Math.random()*100}%;left:${Math.random()*100}%;
      opacity:${Math.random()*0.5+0.1};
      animation:float ${Math.random()*6+4}s ease-in-out infinite;
      animation-delay:${Math.random()*-6}s;
    `;
    bg.appendChild(p);
  }
})();
