/* Core app logic: renders featured, grid, categories, popular; filters, modal, pagination, theme */

// Utilities
const fmtDate = (iso) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(iso));
const qs = (sel, el = document) => el.querySelector(sel);
const qsa = (sel, el = document) => Array.from(el.querySelectorAll(sel));

// State
let state = {
  query: '',
  tags: new Set(),
  page: 1,
  perPage: 9,
};

// Theme
function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', theme === 'dark');
}
function toggleTheme() {
  const isDark = document.documentElement.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

// Rendering helpers
function postCard(post) {
  return `
  <article class="card overflow-hidden group focus-within:ring-2 focus-within:ring-accent-primary" tabindex="0" data-id="${post.id}">
    <div class="relative aspect-[3/2] overflow-hidden thumb-overlay">
      <img src="${post.image}" alt="${post.title}" loading="lazy" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onerror="this.src='./images/posts/placeholder.jpg'"/>
    </div>
    <div class="p-5">
      <div class="flex items-center gap-2 text-xs text-slate-400">
        <span>${fmtDate(post.date)}</span>
        <span aria-hidden="true">•</span>
        <span>${post.readMins} min</span>
        ${post.tags?.[0] ? `<span aria-hidden="true">•</span><span>${post.tags[0]}</span>` : ''}
      </div>
      <h3 class="mt-2 text-lg font-semibold">${post.title}</h3>
      <p class="mt-1 text-slate-300 line-clamp-2">${post.excerpt}</p>
      <div class="mt-3 inline-flex items-center text-accent-secondary text-sm">Read more <span class="ml-1">→</span></div>
    </div>
  </article>`;
}

function renderFeatured(post) {
  const el = qs('#featured-container');
  if (!post) { el.innerHTML = ''; return; }
  el.innerHTML = `
  <div class="card overflow-hidden grid md:grid-cols-2">
    <div class="relative aspect-[16/10] md:aspect-auto md:h-full">
      <img src="${post.image}" alt="${post.title}" loading="lazy" class="w-full h-full object-cover" onerror="this.src='./images/posts/placeholder.jpg'"/>
      <div class="absolute inset-0 bg-gradient-to-tr from-accent-primary/20 to-accent-secondary/20 mix-blend-overlay"></div>
    </div>
    <div class="p-6 lg:p-8 flex flex-col">
      <span class="inline-flex w-fit items-center gap-2 rounded-full bg-accent-primary/10 ring-1 ring-accent-primary/30 px-3 py-1 text-xs text-accent-secondary">New</span>
      <h3 class="mt-4 text-2xl font-bold">${post.title}</h3>
      <p class="mt-2 text-slate-300">${post.excerpt}</p>
      <div class="mt-3 text-sm text-slate-400">${fmtDate(post.date)} • ${post.readMins} min • ${post.tags.join(', ')}</div>
      <div class="mt-auto pt-6 flex gap-3">
        <a href="#/post/${post.id}" class="btn-primary">Read</a>
        <a href="#posts" class="btn-ghost">Browse all</a>
      </div>
    </div>
  </div>`;
  // Click to open
  el.querySelector('a.btn-primary')?.addEventListener('click', (e) => {
    e.preventDefault();
    openPost(post.id);
    location.hash = `#/post/${post.id}`;
  });
}

function renderGrid(posts) {
  const grid = qs('#grid');
  grid.innerHTML = posts.map(postCard).join('');
  // interactions
  qsa('article[data-id]', grid).forEach((card) => {
    card.addEventListener('click', () => navigateToPost(card.getAttribute('data-id')));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter') navigateToPost(card.getAttribute('data-id')); });
  });
}

function renderCategories(posts) {
  const byTag = posts.reduce((acc, p) => {
    (p.tags || []).forEach(t => { acc[t] = (acc[t] || 0) + 1; });
    return acc;
  }, {});
  const cats = Object.entries(byTag).map(([tag, count]) => ({ tag, count })).sort((a,b) => b.count - a.count).slice(0,4);
  const wrap = qs('#categories');
  wrap.innerHTML = cats.map(({ tag, count }) => `
    <button class="card p-5 text-left group" data-tag="${tag}">
      <div class="flex items-center justify-between">
        <span class="text-lg font-semibold">${tag}</span>
        <span class="px-2 py-1 rounded-xl bg-white/10 text-sm">${count}</span>
      </div>
      <div class="mt-3 h-24 rounded-2xl bg-gradient-to-tr from-accent-primary/20 to-accent-secondary/20"></div>
    </button>
  `).join('');
  qsa('button[data-tag]', wrap).forEach(btn => btn.addEventListener('click', () => {
    state.tags = new Set([btn.getAttribute('data-tag')]);
    state.page = 1;
    syncTagChips();
    applyFilters();
    location.hash = '#posts';
  }));
}

function renderPopular(posts) {
  const row = qs('#popular-row');
  const byId = Object.fromEntries(posts.map(p => [p.id, p]));
  const items = (window.POPULAR || []).map(({ id, likes }) => ({ post: byId[id], likes })).filter(x => x.post);
  row.innerHTML = items.map(({ post, likes }) => `
    <button class="card p-3 min-w-[240px] snap-start text-left" data-id="${post.id}">
      <div class="relative aspect-video overflow-hidden rounded-2xl thumb-overlay">
        <img src="${post.image}" alt="${post.title}" loading="lazy" class="w-full h-full object-cover" onerror="this.src='./images/posts/placeholder.jpg'"/>
      </div>
      <div class="mt-2 text-sm font-medium line-clamp-1">${post.title}</div>
      <div class="mt-1 flex items-center gap-1 text-xs text-slate-400"><i data-lucide="heart" class="h-3.5 w-3.5"></i> ${likes}</div>
    </button>
  `).join('');
  qsa('button[data-id]', row).forEach(btn => btn.addEventListener('click', () => navigateToPost(btn.getAttribute('data-id'))));
}

// Modal
function openPost(id) {
  const post = (window.POSTS || []).find(p => p.id === id);
  if (!post) return;
  const root = qs('#modal-root');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.addEventListener('click', closePost);

  const host = document.createElement('div');
  host.className = 'modal-card';
  host.innerHTML = `
    <div class="modal-content relative" role="dialog" aria-modal="true" aria-labelledby="post-title-${post.id}">
      <button class="modal-close" aria-label="Close"><i data-lucide="x"></i></button>
      <div class="prose prose-invert max-w-none">
        <h2 id="post-title-${post.id}" class="text-2xl font-bold">${post.title}</h2>
        <div class="mt-1 text-sm text-slate-400">${fmtDate(post.date)} • ${post.readMins} min • ${post.tags.join(', ')}</div>
        <img src="${post.image}" alt="${post.title}" class="mt-4 w-full rounded-2xl ring-1 ring-white/10" onerror="this.src='./images/posts/placeholder.jpg'"/>
        <div class="mt-6 space-y-4">${post.content}</div>
      </div>
    </div>`;
  root.append(backdrop, host);
  lucide?.createIcons();
  document.addEventListener('keydown', onEsc, { once: true });
  location.hash = `#/post/${id}`;
}
function onEsc(e) { if (e.key === 'Escape') closePost(); }
function closePost() {
  qsa('.modal-backdrop, .modal-card').forEach(el => el.remove());
  if (location.hash.startsWith('#/post/')) history.replaceState(null, '', '#posts');
}

// Filters
function syncTagChips() {
  const container = qs('#tag-chips');
  const allTags = Array.from(new Set(window.POSTS.flatMap(p => p.tags || []))).sort();
  container.innerHTML = allTags.map(tag => `
    <button class="px-3 py-1.5 rounded-2xl text-sm ring-1 ring-white/10 ${state.tags.has(tag) ? 'bg-accent-primary text-white' : 'bg-white/5 text-slate-200 hover:bg-white/10'}" data-tag="${tag}">${tag}</button>
  `).join('');
  qsa('button[data-tag]', container).forEach(btn => btn.addEventListener('click', () => {
    const t = btn.getAttribute('data-tag');
    if (state.tags.has(t)) state.tags.delete(t); else state.tags.add(t);
    state.page = 1;
    syncTagChips();
    applyFilters();
  }));
}

function applyFilters() {
  const q = state.query.toLowerCase();
  const tags = state.tags;
  let filtered = window.POSTS.filter(p => {
    const matchQ = !q || p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q) || (p.tags||[]).some(t => t.toLowerCase().includes(q));
    const matchTags = tags.size === 0 || (p.tags||[]).some(t => tags.has(t));
    return matchQ && matchTags;
  });
  const featured = filtered[0];
  renderFeatured(featured);
  const paged = filtered.slice(0, state.page * state.perPage);
  renderGrid(paged);
  qs('#load-more').classList.toggle('hidden', paged.length >= filtered.length);
  lucide?.createIcons();
}

// Search & pagination
function initInteractions() {
  const search = qs('#search');
  const loadMore = qs('#load-more');
  const themeBtns = [qs('#theme-toggle'), qs('#theme-toggle-footer')].filter(Boolean);
  search?.addEventListener('input', (e) => { state.query = e.target.value || ''; state.page = 1; applyFilters(); });
  // Cmd/Ctrl+K focus
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); search?.focus(); }
  });
  loadMore?.addEventListener('click', () => { state.page += 1; applyFilters(); });
  themeBtns.forEach(btn => btn.addEventListener('click', toggleTheme));
  // Newsletter
  qs('#newsletter-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = qs('#email').value.trim();
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const err = qs('#email-error');
    if (!ok) {
      err.classList.remove('sr-only');
      return;
    }
    err.classList.add('sr-only');
    const subject = encodeURIComponent('Newsletter signup');
    const body = encodeURIComponent(`Please add me to the list.\nEmail: ${email}`);
    window.location.href = `mailto:hello@example.com?subject=${subject}&body=${body}`;
  });
  // Hash routing
  window.addEventListener('hashchange', handleHash);
}

function handleHash() {
  const m = location.hash.match(/^#\/post\/(.+)$/);
  if (m) navigateToPost(m[1]);
}

function init() {
  initTheme();
  qs('#year').textContent = new Date().getFullYear();
  syncTagChips();
  renderCategories(window.POSTS);
  renderPopular(window.POSTS);
  applyFilters();
  initInteractions();
  lucide?.createIcons();
  handleHash();
}

document.addEventListener('DOMContentLoaded', init);

// Expose some functions if needed
window.applyFilters = applyFilters;
window.openPost = openPost; // kept for compatibility (modal no longer used by default)
window.closePost = closePost;
window.toggleTheme = toggleTheme;

function navigateToPost(id){
  // Navigate to prebuilt static page if available; fallback to modal if not.
  const url = `./posts/${id}.html`;
  fetch(url, { method: 'HEAD' }).then(r => {
    if (r.ok) { window.location.href = url; }
    else { openPost(id); }
  }).catch(() => openPost(id));
}


