/* ═══════════════════════════════════════════════════════════════
   GOOD NEIGHBORS — App Frontend Logic
   ═══════════════════════════════════════════════════════════════ */

// ─── State ──────────────────────────────────────────────────────
let currentUser = null;
let currentSection = 'feed';
let selectedPostType = 'general';
let selectedSeverity = 'medium';
let openComments = new Set();
let currentGroupId = null;
let currentBizId = null;

const GROUP_BANNERS = [
  'linear-gradient(135deg,#0077B6,#00B4D8)',
  'linear-gradient(135deg,#2A9D8F,#57CC99)',
  'linear-gradient(135deg,#E76F51,#F4A261)',
  'linear-gradient(135deg,#6D6875,#B5838D)',
  'linear-gradient(135deg,#457B9D,#1D3557)',
  'linear-gradient(135deg,#4CAF50,#81C784)',
  'linear-gradient(135deg,#E9C46A,#F4A261)',
  'linear-gradient(135deg,#264653,#2A9D8F)',
];
function groupBannerGradient(id) {
  const sum = String(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return GROUP_BANNERS[sum % GROUP_BANNERS.length];
}

function groupTimeAgo(iso) {
  if (!iso) return '';
  const d = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (d < 1) return 'just now';
  if (d < 60) return `${d}m ago`;
  if (d < 1440) return `${Math.floor(d / 60)}h ago`;
  return `${Math.floor(d / 1440)}d ago`;
}

// ─── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  lucide.createIcons();
  await loadNotifications();
  loadTides();
  loadWhatsHappening();
  loadSidebarWidgets();
  initMobile();
  navigate(currentUser?.role === 'realtor' ? 'realestate' : 'feed');
});

function initMobile() {
  if (window.innerWidth > 700) return;
  // Show hamburger button
  const ham = document.getElementById('hamburgerBtn');
  if (ham) ham.style.display = 'block';
  // Show bottom nav
  const bn = document.getElementById('mobileBottomNav');
  if (bn) { bn.style.display = 'flex'; bn.style.cssText = 'display:flex!important;position:fixed;bottom:0;left:0;right:0;height:60px;background:white;border-top:1px solid #E5EBF2;z-index:9000;box-shadow:0 -2px 12px rgba(0,0,0,.08);'; }
  // Add bottom padding to body so content isn't hidden behind nav
  const body = document.querySelector('.app-body');
  if (body) body.style.paddingBottom = '70px';
}

async function loadWhatsHappening() {
  const el = document.getElementById('happeningList');
  if (!el) return;

  // Pull recent posts from feed + safety section
  const [feedPosts, safetyPosts] = await Promise.all([
    fetchJSON('/api/posts?section=feed'),
    fetchJSON('/api/posts?section=safety')
  ]);
  const all = [...(safetyPosts || []), ...(feedPosts || [])];

  // Deduplicate + pick the most relevant recent items (max 5)
  const seen = new Set();
  const picks = [];
  for (const p of all) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    if (picks.length >= 5) break;
    picks.push(p);
  }

  if (!picks.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text-light);">Nothing new right now.</div>'; return; }

  el.innerHTML = picks.map(p => {
    const dotClass = p.type === 'safety' ? 'safety' : p.type === 'events' ? 'event' : p.type === 'lost_found' ? 'lost' : 'recommend';
    const section = p.type === 'safety' ? 'safety' : p.type === 'events' ? 'events' : p.type === 'lost_found' ? 'feed' : 'feed';
    const preview = (p.alertType ? `<strong>${p.alertType}</strong>` : `<strong>${escHtml(p.author?.name || '')}</strong>`) +
      ' — ' + escHtml((p.content || '').slice(0, 52)) + ((p.content || '').length > 52 ? '…' : '');
    const timeStr = p.createdAt ? groupTimeAgo(p.createdAt) : '';
    return `<div class="happening-item" onclick="navigate('${section}')">
      <span class="happening-dot ${dotClass}"></span>
      <div class="happening-text">${preview}<div class="happening-time">${timeStr}</div></div>
    </div>`;
  }).join('');
}

async function loadSidebarWidgets() {
  const [events, neighbors, feedPosts, marketplaceItems, safetyPosts, realEstateListings] = await Promise.all([
    fetchJSON('/api/events'),
    fetchJSON('/api/neighbors'),
    fetchJSON('/api/posts?section=feed'),
    fetchJSON('/api/marketplace'),
    fetchJSON('/api/posts?section=safety'),
    fetchJSON('/api/realestate'),
  ]);

  // Nav badges — only show if count > 0
  function setBadge(id, count) {
    const el = document.getElementById(id);
    if (!el) return;
    if (count > 0) { el.textContent = count; el.style.display = ''; }
    else el.style.display = 'none';
  }
  setBadge('badgeMarketplace', (marketplaceItems || []).length);
  setBadge('badgeEvents', (events || []).filter(e => new Date(e.date || e.eventDate) >= new Date()).length);
  setBadge('badgeSafety', (safetyPosts || []).filter(p => p.severity !== 'resolved').length);
  setBadge('badgeRealestate', (realEstateListings || []).length);

  // Sidebar stats
  const nbCount = document.getElementById('sidebarNeighbors');
  if (nbCount) nbCount.textContent = (neighbors || []).length;

  // Next Event
  const nextEventEl = document.getElementById('nextEventCard');
  if (nextEventEl) {
    const upcoming = (events || [])
      .filter(e => new Date(e.date || e.eventDate) >= new Date())
      .sort((a, b) => new Date(a.date || a.eventDate) - new Date(b.date || b.eventDate))[0];
    if (upcoming) {
      const d = new Date(upcoming.date || upcoming.eventDate);
      const month = d.toLocaleString('en', { month: 'short' }).toUpperCase();
      const day   = d.getDate();
      const going = upcoming.rsvpCounts?.going || 0;
      nextEventEl.innerHTML = `
        <div class="next-event-date"><span class="nev-month">${month}</span><span class="nev-day">${day}</span></div>
        <div class="next-event-info">
          <div class="nev-title">${escHtml(upcoming.title)}</div>
          <div class="nev-meta">${upcoming.time || upcoming.eventTime || ''} · ${escHtml(upcoming.location || '')}</div>
          ${going ? `<div class="nev-going">🙋 ${going} going</div>` : ''}
        </div>`;
      nextEventEl.style.cursor = 'pointer';
    } else {
      nextEventEl.innerHTML = '<div style="font-size:12px;color:var(--text-light);padding:8px 0">No upcoming events yet.</div>';
    }
  }

  // Trending Topics — most-reacted posts
  const trendingEl = document.getElementById('trendingTopicsList');
  if (trendingEl) {
    const posts = (feedPosts || [])
      .filter(p => p.type !== 'sponsored')
      .map(p => ({ p, total: Object.values(p.reactions || {}).reduce((a, b) => a + b, 0) + (p.commentCount || 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
    if (posts.length) {
      const icons = { safety: '🚨', for_sale: '🏷️', lost_found: '🔍', events: '🎉', recommendation: '⭐', poll: '📊', general: '💬', free: '🎁' };
      trendingEl.innerHTML = posts.map(({ p }) =>
        `<div class="trend-item" onclick="navigate('${p.type === 'safety' ? 'safety' : 'feed'}')">${icons[p.type] || '💬'} ${escHtml((p.content || '').slice(0, 48))}${(p.content || '').length > 48 ? '…' : ''}</div>`
      ).join('');
    } else {
      trendingEl.innerHTML = '<div style="font-size:12px;color:var(--text-light)">No posts yet.</div>';
    }
  }

  // New Neighbors — most recently joined users
  const nnEl = document.getElementById('newNeighborsList');
  if (nnEl) {
    const recent = (neighbors || []).slice(0, 5);
    if (recent.length) {
      nnEl.innerHTML = recent.map(n => `
        <div class="new-neighbor">
          <div class="avatar-sm" style="background:${n.avatar || n.avatarHex || '#0077B6'};overflow:hidden;">
            ${n.avatarUrl ? `<img src="${n.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : escHtml(n.initials || '?')}
          </div>
          <div class="nn-info">
            <div class="nn-name">${escHtml(n.name)}</div>
            <div class="nn-street">${escHtml(n.address || '')}</div>
          </div>
          <button class="btn-wave">👋</button>
        </div>`).join('');
    } else {
      nnEl.innerHTML = '<div style="font-size:12px;color:var(--text-light)">No neighbors yet.</div>';
    }
  }
}

async function loadTides() {
  const el = document.getElementById('tideData');
  if (!el) return;
  const tides = await fetchJSON('/api/tides');
  if (!tides) { el.innerHTML = '<div class="tide-loading">Unavailable</div>'; return; }
  const now = new Date();
  const toMins = t => { const [time, ap] = t.split(' '); const [h, m] = time.split(':').map(Number); return ((h % 12) + (ap === 'PM' ? 12 : 0)) * 60 + m; };
  const nowMins = now.getHours() * 60 + now.getMinutes();
  el.innerHTML = tides.map(t => {
    const past = toMins(t.time) < nowMins;
    return `<div class="tide-row ${past ? 'tide-past' : ''}">
      <span class="tide-type">${t.type === 'High' ? '▲' : '▼'} ${t.type}</span>
      <span class="tide-time">${t.time}</span>
      <span class="tide-height">${t.height}</span>
    </div>`;
  }).join('');
}

async function checkAuth() {
  try {
    const res = await fetch('/api/auth/me', { credentials: 'include' });
    if (!res.ok) { window.location.href = '/login'; return; }
    currentUser = await res.json();
    renderUserUI();
  } catch {
    window.location.href = '/login';
  }
}

async function refreshPoints() {
  try {
    const fresh = await fetchJSON('/api/auth/me');
    if (fresh && typeof fresh.points === 'number') {
      currentUser.points = fresh.points;
      setTextSafe('sidebarPoints', fresh.points);
    }
  } catch {}
}

function renderUserUI() {
  if (!currentUser) return;
  // Topbar
  const topbarAvatar = document.getElementById('topbarAvatar');
  if (topbarAvatar) topbarAvatar.style.background = currentUser.avatar;
  setTextSafe('topbarInitials', currentUser.initials);

  // Dropdown
  const dropAvatar = document.getElementById('dropdownAvatar');
  if (dropAvatar) dropAvatar.style.background = currentUser.avatar;
  setTextSafe('dropdownInitials', currentUser.initials);
  setTextSafe('dropdownName', currentUser.name);

  // Sidebar
  const sidebarAv = document.getElementById('sidebarAvatar');
  if (sidebarAv) sidebarAv.style.background = currentUser.avatar;
  setTextSafe('sidebarInitials', currentUser.initials);
  setTextSafe('sidebarName', currentUser.name);
  setTextSafe('sidebarPosts', currentUser.posts);
  setTextSafe('sidebarNeighbors', currentUser.neighbors);
  setTextSafe('sidebarPoints', currentUser.points);

  // Create post modal avatar
  const createAv = document.getElementById('createAvatar');
  if (createAv) {
    createAv.style.background = currentUser.avatar;
    if (currentUser.avatarUrl) {
      createAv.innerHTML = `<img src="${currentUser.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    }
  }
  setTextSafe('createInitials', currentUser.avatarUrl ? '' : currentUser.initials);
  setTextSafe('createName', currentUser.name);
}

function setTextSafe(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function pointsLevelLabel(pts) {
  const p = pts ?? 0;
  if (p >= 2000) return 'Legend';
  if (p >= 1000) return 'Champion';
  if (p >= 500)  return 'Regular';
  if (p >= 200)  return 'Member';
  if (p >= 50)   return 'Neighbor';
  return 'Newcomer';
}

// ─── Navigation ─────────────────────────────────────────────────
function navigate(section) {
  currentSection = section;

  // Update nav active state (sidebar + mobile bottom nav)
  document.querySelectorAll('.nav-item, .mbn-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  // Render section
  const container = document.getElementById('sectionContent');
  container.innerHTML = '<div class="loading-spinner"></div>';

  // Small delay for smooth transition
  setTimeout(() => {
    renderSection(section, container);
    lucide.createIcons();
    closeDropdowns();
  }, 150);
}

async function renderSection(section, container) {
  switch (section) {
    case 'feed':        await renderFeed(container); break;
    case 'marketplace': await renderMarketplace(container); break;
    case 'events':      await renderEvents(container); break;
    case 'safety':      await renderSafety(container); break;
    case 'businesses':  await renderBusinesses(container); break;
    case 'neighbors':   await renderNeighbors(container); break;
    case 'groups':      await renderGroups(container); break;
    case 'notifications': await renderNotifications(container); break;
    case 'profile':     await renderProfile(container); break;
    case 'settings':    renderSettings(container); break;
    case 'realestate':  await renderRealEstate(container); break;
    case 'transport':   await renderTransport(container); break;
    default:            await renderFeed(container);
  }
  lucide.createIcons();
}

// ─── Feed ────────────────────────────────────────────────────────
async function renderFeed(container) {
  container.innerHTML = sectionHeaderHTML('feed');
  const createCard = document.createElement('div');
  createCard.className = 'create-post-card';
  createCard.onclick = openCreatePost;
  createCard.innerHTML = `
    <div class="avatar-post" style="background:${currentUser?.avatar || '#0077B6'};width:40px;height:40px;overflow:hidden;">
      ${currentUser?.avatarUrl ? `<img src="${currentUser.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (currentUser?.initials || 'ME')}
    </div>
    <div class="create-post-input">What's happening?</div>
    <div class="create-type-btns">
      <button class="create-type-btn" onclick="event.stopPropagation();openCreatePost('for_sale')">
        🏷️ Sell
      </button>
      <button class="create-type-btn" onclick="event.stopPropagation();openCreatePost('events')">
        📅 Event
      </button>
    </div>
  `;
  container.appendChild(createCard);

  const posts = await fetchJSON('/api/posts?section=feed');
  if (!posts || !posts.length) {
    container.innerHTML += emptyStateHTML('🌊', 'No posts yet', 'Be the first to post in Costa Blanca Villas!');
    return;
  }
  posts.forEach(post => {
    if (post.type === 'sponsored') {
      container.appendChild(buildSponsoredCard(post));
    } else {
      container.appendChild(buildPostCard(post));
    }
  });
  lucide.createIcons();
}

// ─── Marketplace ────────────────────────────────────────────────
async function renderMarketplace(container) {
  container.innerHTML = sectionHeaderHTML('marketplace');
  let items = await fetchJSON('/api/marketplace');
  if (!items) items = await fetchJSON('/api/marketplace');
  if (!items || !items.length) {
    container.innerHTML += emptyStateHTML('🛒', 'Nothing listed yet', 'Be the first to list something!');
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'marketplace-grid';
  items.forEach(item => grid.appendChild(buildMarketCard(item)));
  container.appendChild(grid);
  if (window.lucide) lucide.createIcons();
}

// ─── Events ─────────────────────────────────────────────────────
async function renderEvents(container) {
  container.innerHTML = sectionHeaderHTML('events');
  let evts = await fetchJSON('/api/events');
  // Retry once if first attempt fails
  if (!evts) evts = await fetchJSON('/api/events');
  if (!evts || !evts.length) {
    container.innerHTML += emptyStateHTML('📅', 'No events coming up', 'Create an event and invite the neighborhood!');
    return;
  }
  evts.forEach((ev, i) => {
    const card = buildEventCard(ev);
    card.style.animationDelay = `${i * 70}ms`;
    container.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
}

// ─── Safety ─────────────────────────────────────────────────────
async function renderSafety(container) {
  container.innerHTML = sectionHeaderHTML('safety');
  const posts = await fetchJSON('/api/posts?section=safety');
  const allPosts = await fetchJSON('/api/posts?section=feed');
  const safetyPosts = [...(posts || []), ...(allPosts || []).filter(p => p.type === 'safety')];
  // deduplicate
  const seen = new Set();
  const unique = safetyPosts.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

  if (!unique.length) {
    container.innerHTML += emptyStateHTML('🛡️', 'No safety alerts', 'Your neighborhood is safe!');
    return;
  }
  unique.forEach(post => container.appendChild(buildPostCard(post)));
}

// ─── Businesses ─────────────────────────────────────────────────


async function renderBusinesses(container) {
  container.innerHTML = '';
  currentBizId = null;
  const topBar = document.createElement('div');
  topBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;';
  topBar.innerHTML = `<div><h2 style="font-size:19px;font-weight:800;color:var(--text-dark);margin:0;">Business Directory</h2><p style="font-size:13px;color:var(--text-light);margin:2px 0 0;">Local restaurants and services near Farallón</p></div>`;
  container.appendChild(topBar);
  const businesses = await fetchJSON('/api/businesses');
  if (!businesses || !businesses.length) {
    container.innerHTML += emptyStateHTML('🏪', 'No businesses listed', 'Know a great local business? Recommend it!');
    return;
  }
  const list = document.createElement('div');
  list.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  businesses.forEach((biz, i) => {
    const card = buildBusinessListingCard(biz);
    card.style.animationDelay = `${i * 50}ms`;
    list.appendChild(card);
  });
  container.appendChild(list);
}

// ─── Neighbors ──────────────────────────────────────────────────
async function renderNeighbors(container) {
  container.innerHTML = sectionHeaderHTML('neighbors');
  const neighbors = await fetchJSON('/api/neighbors');
  if (!neighbors || !neighbors.length) {
    container.innerHTML += emptyStateHTML('👋', 'No neighbors yet', 'Invite your neighbors to join!');
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'neighbors-grid';
  neighbors.forEach((n, i) => {
    const card = buildNeighborCard(n);
    card.style.animationDelay = `${i * 50}ms`;
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

// ─── Groups ─────────────────────────────────────────────────────
async function renderGroups(container) {
  container.innerHTML = '';
  currentGroupId = null;

  // Top bar
  const topBar = document.createElement('div');
  topBar.className = 'groups-top-bar';
  topBar.innerHTML = `
    <div>
      <h2>Groups</h2>
      <p>Connect around shared interests</p>
    </div>
    <button onclick="openCreateGroupModal()" style="display:flex;align-items:center;gap:6px;padding:9px 18px;background:var(--ocean);color:white;border:none;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">
      <span style="font-size:17px;line-height:1">+</span> Create Group
    </button>`;
  container.appendChild(topBar);

  const groups = await fetchJSON('/api/groups');
  if (!groups || !groups.length) {
    container.appendChild(Object.assign(document.createElement('div'), { innerHTML: emptyStateHTML('👥', 'No groups yet', 'Be the first to create one!') }));
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'groups-grid';
  groups.forEach((g, i) => {
    const card = buildGroupCard(g);
    card.style.animationDelay = `${i * 60}ms`;
    grid.appendChild(card);
  });
  container.appendChild(grid);
}

// ─── Notifications ───────────────────────────────────────────────
async function renderNotifications(container) {
  container.innerHTML = sectionHeaderHTML('notifications');
  const notifs = await fetchJSON('/api/notifications');

  // Mark all read
  fetch('/api/notifications/read', { method: 'POST', credentials: 'include' });
  updateNotifBadge(0);

  if (!notifs || !notifs.length) {
    container.innerHTML += emptyStateHTML('🔔', 'No notifications', 'You\'re all caught up!');
    return;
  }

  const list = document.createElement('div');
  list.className = 'notifications-list';

  const unread = notifs.filter(n => !n.read);
  const read = notifs.filter(n => n.read);

  if (unread.length) {
    const label = document.createElement('div');
    label.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-light);padding:8px 4px 4px;';
    label.textContent = `New (${unread.length})`;
    list.appendChild(label);
    unread.forEach((n, i) => {
      const card = buildNotifCard(n);
      card.style.animationDelay = `${i * 50}ms`;
      list.appendChild(card);
    });
  }

  if (read.length) {
    const label = document.createElement('div');
    label.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:var(--text-light);padding:12px 4px 4px;';
    label.textContent = 'Earlier';
    list.appendChild(label);
    read.forEach((n, i) => {
      const card = buildNotifCard(n);
      card.style.animationDelay = `${(unread.length + i) * 50}ms`;
      list.appendChild(card);
    });
  }

  container.appendChild(list);
}

// ─── Profile ────────────────────────────────────────────────────
async function renderProfile(container) {
  container.innerHTML = '';
  const user = currentUser;
  if (!user) return;

  const bannerStyle = user.bannerUrl
    ? `background:url(${user.bannerUrl}) center/cover no-repeat`
    : `background:linear-gradient(135deg,var(--ocean),var(--seafoam))`;
  const avatarContent = user.avatarUrl
    ? `<img src="${user.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
    : user.initials;

  container.innerHTML = `
    <div class="profile-banner" style="${bannerStyle}" id="profileBanner">
      <label class="banner-change-btn" title="Change banner photo">
        <input type="file" accept="image/*" style="display:none" onchange="uploadBanner(this)">
        <i data-lucide="camera" style="width:14px;height:14px"></i> Change Cover
      </label>
      <div class="profile-avatar-wrap">
        <div class="profile-avatar" style="background:${user.avatar}">${avatarContent}</div>
      </div>
    </div>
    <div class="profile-info">
      <div class="profile-name">
        ${user.name}
        <span class="badge-verified"><span style="font-size:10px">✓</span> Verified Neighbor</span>
      </div>
      <div class="profile-location">
        <i data-lucide="map-pin" style="width:13px;height:13px;"></i>
        ${user.address || 'Costa Blanca Villas'} · Farallón, Panama
      </div>
      <div class="profile-bio">${user.bio || 'Love this neighborhood! Beach walks, farmer\'s market, and good vibes only.'}</div>
      <div class="profile-stats">
        <div class="profile-stat">
          <div class="profile-stat-val">${user.posts || 23}</div>
          <div class="profile-stat-lbl">Posts</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-val">${user.neighbors || 89}</div>
          <div class="profile-stat-lbl">Neighbors</div>
        </div>
        <div class="profile-stat" title="${pointsLevelLabel(user.points)}">
          <div class="profile-stat-val">${user.points ?? 0}</div>
          <div class="profile-stat-lbl">Points · ${pointsLevelLabel(user.points)}</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-val">${user.yearsInNeighborhood || 4}</div>
          <div class="profile-stat-lbl">Years Here</div>
        </div>
      </div>
    </div>
  `;

  // Load and show user's posts
  const all = await fetchJSON('/api/posts?section=feed');
  const userPosts = (all || []).filter(p => p.author && p.author.username === user.username);

  const label = document.createElement('div');
  label.style.cssText = 'font-size:15px;font-weight:700;color:var(--text-dark);margin:16px 0 12px;';
  label.textContent = userPosts.length ? `Posts by ${user.name.split(' ')[0]}` : '';
  container.appendChild(label);

  userPosts.forEach(p => container.appendChild(buildPostCard(p)));
  lucide.createIcons();
}

// ─── Settings ────────────────────────────────────────────────────
function renderSettings(container) {
  const u = currentUser || {};
  container.innerHTML = `
    <div class="profile-banner" style="background:linear-gradient(135deg,var(--ocean),var(--seafoam))">
      <div class="profile-avatar-wrap">
        <div class="profile-avatar" style="background:${u.avatar}">${u.initials}</div>
      </div>
    </div>
    <div class="profile-info" style="margin-bottom:16px;">
      <div class="profile-name">${u.name} <span class="badge-verified"><span style="font-size:10px">✓</span> Verified</span></div>
      <div class="profile-location"><i data-lucide="map-pin" style="width:13px;height:13px"></i> ${u.address || 'Costa Blanca Villas'} · Farallón, Panama</div>
    </div>

    ${u.role === 'admin' ? `
    <div style="background:linear-gradient(135deg,#03045e,#0077B6);border-radius:12px;padding:16px 18px;margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
      <div>
        <div style="font-size:13px;font-weight:700;color:white;">⚡ Administrator</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.65);margin-top:2px;">You have full admin access to Costa Blanca Connect</div>
      </div>
      <button onclick="window.open('/admin','_blank')" style="padding:8px 16px;background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.25);border-radius:8px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.25)'" onmouseout="this.style.background='rgba(255,255,255,0.15)'">
        Open Admin Dashboard →
      </button>
    </div>` : ''}

    <div class="settings-group">
      <div class="settings-group-title">Profile</div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Profile Photo</div><div class="settings-row-sub">Upload a photo — JPG or PNG, max 5MB</div></div>
        <label style="cursor:pointer;flex-shrink:0;">
          <input type="file" accept="image/*" style="display:none" onchange="uploadAvatar(this)">
          <span class="settings-btn">Upload Photo</span>
        </label>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Display Name</div><div class="settings-row-sub">${u.name}</div></div>
        <button class="settings-btn" onclick="showToast('Profile editing available after launch')">Edit</button>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Bio</div><div class="settings-row-sub">${u.bio || 'No bio yet'}</div></div>
        <button class="settings-btn" onclick="showToast('Profile editing available after launch')">Edit</button>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Address</div><div class="settings-row-sub">${u.address || 'Costa Blanca Villas'}</div></div>
        <button class="settings-btn" onclick="showToast('Profile editing available after launch')">Edit</button>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">Notifications</div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">New Posts in Feed</div><div class="settings-row-sub">Get notified of new neighborhood posts</div></div>
        <label class="toggle-switch"><input type="checkbox" checked onchange="showToast('Saved')"><span class="toggle-slider"></span></label>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Safety Alerts</div><div class="settings-row-sub">Urgent alerts near Costa Blanca Villas</div></div>
        <label class="toggle-switch"><input type="checkbox" checked onchange="showToast('Saved')"><span class="toggle-slider"></span></label>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Event Reminders</div><div class="settings-row-sub">Reminders before events you're attending</div></div>
        <label class="toggle-switch"><input type="checkbox" checked onchange="showToast('Saved')"><span class="toggle-slider"></span></label>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Comments & Reactions</div><div class="settings-row-sub">When someone reacts to your posts</div></div>
        <label class="toggle-switch"><input type="checkbox" onchange="showToast('Saved')"><span class="toggle-slider"></span></label>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">Privacy</div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Show Address to Neighbors</div><div class="settings-row-sub">Neighbors can see your villa number</div></div>
        <label class="toggle-switch"><input type="checkbox" checked onchange="showToast('Saved')"><span class="toggle-slider"></span></label>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Appear in Neighbor Search</div><div class="settings-row-sub">Other residents can find your profile</div></div>
        <label class="toggle-switch"><input type="checkbox" checked onchange="showToast('Saved')"><span class="toggle-slider"></span></label>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">Account</div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Change Password</div><div class="settings-row-sub">Update your login password</div></div>
        <button class="settings-btn" onclick="showToast('Password reset email sent')">Reset</button>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label" style="color:var(--coral)">Sign Out</div><div class="settings-row-sub">Log out of Costa Blanca Connect</div></div>
        <button class="settings-btn danger" onclick="logout()">Sign Out</button>
      </div>
    </div>
  `;
  lucide.createIcons();
}

// ─── Build Sponsored Post Card ───────────────────────────────────
function buildSponsoredCard(post) {
  const card = document.createElement('div');
  card.className = 'post-card';
  card.style.cssText = 'border:1.5px solid #bee3f8;background:linear-gradient(135deg,#f0f9ff 0%,#ffffff 100%);';
  card.dataset.postId = post.id;
  card.innerHTML = `
    <div class="post-card-inner">
      <div style="display:flex;align-items:center;gap:6px;padding:5px 10px;background:#e8f4fd;border-bottom:1px solid #bee3f8;font-size:11.5px;font-weight:700;color:#0077B6;margin:-12px -12px 10px -12px;border-radius:12px 12px 0 0;letter-spacing:0.3px;">
        📢 SPONSORED · PARTNER
      </div>
      <div class="post-header">
        <div class="post-author">
          <div class="avatar-post" style="background:${post.avatar}">${post.initials}</div>
          <div class="post-author-info">
            <div class="post-author-name">${escHtml(post.businessName)}</div>
            <div class="post-meta">Community Partner</div>
          </div>
        </div>
      </div>
      <div class="post-content">${escHtml(post.content)}</div>
      ${post.linkUrl ? `
        <a href="${escHtml(post.linkUrl)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:9px 18px;background:#0077B6;color:white;border-radius:10px;font-size:13.5px;font-weight:700;text-decoration:none;transition:background 0.15s;" onmouseover="this.style.background='#005f92'" onmouseout="this.style.background='#0077B6'">
          ${escHtml(post.linkLabel || 'Learn More')} →
        </a>
      ` : ''}
    </div>
  `;
  return card;
}

// ─── Build Post Card ─────────────────────────────────────────────
function buildPostCard(post) {
  const resolvedClass = (post.type === 'safety' && post.severity === 'resolved') ? ' resolved' : '';
  const card = document.createElement('div');
  card.className = `post-card${post.type === 'safety' ? ' safety-card' + resolvedClass : ''}`;
  card.dataset.postId = post.id;

  const totalReactions = Object.values(post.reactions || {}).reduce((a, b) => a + b, 0);
  const topReactions = getTopReactions(post.reactions);
  const canResolve = (currentUser?.role === 'admin' || currentUser?.role === 'hoa') && post.type === 'safety' && post.severity !== 'resolved';

  card.innerHTML = `
    <div class="post-card-inner">
      ${post.isOfficial ? `<div style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#FFF3CD;border-bottom:1px solid #FFCA28;font-size:12px;font-weight:700;color:#856404;margin:-12px -12px 10px -12px;border-radius:12px 12px 0 0;">⚡ OFFICIAL ALERT · ${escHtml(post.author?.name || '')}</div>` : ''}
      ${post.alertType ? `<div class="alert-badge ${post.severity === 'resolved' ? 'resolved' : (post.severity || 'medium')}">${post.severity === 'resolved' ? '✅ Resolved' : `⚠ ${post.alertType}`}</div>` : ''}
      ${post.price !== undefined ? `
        <span class="price-tag${post.free || post.price === 0 ? ' free' : ''}">
          ${post.free || post.price === 0 ? '🎁 FREE' : `$${post.price}`}
        </span>
        ${post.condition ? `<span class="condition-tag">${post.condition}</span>` : ''}
      ` : ''}

      <div class="post-header">
        <div class="post-author">
          <div class="avatar-post" style="background:${post.author?.avatar || '#0077B6'};overflow:hidden;">
            ${post.author?.avatarUrl ? `<img src="${post.author.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (post.author?.initials || '??')}
          </div>
          <div class="post-author-info">
            <div class="post-author-name">
              ${escHtml(post.author?.name || 'Anonymous')}
              ${post.author?.verified ? '<span class="verified-check">✓</span>' : ''}
            </div>
            <div class="post-meta">
              <i data-lucide="map-pin" style="width:11px;height:11px"></i>
              Costa Blanca Villas
              <span class="post-meta-dot"></span>
              ${relativeTime(post.createdAt)}
            </div>
          </div>
        </div>
        <span class="post-type-pill pill-${post.type}">${postTypeLabel(post.type)}</span>
        <div style="position:relative;margin-left:auto;">
          <button onclick="togglePostMenu('${post.id}')" style="width:30px;height:30px;border:none;background:none;cursor:pointer;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;color:var(--text-light);transition:background 0.15s;" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='none'">⋯</button>
          <div id="post-menu-${post.id}" style="display:none;position:absolute;right:0;top:34px;background:white;border:1px solid var(--border);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.12);min-width:180px;z-index:50;overflow:hidden;">
            <button onclick="openReportModal('post','${post.id}','${escHtml(post.author?.name || 'post').replace(/'/g,"\\'")}');togglePostMenu('${post.id}')" style="width:100%;padding:11px 16px;background:none;border:none;text-align:left;cursor:pointer;font-size:13.5px;font-family:inherit;color:var(--text);display:flex;align-items:center;gap:10px;" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='none'">⚑ Report Post</button>
            ${currentUser?.role === 'admin' ? `<button onclick="adminDeletePost('${post.id}');togglePostMenu('${post.id}')" style="width:100%;padding:11px 16px;background:none;border:none;text-align:left;cursor:pointer;font-size:13.5px;font-family:inherit;color:var(--coral);display:flex;align-items:center;gap:10px;border-top:1px solid var(--border);" onmouseover="this.style.background='#fff5f5'" onmouseout="this.style.background='none'">🗑️ Delete Post</button>` : ''}
          </div>
        </div>
      </div>

      <div class="post-content" id="content-${post.id}">
        ${buildPostContent(post)}
      </div>

      ${post.pollOptions ? buildPollHTML(post) : ''}

      ${post.image ? `<div class="post-image-wrap"><img src="${post.image}" alt="Post image" style="width:100%;border-radius:10px;margin-top:12px;object-fit:cover;max-height:360px;display:block;cursor:zoom-in;" onclick="openLightbox('${post.image}')"></div>` : ''}

      <div class="post-divider"></div>

      ${totalReactions > 0 ? `
        <div class="reaction-summary">
          <div style="display:flex;align-items:center;gap:4px;">
            <div class="reaction-emojis">
              ${topReactions.map(r => `<div class="reaction-emoji-item">${r.emoji}</div>`).join('')}
            </div>
            <span class="reaction-count-text">${totalReactions} reaction${totalReactions !== 1 ? 's' : ''}</span>
          </div>
          ${post.commentCount > 0 ? `<span style="font-size:12px;color:var(--text-light);cursor:pointer" onclick="toggleComments('${post.id}',this)">${post.commentCount} comment${post.commentCount !== 1 ? 's' : ''}</span>` : ''}
        </div>
        <div class="post-divider"></div>
      ` : ''}

      <div class="post-actions">
        <div class="reaction-btn ${post.userReaction ? 'reacted' : ''}" id="react-btn-${post.id}" onclick="showReactionPicker(event,'${post.id}')">
          <span class="reaction-btn-emoji">${post.userReaction ? reactionEmoji(post.userReaction) : '👍'}</span>
          <span class="reaction-btn-count">${post.userReaction ? capitalize(post.userReaction) : 'React'}</span>
        </div>
        <div class="reaction-picker" id="picker-${post.id}">
          ${buildReactionPicker(post.id)}
        </div>
        <button class="comment-btn" onclick="toggleComments('${post.id}',this)">
          <i data-lucide="message-circle" style="width:16px;height:16px"></i>
          ${post.commentCount > 0 ? post.commentCount : ''} Comment
        </button>
        <button class="share-btn" onclick="handleShare('${post.id}')">
          <i data-lucide="share-2" style="width:15px;height:15px"></i>
          Share
        </button>
        ${canResolve ? `<button onclick="resolveAlert('${post.id}')" style="margin-left:auto;padding:6px 14px;background:#2A9D8F;color:white;border:none;border-radius:20px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">✅ Mark Resolved</button>` : ''}
        ${post.severity === 'resolved' && post.resolvedBy ? `<span style="margin-left:auto;font-size:11.5px;color:#2A9D8F;font-weight:600;">✅ Resolved by ${escHtml(post.resolvedBy)}</span>` : ''}
      </div>
    </div>

    <div class="comments-area" id="comments-${post.id}">
      <div class="comments-inner" id="comments-inner-${post.id}">
        <div class="loading-spinner" style="width:24px;height:24px;margin:12px auto;"></div>
      </div>
    </div>
  `;

  return card;
}

function buildPostContent(post) {
  const maxLen = 280;
  const text = escHtml(post.content);
  if (post.content.length <= maxLen) return text;
  const truncated = escHtml(post.content.substring(0, maxLen));
  return `
    <span id="text-short-${post.id}">${truncated}... <button class="read-more-btn" onclick="expandPost('${post.id}')">Read more</button></span>
    <span id="text-full-${post.id}" style="display:none">${text} <button class="read-more-btn" onclick="collapsePost('${post.id}')">Show less</button></span>
  `;
}

function expandPost(id) {
  document.getElementById(`text-short-${id}`).style.display = 'none';
  document.getElementById(`text-full-${id}`).style.display = '';
}

function collapsePost(id) {
  document.getElementById(`text-short-${id}`).style.display = '';
  document.getElementById(`text-full-${id}`).style.display = 'none';
}

function buildPollHTML(post) {
  const total = (post.pollOptions || []).reduce((s, o) => s + o.votes, 0);
  return `
    <div class="poll-container">
      ${post.pollOptions.map(opt => {
        const pct = total > 0 ? Math.round((opt.votes / total) * 100) : 0;
        const isVoted = post.userVote === opt.id;
        return `
          <div class="poll-option${isVoted ? ' voted' : ''}" onclick="votePoll('${post.id}','${opt.id}',this)">
            <div class="poll-bar-wrap">
              <div class="poll-bar" style="width:${pct}%"></div>
              <div class="poll-bar-label">
                <span>${escHtml(opt.text)}</span>
                <span class="poll-bar-pct">${pct}%</span>
              </div>
            </div>
          </div>
        `;
      }).join('')}
      <div class="poll-total">${total} vote${total !== 1 ? 's' : ''}</div>
    </div>
  `;
}

function votePoll(postId, optId, el) {
  showToast('Your vote has been recorded! 🗳️');
}

function buildReactionPicker(postId) {
  const reactions = [
    { key: 'like', emoji: '👍', label: 'Like' },
    { key: 'insightful', emoji: '💡', label: 'Insightful' },
    { key: 'agree', emoji: '✅', label: 'Agree' },
    { key: 'haha', emoji: '😄', label: 'Haha' },
    { key: 'wow', emoji: '😮', label: 'Wow' },
    { key: 'sad', emoji: '😢', label: 'Sad' }
  ];
  return reactions.map(r => `
    <button class="reaction-pick-btn" onclick="reactToPost('${postId}','${r.key}')">
      ${r.emoji}
      <span class="reaction-tooltip">${r.label}</span>
    </button>
  `).join('');
}

function showReactionPicker(event, postId) {
  event.stopPropagation();
  const picker = document.getElementById(`picker-${postId}`);
  if (!picker) return;
  const isOpen = picker.classList.contains('show');

  // Close all pickers
  document.querySelectorAll('.reaction-picker.show').forEach(p => p.classList.remove('show'));

  if (!isOpen) picker.classList.add('show');
}

async function reactToPost(postId, reaction) {
  // Close picker
  document.querySelectorAll('.reaction-picker.show').forEach(p => p.classList.remove('show'));

  try {
    const res = await fetch(`/api/posts/${postId}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reaction })
    });
    if (!res.ok) throw new Error();
    const data = await res.json();

    // Update react button
    const btn = document.getElementById(`react-btn-${postId}`);
    if (btn) {
      if (data.userReaction) {
        btn.classList.add('reacted');
        btn.querySelector('.reaction-btn-emoji').textContent = reactionEmoji(data.userReaction);
        btn.querySelector('.reaction-btn-count').textContent = capitalize(data.userReaction);
      } else {
        btn.classList.remove('reacted');
        btn.querySelector('.reaction-btn-emoji').textContent = '👍';
        btn.querySelector('.reaction-btn-count').textContent = 'React';
      }
    }
  } catch {
    showToast('Please log in to react');
  }
}

async function toggleComments(postId, triggerEl) {
  const area = document.getElementById(`comments-${postId}`);
  if (!area) return;

  if (area.classList.contains('open')) {
    area.classList.remove('open');
    openComments.delete(postId);
    return;
  }

  area.classList.add('open');
  openComments.add(postId);

  // Load comments
  try {
    const comments = await fetchJSON(`/api/posts/${postId}/comments`);
    const inner = document.getElementById(`comments-inner-${postId}`);
    if (!inner) return;
    inner.innerHTML = '';

    if (comments && comments.length) {
      comments.forEach(c => {
        inner.appendChild(buildCommentEl(c));
      });
    } else {
      inner.innerHTML = '<div style="text-align:center;padding:12px;color:var(--text-light);font-size:13px;">No comments yet. Be the first!</div>';
    }

    // Comment input
    const inputRow = document.createElement('div');
    inputRow.className = 'comment-input-row';
    inputRow.innerHTML = `
      <div class="avatar-comment" style="background:${currentUser?.avatar || '#0077B6'};width:30px;height:30px;flex-shrink:0;overflow:hidden;">
        ${currentUser?.avatarUrl ? `<img src="${currentUser.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (currentUser?.initials || 'ME')}
      </div>
      <input type="text" class="comment-input" placeholder="Add a comment..." id="comment-input-${postId}" onkeydown="commentKeydown(event,'${postId}')" />
      <button class="comment-submit" onclick="submitComment('${postId}')">
        <i data-lucide="send" style="width:14px;height:14px"></i>
      </button>
    `;
    inner.appendChild(inputRow);
    lucide.createIcons();
  } catch {
    const inner = document.getElementById(`comments-inner-${postId}`);
    if (inner) inner.innerHTML = '<div style="text-align:center;padding:12px;color:var(--coral);font-size:13px;">Could not load comments.</div>';
  }
}

function commentKeydown(event, postId) {
  if (event.key === 'Enter') submitComment(postId);
}

async function submitComment(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;

  try {
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content: text })
    });
    if (!res.ok) throw new Error();
    const comment = await res.json();
    input.value = '';

    const inner = document.getElementById(`comments-inner-${postId}`);
    if (inner) {
      const noComment = inner.querySelector('div[style*="text-align:center"]');
      if (noComment) noComment.remove();
      inner.insertBefore(buildCommentEl(comment), inner.lastChild);
      lucide.createIcons();
    }
    refreshPoints();
    showToast('Comment posted! 💬');
  } catch {
    showToast('Could not post comment. Please try again.');
  }
}

function buildCommentEl(c) {
  const div = document.createElement('div');
  div.className = 'comment-item';
  div.innerHTML = `
    <div class="avatar-comment" style="background:${c.author?.avatar || '#0077B6'}">
      ${c.author?.initials || '??'}
    </div>
    <div class="comment-bubble">
      <div class="comment-author">${escHtml(c.author?.name || 'Anonymous')}</div>
      <div class="comment-text">${escHtml(c.content)}</div>
      <div class="comment-time">${relativeTime(c.createdAt)}</div>
    </div>
  `;
  return div;
}

// ─── Marketplace Card ────────────────────────────────────────────
const categoryIcons = {
  'Furniture': '🪑', 'Transportation': '🛴', 'Sports': '🏄',
  'Home & Garden': '🪴', 'Free': '🎁', 'Decor': '🖼️',
  'Electronics': '🔊', 'Clothing': '👕', 'Toys': '🧸', 'default': '📦'
};

function buildMarketCard(item) {
  const card = document.createElement('div');
  card.className = 'market-card';
  const icon = categoryIcons[item.category] || categoryIcons.default;

  const gradients = {
    '#2A9D8F': 'linear-gradient(135deg,rgba(42,157,143,0.15),rgba(0,119,182,0.1))',
    '#0077B6': 'linear-gradient(135deg,rgba(0,119,182,0.12),rgba(3,4,94,0.08))',
    '#E76F51': 'linear-gradient(135deg,rgba(231,111,81,0.12),rgba(244,162,97,0.08))',
    '#457B9D': 'linear-gradient(135deg,rgba(69,123,157,0.15),rgba(0,119,182,0.08))',
    '#264653': 'linear-gradient(135deg,rgba(38,70,83,0.12),rgba(0,119,182,0.06))',
    '#52B788': 'linear-gradient(135deg,rgba(82,183,136,0.12),rgba(42,157,143,0.08))',
    '#F4A261': 'linear-gradient(135deg,rgba(244,162,97,0.15),rgba(231,111,81,0.08))',
    '#E63946': 'linear-gradient(135deg,rgba(230,57,70,0.1),rgba(231,111,81,0.08))',
    '#6D6875': 'linear-gradient(135deg,rgba(109,104,117,0.1),rgba(38,70,83,0.06))',
  };

  const bg = gradients[item.color] || 'linear-gradient(135deg,rgba(0,119,182,0.1),rgba(42,157,143,0.08))';
  const priceDisplay = item.free || item.price === 0 ? 'FREE' : `$${item.price}`;
  const priceClass = item.free || item.price === 0 ? 'free-badge' : 'paid-badge';

  const imgContent = item.image
    ? `<img src="${item.image}" alt="${escHtml(item.title)}" style="width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in;" onclick="openLightbox('${item.image}')">`
    : `<span style="font-size:52px">${icon}</span>`;

  card.innerHTML = `
    <div class="market-img" style="${item.image ? '' : `background:${bg}`}">
      ${imgContent}
      <div class="market-price-badge ${priceClass}">${priceDisplay}</div>
    </div>
    <div class="market-info">
      <div class="market-title">${escHtml(item.title)}</div>
      <div class="market-seller">
        <div class="avatar-sm" style="background:${item.seller?.avatar || '#0077B6'};width:20px;height:20px;font-size:8px;">${item.seller?.initials || '??'}</div>
        ${escHtml(item.seller?.name?.split(' ')[0] || 'Neighbor')}
        <span class="post-meta-dot" style="margin:0 2px"></span>
        ${relativeTime(item.createdAt)}
      </div>
      <div class="market-condition">${escHtml(item.condition || '')}</div>
      <div style="font-size:12px;color:var(--text-mid);margin-bottom:10px;line-height:1.4;">${escHtml(item.description || '')}</div>
      <button class="btn-contact" onclick="event.stopPropagation();contactSeller('${item.seller?.name || 'Seller'}')">
        Message Seller
      </button>
    </div>
  `;
  return card;
}

function contactSeller(name) {
  showToast(`Message sent to ${name}! They'll respond soon 📬`);
}

// ─── Event Card ──────────────────────────────────────────────────
function buildEventCard(ev) {
  const card = document.createElement('div');
  card.className = 'event-card';
  const dateObj = new Date(ev.date + 'T12:00:00');
  const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const day = dateObj.getDate();
  const totalGoing = ev.rsvp?.going || 0;

  card.innerHTML = `
    <div class="event-date-badge">
      <div class="event-date-inner">
        <div class="event-month">${month}</div>
        <div class="event-day">${day}</div>
      </div>
    </div>
    <div class="event-body">
      <div class="event-category-tag">${ev.category || 'Community'}</div>
      <div class="event-title">${escHtml(ev.title)}</div>
      <div class="event-desc">${escHtml(ev.description)}</div>
      <div class="event-meta-row">
        <div class="event-meta-item">
          <i data-lucide="clock" style="width:12px;height:12px"></i>
          ${ev.time}${ev.endTime ? ` – ${ev.endTime}` : ''}
        </div>
        <div class="event-meta-item">
          <i data-lucide="map-pin" style="width:12px;height:12px"></i>
          ${escHtml(ev.location)}
        </div>
        <div class="event-meta-item">
          <i data-lucide="user" style="width:12px;height:12px"></i>
          ${escHtml(ev.host?.name || 'Organizer')}
        </div>
      </div>
      <div class="rsvp-row" id="rsvp-row-${ev.id}">
        ${buildRsvpButtons(ev)}
        <div class="going-avatars">
          ${(ev.goingAvatars || []).slice(0, 5).map(c => `<div class="going-avatar" style="background:${c}"></div>`).join('')}
          <span class="going-count">${totalGoing} going</span>
        </div>
      </div>
    </div>
  `;
  return card;
}

function buildRsvpButtons(ev) {
  return `
    <button class="rsvp-btn${ev.userRsvp === 'going' ? ' going' : ''}" onclick="rsvpEvent('${ev.id}','going',this)">
      ✓ Going
    </button>
    <button class="rsvp-btn${ev.userRsvp === 'maybe' ? ' maybe' : ''}" onclick="rsvpEvent('${ev.id}','maybe',this)">
      ? Maybe
    </button>
    <button class="rsvp-btn${ev.userRsvp === 'cantGo' ? ' cantgo' : ''}" onclick="rsvpEvent('${ev.id}','cantGo',this)">
      ✕ Can't Go
    </button>
  `;
}

async function rsvpEvent(eventId, status, btn) {
  try {
    const res = await fetch(`/api/events/${eventId}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status })
    });
    if (!res.ok) throw new Error();
    const data = await res.json();

    const row = document.getElementById(`rsvp-row-${eventId}`);
    if (row) {
      // Get the event data from server
      const events = await fetchJSON('/api/events');
      const ev = events.find(e => e.id === eventId);
      if (ev) {
        const btns = row.querySelectorAll('.rsvp-btn');
        btns[0].className = `rsvp-btn${data.userRsvp === 'going' ? ' going' : ''}`;
        btns[1].className = `rsvp-btn${data.userRsvp === 'maybe' ? ' maybe' : ''}`;
        btns[2].className = `rsvp-btn${data.userRsvp === 'cantGo' ? ' cantgo' : ''}`;
      }
    }

    const msgs = { going: '🎉 You\'re going!', maybe: '🤔 Marked as maybe!', cantGo: 'Marked as can\'t go.' };
    showToast(msgs[status] || 'RSVP updated!');
  } catch {
    showToast('Could not update RSVP. Please try again.');
  }
}

// ─── Business Card ───────────────────────────────────────────────
const bizIcons = {
  'Sports & Recreation': '🏄', 'Home Services': '🔧', 'Food & Drink': '🍹',
  'Restaurant': '🍽️', 'Shopping': '👜', 'Health & Fitness': '🧘',
  'Real Estate': '🏡', 'Bar & Grill': '🍺', 'Transportation': '🚗',
  'Spa & Wellness': '💆', 'Entertainment': '🎉', 'default': '⭐'
};

function buildBusinessCard(biz) {
  const card = document.createElement('div');
  card.className = 'business-card';
  const icon = bizIcons[biz.category] || bizIcons.default;

  card.innerHTML = `
    <div class="business-header">
      <div class="business-icon">${icon}</div>
      <div>
        <div class="business-name">${escHtml(biz.name)}</div>
        <div class="business-category">${escHtml(biz.category)}</div>
      </div>
    </div>
    <div class="star-rating">
      ${buildStars(biz.rating)}
      <span class="rating-num">${biz.rating}</span>
      <span class="review-count">(${biz.reviewCount} reviews)</span>
    </div>
    <div class="recommended-badge">👥 Recommended by ${biz.recommendedBy} neighbors</div>
    <div class="business-desc">${escHtml(biz.description)}</div>
    <div class="business-meta">
      <div class="business-meta-row">
        <i data-lucide="map-pin" style="width:12px;height:12px;color:var(--text-light)"></i>
        ${escHtml(biz.address)}
      </div>
      <div class="business-meta-row">
        <i data-lucide="clock" style="width:12px;height:12px;color:var(--text-light)"></i>
        ${escHtml(biz.hours)}
      </div>
      <div class="business-meta-row">
        <i data-lucide="phone" style="width:12px;height:12px;color:var(--text-light)"></i>
        ${escHtml(biz.phone)}
      </div>
    </div>
    <div class="business-tags">
      ${(biz.tags || []).map(t => `<span class="business-tag">${t}</span>`).join('')}
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;">
      <button class="btn-business-contact" style="flex:1" onclick="openBusinessModal('${biz.id}')">
        ⭐ Reviews (${biz.reviewCount})
      </button>
      <a href="tel:${biz.phone.replace(/\s/g,'')}" class="btn-business-contact" style="flex:1;background:var(--seafoam);text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;">
        📞 Call
      </a>
    </div>
  `;
  return card;
}

async function openBusinessModal(bizId) {
  const modal = document.getElementById('postDetailModal');
  const body = document.getElementById('postDetailBody');
  const title = modal.querySelector('.modal-header h3');
  if (title) title.textContent = 'Business Details';
  body.innerHTML = '<div class="loading-spinner"></div>';
  openModal('postDetailModal');

  const biz = await fetchJSON(`/api/businesses/${bizId}`);
  if (!biz) { body.innerHTML = '<p style="padding:20px;color:var(--coral)">Could not load business details.</p>'; return; }

  const icon = bizIcons[biz.category] || bizIcons.default;
  const reviews = biz.reviews || [];
  const avgStars = buildStars(biz.rating);

  // Rating breakdown
  const counts = [5,4,3,2,1].map(s => ({
    star: s,
    count: reviews.filter(r => r.rating === s).length
  }));

  body.innerHTML = `
    <div style="padding:20px;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:16px;">
        <div style="font-size:40px;line-height:1;">${icon}</div>
        <div>
          <div style="font-size:18px;font-weight:800;color:var(--text-dark)">${escHtml(biz.name)}</div>
          <div style="font-size:13px;color:var(--text-light)">${escHtml(biz.category)}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
            ${avgStars}
            <span style="font-weight:700;color:var(--text-dark)">${biz.rating}</span>
            <span style="color:var(--text-light);font-size:12px">(${biz.reviewCount} reviews)</span>
          </div>
        </div>
      </div>

      <div style="background:var(--bg);border-radius:12px;padding:14px;margin-bottom:16px;font-size:13px;color:var(--text-mid);line-height:1.6">
        ${escHtml(biz.description)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:18px;font-size:13px;">
        <div style="display:flex;align-items:center;gap:6px;color:var(--text-mid);">
          <i data-lucide="map-pin" style="width:13px;height:13px;color:var(--coral);flex-shrink:0"></i>${escHtml(biz.address)}
        </div>
        <div style="display:flex;align-items:center;gap:6px;color:var(--text-mid);">
          <i data-lucide="clock" style="width:13px;height:13px;color:var(--ocean);flex-shrink:0"></i>${escHtml(biz.hours)}
        </div>
        <div style="display:flex;align-items:center;gap:6px;color:var(--text-mid);">
          <i data-lucide="phone" style="width:13px;height:13px;color:var(--seafoam);flex-shrink:0"></i>${escHtml(biz.phone)}
        </div>
        <div style="display:flex;align-items:center;gap:6px;color:var(--text-mid);">
          <i data-lucide="users" style="width:13px;height:13px;color:var(--purple);flex-shrink:0"></i>Recommended by ${biz.recommendedBy} neighbors
        </div>
      </div>

      <div style="font-size:14px;font-weight:700;color:var(--text-dark);margin-bottom:12px;">
        Neighbor Reviews
      </div>

      ${reviews.length === 0 ? '<p style="color:var(--text-light);font-size:13px;">No reviews yet.</p>' : reviews.map(r => `
        <div style="border-top:1px solid var(--border);padding:14px 0;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <div style="width:34px;height:34px;border-radius:50%;background:${r.avatar};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0;">${r.initials}</div>
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--text-dark)">${escHtml(r.author)}</div>
              <div style="display:flex;align-items:center;gap:6px;">
                ${buildStars(r.rating)}
                <span style="font-size:11px;color:var(--text-light)">${r.date}</span>
              </div>
            </div>
          </div>
          <div style="font-size:13px;color:var(--text-mid);line-height:1.6;padding-left:44px">${escHtml(r.text)}</div>
        </div>
      `).join('')}

      <div style="margin-top:16px;display:flex;gap:10px;">
        <a href="tel:${biz.phone.replace(/\s/g,'')}" class="btn-business-contact" style="flex:1;text-decoration:none;text-align:center;display:block;">📞 Call Now</a>
        <button class="btn-business-contact" style="flex:1;background:var(--seafoam);" onclick="showToast('Review submitted! ⭐');closeModal('postDetailModal')">Write a Review</button>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
}

function buildBusinessListingCard(biz) {
  const icon = bizIcons[biz.category] || bizIcons.default;
  const bgColors = { 'Restaurant': '#FFF3E0', 'Bar & Grill': '#FCE4EC', 'Transportation': '#E8F5E9', 'default': '#E3F2FD' };
  const fgColors = { 'Restaurant': '#E65100', 'Bar & Grill': '#880E4F', 'Transportation': '#1B5E20', 'default': '#0D47A1' };
  const bg = bgColors[biz.category] || bgColors.default;
  const fg = fgColors[biz.category] || fgColors.default;
  const faveYears = biz.faveYears || [];

  const card = document.createElement('div');
  card.className = 'biz-listing-card';
  card.onclick = () => openBusinessPage(biz.id);
  card.innerHTML = `
    <div class="biz-listing-logo" style="background:${bg};color:${fg};">${icon}</div>
    <div class="biz-listing-body">
      <div class="biz-listing-name">
        ${escHtml(biz.name)}
        <span class="biz-verified-badge">✓</span>
        ${faveYears.length ? '<span style="font-size:12px;color:#3A7D44;font-weight:600;">🏆 Neighborhood Fave</span>' : ''}
      </div>
      <div class="biz-listing-category">${escHtml(biz.category)}</div>
      <div class="biz-listing-rating">
        ${buildStars(biz.rating)}
        <span style="font-size:12px;font-weight:700;color:var(--text-dark)">${biz.rating}</span>
        <span style="font-size:12px;color:var(--text-light)">(${biz.reviewCount})</span>
      </div>
      <div class="biz-listing-desc">${escHtml(biz.description)}</div>
      <div class="biz-listing-tags">
        ${(biz.tags || []).slice(0, 4).map(t => `<span class="biz-listing-tag">${t}</span>`).join('')}
      </div>
      <div class="biz-listing-footer">
        <span class="biz-listing-fave-count">❤️ ${biz.currentYearFaves || biz.recommendedBy} neighbors faved this</span>
        <button onclick="event.stopPropagation();openBusinessPage('${biz.id}')" style="padding:7px 16px;background:#3A7D44;color:white;border:none;border-radius:20px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;">View Profile</button>
      </div>
    </div>
  `;
  return card;
}

async function openBusinessPage(bizId) {
  currentBizId = bizId;
  const container = document.getElementById('sectionContent');
  container.innerHTML = '<div class="loading-spinner" style="margin:60px auto;display:block;"></div>';
  await renderBusinessPage(bizId, container);
}

async function renderBusinessPage(bizId, container) {
  const biz = await fetchJSON(`/api/businesses/${bizId}`);
  if (!biz) { container.innerHTML = '<p style="padding:30px;color:var(--coral);">Could not load business.</p>'; return; }

  const icon = bizIcons[biz.category] || bizIcons.default;
  const bgColors = { 'Restaurant': '#FFF3E0', 'Bar & Grill': '#FCE4EC', 'Transportation': '#E8F5E9', 'default': '#E3F2FD' };
  const bg = bgColors[biz.category] || bgColors.default;
  const photos = biz.photos || [];
  const reviews = biz.reviews || [];
  const faveYears = biz.faveYears || [];
  const currentYearFaves = biz.currentYearFaves || 0;
  const faveThreshold = biz.faveThreshold || 30;
  const userHasFaved = biz.userHasFaved || false;
  const currentYear = new Date().getFullYear();
  const alreadyWonThisYear = faveYears.includes(currentYear);
  const pct = Math.min(100, Math.round((currentYearFaves / faveThreshold) * 100));

  // Trophy icon — CSS circle outline style like Nextdoor
  const trophySVG = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4a2 2 0 0 1-2-2V5h4"/><path d="M18 9h2a2 2 0 0 0 2-2V5h-4"/><path d="M12 17v4"/><path d="M8 21h8"/><path d="M6 5h12v4a6 6 0 0 1-12 0V5Z"/></svg>`;

  const wrap = document.createElement('div');
  wrap.className = 'biz-page';
  wrap.innerHTML = `
    <button class="group-back-btn" onclick="navigate('businesses')">← Back to Businesses</button>

    <!-- Header card — matches Nextdoor layout exactly -->
    <div class="biz-page-header-card" style="flex-direction:column;padding:0;overflow:hidden;">
      <!-- Top section: logo + name + actions -->
      <div style="display:flex;align-items:flex-start;gap:18px;padding:24px 24px 16px;">
        <div style="position:relative;flex-shrink:0;">
          <div class="biz-logo-circle" style="background:${bg};font-size:40px;width:88px;height:88px;">${icon}</div>
          <div style="position:absolute;bottom:-3px;right:-3px;width:22px;height:22px;background:var(--ocean);border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:10px;color:white;font-weight:700;">✓</div>
        </div>
        <div style="flex:1;min-width:0;padding-top:4px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px;">
            <span style="font-size:22px;font-weight:800;color:var(--text-dark);">${escHtml(biz.name)}</span>
            <span style="font-size:14px;font-weight:600;color:var(--text-light);">${biz.recommendedBy}</span>
          </div>
          <div style="font-size:14px;color:var(--ocean);font-weight:500;margin-bottom:14px;">${escHtml(biz.category)}</div>
          <div class="biz-action-bar">
            <button class="btn-biz-fave${userHasFaved ? ' faved' : ''}" id="bizFaveBtn-${biz.id}" onclick="toggleBizFave('${biz.id}')">${userHasFaved ? '⭐ Faved' : '⭐ Fave'}</button>
            <button class="btn-biz-message" onclick="showToast('Messaging coming soon!')">💬 Message</button>
            <div style="position:relative;">
              <button class="btn-biz-more" onclick="toggleBizMoreMenu('${biz.id}')">⋯</button>
              <div class="biz-more-dropdown" id="bizMoreMenu-${biz.id}" style="display:none;">
                <div class="biz-more-item" onclick="showToast('${escHtml(biz.name)} muted.');toggleBizMoreMenu('${biz.id}')"><span class="biz-more-item-icon">🔇</span><div><div class="biz-more-item-text">Mute</div><div class="biz-more-item-sub">Hide all posts from ${escHtml(biz.name)}</div></div></div>
                <div class="biz-more-item" onclick="showToast('${escHtml(biz.name)} blocked.');toggleBizMoreMenu('${biz.id}')"><span class="biz-more-item-icon">🚫</span><div><div class="biz-more-item-text">Block</div><div class="biz-more-item-sub">Stop messages from ${escHtml(biz.name)}</div></div></div>
                <div class="biz-more-item" onclick="openReportModal('business','${biz.id}','${escHtml(biz.name).replace(/'/g,"\\'")}');toggleBizMoreMenu('${biz.id}')"><span class="biz-more-item-icon">⚑</span><div><div class="biz-more-item-text">Report</div><div class="biz-more-item-sub">Flag for review</div></div></div>
                <div class="biz-more-item" onclick="showToast('Link copied!');toggleBizMoreMenu('${biz.id}')"><span class="biz-more-item-icon">🔗</span><div><div class="biz-more-item-text">Share ${escHtml(biz.name)}</div><div class="biz-more-item-sub">Share on or off Costa Blanca Connect</div></div></div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Description in header — like Nextdoor -->
      <div style="padding:0 24px 20px;font-size:14px;color:var(--text-mid);line-height:1.65;">${escHtml(biz.description)}</div>
      <!-- Claim page banner -->
      <div style="border-top:1px solid var(--border);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;background:#fafcff;">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-mid);">
          <span style="font-size:15px;">ℹ️</span> Is this your business?
        </div>
        <button onclick="openClaimModal('${biz.id}','${escHtml(biz.name).replace(/'/g,"\\'")}')" style="font-size:13px;font-weight:700;color:var(--ocean);background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;font-family:inherit;">Claim this business →</button>
      </div>
    </div>

    <!-- Two-column layout -->
    <div class="biz-page-layout">
      <!-- Main content -->
      <div class="biz-page-main">
        <div class="biz-tab-bar">
          <button class="biz-tab active" onclick="switchBizTab('overview')">Overview</button>
          <button class="biz-tab" onclick="switchBizTab('recommendations')">Recommendations</button>
          <button class="biz-tab" onclick="switchBizTab('photos')">Photos</button>
        </div>

        <!-- Overview tab -->
        <div id="bizTab-overview">
          ${photos.length ? `
            <div style="display:flex;gap:6px;margin-bottom:20px;overflow:hidden;border-radius:12px;max-height:200px;">
              ${photos.slice(0,4).map((url,i) => `<img src="${url}" alt="Photo" loading="lazy" style="flex:1;min-width:0;height:200px;object-fit:cover;${i===0?'border-radius:12px 0 0 12px;':''}${i===photos.length-1||i===3?'border-radius:0 12px 12px 0;':''}" />`).join('')}
            </div>` : ''}

          <div class="biz-fave-section" id="bizFaveSection-${biz.id}">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
              <h3 style="margin:0;">Neighborhood Fave</h3>
            </div>
            ${faveYears.length ? `
            <div class="biz-fave-awards" style="margin-bottom:16px;">
              ${faveYears.map(y => `
                <div class="biz-fave-award">
                  <div class="biz-fave-award-icon" style="color:#B8860B;">${trophySVG}</div>
                  <div class="biz-fave-award-year">${y}</div>
                </div>`).join('')}
            </div>` : ''}
            ${alreadyWonThisYear ? `
            <div style="display:flex;align-items:center;gap:8px;padding:12px 14px;background:#FFFBEA;border:1.5px solid #F6C90E;border-radius:10px;font-size:13px;font-weight:600;color:#7A5B00;">
              🏆 ${currentYear} Neighborhood Fave Award earned!
            </div>` : `
            <div style="background:white;border:1px solid var(--border);border-radius:12px;padding:14px 16px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                <span style="font-size:13px;font-weight:600;color:var(--text-dark);">Progress toward ${currentYear} Award</span>
                <span style="font-size:13px;font-weight:700;color:var(--ocean);" id="bizFaveCount-${biz.id}">${currentYearFaves} / ${faveThreshold}</span>
              </div>
              <div style="background:#E8EDF2;border-radius:20px;height:8px;overflow:hidden;margin-bottom:8px;">
                <div id="bizFaveBar-${biz.id}" style="height:100%;border-radius:20px;background:linear-gradient(90deg,#0077B6,#00B4D8);transition:width 0.4s ease;width:${pct}%;"></div>
              </div>
              <div style="font-size:12px;color:var(--text-light);">${faveThreshold - currentYearFaves} more fave${faveThreshold - currentYearFaves !== 1 ? 's' : ''} needed for the ${currentYear} Neighborhood Fave award</div>
            </div>`}
          </div>
        </div>

        <!-- Recommendations tab (hidden) -->
        <div id="bizTab-recommendations" style="display:none;">
          <div class="biz-rec-compose">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:38px;height:38px;border-radius:50%;background:${currentUser?.avatar||'#0077B6'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;">${currentUser?.initials||'?'}</div>
              <div style="flex:1;position:relative;">
                <input id="bizRecBox" type="text" placeholder="Add a recommendation..." style="width:100%;padding:11px 50px 11px 16px;border:1.5px solid var(--border);border-radius:30px;font-size:14px;font-family:inherit;outline:none;background:var(--bg);" />
                <button onclick="submitBizRec('${biz.id}')" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);width:32px;height:32px;background:var(--ocean);color:white;border:none;border-radius:50%;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;">→</button>
              </div>
            </div>
          </div>
          <div style="font-size:13px;font-weight:700;color:var(--text-dark);margin-bottom:12px;">${reviews.length} Recommendation${reviews.length !== 1 ? 's' : ''}</div>
          ${reviews.length === 0 ? '<div style="background:white;border:1px solid var(--border);border-radius:var(--radius);padding:30px;text-align:center;color:var(--text-light);font-size:14px;">No recommendations yet — be the first!</div>' :
            reviews.map(r => `
              <div class="biz-rec-card">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                  <div style="width:40px;height:40px;border-radius:50%;background:${r.avatar};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;">${r.initials}</div>
                  <div>
                    <div style="font-size:14px;font-weight:700;color:var(--text-dark);">${escHtml(r.author)}</div>
                    <div style="display:flex;align-items:center;gap:6px;">${buildStars(r.rating)}<span style="font-size:11.5px;color:var(--text-light);">${r.date}</span></div>
                  </div>
                </div>
                <div style="font-size:14px;color:var(--text-mid);line-height:1.65;">${escHtml(r.text)}</div>
                ${r.ownerReply ? `<div style="margin-top:10px;padding:10px 12px;background:var(--bg);border-radius:10px;font-size:13px;color:var(--text-mid);border-left:3px solid var(--ocean);"><span style="font-weight:700;color:var(--text-dark);">Owner replied:</span> ${escHtml(r.ownerReply)}</div>` : ''}
              </div>`).join('')}
        </div>

        <!-- Photos tab (hidden) -->
        <div id="bizTab-photos" style="display:none;">
          ${photos.length ? `<div class="biz-photo-grid">${photos.map(url => `<img src="${url}" alt="Business photo" loading="lazy" />`).join('')}</div>`
            : '<div style="background:white;border:1px solid var(--border);border-radius:var(--radius);padding:40px;text-align:center;color:var(--text-light);">No photos yet.</div>'}
        </div>
      </div>

      <!-- Right sidebar -->
      <div class="biz-page-sidebar">
        <div class="biz-sidebar-card">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid var(--border);">
            <span style="font-size:18px;">🍽️</span>
            <span style="font-size:13px;font-weight:600;color:var(--text-mid);">${escHtml(biz.category)} · ${(biz.tags||[]).slice(0,2).join(' · ')}</span>
          </div>
          <div class="biz-sidebar-row"><span class="biz-sidebar-icon">📞</span><span>${escHtml(biz.phone)}</span></div>
          <div class="biz-sidebar-row"><span class="biz-sidebar-icon">🕐</span><span>${escHtml(biz.hours)}</span></div>
          <div class="biz-sidebar-row"><span class="biz-sidebar-icon">📍</span><span>${escHtml(biz.address)}</span></div>
          <div class="biz-sidebar-row"><span class="biz-sidebar-icon">🧭</span><span style="color:var(--ocean);cursor:pointer;font-weight:600;" onclick="showToast('Opening directions...')">Get directions</span></div>
          ${biz.website && biz.website !== '#' ? `<div class="biz-sidebar-row"><span class="biz-sidebar-icon">🔗</span><span style="color:var(--ocean);">${escHtml(biz.website)}</span></div>` : ''}
        </div>
        <div class="biz-sidebar-card" style="text-align:center;">
          <div style="font-size:28px;font-weight:800;color:var(--text-dark);">${biz.rating}</div>
          <div style="display:flex;justify-content:center;margin:4px 0 6px;">${buildStars(biz.rating)}</div>
          <div style="font-size:12px;color:var(--text-light);">${biz.reviewCount} reviews · ${biz.recommendedBy} faves</div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = '';
  container.appendChild(wrap);
}

function switchBizTab(tabName) {
  ['overview','recommendations','photos'].forEach(t => {
    const el = document.getElementById(`bizTab-${t}`);
    if (el) el.style.display = t === tabName ? 'block' : 'none';
  });
  document.querySelectorAll('.biz-tab').forEach(btn => {
    btn.classList.toggle('active', btn.textContent.toLowerCase().includes(tabName));
  });
}

function toggleBizMoreMenu(bizId) {
  const menu = document.getElementById(`bizMoreMenu-${bizId}`);
  if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

function openClaimModal(bizId, bizName) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:20px;width:min(480px,100%);padding:28px;box-shadow:0 24px 60px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;">
      <div style="font-size:24px;margin-bottom:6px;">🏪</div>
      <h3 style="font-size:17px;font-weight:800;margin-bottom:4px;color:#0d1b2a;">Claim ${escHtml(bizName)}</h3>
      <p style="font-size:13px;color:#4a6378;margin-bottom:20px;">Tell us who you are and we'll verify ownership. You'll receive login credentials within 24 hours to manage your business profile.</p>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:18px;">
        <div>
          <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Your full name *</label>
          <input id="claimName" type="text" placeholder="e.g. Maria González" value="${currentUser?.name || ''}" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Email address *</label>
          <input id="claimEmail" type="email" placeholder="you@example.com" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Phone number</label>
          <input id="claimPhone" type="tel" placeholder="+507 6XXX-XXXX" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" />
        </div>
        <div>
          <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Your role at this business</label>
          <select id="claimRole" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;">
            <option value="Owner">Owner</option>
            <option value="Manager">Manager</option>
            <option value="Marketing">Marketing / PR</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Anything to help us verify? <span style="font-weight:400;color:#8a9db0;">(optional)</span></label>
          <textarea id="claimMessage" rows="2" placeholder="e.g. I am the registered owner, my name appears on the business license." style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;resize:none;box-sizing:border-box;"></textarea>
        </div>
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="this.closest('[style*=fixed]').remove()" style="flex:1;padding:11px;background:#f0f3f7;border:none;border-radius:10px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;">Cancel</button>
        <button onclick="submitClaim(this,'${bizId}')" style="flex:1;padding:11px;background:#0077B6;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;">Submit Claim</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function submitClaim(btn, bizId) {
  const name  = document.getElementById('claimName')?.value.trim();
  const email = document.getElementById('claimEmail')?.value.trim();
  const phone = document.getElementById('claimPhone')?.value.trim();
  const role  = document.getElementById('claimRole')?.value;
  const message = document.getElementById('claimMessage')?.value.trim();
  if (!name || !email) { showToast('Name and email are required'); return; }
  btn.disabled = true; btn.textContent = 'Submitting…';
  const res = await fetch('/api/business/claim', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ businessId: bizId, name, email, phone, role, message })
  });
  const data = await res.json();
  btn.closest('[style*=fixed]').remove();
  if (res.ok) {
    showToast('Claim submitted! We will review and send your login within 24 hours.');
  } else {
    showToast(data.error || 'Could not submit claim — please try again.');
  }
}

async function toggleBizFave(bizId) {
  const res = await fetch(`/api/businesses/${bizId}/fave`, { method: 'POST', credentials: 'include' });
  if (!res.ok) return;
  const data = await res.json();

  // Update fave button
  const btn = document.getElementById(`bizFaveBtn-${bizId}`);
  if (btn) {
    btn.textContent = data.faved ? '⭐ Faved' : '⭐ Fave';
    btn.classList.toggle('faved', data.faved);
  }

  // Update progress bar & count
  const threshold = data.faveThreshold || 30;
  const count = data.currentYearFaves || 0;
  const pct = Math.min(100, Math.round((count / threshold) * 100));
  const countEl = document.getElementById(`bizFaveCount-${bizId}`);
  const barEl = document.getElementById(`bizFaveBar-${bizId}`);
  if (countEl) countEl.textContent = `${count} / ${threshold}`;
  if (barEl) barEl.style.width = `${pct}%`;

  // If threshold just hit, reload the whole page to show award badge
  const currentYear = new Date().getFullYear();
  if (data.faveYears && data.faveYears.includes(currentYear) && barEl) {
    await renderBusinessPage(bizId, document.getElementById('sectionContent'));
    return;
  }

  showToast(data.faved ? 'Added to your faves! ⭐' : 'Removed from faves.');
}

async function submitBizRec(bizId) {
  const box = document.getElementById('bizRecBox');
  const text = box?.value.trim();
  if (!text) return;
  const res = await fetch(`/api/businesses/${bizId}/recommend`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text })
  });
  if (res.ok) {
    box.value = '';
    await renderBusinessPage(bizId, document.getElementById('sectionContent'));
    switchBizTab('recommendations');
    showToast('Recommendation posted! ⭐');
  }
}

function buildStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (rating >= i) html += '<span class="star">★</span>';
    else if (rating >= i - 0.5) html += '<span class="star half">★</span>';
    else html += '<span class="star empty">★</span>';
  }
  return html;
}

// ─── Neighbor Card ───────────────────────────────────────────────
function buildNeighborCard(neighbor) {
  const card = document.createElement('div');
  card.className = 'neighbor-card';
  const yearsText = neighbor.yearsInNeighborhood === 1 ? '1 year' : `${neighbor.yearsInNeighborhood} years`;

  card.innerHTML = `
    <div class="neighbor-avatar" style="background:${neighbor.avatar}">
      ${neighbor.initials}
      ${neighbor.verified ? '<div class="neighbor-verified">✓</div>' : ''}
    </div>
    <div class="neighbor-name">${escHtml(neighbor.name)}</div>
    <div class="neighbor-years">
      ${yearsText} in Costa Blanca Villas
    </div>
    <button class="btn-wave-neighbor" onclick="waveAtNeighbor('${escHtml(neighbor.name).replace(/'/g, "\\'")}')">
      👋 Say Hi!
    </button>
  `;
  return card;
}

function waveAtNeighbor(name) {
  showToast(`You waved at ${name}! 👋`);
}

// ─── Group Card ──────────────────────────────────────────────────
function buildGroupCard(group) {
  const banner = groupBannerGradient(group.id);
  const card = document.createElement('div');
  card.className = 'group-card';
  const bannerStyle = group.coverPhoto
    ? `background:url('${group.coverPhoto}') center/cover no-repeat;`
    : `background:${banner};`;
  card.innerHTML = `
    <div class="group-card-banner" style="${bannerStyle}">
      <div class="group-card-icon" style="overflow:hidden;">${/^(data:|https?:)/.test(group.icon) ? `<img src="${group.icon}" style="width:100%;height:100%;object-fit:cover;border-radius:13px;">` : group.icon}</div>
    </div>
    <div class="group-card-body">
      <div class="group-card-name">${escHtml(group.name)}</div>
      <div class="group-card-meta">
        👥 ${group.members} members
        ${group.privacy === 'private' ? '<span style="background:rgba(231,111,81,0.1);color:var(--coral);padding:1px 6px;border-radius:7px;font-weight:700;font-size:10px;">Private</span>' : ''}
      </div>
      <div class="group-card-desc">${escHtml(group.description)}</div>
      <div class="group-card-actions">
        ${group.joined
          ? `<button class="btn-group-open" onclick="openGroupPage('${group.id}')">View Group →</button>`
          : group.pendingRequest
            ? `<button class="btn-join-group" style="background:#f0f3f7;color:var(--text-mid);cursor:default;" disabled>Requested ✓</button>`
            : `<button class="btn-join-group" id="group-btn-${group.id}" onclick="toggleGroup('${group.id}',this)">${group.privacy === 'private' ? '🔒 Request to Join' : 'Join Group'}</button>`}
        ${group.joined ? `<button class="btn-join-group joined" id="group-btn-${group.id}" onclick="toggleGroup('${group.id}',this)" style="flex:0 0 auto;padding:8px 10px;">✓</button>` : ''}
        ${group.isAdmin ? `<button onclick="deleteGroup('${group.id}',this)" title="Delete group" style="padding:7px 10px;background:none;border:1.5px solid var(--border);border-radius:20px;cursor:pointer;font-size:14px;color:var(--coral);flex-shrink:0;">🗑️</button>` : ''}
      </div>
    </div>
  `;
  return card;
}

async function handleJoinRequest(groupId, username, action) {
  const res = await fetch(`/api/groups/${groupId}/join-requests/${username}/${action}`, {
    method: 'POST', credentials: 'include'
  });
  if (res.ok) {
    showToast(action === 'approve' ? 'Member approved!' : 'Request denied.');
    await renderGroupPage(groupId, document.getElementById('sectionContent'));
  } else {
    showToast('Something went wrong.');
  }
}

async function toggleGroup(groupId, btn) {
  try {
    const res = await fetch(`/api/groups/${groupId}/join`, {
      method: 'POST', credentials: 'include'
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    if (data.requested) {
      showToast('Request sent — the group owner will review it.');
    } else {
      showToast(data.joined ? 'You joined the group! 🎉' : 'You left the group.');
    }
    await renderGroups(document.getElementById('sectionContent'));
  } catch {
    showToast('Could not update group membership.');
  }
}

async function openGroupPage(groupId) {
  currentGroupId = groupId;
  const container = document.getElementById('sectionContent');
  container.innerHTML = '<div class="loading-spinner" style="margin:60px auto;display:block;"></div>';
  await renderGroupPage(groupId, container);
}

async function renderGroupPage(groupId, container) {
  const group = await fetchJSON(`/api/groups/${groupId}`);
  if (!group) {
    container.innerHTML = '<p style="padding:30px;color:var(--coral);">Could not load group.</p>';
    return;
  }
  const posts = group.posts || [];
  const bannerStyle = group.coverPhoto
    ? `background:url('${group.coverPhoto}') center/cover no-repeat;`
    : `background:${groupBannerGradient(group.id)};`;

  const wrap = document.createElement('div');
  wrap.className = 'group-page';

  // Back button
  wrap.innerHTML = `
    <button class="group-back-btn" onclick="navigate('groups')">← Back to Groups</button>

    <div style="border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;margin-bottom:16px;">
      <div class="group-page-banner" style="${bannerStyle}"></div>
      <div class="group-page-header">
        <div class="group-page-icon" style="overflow:hidden;">${/^(data:|https?:)/.test(group.icon) ? `<img src="${group.icon}" style="width:100%;height:100%;object-fit:cover;border-radius:18px;">` : group.icon}</div>
        <div class="group-page-info">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div class="group-page-name">${escHtml(group.name)}</div>
            <div style="display:flex;gap:8px;flex-shrink:0;margin-top:4px;">
              <button onclick="reportGroup('${group.id}')" style="padding:7px 13px;background:none;border:1.5px solid var(--border);border-radius:10px;cursor:pointer;font-size:12px;font-weight:600;color:var(--text-mid);font-family:inherit;display:flex;align-items:center;gap:5px;">⚑ Report</button>
              ${group.isAdmin ? `<button onclick="deleteGroup('${group.id}',null,true)" style="padding:7px 13px;background:none;border:1.5px solid var(--border);border-radius:10px;cursor:pointer;font-size:12px;font-weight:700;color:var(--coral);font-family:inherit;">🗑️ Delete</button>` : ''}
            </div>
          </div>
          <div class="group-page-meta">
            <span>👥 ${group.members} members</span>
            <span>${group.privacy === 'private' ? '🔒 Private' : '🌐 Public'}</span>
          </div>
          <div class="group-page-desc">${escHtml(group.description)}</div>
          <div class="group-page-location">📍 Costa Blanca Villas · Farallón, Panama</div>
        </div>
      </div>
    </div>

    ${(group.isCreator || group.isAdmin) && group.joinRequests?.length ? `
    <div style="background:white;border:1px solid #fde68a;border-radius:var(--radius);padding:16px 20px;margin-bottom:16px;box-shadow:var(--shadow-sm);">
      <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:12px;">🔒 Join Requests (${group.joinRequests.length})</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${group.joinRequests.map(r => `
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:36px;height:36px;border-radius:50%;background:${r.avatar};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0;">${r.initials}</div>
            <div style="flex:1;font-size:14px;font-weight:600;color:var(--text-dark);">${escHtml(r.name)}</div>
            <button onclick="handleJoinRequest('${group.id}','${r.username}','approve')" style="padding:7px 14px;background:#16a34a;color:white;border:none;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;">Approve</button>
            <button onclick="handleJoinRequest('${group.id}','${r.username}','deny')" style="padding:7px 14px;background:none;border:1.5px solid var(--border);border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--coral);">Deny</button>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <div class="group-compose-box" id="groupComposeBox">
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="width:38px;height:38px;border-radius:50%;background:${currentUser?.avatar || '#0077B6'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;">${currentUser?.initials || '?'}</div>
        <div style="flex:1;">
          <textarea id="groupPostBox" placeholder="Write something to ${escHtml(group.name)}…"></textarea>
          <div style="display:flex;justify-content:flex-end;margin-top:8px;">
            <button onclick="submitGroupPost('${group.id}')" style="padding:9px 22px;background:var(--ocean);color:white;border:none;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">Post</button>
          </div>
        </div>
      </div>
    </div>

    <div style="font-size:13px;font-weight:700;color:var(--text-dark);margin-bottom:12px;padding:0 2px;">${posts.length} Post${posts.length !== 1 ? 's' : ''}</div>

    <div id="groupPostsFeed">
      ${posts.length === 0
        ? `<div style="background:white;border:1px solid var(--border);border-radius:var(--radius);padding:40px;text-align:center;color:var(--text-light);font-size:14px;">No posts yet — be the first to share something!</div>`
        : posts.map(p => `
          <div class="group-post-card">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:40px;height:40px;border-radius:50%;background:${p.author.avatar};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;">${escHtml(p.author.initials)}</div>
                <div>
                  <div style="font-size:14px;font-weight:700;color:var(--text-dark);">${escHtml(p.author.name)}</div>
                  <div style="font-size:11.5px;color:var(--text-light);">${groupTimeAgo(p.createdAt)}</div>
                </div>
              </div>
              ${group.isAdmin ? `<button onclick="deleteGroupPost('${group.id}','${p.id}')" title="Delete post" style="padding:5px 10px;background:none;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;font-size:12px;color:var(--coral);">🗑️</button>` : ''}
            </div>
            <div style="font-size:14px;color:var(--text-mid);line-height:1.65;">${escHtml(p.content)}</div>
          </div>`).join('')}
    </div>
  `;

  container.innerHTML = '';
  container.appendChild(wrap);
}

async function submitGroupPost(groupId) {
  const box = document.getElementById('groupPostBox');
  const content = box?.value.trim();
  if (!content) return;
  const res = await fetch(`/api/groups/${groupId}/posts`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });
  if (res.ok) {
    box.value = '';
    await renderGroupPage(groupId, document.getElementById('sectionContent'));
    showToast('Posted to the group! 🎉');
  }
}

async function deleteGroupPost(groupId, postId) {
  if (!confirm('Delete this post?')) return;
  const res = await fetch(`/api/groups/${groupId}/posts/${postId}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok) {
    await renderGroupPage(groupId, document.getElementById('sectionContent'));
    showToast('Post deleted.');
  }
}

async function deleteGroup(groupId, cardEl, fromPage) {
  if (!confirm('Delete this group? This cannot be undone.')) return;
  const res = await fetch(`/api/groups/${groupId}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok) {
    showToast('Group deleted.');
    navigate('groups');
  }
}

// ─── Unified Report System ────────────────────────────────────────────────────
function togglePostMenu(postId) {
  const menu = document.getElementById('post-menu-' + postId);
  if (!menu) return;
  const isOpen = menu.style.display !== 'none';
  // close all open post menus first
  document.querySelectorAll('[id^="post-menu-"]').forEach(m => m.style.display = 'none');
  if (!isOpen) {
    menu.style.display = 'block';
    setTimeout(() => document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target)) { menu.style.display = 'none'; document.removeEventListener('click', closeMenu); }
    }), 10);
  }
}

function openReportModal(targetType, targetId, targetLabel) {
  const existing = document.getElementById('reportModal');
  if (existing) existing.remove();

  const REASONS = {
    post:     ['Harassment or bullying', 'False or misleading information', 'Hate speech or discrimination', 'Spam or advertising', 'Privacy violation', 'Threatening content', 'Inappropriate content', 'Other'],
    business: ['Misleading or false information', 'Spam or excessive posting', 'Inappropriate content', 'Not a legitimate business', 'Other'],
    group:    ['Harassment or bullying', 'Inappropriate content', 'Spam', 'Hate speech', 'Other'],
    member:   ['Harassment', 'Impersonation', 'Spam', 'Threatening behavior', 'Other'],
  };
  const reasons = REASONS[targetType] || REASONS.post;

  const overlay = document.createElement('div');
  overlay.id = 'reportModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:18px;width:min(440px,100%);padding:26px;box-shadow:0 24px 60px rgba(0,0,0,0.25);" onclick="event.stopPropagation()">
      <div style="font-size:22px;margin-bottom:8px;">⚑</div>
      <h3 style="font-size:16px;font-weight:800;margin-bottom:5px;">Report ${targetType.charAt(0).toUpperCase()+targetType.slice(1)}</h3>
      <p style="font-size:13px;color:#5a7184;margin-bottom:18px;line-height:1.5;">Help us keep Costa Blanca Connect safe. Reports go directly to the admin team for review.</p>
      <div style="margin-bottom:12px;">
        <label style="font-size:12px;font-weight:700;color:#2d3748;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Reason *</label>
        <select id="rptReason" style="width:100%;padding:10px 13px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;">
          <option value="">Select a reason…</option>
          ${reasons.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:18px;">
        <label style="font-size:12px;font-weight:700;color:#2d3748;display:block;margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;">Additional details <span style="color:#a0aec0;font-weight:400;text-transform:none">(optional)</span></label>
        <textarea id="rptNote" placeholder="Tell us more about what happened…" style="width:100%;min-height:72px;padding:10px 13px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;resize:none;outline:none;background:#f8fafc;"></textarea>
      </div>
      <div id="rptErr" style="display:none;color:#c0392b;font-size:12.5px;margin-bottom:10px;"></div>
      <div style="display:flex;gap:10px;">
        <button onclick="document.getElementById('reportModal').remove()" style="flex:1;padding:11px;background:#f0f3f7;border:none;border-radius:10px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;">Cancel</button>
        <button onclick="submitReport('${targetType}','${targetId}','${targetLabel.replace(/'/g,"\\'")}')" style="flex:1;padding:11px;background:#E63946;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;">Submit Report</button>
      </div>
    </div>`;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}

async function submitReport(targetType, targetId, targetLabel) {
  const reason = document.getElementById('rptReason')?.value;
  const note = document.getElementById('rptNote')?.value.trim() || '';
  const errEl = document.getElementById('rptErr');
  if (!reason) { if (errEl) { errEl.textContent = 'Please select a reason.'; errEl.style.display = 'block'; } return; }
  const res = await fetch('/api/reports', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetType, targetId, targetLabel, reason, note })
  });
  if (res.ok) {
    document.getElementById('reportModal')?.remove();
    showToast('Report submitted — the admin team will review it shortly.');
  } else {
    if (errEl) { errEl.textContent = 'Something went wrong. Please try again.'; errEl.style.display = 'block'; }
  }
}

async function adminDeletePost(postId) {
  if (!confirm('Delete this post? This cannot be undone.')) return;
  const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok) {
    document.getElementById('post-card-' + postId)?.remove();
    showToast('Post deleted.');
  } else {
    showToast('Could not delete post.');
  }
}

function reportGroup(groupId) {
  const modal = document.getElementById('eventDetailModal');
  const body = document.getElementById('eventDetailBody');
  const title = modal.querySelector('.modal-header h3');
  if (title) title.textContent = 'Report Group';
  body.innerHTML = `
    <div style="padding:22px;">
      <p style="font-size:13px;color:var(--text-mid);margin-bottom:18px;line-height:1.6;">Help us keep Costa Blanca Connect safe and respectful. Let us know why you're reporting this group.</p>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Reason *</label>
        <select id="reportReason" style="width:100%;padding:11px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:white;color:var(--text-dark);">
          <option value="">Select a reason...</option>
          <option value="spam">Spam or misleading content</option>
          <option value="harassment">Harassment or bullying</option>
          <option value="hate">Hate speech or discrimination</option>
          <option value="misinformation">Misinformation</option>
          <option value="inappropriate">Inappropriate content</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div style="margin-bottom:18px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px;">Additional details (optional)</label>
        <textarea id="reportNote" placeholder="Tell us more about what's happening..." style="width:100%;min-height:80px;padding:11px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;resize:none;outline:none;"></textarea>
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="closeModal('eventDetailModal')" style="flex:1;padding:11px;background:var(--bg);color:var(--text-mid);border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Cancel</button>
        <button onclick="submitGroupReport('${groupId}')" style="flex:1;padding:11px;background:var(--coral);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Submit Report</button>
      </div>
    </div>
  `;
  openModal('eventDetailModal');
}

async function submitGroupReport(groupId) {
  const reason = document.getElementById('reportReason')?.value;
  if (!reason) { showToast('Please select a reason.'); return; }
  const note = document.getElementById('reportNote')?.value.trim() || '';
  const res = await fetch('/api/reports', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetType: 'group', targetId: groupId, targetLabel: 'Group ' + groupId, reason, note }),
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason, note })
  });
  if (res.ok) {
    closeModal('eventDetailModal');
    showToast('Report submitted. Thank you for helping keep the community safe.');
  }
}

function openCreateGroupModal() {
  const modal = document.getElementById('eventDetailModal');
  const body = document.getElementById('eventDetailBody');
  const title = modal.querySelector('.modal-header h3');
  if (title) title.textContent = 'Create Group';
  body.innerHTML = `
    <div style="padding:20px;">
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Group Name *</label>
        <input id="cgName" type="text" placeholder="e.g. Golf Enthusiasts" style="width:100%;padding:11px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;" />
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Description</label>
        <textarea id="cgDesc" placeholder="What is this group about?" style="width:100%;min-height:80px;padding:11px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;resize:none;outline:none;"></textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Group Photo</label>
          <label style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;height:88px;border:1.5px dashed var(--border);border-radius:13px;cursor:pointer;background:#f8fafc;transition:border-color 0.15s;" onmouseover="this.style.borderColor='var(--ocean)'" onmouseout="this.style.borderColor='var(--border)'">
            <input type="file" accept="image/*" style="display:none;" onchange="previewGroupPhoto(this)">
            <div id="cgPhotoPreview" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
              <span style="font-size:22px;">📷</span>
              <span style="font-size:11px;color:var(--text-mid);font-weight:600;">Upload photo</span>
            </div>
          </label>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Privacy</label>
          <select id="cgPrivacy" style="width:100%;padding:11px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:white;">
            <option value="public">🌐 Public</option>
            <option value="private">🔒 Private</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Cover Photo URL <span style="font-weight:400;text-transform:none;letter-spacing:0;">(optional)</span></label>
        <input id="cgCover" type="url" placeholder="https://..." style="width:100%;padding:11px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;" />
        <div style="font-size:11px;color:var(--text-light);margin-top:4px;">Paste any image URL — it will appear as the group's cover photo.</div>
      </div>
      <button onclick="submitCreateGroup()" style="width:100%;padding:12px;background:var(--ocean);color:white;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Create Group</button>
    </div>
  `;
  openModal('eventDetailModal');
}

let cgPhotoDataUrl = null;

function previewGroupPhoto(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    cgPhotoDataUrl = e.target.result;
    const preview = document.getElementById('cgPhotoPreview');
    if (preview) {
      preview.innerHTML = `<img src="${cgPhotoDataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:11px;">`;
    }
  };
  reader.readAsDataURL(input.files[0]);
}

async function submitCreateGroup() {
  const name = document.getElementById('cgName')?.value.trim();
  if (!name) { showToast('Please enter a group name.'); return; }
  const body = {
    name,
    description: document.getElementById('cgDesc')?.value.trim(),
    icon: cgPhotoDataUrl || '👥',
    privacy: document.getElementById('cgPrivacy')?.value || 'public',
    coverPhoto: document.getElementById('cgCover')?.value.trim() || ''
  };
  cgPhotoDataUrl = null;
  const res = await fetch('/api/groups', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (res.ok) {
    closeModal('eventDetailModal');
    showToast('Group created! 🎉');
    navigate('groups');
  }
}

// ─── Notification Card ───────────────────────────────────────────
function buildNotifCard(notif) {
  const card = document.createElement('div');
  card.className = `notif-card${notif.read ? '' : ' unread'}`;

  card.innerHTML = `
    <div class="notif-avatar" style="background:${notif.avatar || '#0077B6'}">${notif.initials || '??'}</div>
    <div class="notif-body">
      <div class="notif-msg">${escHtml(notif.message)}</div>
      <div class="notif-time">${relativeTime(notif.time)}</div>
    </div>
    ${!notif.read ? '<div class="notif-unread-dot"></div>' : ''}
  `;
  return card;
}

// ─── Create Post Modal ───────────────────────────────────────────
function openCreatePost(type) {
  if (type) selectPostType(type);
  openModal('createPostModal');
}

function selectPostType(type, btnEl) {
  selectedPostType = type;
  document.querySelectorAll('.type-tab').forEach(b => b.classList.remove('active'));
  if (btnEl) {
    btnEl.classList.add('active');
  } else {
    const tab = document.querySelector(`[data-type="${type}"]`);
    if (tab) tab.classList.add('active');
  }

  // Show/hide extra fields
  document.getElementById('priceField').style.display = ['for_sale', 'free'].includes(type) ? 'flex' : 'none';
  document.getElementById('pollOptions').style.display = type === 'poll' ? 'block' : 'none';
  document.getElementById('safetyFields').style.display = type === 'safety' ? 'block' : 'none';

  // Show official note only for HOA/admin
  const officialNote = document.getElementById('officialAlertNote');
  const highBtn = document.querySelector('.sev-high-btn');
  if (type === 'safety') {
    const isPrivileged = currentUser?.role === 'hoa' || currentUser?.role === 'admin';
    if (officialNote) officialNote.style.display = isPrivileged ? 'block' : 'none';
    if (highBtn) highBtn.style.display = isPrivileged ? 'inline-block' : 'none';
    if (!isPrivileged) selectSeverity('medium', document.querySelector('[data-sev="medium"]'));
  }

  updatePostBtn();
}

function updatePostBtn() {
  const content = document.getElementById('postContent');
  const btn = document.getElementById('submitPostBtn');
  if (btn && content) {
    btn.disabled = !content.value.trim();
  }
}

function addPollOption() {
  const container = document.getElementById('pollOptions');
  const count = container.querySelectorAll('.poll-option-row').length + 1;
  if (count > 5) { showToast('Maximum 5 poll options'); return; }
  const row = document.createElement('div');
  row.className = 'poll-option-row';
  row.innerHTML = `<input type="text" class="poll-option-input" placeholder="Option ${count}" />`;
  container.insertBefore(row, container.lastElementChild);
}

function selectSeverity(sev, btnEl) {
  selectedSeverity = sev;
  document.querySelectorAll('.sev-btn').forEach(b => {
    b.style.borderColor = 'var(--border)';
    b.style.background = 'white';
    b.style.color = 'var(--text-mid)';
  });
  if (btnEl) {
    const colors = { low: '#2A9D8F', medium: '#F4A261', high: '#E76F51' };
    btnEl.style.borderColor = colors[sev] || 'var(--ocean)';
    btnEl.style.background = (colors[sev] || '#0077B6') + '18';
    btnEl.style.color = colors[sev] || 'var(--ocean)';
  }
}

// ─── Post Photo & Location ───────────────────────────────────────
let postPhotoDataUrl = null;
let postLocationValue = null;

function attachPostPhoto(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    postPhotoDataUrl = e.target.result;
    document.getElementById('postPhotoImg').src = postPhotoDataUrl;
    document.getElementById('postPhotoPreview').style.display = 'block';
  };
  reader.readAsDataURL(input.files[0]);
}

function removePostPhoto() {
  postPhotoDataUrl = null;
  document.getElementById('postPhotoPreview').style.display = 'none';
  document.getElementById('postPhotoInput').value = '';
}

const locationOptions = [
  'Villa 270 area', 'Villa 94 area', 'North Gate', 'South Gate',
  'Beach Club', 'Golf Course', 'Pool Area', 'Playa Farallón',
  'Main Entrance', 'Tennis Courts', 'Community Center'
];

function pickPostLocation(btn) {
  if (postLocationValue) { removePostLocation(); return; }
  // Cycle through options on click
  const idx = Math.floor(Math.random() * locationOptions.length);
  postLocationValue = locationOptions[idx];
  document.getElementById('postLocationText').textContent = postLocationValue;
  const tag = document.getElementById('postLocationTag');
  tag.style.display = 'flex';
  if (window.lucide) lucide.createIcons();
  btn.style.color = 'var(--ocean)';
}

function removePostLocation() {
  postLocationValue = null;
  document.getElementById('postLocationTag').style.display = 'none';
}

async function submitPost() {
  const content = document.getElementById('postContent').value.trim();
  if (!content) return;

  const body = { type: selectedPostType, content };
  if (postPhotoDataUrl) body.image = postPhotoDataUrl;
  if (postLocationValue) body.location = postLocationValue;

  if (selectedPostType === 'safety') {
    const alertType = document.getElementById('alertTypeSelect')?.value;
    if (alertType) body.alertType = alertType;
    body.severity = selectedSeverity;
  }

  if (['for_sale', 'free'].includes(selectedPostType)) {
    const price = document.getElementById('postPrice').value;
    const condition = document.getElementById('postCondition').value;
    if (price) body.price = Number(price);
    if (condition) body.condition = condition;
    body.free = selectedPostType === 'free';
  }

  if (selectedPostType === 'poll') {
    const inputs = document.querySelectorAll('.poll-option-input');
    body.pollOptions = Array.from(inputs).map(i => i.value.trim()).filter(Boolean);
    if (body.pollOptions.length < 2) { showToast('Please add at least 2 poll options'); return; }
  }

  try {
    const res = await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error();
    const newPost = await res.json();

    closeModal('createPostModal');
    document.getElementById('postContent').value = '';
    removePostPhoto();
    removePostLocation();
    selectedSeverity = 'medium';
    const safetyFields = document.getElementById('safetyFields');
    if (safetyFields) safetyFields.style.display = 'none';
    refreshPoints();
    showToast('Your post is live! 🌊');

    // Navigate to feed and show post
    if (currentSection === 'feed') {
      navigate('feed');
    } else {
      navigate('feed');
    }
  } catch {
    showToast('Could not post. Please try again.');
  }
}

async function resolveAlert(postId) {
  const res = await fetch(`/api/posts/${postId}/resolve`, { method: 'POST', credentials: 'include' });
  if (res.ok) {
    showToast('Alert marked as resolved ✅');
    if (currentSection === 'safety') navigate('safety');
    else navigate('feed');
  }
}

// ─── Notifications ───────────────────────────────────────────────
async function loadNotifications() {
  try {
    const notifs = await fetchJSON('/api/notifications');
    const unread = (notifs || []).filter(n => !n.read).length;
    updateNotifBadge(unread);
  } catch {}
}

function updateNotifBadge(count) {
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 9 ? '9+' : count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

// ─── Real Estate ─────────────────────────────────────────────────
async function renderRealEstate(container) {
  container.innerHTML = sectionHeaderHTML('realestate');

  // Sponsor banner
  const sponsor = document.createElement('a');
  sponsor.href = 'https://www.uncoverpanamarealestate.com';
  sponsor.target = '_blank';
  sponsor.rel = 'noopener';
  sponsor.className = 're-sponsor-banner';
  sponsor.innerHTML = `
    <div class="re-sponsor-logo-mark">
      <img src="/images/uncover-panama-logo.png" alt="Uncover Panama Real Estate" style="width:100%;height:100%;object-fit:contain;border-radius:10px;">
    </div>
    <div class="re-sponsor-info">
      <div class="re-sponsor-label">Official Real Estate Partner</div>
      <div class="re-sponsor-name">Uncover Panama Real Estate</div>
      <div class="re-sponsor-tagline">Costa Blanca · Bijao · Vistamar · Farallón</div>
    </div>
    <div class="re-sponsor-cta">View All Listings →</div>
  `;
  container.appendChild(sponsor);

  // Realtor / admin bar
  if (currentUser?.role === 'realtor' || currentUser?.role === 'admin') {
    const adminBar = document.createElement('div');
    adminBar.className = 're-admin-bar';
    adminBar.innerHTML = `
      <button class="re-btn-add" onclick="openAddListingModal()">
        <i data-lucide="plus-circle" style="width:16px;height:16px"></i>
        Add Listing
      </button>
    `;
    container.appendChild(adminBar);
  }

  // Filter tabs
  const tabs = document.createElement('div');
  tabs.className = 're-tabs';
  tabs.innerHTML = `
    <button class="re-tab active" onclick="filterRE('all',this)">All Listings</button>
    <button class="re-tab" onclick="filterRE('for_sale',this)">🏠 For Sale</button>
    <button class="re-tab" onclick="filterRE('for_rent',this)">🔑 For Rent</button>
  `;
  container.appendChild(tabs);

  const grid = document.createElement('div');
  grid.className = 're-grid';
  grid.id = 'reGrid';
  container.appendChild(grid);

  await loadRealEstateGrid('all');
}

async function loadRealEstateGrid(type) {
  const grid = document.getElementById('reGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-spinner"></div>';
  const url = type === 'all' ? '/api/realestate' : `/api/realestate?type=${type}`;
  const listings = await fetchJSON(url);
  grid.innerHTML = '';
  if (!listings || !listings.length) {
    grid.innerHTML = emptyStateHTML('🏡', 'No listings right now', 'Check back soon for new properties.');
    return;
  }
  listings.forEach((l, i) => {
    const card = buildRealEstateCard(l);
    card.style.animationDelay = `${i * 60}ms`;
    grid.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
}

function filterRE(type, btn) {
  document.querySelectorAll('.re-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  loadRealEstateGrid(type);
}

function buildRealEstateCard(listing) {
  const card = document.createElement('div');
  card.className = 're-card';
  const isRent = listing.type === 'for_rent';
  const priceLabel = isRent
    ? `$${listing.price.toLocaleString()}/${listing.priceUnit || 'week'}`
    : `$${listing.price.toLocaleString()}`;
  const typeBadge = isRent ? 'For Rent' : 'For Sale';
  const typeCls = isRent ? 'for-rent' : 'for-sale';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'realtor';

  card.innerHTML = `
    <div class="re-card-img-wrap">
      <img src="${listing.image}" alt="${escHtml(listing.title)}" class="re-card-img"
        onclick="openLightbox('${listing.image}')"
        onerror="this.style.objectFit='contain';this.style.padding='20px';this.style.background='var(--bg)'">
      <div class="re-price-badge">${priceLabel}</div>
      <div class="re-type-badge ${typeCls}">${typeBadge}</div>
    </div>
    <div class="re-card-body">
      <div class="re-card-title">${escHtml(listing.title)}</div>
      <div class="re-card-location">
        <i data-lucide="map-pin" style="width:12px;height:12px;color:var(--coral)"></i>
        ${escHtml(listing.location)}
      </div>
      <div class="re-stats">
        <div class="re-stat">
          <span class="re-stat-val">${listing.bedrooms}</span>
          <span class="re-stat-lbl">Beds</span>
        </div>
        <div class="re-stat">
          <span class="re-stat-val">${listing.bathrooms}</span>
          <span class="re-stat-lbl">Baths</span>
        </div>
        <div class="re-stat">
          <span class="re-stat-val">${listing.sqft.toLocaleString()}</span>
          <span class="re-stat-lbl">Sq Ft</span>
        </div>
        <div class="re-stat">
          <span class="re-stat-val" style="font-size:11px">${relativeTime(listing.listedAt)}</span>
          <span class="re-stat-lbl">Listed</span>
        </div>
      </div>
      <div class="re-features">
        ${(listing.features || []).slice(0, 4).map(f => `<span class="re-feature-tag">✓ ${escHtml(f)}</span>`).join('')}
      </div>
      <div class="re-agent">
        <i data-lucide="user" style="width:12px;height:12px"></i>
        ${escHtml(listing.agentName)}
      </div>
      <div class="re-card-actions">
        <button class="re-btn-contact" onclick="contactREAgent('${escHtml(listing.agentName).replace(/'/g,"\\'")}','${listing.agentPhone}','${listing.agentEmail||''}')">
          📞 Contact Agent
        </button>
        <a href="https://www.uncoverpanamarealestate.com" target="_blank" rel="noopener" class="re-btn-view">
          <i data-lucide="external-link" style="width:13px;height:13px"></i>
          View
        </a>
        ${isAdmin ? `<button class="re-btn-delete" onclick="deleteListing('${listing.id}',this)" title="Remove listing">🗑️</button>` : ''}
      </div>
    </div>
  `;
  return card;
}

function contactREAgent(name, phone, email) {
  const modal = document.getElementById('postDetailModal');
  const body = document.getElementById('postDetailBody');
  const title = modal.querySelector('.modal-header h3');
  if (title) title.textContent = 'Contact Agent';
  body.innerHTML = `
    <div style="padding:24px;text-align:center;">
      <div style="font-size:48px;margin-bottom:12px;">🏡</div>
      <div style="font-size:16px;font-weight:800;color:var(--text-dark);margin-bottom:4px;">${escHtml(name)}</div>
      <div style="font-size:13px;color:var(--text-light);margin-bottom:24px;">Uncover Panama Real Estate</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        <a href="tel:${phone}" style="display:flex;align-items:center;justify-content:center;gap:10px;background:var(--ocean);color:white;border-radius:12px;padding:14px;font-size:15px;font-weight:700;text-decoration:none;">
          📞 ${phone}
        </a>
        ${email ? `<a href="mailto:${email}" style="display:flex;align-items:center;justify-content:center;gap:10px;background:var(--seafoam);color:white;border-radius:12px;padding:14px;font-size:15px;font-weight:700;text-decoration:none;">
          ✉️ ${email}
        </a>` : ''}
        <a href="https://www.uncoverpanamarealestate.com" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:center;gap:10px;background:var(--bg);color:var(--ocean);border:1.5px solid var(--ocean);border-radius:12px;padding:14px;font-size:15px;font-weight:700;text-decoration:none;">
          🌐 View All Listings
        </a>
      </div>
    </div>
  `;
  openModal('postDetailModal');
}

async function deleteListing(id, btn) {
  const card = btn.closest('.re-card');
  try {
    const res = await fetch(`/api/realestate/${id}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error();
    card.style.transition = 'all 0.3s';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95)';
    setTimeout(() => card.remove(), 300);
    showToast('Listing removed ✓');
  } catch {
    showToast('Could not remove listing.');
  }
}

function openAddListingModal() {
  // Clear form
  ['rlTitle','rlPrice','rlLocation','rlBeds','rlBaths','rlSqft','rlFeatures','rlDesc','rlAgent','rlPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  openModal('addListingModal');
}

async function submitListing() {
  const get = id => document.getElementById(id)?.value?.trim() || '';
  const title = get('rlTitle');
  const type = get('rlType') || 'for_sale';
  const price = get('rlPrice');
  if (!title || !price) { showToast('Please fill in Title and Price'); return; }

  try {
    const res = await fetch('/api/realestate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title, type, price: Number(price),
        priceUnit: get('rlPriceUnit') || 'week',
        bedrooms: Number(get('rlBeds')) || 0,
        bathrooms: Number(get('rlBaths')) || 0,
        sqft: Number(get('rlSqft')) || 0,
        description: get('rlDesc'),
        location: get('rlLocation') || 'Costa Blanca Villas, Farallón',
        features: get('rlFeatures').split(',').map(f => f.trim()).filter(Boolean),
        agentName: get('rlAgent') || 'Uncover Panama',
        agentPhone: get('rlPhone') || '+507 6622-8810'
      })
    });
    if (!res.ok) throw new Error();
    closeModal('addListingModal');
    showToast('New listing added! 🏡');
    await loadRealEstateGrid('all');
    document.querySelectorAll('.re-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  } catch {
    showToast('Could not save listing. Please try again.');
  }
}

// ─── Transportation ───────────────────────────────────────────────
async function renderTransport(container) {
  container.innerHTML = sectionHeaderHTML('transport');

  container.innerHTML += `

    <!-- Golf Cart Rentals -->
    <div style="font-size:13px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">🛺 Golf Cart Rentals</div>
    <div style="background:white;border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-bottom:20px;box-shadow:var(--shadow-sm);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div>
          <div style="font-size:14.5px;font-weight:700;color:var(--text-dark);">Community Cart Rentals</div>
          <div style="font-size:12.5px;color:var(--text-mid);margin-top:2px;">Residents renting their carts — post yours or find one available</div>
        </div>
        <button onclick="openCartListingForm()" style="padding:9px 16px;background:var(--ocean);color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">+ List My Cart</button>
      </div>
      <div id="cartListings" style="display:flex;flex-direction:column;gap:10px;">
        <div style="text-align:center;padding:20px;color:var(--text-light);font-size:13.5px;">No carts listed yet — be the first to post yours!</div>
      </div>
    </div>

    <!-- Transport Costs Community Board -->
    <div style="font-size:13px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">🚕 Getting Around · Fares & Costs</div>
    <div style="background:white;border:1px solid var(--border);border-radius:var(--radius);padding:20px 24px;margin-bottom:20px;box-shadow:var(--shadow-sm);">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div>
          <div style="font-size:14.5px;font-weight:700;color:var(--text-dark);">Community Fare Board</div>
          <div style="font-size:12.5px;color:var(--text-mid);margin-top:2px;">Share what you paid — taxi, bus, or private driver to the airports, Panama City & more</div>
        </div>
        <button onclick="openTransportPost()" style="padding:9px 16px;background:#f57c00;color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">+ Post Fare</button>
      </div>
      <div id="transportPosts" style="display:flex;flex-direction:column;gap:10px;">
        <div style="text-align:center;padding:20px;color:var(--text-light);font-size:13.5px;">No fares posted yet — share what you paid!</div>
      </div>
    </div>

    <!-- Airports -->
    <div style="font-size:13px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">✈️ Airports</div>
    <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:20px;">

      <a href="https://flightaware.com/live/airport/MPTO" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:16px;background:linear-gradient(135deg,#0d1b2a 0%,#0077B6 100%);border-radius:16px;padding:18px 22px;text-decoration:none;box-shadow:0 4px 16px rgba(0,119,182,0.25);">
        <div style="width:52px;height:52px;border-radius:12px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i data-lucide="plane" style="width:26px;height:26px;color:white;stroke-width:1.8;"></i></div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
            <span style="font-size:22px;font-weight:900;color:white;letter-spacing:-0.5px;">PTY</span>
            <span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;">MPTO</span>
          </div>
          <div style="font-size:13.5px;font-weight:600;color:rgba(255,255,255,0.9);margin-bottom:1px;">Tocumen International Airport</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.55);">Panama City</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:7px 13px;white-space:nowrap;flex-shrink:0;">
          <span style="font-size:12px;font-weight:700;color:white;">FlightAware</span>
          <span style="font-size:12px;color:rgba(255,255,255,0.6);">→</span>
        </div>
      </a>

      <a href="https://www.flightaware.com/live/airport/MPSM" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:16px;background:linear-gradient(135deg,#0d2a1e 0%,#2A9D8F 100%);border-radius:16px;padding:18px 22px;text-decoration:none;box-shadow:0 4px 16px rgba(42,157,143,0.25);">
        <div style="width:52px;height:52px;border-radius:12px;background:rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i data-lucide="plane" style="width:26px;height:26px;color:white;stroke-width:1.8;"></i></div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;">
            <span style="font-size:22px;font-weight:900;color:white;letter-spacing:-0.5px;">RIH</span>
            <span style="font-size:11px;font-weight:700;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1px;">MPSM</span>
          </div>
          <div style="font-size:13.5px;font-weight:600;color:rgba(255,255,255,0.9);margin-bottom:1px;">Scarlett Martínez International</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.55);">Río Hato · ~5 min away</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:20px;padding:7px 13px;white-space:nowrap;flex-shrink:0;">
          <span style="font-size:12px;font-weight:700;color:white;">FlightAware</span>
          <span style="font-size:12px;color:rgba(255,255,255,0.6);">→</span>
        </div>
      </a>

    </div>

  `;

  renderTransportPosts();
  if (window.lucide) lucide.createIcons();
}

// ─── Golf Cart Listings ───────────────────────────────────────────
const cartListings = [];
const transportPosts = [];

function openCartListingForm() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:20px;width:min(460px,100%);padding:28px;box-shadow:0 24px 60px rgba(0,0,0,0.3);">
      <div style="font-size:24px;margin-bottom:6px;">🛺</div>
      <h3 style="font-size:17px;font-weight:800;margin-bottom:4px;color:#0d1b2a;">List Your Golf Cart</h3>
      <p style="font-size:13px;color:#4a6378;margin-bottom:18px;">Let neighbors rent your cart. You handle the arrangement directly.</p>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px;">
        <div>
          <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Cart description</label>
          <input id="cartDesc" type="text" placeholder="e.g. 4-seater, 2023, good condition" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Rate</label>
            <input id="cartRate" type="text" placeholder="e.g. $25/day" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" />
          </div>
          <div>
            <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Contact</label>
            <input id="cartContact" type="text" placeholder="WhatsApp or villa #" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" />
          </div>
        </div>
        <div>
          <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Availability</label>
          <input id="cartAvail" type="text" placeholder="e.g. Weekends only, or contact to check" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" />
        </div>
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="this.closest('[style*=fixed]').remove()" style="flex:1;padding:11px;background:#f0f3f7;border:none;border-radius:10px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;">Cancel</button>
        <button onclick="submitCartListing(this)" style="flex:1;padding:11px;background:#0077B6;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;">Post Listing</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function submitCartListing(btn) {
  const desc = document.getElementById('cartDesc').value.trim();
  const rate = document.getElementById('cartRate').value.trim();
  const contact = document.getElementById('cartContact').value.trim();
  const avail = document.getElementById('cartAvail').value.trim();
  if (!desc || !contact) { showToast('Description and contact required'); return; }
  cartListings.unshift({
    id: 'cart' + Date.now(),
    desc, rate, contact, avail,
    postedBy: currentUser?.name || 'A neighbor',
    avatar: currentUser?.avatar || '#0077B6',
    initials: currentUser?.initials || '??',
    postedAt: new Date().toISOString()
  });
  btn.closest('[style*=fixed]').remove();
  renderCartListings();
  showToast('Cart listing posted!');
}

function renderCartListings() {
  const el = document.getElementById('cartListings');
  if (!el) return;
  if (!cartListings.length) { el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-light);font-size:13.5px;">No carts listed yet — be the first to post yours!</div>'; return; }
  el.innerHTML = cartListings.map(c => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:14px;background:#f8fafc;border-radius:12px;border:1px solid var(--border);">
      <div style="width:38px;height:38px;border-radius:10px;background:${c.avatar};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;">${c.initials}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;color:var(--text-dark);">🛺 ${escHtml(c.desc)}</div>
        <div style="display:flex;gap:12px;margin-top:4px;flex-wrap:wrap;">
          ${c.rate ? `<span style="font-size:12.5px;color:#16a34a;font-weight:700;">💵 ${escHtml(c.rate)}</span>` : ''}
          ${c.avail ? `<span style="font-size:12.5px;color:var(--text-mid);">📅 ${escHtml(c.avail)}</span>` : ''}
        </div>
        <div style="font-size:12.5px;color:var(--text-mid);margin-top:4px;">Posted by ${escHtml(c.postedBy)} · ${timeAgo(new Date(c.postedAt))}</div>
      </div>
      <a href="tel:${encodeURIComponent(c.contact)}" style="padding:8px 12px;background:var(--ocean);color:white;border-radius:8px;font-size:12.5px;font-weight:700;text-decoration:none;white-space:nowrap;flex-shrink:0;">📞 Contact</a>
    </div>
  `).join('');
}

function openTransportPost() {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:20px;width:min(460px,100%);padding:28px;box-shadow:0 24px 60px rgba(0,0,0,0.3);">
      <div style="font-size:24px;margin-bottom:6px;">🚕</div>
      <h3 style="font-size:17px;font-weight:800;margin-bottom:4px;color:#0d1b2a;">Post a Fare</h3>
      <p style="font-size:13px;color:#4a6378;margin-bottom:18px;">Share what you paid so neighbors know what to expect.</p>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px;">
        <div>
          <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Transport type</label>
          <select id="tpType" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;">
            <option value="Taxi">🚕 Taxi</option>
            <option value="Bus">🚌 Bus</option>
            <option value="Private Driver">🚗 Private Driver</option>
          </select>
        </div>
        <div>
          <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Route / destination</label>
          <select id="tpRoute" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;">
            <option value="To PTY (Tocumen)">✈️ To PTY — Tocumen International</option>
            <option value="To RIH (Río Hato)">🛩️ To RIH — Río Hato Airport</option>
            <option value="To Panama City">🌆 To Panama City</option>
            <option value="To Albrook Bus Terminal">🚌 To Albrook Bus Terminal</option>
            <option value="To Penonome">🛣️ To Penonomé</option>
            <option value="Local / within Farallón">📍 Local / within Farallón</option>
            <option value="Other">📝 Other (add in notes)</option>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Cost</label>
            <input id="tpCost" type="text" placeholder="e.g. $65" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" />
          </div>
          <div>
            <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Passengers</label>
            <input id="tpPax" type="text" placeholder="e.g. 2 people" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" />
          </div>
        </div>
        <div>
          <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Notes (optional)</label>
          <input id="tpNotes" type="text" placeholder="e.g. driver contact, took ~2.5 hrs, luggage included" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" />
        </div>
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="this.closest('[style*=fixed]').remove()" style="flex:1;padding:11px;background:#f0f3f7;border:none;border-radius:10px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;">Cancel</button>
        <button onclick="submitTransportPost(this)" style="flex:1;padding:11px;background:#f57c00;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;">Post Fare</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function submitTransportPost(btn) {
  const type  = document.getElementById('tpType').value;
  const route = document.getElementById('tpRoute').value;
  const cost  = document.getElementById('tpCost').value.trim();
  const pax   = document.getElementById('tpPax').value.trim();
  const notes = document.getElementById('tpNotes').value.trim();
  if (!cost) { showToast('Add a cost so neighbors know what to expect'); return; }
  transportPosts.unshift({
    id: 'tp' + Date.now(),
    type, route, cost, pax, notes,
    postedBy: currentUser?.name || 'A neighbor',
    avatar: currentUser?.avatar || '#f57c00',
    initials: currentUser?.initials || '??',
    postedAt: new Date().toISOString()
  });
  btn.closest('[style*=fixed]').remove();
  renderTransportPosts();
  showToast('Fare posted — thanks!');
}

const typeEmoji = { 'Taxi': '🚕', 'Bus': '🚌', 'Private Driver': '🚗' };

function renderTransportPosts() {
  const el = document.getElementById('transportPosts');
  if (!el) return;
  if (!transportPosts.length) {
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-light);font-size:13.5px;">No fares posted yet — share what you paid!</div>';
    return;
  }
  el.innerHTML = transportPosts.map(p => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:14px;background:#f8fafc;border-radius:12px;border:1px solid var(--border);">
      <div style="width:38px;height:38px;border-radius:10px;background:${p.avatar};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;">${p.initials}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;color:var(--text-dark);">${typeEmoji[p.type] || '🚗'} ${escHtml(p.type)} — ${escHtml(p.route)}</div>
        <div style="display:flex;gap:12px;margin-top:5px;flex-wrap:wrap;align-items:center;">
          <span style="font-size:13.5px;color:#16a34a;font-weight:800;">💵 ${escHtml(p.cost)}</span>
          ${p.pax ? `<span style="font-size:12.5px;color:var(--text-mid);">👥 ${escHtml(p.pax)}</span>` : ''}
        </div>
        ${p.notes ? `<div style="font-size:12.5px;color:var(--text-mid);margin-top:4px;">💬 ${escHtml(p.notes)}</div>` : ''}
        <div style="font-size:11.5px;color:var(--text-light);margin-top:4px;">Posted by ${escHtml(p.postedBy)} · ${timeAgo(new Date(p.postedAt))}</div>
      </div>
    </div>
  `).join('');
}

// ─── Section Headers ─────────────────────────────────────────────
const sectionMeta = {
  feed: { title: 'Neighborhood Feed', desc: 'What\'s happening in Costa Blanca Villas right now', emoji: '<img src="/logo.png" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">' },
  marketplace: { title: 'Marketplace', desc: 'Buy, sell, and give away items with neighbors', emoji: '🛒' },
  events: { title: 'Events', desc: 'What\'s coming up in Costa Blanca Villas & Farallón', emoji: '📅' },
  safety: { title: 'Safety & Alerts', desc: 'Stay informed about safety in Costa Blanca Villas', emoji: '🛡️' },
  businesses: { title: 'Business Directory', desc: 'Local restaurants and services near Farallón', emoji: '🍽️' },
  neighbors: { title: 'My Neighbors', desc: '312 verified residents in Costa Blanca Villas', emoji: '👋' },
  groups: { title: 'Groups', desc: 'Connect with neighbors who share your interests', emoji: '👥' },
  notifications: { title: 'Notifications', desc: 'Stay up to date on what matters', emoji: '🔔' },
  profile: { title: 'My Profile', desc: 'Your Costa Blanca Villas profile', emoji: '👤' },
  realestate: { title: 'Real Estate', desc: 'Properties for sale & rent near Costa Blanca Villas', emoji: '🏡' },
  transport: { title: 'Transportation', desc: 'Getting around Farallón, to Panama City & the airports', emoji: '🚗' }
};

function sectionHeaderHTML(section) {
  const meta = sectionMeta[section] || sectionMeta.feed;
  return `
    <div class="section-header">
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:24px">${meta.emoji}</span>
        <div>
          <h2>${meta.title}</h2>
          <p>${meta.desc}</p>
        </div>
      </div>
      <svg class="section-header-wave" viewBox="0 0 1440 30" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="rgba(0,119,182,0.05)" d="M0,15 C240,30 480,0 720,15 C960,30 1200,5 1440,15 L1440,30 L0,30 Z"/>
      </svg>
    </div>
  `;
}

// ─── Modals ──────────────────────────────────────────────────────
function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

function handleModalOverlayClick(event, modalId) {
  if (event.target === event.currentTarget) closeModal(modalId);
}

// ─── Dropdown ────────────────────────────────────────────────────
function toggleProfileMenu() {
  const dd = document.getElementById('profileDropdown');
  if (!dd) return;
  dd.classList.toggle('open');
}

function closeDropdowns() {
  document.querySelectorAll('.profile-dropdown.open').forEach(d => d.classList.remove('open'));
  document.querySelectorAll('.reaction-picker.show').forEach(p => p.classList.remove('show'));
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.topbar-avatar') && !e.target.closest('.profile-dropdown')) {
    document.querySelectorAll('.profile-dropdown.open').forEach(d => d.classList.remove('open'));
  }
  if (!e.target.closest('.reaction-btn') && !e.target.closest('.reaction-picker')) {
    document.querySelectorAll('.reaction-picker.show').forEach(p => p.classList.remove('show'));
  }
});

// ─── Mobile Menu ─────────────────────────────────────────────────
async function toggleMobileMenu() {
  document.getElementById('mobileMenuOverlay').classList.toggle('open');
  document.getElementById('mobileMenuDrawer').classList.toggle('open');
  lucide.createIcons();
  // Populate tides in drawer
  const tideEl = document.getElementById('mobileDrawerTides');
  if (tideEl && tideEl.textContent === 'Loading…') {
    const tides = await fetchJSON('/api/tides');
    if (tides) {
      const now = new Date();
      const nowMins = now.getHours() * 60 + now.getMinutes();
      const toMins = t => { const [time, ap] = t.split(' '); const [h, m] = time.split(':').map(Number); return ((h % 12) + (ap === 'PM' ? 12 : 0)) * 60 + m; };
      tideEl.innerHTML = tides.map(t => `<div style="display:flex;justify-content:space-between;padding:2px 0;opacity:${toMins(t.time) < nowMins ? 0.4 : 1}"><span>${t.type === 'High' ? '▲' : '▼'} ${t.type}</span><span>${t.time}</span><span>${t.height}</span></div>`).join('');
    } else { tideEl.textContent = 'Unavailable'; }
  }
}
function closeMobileMenu() {
  document.getElementById('mobileMenuOverlay').classList.remove('open');
  document.getElementById('mobileMenuDrawer').classList.remove('open');
}

// ─── Auth ────────────────────────────────────────────────────────
async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/login';
}

// ─── Toast ───────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ─── Share ───────────────────────────────────────────────────────
function handleShare(postId) {
  showToast('Post link copied to clipboard! 🔗');
}

// ─── Avatar Upload ───────────────────────────────────────────────
async function uploadAvatar(input) {
  if (!input.files || !input.files[0]) return;
  const formData = new FormData();
  formData.append('avatar', input.files[0]);
  showToast('Uploading…');
  try {
    const res = await fetch('/api/profile/avatar', { method: 'POST', body: formData, credentials: 'include' });
    if (!res.ok) throw new Error();
    const { avatarUrl } = await res.json();
    currentUser.avatarUrl = avatarUrl;
    // Update all avatar elements for current user
    updateAvatarDisplays(avatarUrl);
    showToast('Profile photo updated! ✓');
  } catch {
    showToast('Upload failed — try a smaller image');
  }
}

async function uploadBanner(input) {
  if (!input.files || !input.files[0]) return;
  const formData = new FormData();
  formData.append('banner', input.files[0]);
  showToast('Uploading…');
  try {
    const res = await fetch('/api/profile/banner', { method: 'POST', body: formData, credentials: 'include' });
    if (!res.ok) throw new Error();
    const { bannerUrl } = await res.json();
    currentUser.bannerUrl = bannerUrl;
    const banner = document.getElementById('profileBanner');
    if (banner) { banner.style.background = `url(${bannerUrl}) center/cover no-repeat`; }
    showToast('Cover photo updated! ✓');
  } catch {
    showToast('Upload failed — try a smaller image');
  }
}

function avatarHTML(user, size = 40, cls = '') {
  if (user && user.avatarUrl) {
    return `<img src="${user.avatarUrl}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;" class="${cls}" alt="${user.initials}">`;
  }
  return `<div class="${cls}" style="width:${size}px;height:${size}px;border-radius:50%;background:${user?.avatar || '#0077B6'};display:flex;align-items:center;justify-content:center;font-size:${Math.floor(size*0.35)}px;font-weight:700;color:white;flex-shrink:0;">${user?.initials || '??'}</div>`;
}

function updateAvatarDisplays(avatarUrl) {
  // Topbar
  const topEl = document.getElementById('topbarAvatar');
  const topInit = document.getElementById('topbarInitials');
  if (topEl) { topEl.style.backgroundImage = `url(${avatarUrl})`; topEl.style.backgroundSize = 'cover'; if(topInit) topInit.style.display='none'; }
  // Sidebar
  const sbEl = document.getElementById('sidebarAvatar');
  if (sbEl) { sbEl.style.backgroundImage = `url(${avatarUrl})`; sbEl.style.backgroundSize = 'cover'; sbEl.style.backgroundPosition = 'center'; const si = document.getElementById('sidebarInitials'); if(si) si.style.display='none'; }
  // Dropdown
  const ddEl = document.getElementById('dropdownAvatar');
  if (ddEl) { ddEl.style.backgroundImage = `url(${avatarUrl})`; ddEl.style.backgroundSize = 'cover'; const di = document.getElementById('dropdownInitials'); if(di) di.style.display='none'; }
  // Create post modal
  const createAv = document.getElementById('createAvatar');
  if (createAv) { createAv.innerHTML = `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`; }
  const createInit = document.getElementById('createInitials');
  if (createInit) createInit.textContent = '';
}

// ─── Lightbox ────────────────────────────────────────────────────
function openLightbox(src) {
  const lb = document.getElementById('lightbox');
  document.getElementById('lightboxImg').src = src;
  lb.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeLightbox() {
  document.getElementById('lightbox').style.display = 'none';
  document.body.style.overflow = '';
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

// ─── Utilities ───────────────────────────────────────────────────
async function fetchJSON(url) {
  try {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function relativeTime(isoString) {
  if (!isoString) return '';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(isoString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function postTypeLabel(type) {
  const labels = {
    general: 'General', safety: '⚠ Safety', lost_found: 'Lost & Found',
    for_sale: 'For Sale', free: 'Free', events: 'Event',
    recommendation: 'Recommendation', poll: 'Poll'
  };
  return labels[type] || capitalize(type);
}

function reactionEmoji(key) {
  const emojis = { like: '👍', insightful: '💡', agree: '✅', haha: '😄', wow: '😮', sad: '😢' };
  return emojis[key] || '👍';
}

function getTopReactions(reactions) {
  if (!reactions) return [];
  const emojiMap = { like: '👍', insightful: '💡', agree: '✅', haha: '😄', wow: '😮', sad: '😢' };
  return Object.entries(reactions)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key]) => ({ key, emoji: emojiMap[key] }));
}

function emptyStateHTML(icon, title, body) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">${icon}</div>
      <h3>${title}</h3>
      <p>${body}</p>
    </div>
  `;
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal('createPostModal');
    closeModal('postDetailModal');
    closeModal('eventDetailModal');
    closeDropdowns();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('searchInput')?.focus();
  }
});
