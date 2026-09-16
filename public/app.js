/* ══════════════════════════════════════════
   AniVerse — Frontend Application Logic
   ══════════════════════════════════════════ */

const API = ''; // Same origin — backend serves the API at /api/*

// ─── State ──────────────────────────────────
const state = {
  currentSection: 'trending',
  currentPage: 1,
  totalPages: 1,
  lastFetch: null,
  genres: [],
  selectedGenre: null,
};

// ─── Genre Emoji Map ─────────────────────────
const genreEmoji = {
  Action: '⚔️', Adventure: '🗺️', 'Avant Garde': '🎨', 'Award Winning': '🏆',
  Comedy: '😂', Drama: '🎭', Fantasy: '🐉', Horror: '👻',
  Mystery: '🔍', Romance: '❤️', 'Sci-Fi': '🚀', 'Slice of Life': '☕',
  Sports: '⚽', Supernatural: '🌙', Suspense: '😱', Ecchi: '🌸',
  Gourmet: '🍜', Music: '🎵', Boys_Love: '💙', Girls_Love: '💜',
  Hentai: '🔞', Kids: '🧒', Parody: '🎪', School: '🏫', Military: '🎖️',
  'Psychological': '🧠', 'Racing': '🏎️', 'Magic': '✨', 'Mecha': '🤖',
  'Historical': '📜', 'Space': '🪐', 'Vampire': '🧛', 'Martial Arts': '🥋',
};

// ─── DOM References ──────────────────────────
const animeGrid   = document.getElementById('animeGrid');
const loading     = document.getElementById('loading');
const errorState  = document.getElementById('errorState');
const errorMsg    = document.getElementById('errorMsg');
const pagination  = document.getElementById('pagination');
const sectionTitle = document.getElementById('sectionTitle');
const genresSection = document.getElementById('genresSection');
const mainContent  = document.getElementById('mainContent');
const modalOverlay = document.getElementById('modalOverlay');
const modalInner   = document.getElementById('modalInner');
const modalClose   = document.getElementById('modalClose');
const searchInput  = document.getElementById('searchInput');
const searchBtn    = document.getElementById('searchBtn');
const searchSuggestions = document.getElementById('searchSuggestions');
const navbar       = document.getElementById('navbar');
const hamburger    = document.getElementById('hamburger');
const mobileMenu   = document.getElementById('mobileMenu');
const toast        = document.getElementById('toast');

// ─── Navbar scroll effect ────────────────────
window.addEventListener('scroll', () => {
  navbar.classList.toggle('scrolled', window.scrollY > 60);
});

// ─── Hamburger toggle ────────────────────────
hamburger.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
});

// ─── Nav link clicks ─────────────────────────
document.querySelectorAll('.nav-link[data-section]').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    showSection(link.dataset.section);
    mobileMenu.classList.remove('open');
  });
});

// ─── Modal close ─────────────────────────────
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => {
  if (e.target === modalOverlay) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// ─── Search ──────────────────────────────────
let searchTimeout;
searchInput.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const q = searchInput.value.trim();
  if (q.length < 2) {
    searchSuggestions.innerHTML = '';
    searchSuggestions.classList.remove('show');
    return;
  }
  searchTimeout = setTimeout(() => fetchSuggestions(q), 400);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const q = searchInput.value.trim();
    if (q) performSearch(q);
    searchSuggestions.classList.remove('show');
  }
});

searchBtn.addEventListener('click', () => {
  const q = searchInput.value.trim();
  if (q) performSearch(q);
  searchSuggestions.classList.remove('show');
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) {
    searchSuggestions.classList.remove('show');
  }
});

async function fetchSuggestions(q) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    const items = (data.data || []).slice(0, 6);
    searchSuggestions.innerHTML = items.map(a => `
      <li onclick="openDetail(${a.mal_id})">
        <img src="${a.images?.jpg?.small_image_url || ''}" alt="" />
        <span>${a.title}</span>
      </li>
    `).join('');
    searchSuggestions.classList.toggle('show', items.length > 0);
  } catch {
    searchSuggestions.classList.remove('show');
  }
}

function performSearch(q) {
  state.currentSection = 'search';
  state.currentPage = 1;
  sectionTitle.textContent = `🔍 Results for "${q}"`;
  setActiveNav(null);
  mainContent.style.display = 'block';
  genresSection.style.display = 'none';
  fetchAndRender(`/api/search?q=${encodeURIComponent(q)}&page=${state.currentPage}`, false);
  mainContent.scrollIntoView({ behavior: 'smooth' });
}

// ─── Section Routing ─────────────────────────
const sectionConfig = {
  trending: {
    title: '🔥 Trending Now',
    endpoint: () => `/api/trending?page=${state.currentPage}`,
    paginated: true,
  },
  top: {
    title: '🏆 All-Time Top Anime',
    endpoint: () => `/api/top?page=${state.currentPage}`,
    paginated: true,
  },
  seasonal: {
    title: '🌸 This Season',
    endpoint: () => `/api/seasonal`,
    paginated: false,
  },
  upcoming: {
    title: '🚀 Upcoming Anime',
    endpoint: () => `/api/upcoming`,
    paginated: false,
  },
};

function showSection(section) {
  searchInput.value = '';
  searchSuggestions.classList.remove('show');
  state.currentSection = section;
  state.currentPage = 1;

  if (section === 'genres') {
    mainContent.style.display = 'none';
    genresSection.style.display = 'block';
    loadGenres();
    genresSection.scrollIntoView({ behavior: 'smooth' });
  } else {
    mainContent.style.display = 'block';
    genresSection.style.display = 'none';
    const cfg = sectionConfig[section];
    sectionTitle.textContent = cfg.title;
    setActiveNav(section);
    fetchAndRender(cfg.endpoint(), cfg.paginated);
    mainContent.scrollIntoView({ behavior: 'smooth' });
  }
}

function setActiveNav(section) {
  document.querySelectorAll('.nav-link[data-section]').forEach(l => {
    l.classList.toggle('active', l.dataset.section === section);
  });
}

// ─── Fetch & Render ──────────────────────────
let retryUrl = '';
let retryPaginated = false;

async function fetchAndRender(url, paginated = true) {
  retryUrl = url;
  retryPaginated = paginated;

  setLoading(true);
  animeGrid.innerHTML = '';
  pagination.innerHTML = '';
  errorState.style.display = 'none';

  // Show skeleton
  showSkeletons(12);

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const items = data.data || [];
    if (paginated && data.pagination) {
      state.totalPages = data.pagination.last_visible_page || 1;
    }

    setLoading(false);
    animeGrid.innerHTML = '';

    if (items.length === 0) {
      animeGrid.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:3rem">No anime found.</p>`;
      return;
    }

    items.forEach((anime, i) => {
      animeGrid.appendChild(createCard(anime, i + 1 + (state.currentPage - 1) * 20));
    });

    if (paginated) renderPagination();

  } catch (err) {
    setLoading(false);
    animeGrid.innerHTML = '';
    errorMsg.textContent = 'Failed to load anime. Please try again.';
    errorState.style.display = 'block';
    console.error(err);
  }
}

function retryFetch() {
  fetchAndRender(retryUrl, retryPaginated);
}

// ─── Skeleton Loader ─────────────────────────
function showSkeletons(n) {
  animeGrid.innerHTML = Array.from({ length: n }, () => `
    <div class="anime-card skeleton-card">
      <div class="card-img-wrap skeleton skeleton-img"></div>
      <div class="card-body">
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line short"></div>
      </div>
    </div>
  `).join('');
}

// ─── Create Card ─────────────────────────────
function createCard(anime, rank) {
  const card = document.createElement('div');
  card.className = 'anime-card';
  card.addEventListener('click', () => openDetail(anime.mal_id));

  const img = anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '';
  const score = anime.score ? `⭐ ${anime.score}` : 'N/A';
  const status = anime.status || '';
  const statusClass = status.includes('Airing') ? 'airing' : status.includes('Upcoming') ? 'upcoming' : 'finished';
  const genres = (anime.genres || []).slice(0, 3).map(g => `<span class="genre-pill">${g.name}</span>`).join('');
  const eps = anime.episodes ? `${anime.episodes} eps` : 'Ongoing';
  const year = anime.aired?.prop?.from?.year || anime.year || '—';

  card.innerHTML = `
    <div class="card-img-wrap">
      <img src="${img}" alt="${escHtml(anime.title)}" loading="lazy" onerror="this.src='https://via.placeholder.com/225x318?text=No+Image'" />
      <span class="rank-badge">#${rank}</span>
      <span class="score-badge">⭐ ${anime.score || 'N/A'}</span>
      ${status ? `<span class="status-tag ${statusClass}">${status.replace('Currently Airing','Airing')}</span>` : ''}
      <div class="card-overlay">
        <div class="card-overlay-text">
          <div class="card-overlay-genres">${genres}</div>
        </div>
      </div>
    </div>
    <div class="card-body">
      <div class="card-title">${escHtml(anime.title)}</div>
      <div class="card-meta">
        <span><i class="fa fa-film"></i> ${escHtml(anime.type || 'TV')}</span>
        <span><i class="fa fa-list"></i> ${eps}</span>
        <span><i class="fa fa-calendar"></i> ${year}</span>
      </div>
    </div>
  `;

  return card;
}

// ─── Pagination ──────────────────────────────
function renderPagination() {
  if (state.totalPages <= 1) return;
  const cur = state.currentPage;
  const total = state.totalPages;

  let pages = [];
  if (total <= 7) {
    pages = Array.from({ length: total }, (_, i) => i + 1);
  } else {
    pages = [1];
    if (cur > 3) pages.push('...');
    for (let i = Math.max(2, cur - 1); i <= Math.min(total - 1, cur + 1); i++) pages.push(i);
    if (cur < total - 2) pages.push('...');
    pages.push(total);
  }

  pagination.innerHTML = `
    <button class="page-btn" onclick="goPage(${cur - 1})" ${cur === 1 ? 'disabled' : ''}>
      <i class="fa fa-chevron-left"></i>
    </button>
    ${pages.map(p => p === '...'
      ? `<span class="page-btn" style="cursor:default">…</span>`
      : `<button class="page-btn ${p === cur ? 'active' : ''}" onclick="goPage(${p})">${p}</button>`
    ).join('')}
    <button class="page-btn" onclick="goPage(${cur + 1})" ${cur === total ? 'disabled' : ''}>
      <i class="fa fa-chevron-right"></i>
    </button>
  `;
}

function goPage(page) {
  if (page < 1 || page > state.totalPages) return;
  state.currentPage = page;
  const cfg = sectionConfig[state.currentSection];
  if (cfg) {
    fetchAndRender(cfg.endpoint(), cfg.paginated);
  } else if (state.currentSection === 'genre' && state.selectedGenre) {
    fetchAndRender(`/api/genre/${encodeURIComponent(state.selectedGenre)}?page=${page}`, true);
  } else if (state.currentSection === 'search') {
    const q = searchInput.value.trim();
    if (q) fetchAndRender(`/api/search?q=${encodeURIComponent(q)}&page=${page}`, true);
  }
  mainContent.scrollIntoView({ behavior: 'smooth' });
}

// ─── Genres ──────────────────────────────────
async function loadGenres() {
  const genresGrid = document.getElementById('genresGrid');
  genresGrid.innerHTML = '<p style="color:var(--text-muted)">Loading genres...</p>';

  try {
    if (state.genres.length === 0) {
      const res = await fetch('/api/genres');
      const data = await res.json();
      state.genres = data.data || [];
    }

    genresGrid.innerHTML = state.genres.map(g => {
      const emoji = genreEmoji[g.name] || '🎬';
      return `
        <div class="genre-card" onclick="showGenre(${g.mal_id}, '${escHtml(g.name)}')">
          <span class="genre-emoji">${emoji}</span>
          ${escHtml(g.name)}
          <div style="font-size:.75rem;color:var(--text-muted);margin-top:.3rem">${g.count ? g.count.toLocaleString() + ' anime' : ''}</div>
        </div>
      `;
    }).join('');
  } catch {
    genresGrid.innerHTML = '<p style="color:var(--accent)">Failed to load genres.</p>';
  }
}

function showGenre(id, name) {
  state.selectedGenre = name;
  state.currentSection = 'genre';
  state.currentPage = 1;
  sectionTitle.textContent = `${genreEmoji[name] || '🎬'} ${name} Anime`;
  mainContent.style.display = 'block';
  genresSection.style.display = 'none';
  setActiveNav('genres');
  fetchAndRender(`/api/genre/${encodeURIComponent(name)}?page=${state.currentPage}`, true);
  mainContent.scrollIntoView({ behavior: 'smooth' });
}

// ─── Detail Modal ─────────────────────────────
async function openDetail(id) {
  modalOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  modalInner.innerHTML = `
    <div style="display:flex;justify-content:center;padding:5rem">
      <div class="spinner"></div>
    </div>
  `;

  try {
    const [detailRes, charsRes] = await Promise.allSettled([
      fetch(`/api/anime/${id}`),
      fetch(`/api/anime/${id}/characters`),
    ]);

    const detail = detailRes.status === 'fulfilled' ? await detailRes.value.json() : null;
    const chars  = charsRes.status === 'fulfilled'  ? await charsRes.value.json()  : null;

    if (!detail?.data) throw new Error('No data');
    renderModal(detail.data, chars?.data || []);
  } catch {
    modalInner.innerHTML = `
      <div style="padding:3rem;text-align:center;color:var(--text-muted)">
        <i class="fa fa-exclamation-circle" style="font-size:2rem;color:var(--accent)"></i>
        <p style="margin-top:1rem">Failed to load anime details.</p>
      </div>
    `;
  }
}

function renderModal(a, chars) {
  const img  = a.images?.jpg?.large_image_url || '';
  const score = a.score ?? '—';
  const genres = (a.genres || []).map(g => `<span class="modal-genre-pill">${g.name}</span>`).join('');
  const studios = (a.studios || []).map(s => s.name).join(', ') || '—';
  const synopsis = a.synopsis ? a.synopsis.replace(/\[Written.*?\]/g, '').trim() : 'No synopsis available.';

  // Characters (main/supporting first 12)
  const mainChars = chars
    .filter(c => c.role === 'Main' || c.role === 'Supporting')
    .slice(0, 12);

  const trailerHtml = a.trailer?.embed_url
    ? `<div class="modal-trailer">
        <h3>🎬 Trailer</h3>
        <div class="trailer-embed">
          <iframe src="${a.trailer.embed_url}?autoplay=0" allowfullscreen loading="lazy"></iframe>
        </div>
       </div>`
    : '';

  const charsHtml = mainChars.length > 0
    ? `<div class="modal-characters">
        <h3>👥 Characters</h3>
        <div class="chars-grid">
          ${mainChars.map(c => `
            <div class="char-card">
              <img src="${c.character.images?.jpg?.image_url || ''}" alt="" loading="lazy"
                   onerror="this.src='https://via.placeholder.com/100?text=?'" />
              <div class="char-name">${escHtml(c.character.name.split(',').reverse().join(' ').trim())}</div>
              <div class="char-role">${c.role}</div>
            </div>
          `).join('')}
        </div>
       </div>`
    : '';

  modalInner.innerHTML = `
    <div class="modal-hero">
      <div class="modal-poster">
        <img src="${img}" alt="${escHtml(a.title)}" onerror="this.src='https://via.placeholder.com/225x318?text=No+Image'" />
      </div>
      <div class="modal-info">
        <div>
          <div class="modal-title">${escHtml(a.title)}</div>
          ${a.title_english && a.title_english !== a.title
            ? `<div class="modal-title-en">${escHtml(a.title_english)}</div>` : ''}
        </div>
        <div class="modal-score-row">
          <div class="modal-score">⭐ ${score}</div>
          <div style="color:var(--text-muted);font-size:.85rem">${a.scored_by ? a.scored_by.toLocaleString() + ' votes' : ''}</div>
        </div>
        <div class="modal-rank-row">
          ${a.rank ? `<span class="modal-badge">Rank #${a.rank}</span>` : ''}
          ${a.popularity ? `<span class="modal-badge" style="color:#a78bfa;border-color:rgba(167,139,250,.3);background:rgba(124,58,237,.15)">Popularity #${a.popularity}</span>` : ''}
          ${a.status ? `<span class="modal-badge" style="color:#34d399;border-color:rgba(52,211,153,.3);background:rgba(16,185,129,.12)">${a.status}</span>` : ''}
        </div>
        <div class="modal-stats">
          <div class="modal-stat">
            <div class="modal-stat-label">Type</div>
            <div class="modal-stat-value">${a.type || '—'}</div>
          </div>
          <div class="modal-stat">
            <div class="modal-stat-label">Episodes</div>
            <div class="modal-stat-value">${a.episodes || 'Ongoing'}</div>
          </div>
          <div class="modal-stat">
            <div class="modal-stat-label">Duration</div>
            <div class="modal-stat-value">${a.duration?.replace(' per ep','') || '—'}</div>
          </div>
          <div class="modal-stat">
            <div class="modal-stat-label">Rating</div>
            <div class="modal-stat-value">${a.rating || '—'}</div>
          </div>
          <div class="modal-stat">
            <div class="modal-stat-label">Season</div>
            <div class="modal-stat-value">${a.season ? cap(a.season) + ' ' + (a.year || '') : '—'}</div>
          </div>
          <div class="modal-stat">
            <div class="modal-stat-label">Studio</div>
            <div class="modal-stat-value" style="font-size:.8rem">${studios}</div>
          </div>
          <div class="modal-stat">
            <div class="modal-stat-label">Members</div>
            <div class="modal-stat-value">${a.members ? a.members.toLocaleString() : '—'}</div>
          </div>
          <div class="modal-stat">
            <div class="modal-stat-label">Source</div>
            <div class="modal-stat-value">${a.source || '—'}</div>
          </div>
        </div>
        <div class="modal-genres-row">${genres}</div>
        <a href="https://myanimelist.net/anime/${a.mal_id}" target="_blank"
           style="display:inline-flex;align-items:center;gap:.5rem;color:var(--accent);font-weight:700;font-size:.85rem;margin-top:.5rem">
          <i class="fa fa-external-link"></i> View on MyAnimeList
        </a>
      </div>
    </div>

    <div class="modal-synopsis">
      <h3>📖 Synopsis</h3>
      <p>${escHtml(synopsis)}</p>
    </div>

    ${trailerHtml}
    ${charsHtml}
  `;
}

function closeModal() {
  modalOverlay.classList.remove('open');
  document.body.style.overflow = '';
  // Stop trailer if playing
  const iframe = modalInner.querySelector('iframe');
  if (iframe) iframe.src = iframe.src;
}

// ─── Hero Cards ──────────────────────────────
async function loadHeroCards() {
  try {
    const res = await fetch('/api/trending?page=1');
    const data = await res.json();
    const items = (data.data || []).slice(0, 3);
    items.forEach((anime, i) => {
      const slot = document.getElementById(`heroCard${i + 1}`);
      if (slot) {
        slot.innerHTML = `<img src="${anime.images?.jpg?.large_image_url || ''}" alt="${escHtml(anime.title)}" />`;
        slot.style.cursor = 'pointer';
        slot.addEventListener('click', () => openDetail(anime.mal_id));
      }
    });
  } catch {/* silent */}
}

// ─── Loading State ───────────────────────────
function setLoading(show) {
  loading.classList.toggle('hidden', !show);
}

// ─── Toast ───────────────────────────────────
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── Utilities ───────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cap(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
}

// ─── Init ────────────────────────────────────
(function init() {
  setLoading(false);
  showSection('trending');
  loadHeroCards();
})();
