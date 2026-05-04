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

// ─── Auto-reload when server JS changes ──────────────────────────
(async () => {
  const r = await fetch('/api/version').catch(() => null);
  if (!r) return;
  const { v: initialV } = await r.json();
  setInterval(async () => {
    const r2 = await fetch('/api/version').catch(() => null);
    if (!r2) return;
    const { v } = await r2.json();
    if (v !== initialV) location.reload();
  }, 10000);
})();

// ─── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  lucide.createIcons();
  await loadNotifications();
  loadTides();
  loadWhatsHappening();
  loadSidebarWidgets();
  initMobile();
  if (currentUser?.role === 'realtor') {
    navigate('realestate');
  } else if (currentUser?.role === 'business') {
    const biz = await fetchJSON('/api/my-business');
    if (biz?.id) { navigate('businesses'); setTimeout(() => openBusinessPage(biz.id), 300); }
    else navigate('businesses');
  } else {
    navigate('feed');
    showWelcomeIfNew();
  }
  focusSharedPostFromUrl();
});

function showWelcomeIfNew() {
  if (!currentUser) return;
  const key = `welcomed_${currentUser.id}`;
  if (localStorage.getItem(key)) return;
  localStorage.setItem(key, '1');

  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:20px;width:min(440px,100%);padding:32px 28px;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,0.25);max-height:90vh;overflow-y:auto;">
      <div style="font-size:48px;margin-bottom:12px;">🏖️</div>
      <h2 style="font-size:22px;font-weight:800;color:var(--text-dark);margin-bottom:8px;">Welcome to Costa Blanca Connect</h2>
      <p style="font-size:14px;color:var(--text-mid);line-height:1.6;margin-bottom:20px;">Built to bring our community closer — a place where neighbors stay connected, share what matters, and look out for one another. Welcome to the family.</p>
      <div style="display:flex;flex-direction:column;gap:10px;text-align:left;margin-bottom:20px;">
        ${[['📰','Feed','Share updates, ask questions, connect with neighbors'],['🛒','Marketplace','Buy & sell within the community'],['📅','Events','See what\'s happening in Costa Blanca Villas'],['🏪','Businesses','Find local services & support community businesses'],['🚨','Safety','Report and stay informed about safety concerns']].map(([icon,name,desc]) =>
          `<div style="display:flex;align-items:center;gap:12px;padding:10px 14px;background:#f8fafc;border-radius:10px;">
            <span style="font-size:20px;">${icon}</span>
            <div><div style="font-size:13px;font-weight:700;color:var(--text-dark);">${name}</div><div style="font-size:12px;color:var(--text-light);">${desc}</div></div>
          </div>`).join('')}
      </div>
      <div style="background:#FFF9F0;border:1px solid #F5D78E;border-radius:12px;padding:12px 14px;text-align:left;margin-bottom:20px;">
        <div style="font-size:13px;font-weight:800;color:var(--text-dark);margin-bottom:4px;">💡 New here? Start with the Help Guide.</div>
        <div style="font-size:12px;color:var(--text-mid);line-height:1.5;">Tap the <b>?</b> icon in the top bar anytime for a full walkthrough of every feature.</div>
      </div>
      <button onclick="this.closest('[style*=fixed]').remove();openHelpModal();" style="width:100%;padding:13px;background:var(--ocean);color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">📖 Show Me How It Works</button>
      <button onclick="this.closest('[style*=fixed]').remove()" style="width:100%;padding:11px;background:none;color:var(--ocean);border:none;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;margin-top:6px;">Let's Explore 🏖️</button>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function openHelpModal() {
  const m = document.getElementById('helpModal');
  if (!m) return;
  m.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  if (currentUser?.id) localStorage.setItem(`help_seen_${currentUser.id}`, '1');
  if (window.lucide) lucide.createIcons();
}

function closeHelpModal() {
  const m = document.getElementById('helpModal');
  if (!m) return;
  m.style.display = 'none';
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const m = document.getElementById('helpModal');
    if (m && m.style.display === 'flex') closeHelpModal();
  }
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
  const [events, neighbors] = await Promise.all([
    fetchJSON('/api/events'),
    fetchJSON('/api/neighbors'),
  ]);

  // Nav badges — server-driven unread counts, poll every 30s
  refreshUnreadBadges();
  setInterval(refreshUnreadBadges, 30000);

  // Community stats
  const stats = await fetchJSON('/api/community-stats');
  if (stats) setTextSafe('activeThisWeek', stats.activeThisWeek);

  // Live weather
  loadWeather();

  // Sidebar stats
  const nbCount = document.getElementById('sidebarNeighbors');
  if (nbCount) nbCount.textContent = (neighbors || []).length;

  // Next Event — prefers user's next RSVP'd event, falls back to next community event
  const nextEventEl = document.getElementById('nextEventCard');
  const nextEventLabelEl = document.querySelector('[data-next-event-label]');
  if (nextEventEl) {
    const now = new Date();
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const upcomingEvents = (events || [])
      .filter(e => !e.cancelled)
      .filter(e => {
        const dateStr = (e.date || e.eventDate || '').substring(0,10);
        if (!dateStr) return false;
        return new Date(dateStr + 'T12:00:00') >= todayMidnight;
      })
      .sort((a, b) => new Date((a.date||a.eventDate||'').substring(0,10)+'T12:00:00') - new Date((b.date||b.eventDate||'').substring(0,10)+'T12:00:00'));

    const myRsvpd = upcomingEvents.find(e => e.userRsvp === 'going');
    const upcoming = myRsvpd || upcomingEvents[0];
    const isMine = !!myRsvpd;

    if (nextEventLabelEl) nextEventLabelEl.textContent = isMine ? 'YOUR NEXT EVENT' : 'NEXT EVENT';

    if (upcoming) {
      const d = new Date((upcoming.date || upcoming.eventDate || '').substring(0,10) + 'T12:00:00');
      const month = d.toLocaleString('en', { month: 'short' }).toUpperCase();
      const day   = d.getDate();
      const going = upcoming.rsvp?.going || upcoming.rsvpCounts?.going || 0;
      const safeId = String(upcoming.id).replace(/'/g, "\\'");
      nextEventEl.innerHTML = `
        <div class="next-event-date" style="${isMine ? 'background:#dcfce7;color:#166534;' : ''}"><span class="nev-month">${month}</span><span class="nev-day">${day}</span></div>
        <div class="next-event-info">
          <div class="nev-title">${escHtml(upcoming.title)}</div>
          <div class="nev-meta">${(upcoming.time && upcoming.time !== 'null') ? upcoming.time + ' · ' : ''}${escHtml(upcoming.location || '')}</div>
          ${isMine ? '<div style="font-size:11px;color:#166534;font-weight:700;margin-top:3px;">✓ You\'re going</div>' : (going ? `<div class="nev-going">🙋 ${going} going</div>` : '')}
        </div>`;
      nextEventEl.style.cursor = 'pointer';
      nextEventEl.onclick = () => goToEvent(safeId);
    } else {
      nextEventEl.innerHTML = '<div style="font-size:12px;color:var(--text-light);padding:8px 0">No upcoming events yet.</div>';
      nextEventEl.style.cursor = 'default';
      nextEventEl.onclick = null;
    }
  }

  // Trending Topics — most-reacted posts
  const trendingEl = document.getElementById('trendingTopicsList');
  if (trendingEl) {
    const trendPosts = await fetchJSON('/api/posts?section=feed') || [];
    const posts = trendPosts
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
          <button class="btn-msg-sm" onclick="startConversation('${n.username}')">Message</button>
        </div>`).join('');
    } else {
      nnEl.innerHTML = '<div style="font-size:12px;color:var(--text-light)">No neighbors yet.</div>';
    }
  }
}

async function loadWeather() {
  const el = document.getElementById('weatherWidget');
  if (!el) return;
  try {
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=8.38&longitude=-80.28&current=temperature_2m,weathercode&temperature_unit=fahrenheit&timezone=America%2FPanama');
    const d = await r.json();
    const temp = Math.round(d.current.temperature_2m);
    const code = d.current.weathercode;
    const icons = { 0:'☀️', 1:'🌤️', 2:'⛅', 3:'☁️', 45:'🌫️', 48:'🌫️', 51:'🌦️', 53:'🌦️', 55:'🌧️', 61:'🌧️', 63:'🌧️', 65:'🌧️', 80:'🌦️', 81:'🌧️', 82:'⛈️', 95:'⛈️' };
    const descs = { 0:'Sunny', 1:'Mostly Sunny', 2:'Partly Cloudy', 3:'Cloudy', 45:'Foggy', 48:'Foggy', 51:'Light Drizzle', 53:'Drizzle', 55:'Heavy Drizzle', 61:'Light Rain', 63:'Rain', 65:'Heavy Rain', 80:'Showers', 81:'Rain Showers', 82:'Heavy Showers', 95:'Thunderstorm' };
    const icon = icons[code] || '🌡️';
    const desc = descs[code] || 'Farallón, Panama';
    el.innerHTML = `<span class="weather-icon">${icon}</span><div><div class="weather-temp">${temp}°F</div><div class="weather-desc">${desc} · Farallón, Panama</div></div>`;
  } catch {
    el.innerHTML = `<span class="weather-icon">☀️</span><div><div class="weather-temp">—</div><div class="weather-desc">Farallón, Panama</div></div>`;
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
    if (!fresh) return;
    if (typeof fresh.points === 'number') {
      currentUser.points = fresh.points;
      setTextSafe('sidebarPoints', fresh.points);
    }
    if (typeof fresh.posts === 'number') currentUser.posts = fresh.posts;
  } catch {}
}

function renderUserUI() {
  if (!currentUser) return;
  // Topbar
  const topbarAvatar = document.getElementById('topbarAvatar');
  if (topbarAvatar) {
    topbarAvatar.style.background = currentUser.role === 'admin' ? '#0077B6' : currentUser.avatar;
    if (currentUser.role === 'admin') {
      topbarAvatar.title = 'Admin';
      topbarAvatar.style.outline = '2px solid #48CAE4';
      topbarAvatar.style.outlineOffset = '2px';
    }
    const topInit = document.getElementById('topbarInitials');
    if (currentUser.avatarUrl && currentUser.role !== 'admin') {
      topbarAvatar.style.backgroundImage = `url("${currentUser.avatarUrl}")`;
      topbarAvatar.style.backgroundSize = 'cover';
      topbarAvatar.style.backgroundPosition = 'center';
      if (topInit) topInit.style.display = 'none';
    } else {
      topbarAvatar.style.backgroundImage = '';
      if (topInit) topInit.style.display = '';
    }
  }
  setTextSafe('topbarInitials', currentUser.role === 'admin' ? '🛡' : (currentUser.avatarUrl ? '' : currentUser.initials));

  // Dropdown
  const dropAvatar = document.getElementById('dropdownAvatar');
  if (dropAvatar) {
    dropAvatar.style.background = currentUser.avatar;
    const dropInit = document.getElementById('dropdownInitials');
    if (currentUser.avatarUrl) {
      dropAvatar.style.backgroundImage = `url("${currentUser.avatarUrl}")`;
      dropAvatar.style.backgroundSize = 'cover';
      dropAvatar.style.backgroundPosition = 'center';
      if (dropInit) dropInit.style.display = 'none';
    } else {
      dropAvatar.style.backgroundImage = '';
      if (dropInit) dropInit.style.display = '';
    }
  }
  setTextSafe('dropdownInitials', currentUser.avatarUrl ? '' : currentUser.initials);
  setTextSafe('dropdownName', currentUser.name);

  // Sidebar banner
  const sidebarBanner = document.getElementById('sidebarBanner');
  if (sidebarBanner && currentUser.bannerUrl) {
    sidebarBanner.style.background = `url('${currentUser.bannerUrl}') center/cover no-repeat`;
  }
  // Sidebar avatar
  const sidebarAv = document.getElementById('sidebarAvatar');
  if (sidebarAv) {
    sidebarAv.style.background = currentUser.avatar;
    const sidebarInit = document.getElementById('sidebarInitials');
    if (currentUser.avatarUrl) {
      sidebarAv.style.backgroundImage = `url(${currentUser.avatarUrl})`;
      sidebarAv.style.backgroundSize = 'cover';
      sidebarAv.style.backgroundPosition = 'center';
      if (sidebarInit) sidebarInit.style.display = 'none';
    } else {
      sidebarAv.style.backgroundImage = '';
      if (sidebarInit) sidebarInit.style.display = '';
    }
  }
  setTextSafe('sidebarInitials', currentUser.avatarUrl ? '' : currentUser.initials);
  setTextSafe('sidebarName', currentUser.name);
  setTextSafe('sidebarPoints', currentUser.points);
  setTextSafe('sidebarStatusLabel', currentUser.role === 'admin' ? 'Admin' : currentUser.verified ? 'Verified' : '');

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

// ─── Unread badge helpers ────────────────────────────────────────
function setBadge(id, count) {
  const el = document.getElementById(id);
  if (!el) return;
  if (count > 0) { el.textContent = count; el.style.display = ''; }
  else el.style.display = 'none';
}

async function refreshUnreadBadges() {
  if (!currentUser) return;
  const counts = await fetchJSON('/api/unread');
  if (!counts) return;
  setBadge('badgeFeed', counts.feed);
  setBadge('badgeSafety', counts.safety);
  setBadge('badgeMarketplace', counts.marketplace);
  setBadge('badgeEvents', counts.events);
  setBadge('badgeMessages', counts.messages);
}

const TRACKED_SECTIONS = ['feed', 'safety', 'marketplace', 'events', 'groups', 'realestate'];

// ─── Navigation ─────────────────────────────────────────────────
function navigate(section) {
  currentSection = section;

  // Mark section as read and clear its badge
  if (currentUser && TRACKED_SECTIONS.includes(section)) {
    fetch(`/api/sections/${section}/read`, { method: 'POST', credentials: 'include' });
    setBadge('badge' + section.charAt(0).toUpperCase() + section.slice(1), 0);
  }

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
    case 'messages':    await renderMessages(container); break;
    case 'notifications': await renderNotifications(container); break;
    case 'profile':     await renderProfile(container); break;
    case 'settings':    renderSettings(container); break;
    case 'realestate':  await renderRealEstate(container); break;
    case 'transport':        await renderTransport(container); break;
    case 'firstresponders':  await renderFirstResponders(container); break;
    default:                 await renderFeed(container);
  }
  lucide.createIcons();
}

// ─── Feed ────────────────────────────────────────────────────────
async function renderFeed(container) {
  container.innerHTML = sectionHeaderHTML('feed');

  const compose = document.createElement('div');
  compose.style.cssText = 'display:flex;align-items:center;gap:10px;background:white;border-radius:16px;padding:12px 16px;margin-bottom:16px;box-shadow:0 1px 4px rgba(0,0,0,0.07);cursor:pointer;border:1.5px solid var(--border);';
  compose.onclick = () => openCreatePost();
  compose.innerHTML = `
    <div style="width:38px;height:38px;border-radius:50%;background-color:${currentUser?.avatar||'#0077B6'};${currentUser?.avatarUrl?`background-image:url(${currentUser.avatarUrl});background-size:cover;background-position:center;`:''}display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;overflow:hidden;">${currentUser?.avatarUrl ? '' : (currentUser?.initials||'?')}</div>
    <div style="flex:1;padding:9px 14px;background:var(--bg);border-radius:30px;font-size:14px;color:var(--text-light);font-family:inherit;">What's happening in Costa Blanca Villas?</div>
    <button onclick="event.stopPropagation();openCreatePost()" style="padding:8px 18px;background:var(--ocean);color:white;border:none;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">+ Post</button>
  `;
  container.appendChild(compose);

  const posts = await fetchJSON('/api/posts?section=feed');
  if (!posts || !posts.length) {
    container.insertAdjacentHTML('beforeend', emptyStateHTML('🌊', 'No posts yet', 'Be the first to post in Costa Blanca Villas!'));
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
let _marketFilter = 'All';

async function renderMarketplace(container) {
  container.innerHTML = sectionHeaderHTML('marketplace');

  const topRow = document.createElement('div');
  topRow.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px;';
  const listBtn = document.createElement('button');
  listBtn.onclick = openListItemModal;
  listBtn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 20px;background:var(--ocean);color:white;border:none;border-radius:20px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;flex-shrink:0;';
  listBtn.innerHTML = '+ List an Item';
  topRow.appendChild(listBtn);
  container.appendChild(topRow);

  const allItems = await fetchJSON('/api/marketplace');
  if (!allItems || !allItems.length) {
    container.appendChild(document.createRange().createContextualFragment(emptyStateHTML('🛒', 'Nothing listed yet', 'Be the first to list something!')));
    return;
  }

  const cats = ['All', ...new Set(allItems.map(i => i.category).filter(Boolean))];
  const filterBar = document.createElement('div');
  filterBar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;';
  filterBar.id = 'marketFilterBar';

  function applyFilter(cat) {
    _marketFilter = cat;
    filterBar.querySelectorAll('button').forEach(b => {
      b.style.background = b.dataset.cat === cat ? 'var(--ocean)' : 'var(--surface)';
      b.style.color = b.dataset.cat === cat ? 'white' : 'var(--text-dark)';
      b.style.borderColor = b.dataset.cat === cat ? 'var(--ocean)' : 'var(--border)';
    });
    const filtered = cat === 'All' ? allItems : allItems.filter(i => i.category === cat);
    grid.innerHTML = '';
    if (!filtered.length) {
      grid.innerHTML = `<p style="color:var(--text-mid);font-size:14px;grid-column:1/-1;">No items in this category.</p>`;
    } else {
      filtered.forEach(item => grid.appendChild(buildMarketCard(item)));
    }
    if (window.lucide) lucide.createIcons();
  }

  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.dataset.cat = cat;
    btn.textContent = cat;
    btn.style.cssText = `padding:6px 14px;border-radius:20px;border:1.5px solid;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.15s;background:${cat === _marketFilter ? 'var(--ocean)' : 'var(--surface)'};color:${cat === _marketFilter ? 'white' : 'var(--text-dark)'};border-color:${cat === _marketFilter ? 'var(--ocean)' : 'var(--border)'};`;
    btn.onclick = () => applyFilter(cat);
    filterBar.appendChild(btn);
  });
  container.appendChild(filterBar);

  const grid = document.createElement('div');
  grid.className = 'marketplace-grid';
  container.appendChild(grid);

  applyFilter(_marketFilter);
}

let marketImageData = null;

function openListItemModal() {
  marketImageData = null;
  const existing = document.getElementById('listItemModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'listItemModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <h3 style="margin:0;font-size:17px;font-weight:800;">List an Item</h3>
        <button onclick="document.getElementById('listItemModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-light);">✕</button>
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">TITLE *</label>
        <input id="liTitle" type="text" placeholder="What are you listing?" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" />
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px;">
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">PRICE</label>
          <input id="liPrice" type="number" placeholder="0 = Free" min="0" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" />
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">CONDITION</label>
          <select id="liCondition" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:white;box-sizing:border-box;">
            <option value="">Any</option>
            <option>New</option><option>Like New</option><option>Good</option><option>Fair</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">CATEGORY</label>
        <select id="liCategory" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:white;box-sizing:border-box;">
          <option value="">Select…</option>
          <option>Appliances</option><option>Art & Collectibles</option><option>Baby & Kids</option><option>Books & Media</option>
          <option>Clothing</option><option>Electronics</option><option>Free</option><option>Furniture</option>
          <option>Golf Cart</option><option>Home & Garden</option><option>Toys</option><option>Tools & Equipment</option><option>Vehicle</option><option>Other</option>
        </select>
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">DESCRIPTION</label>
        <textarea id="liDesc" placeholder="Describe your item…" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;resize:none;height:72px;box-sizing:border-box;"></textarea>
      </div>
      <div style="margin-bottom:18px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">PHOTO</label>
        <input id="marketPhotoFile" type="file" accept="image/*" style="display:none;" onchange="previewMarketImage(this)">
        <input id="marketPhotoCamera" type="file" accept="image/*" capture="environment" style="display:none;" onchange="previewMarketImage(this)">
        <div id="liImagePreview" style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;height:80px;border:1.5px dashed var(--border);border-radius:10px;background:#f8fafc;font-size:13px;color:var(--text-mid);font-weight:600;">📷 Upload photo</div>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button type="button" onclick="document.getElementById('marketPhotoCamera').click()" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;background:white;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--text-mid);">📷 Camera</button>
          <button type="button" onclick="document.getElementById('marketPhotoFile').click()" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;background:white;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--text-mid);">🖼️ Gallery</button>
        </div>
      </div>
      <button onclick="submitListItem()" style="width:100%;padding:12px;background:var(--ocean);color:white;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Post Listing</button>
      <div id="liErr" style="color:var(--coral);font-size:13px;margin-top:8px;display:none;"></div>
    </div>
  `;
  document.body.appendChild(modal);
}

function compressImage(dataUrl, maxW, maxH, quality) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
      if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

async function readAndCompress(file, maxW = 1200, maxH = 1200, quality = 0.82) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = async e => resolve(await compressImage(e.target.result, maxW, maxH, quality));
    reader.readAsDataURL(file);
  });
}

function previewMarketImage(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = async e => {
    marketImageData = await compressImage(e.target.result, 1200, 1200, 0.8);
    const prev = document.getElementById('liImagePreview');
    if (prev) prev.innerHTML = `<img src="${marketImageData}" style="height:70px;border-radius:8px;object-fit:cover;" />`;
  };
  reader.readAsDataURL(input.files[0]);
}

async function submitListItem() {
  const title = document.getElementById('liTitle')?.value.trim();
  const price = document.getElementById('liPrice')?.value;
  const condition = document.getElementById('liCondition')?.value;
  const category = document.getElementById('liCategory')?.value;
  const description = document.getElementById('liDesc')?.value.trim();
  const errEl = document.getElementById('liErr');

  if (!title) { errEl.textContent = 'Please enter a title.'; errEl.style.display = 'block'; return; }

  const res = await fetch('/api/marketplace', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, price: price || 0, condition, category, description, image: marketImageData || null })
  });
  if (res.ok) {
    document.getElementById('listItemModal')?.remove();
    marketImageData = null;
    _marketFilter = 'All';
    await renderMarketplace(document.getElementById('sectionContent'));
    showToast('Item listed! 🛒');
  } else {
    const d = await res.json();
    errEl.textContent = d.error || 'Something went wrong.';
    errEl.style.display = 'block';
  }
}

// ─── Events ─────────────────────────────────────────────────────
async function renderEvents(container) {
  container.innerHTML = sectionHeaderHTML('events');

  const btn = document.createElement('button');
  btn.onclick = openCreateEventModal;
  btn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 20px;background:var(--ocean);color:white;border:none;border-radius:20px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px;';
  btn.innerHTML = '+ Create Event';
  container.appendChild(btn);

  let evts = await fetchJSON('/api/events');
  if (!evts) evts = await fetchJSON('/api/events');
  if (!evts || !evts.length) {
    container.insertAdjacentHTML('beforeend', emptyStateHTML('📅', 'No events coming up', 'Create an event and invite the neighborhood!'));
    return;
  }
  evts.forEach((ev, i) => {
    const card = buildEventCard(ev);
    card.style.animationDelay = `${i * 70}ms`;
    container.appendChild(card);
  });
  if (window.lucide) lucide.createIcons();
}

function openCreateEventModal() {
  const existing = document.getElementById('createEventModal');
  if (existing) existing.remove();

  const now = new Date();
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const selStyle = 'padding:9px 10px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:white;width:100%;box-sizing:border-box;';

  // Month options
  const monthOpts = months.map((m,i) => `<option value="${String(i+1).padStart(2,'0')}" ${i===now.getMonth()?'selected':''}>${m}</option>`).join('');
  // Day options
  const dayOpts = Array.from({length:31},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}" ${i+1===now.getDate()?'selected':''}>${i+1}</option>`).join('');
  // Year options (current year + 2)
  const yearOpts = [0,1,2].map(n=>`<option value="${now.getFullYear()+n}" ${n===0?'selected':''}>${now.getFullYear()+n}</option>`).join('');
  // Hour options 1-12
  const hourOpts = Array.from({length:12},(_,i)=>`<option value="${i+1}" ${i+1===1?'selected':''}>${i+1}</option>`).join('');
  // Minute options
  const minOpts = ['00','15','30','45'].map(m=>`<option value="${m}">${m}</option>`).join('');

  const modal = document.createElement('div');
  modal.id = 'createEventModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <h3 style="margin:0;font-size:17px;font-weight:800;">Create Event</h3>
        <button onclick="document.getElementById('createEventModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-light);">✕</button>
      </div>

      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">EVENT TITLE *</label>
        <input id="evTitle" type="text" placeholder="e.g. Beach Cleanup Day" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" />
      </div>

      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">DATE *</label>
        <div style="display:grid;grid-template-columns:2fr 1fr 1.2fr;gap:8px;">
          <select id="evMonth" style="${selStyle}">${monthOpts}</select>
          <select id="evDay" style="${selStyle}">${dayOpts}</select>
          <select id="evYear" style="${selStyle}">${yearOpts}</select>
        </div>
      </div>

      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">TIME</label>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
          <select id="evHour" style="${selStyle}">${hourOpts}</select>
          <select id="evMin" style="${selStyle}">${minOpts}</select>
          <select id="evAmPm" style="${selStyle}"><option value="AM">AM</option><option value="PM" selected>PM</option></select>
        </div>
      </div>

      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">LOCATION</label>
        <input id="evLocation" type="text" placeholder="e.g. Costa Blanca Beach" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" />
      </div>

      <div style="margin-bottom:12px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">DESCRIPTION</label>
        <textarea id="evDesc" placeholder="Tell neighbors what this event is about…" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;resize:none;height:80px;box-sizing:border-box;"></textarea>
      </div>

      <div style="margin-bottom:18px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">PHOTO (OPTIONAL)</label>
        <input id="evPhotoInput" type="file" accept="image/*" style="display:none;" onchange="attachEventPhoto(this)" />
        <div id="evPhotoPreview" style="display:none;position:relative;margin-bottom:8px;">
          <img id="evPhotoImg" src="" alt="Event photo" style="width:100%;border-radius:10px;object-fit:cover;max-height:200px;display:block;" />
          <button onclick="removeEventPhoto()" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.55);color:white;border:none;border-radius:50%;width:26px;height:26px;font-size:15px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;">✕</button>
        </div>
        <button onclick="document.getElementById('evPhotoInput').click()" style="display:flex;align-items:center;gap:6px;padding:9px 14px;background:white;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--text-mid);">📷 Add Photo</button>
      </div>

      <button onclick="submitCreateEvent()" style="width:100%;padding:12px;background:var(--ocean);color:white;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Post Event</button>
      <div id="evErr" style="color:var(--coral);font-size:13px;margin-top:8px;display:none;"></div>
    </div>
  `;
  document.body.appendChild(modal);
}

let evPhotoDataUrl = null;

async function attachEventPhoto(input) {
  if (!input.files || !input.files[0]) return;
  evPhotoDataUrl = await readAndCompress(input.files[0]);
  document.getElementById('evPhotoImg').src = evPhotoDataUrl;
  document.getElementById('evPhotoPreview').style.display = 'block';
}

function removeEventPhoto() {
  evPhotoDataUrl = null;
  document.getElementById('evPhotoPreview').style.display = 'none';
  document.getElementById('evPhotoInput').value = '';
}

async function submitCreateEvent() {
  const title = document.getElementById('evTitle')?.value.trim();
  const month = document.getElementById('evMonth')?.value;
  const day = document.getElementById('evDay')?.value;
  const year = document.getElementById('evYear')?.value;
  const hour = document.getElementById('evHour')?.value;
  const min = document.getElementById('evMin')?.value;
  const ampm = document.getElementById('evAmPm')?.value;
  const location = document.getElementById('evLocation')?.value.trim();
  const description = document.getElementById('evDesc')?.value.trim();
  const errEl = document.getElementById('evErr');
  if (!title) { errEl.textContent = 'Please enter a title.'; errEl.style.display = 'block'; return; }

  const date = `${year}-${month}-${day}`;
  let h24 = parseInt(hour);
  if (ampm === 'PM' && h24 !== 12) h24 += 12;
  if (ampm === 'AM' && h24 === 12) h24 = 0;
  const time = `${String(h24).padStart(2,'0')}:${min}`;
  const body = { title, eventDate: date, eventTime: time, location, description };
  if (evPhotoDataUrl) body.image = evPhotoDataUrl;
  evPhotoDataUrl = null;

  try {
    const res = await fetch('/api/events', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (res.ok) {
      document.getElementById('createEventModal')?.remove();
      navigate('events');
      showToast('Event created! 📅');
      loadSidebarWidgets();
    } else {
      const d = await res.json().catch(() => ({}));
      showToast('Error: ' + (d.error || `Server error ${res.status}`));
    }
  } catch (err) {
    showToast('Could not connect to server. Please try again.');
    console.error('submitCreateEvent error:', err);
  }
}

// ─── Safety ─────────────────────────────────────────────────────
async function renderSafety(container) {
  container.innerHTML = sectionHeaderHTML('safety');

  container.insertAdjacentHTML('beforeend', `
    <div style="background:#FEF2F2;border:1.5px solid #FCA5A5;border-left:4px solid #DC2626;border-radius:12px;padding:14px 16px;margin-bottom:16px;display:flex;gap:12px;align-items:flex-start;">
      <span style="font-size:22px;line-height:1;">⚠️</span>
      <div>
        <div style="font-size:13px;font-weight:800;color:#991B1B;margin-bottom:4px;">This is NOT an emergency service.</div>
        <div style="font-size:12.5px;color:#7F1D1D;line-height:1.5;">Reports posted here are shared with neighbors only — they do <b>not</b> reach police, fire, or medical services. If you have a true emergency, contact emergency officials directly.</div>
      </div>
    </div>
  `);

  const btn = document.createElement('button');
  btn.onclick = () => { openSafetyReportModal(); };
  btn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:10px 20px;background:#E63946;color:white;border:none;border-radius:20px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px;';
  btn.innerHTML = '🚨 Report Safety Alert';
  container.appendChild(btn);

  const posts = await fetchJSON('/api/posts?section=safety');
  const allPosts = await fetchJSON('/api/posts?section=feed');
  const safetyPosts = [...(posts || []), ...(allPosts || []).filter(p => p.type === 'safety')];
  const seen = new Set();
  const unique = safetyPosts.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });

  if (!unique.length) {
    container.insertAdjacentHTML('beforeend', emptyStateHTML('🛡️', 'No safety alerts', 'Your neighborhood is safe!'));
    return;
  }
  unique.forEach(post => container.appendChild(buildPostCard(post)));
}

const SAFETY_CATEGORIES = [
  { id: 'Suspicious Activity', icon: '👁️', label: 'Suspicious Activity', color: '#E76F51' },
  { id: 'Security',            icon: '🔒', label: 'Security',            color: '#E63946' },
  { id: 'Lost Pet',            icon: '🐾', label: 'Lost Pet',            color: '#F4A261' },
  { id: 'Lost Pet Found',      icon: '🐶', label: 'Pet Found',           color: '#2A9D8F' },
  { id: 'Property Damage',     icon: '🏚️', label: 'Property Damage',     color: '#E76F51' },
  { id: 'Facilities',          icon: '🔧', label: 'Facilities Issue',     color: '#457B9D' },
  { id: 'Medical Emergency',   icon: '🚑', label: 'Medical Emergency',   color: '#E63946' },
  { id: 'Fire',                icon: '🔥', label: 'Fire',                color: '#E63946' },
  { id: 'Flooding',            icon: '🌊', label: 'Flooding',            color: '#0077B6' },
  { id: 'Road Works',          icon: '🚧', label: 'Road Works',          color: '#F4A261' },
  { id: 'Power Outage',        icon: '⚡', label: 'Power Outage',        color: '#E9C46A' },
  { id: 'Water Outage',        icon: '💧', label: 'Water Outage',        color: '#48CAE4' },
  { id: 'General Warning',     icon: '⚠️', label: 'General Warning',     color: '#F4A261' },
];

let safetySelectedCategory = null;
let safetyPhotoDataUrl = null;

function openSafetyReportModal() {
  const existing = document.getElementById('safetyReportModal');
  if (existing) existing.remove();
  safetySelectedCategory = null;
  safetyPhotoDataUrl = null;

  const modal = document.createElement('div');
  modal.id = 'safetyReportModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <h3 style="margin:0;font-size:17px;font-weight:800;">🚨 Report Safety Alert</h3>
        <button onclick="document.getElementById('safetyReportModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-light);">✕</button>
      </div>
      <div style="background:#FEF2F2;border:1px solid #FCA5A5;border-left:3px solid #DC2626;border-radius:10px;padding:10px 12px;margin:8px 0 14px;">
        <div style="font-size:12px;font-weight:800;color:#991B1B;margin-bottom:2px;">⚠️ Not an emergency service</div>
        <div style="font-size:11.5px;color:#7F1D1D;line-height:1.45;">This reaches neighbors only — not police/fire/medical. For true emergencies, call emergency officials.</div>
      </div>
      <p style="font-size:13px;color:var(--text-mid);margin:0 0 16px;">Select a category to report:</p>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:18px;">
        ${SAFETY_CATEGORIES.map(c => `
          <button id="safetycat-${c.id.replace(/\s/g,'_')}" onclick="selectSafetyCategory('${c.id}')"
            style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 8px;border:2px solid var(--border);border-radius:12px;background:white;cursor:pointer;font-family:inherit;transition:all 0.15s;">
            <span style="font-size:24px;">${c.icon}</span>
            <span style="font-size:11px;font-weight:700;color:var(--text-dark);text-align:center;line-height:1.2;">${c.label}</span>
          </button>
        `).join('')}
      </div>

      <div id="safetyDetailSection" style="display:none;">
        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">DESCRIPTION</label>
          <textarea id="safetyDesc" placeholder="Describe what happened, where, and any other details…" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;resize:none;height:90px;box-sizing:border-box;"></textarea>
        </div>
        <div style="margin-bottom:12px;">
          <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">SEVERITY</label>
          <div style="display:flex;gap:8px;">
            <button type="button" class="safety-sev-btn active" data-sev="low" onclick="selectSafetySeverity('low',this)" style="flex:1;padding:9px;border:1.5px solid #2A9D8F;background:#2A9D8F18;color:#2A9D8F;border-radius:8px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;">🟢 Low</button>
            <button type="button" class="safety-sev-btn" data-sev="medium" onclick="selectSafetySeverity('medium',this)" style="flex:1;padding:9px;border:1.5px solid var(--border);background:white;color:var(--text-mid);border-radius:8px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;">🟡 Medium</button>
            <button type="button" class="safety-sev-btn" data-sev="high" onclick="selectSafetySeverity('high',this)" style="flex:1;padding:9px;border:1.5px solid var(--border);background:white;color:var(--text-mid);border-radius:8px;font-size:13px;font-weight:700;font-family:inherit;cursor:pointer;">🔴 High</button>
          </div>
        </div>
        <div style="margin-bottom:18px;">
          <input id="safetyPhotoInput" type="file" accept="image/*" style="display:none;" onchange="attachSafetyPhoto(this)" />
          <input id="safetyPhotoCamera" type="file" accept="image/*" capture="environment" style="display:none;" onchange="attachSafetyPhoto(this)" />
          <div id="safetyPhotoPreview" style="display:none;position:relative;margin-bottom:8px;">
            <img id="safetyPhotoImg" src="" alt="" style="width:100%;border-radius:10px;object-fit:cover;max-height:180px;display:block;" />
            <button onclick="removeSafetyPhoto()" style="position:absolute;top:6px;right:6px;background:rgba(0,0,0,0.55);color:white;border:none;border-radius:50%;width:26px;height:26px;font-size:15px;cursor:pointer;">✕</button>
          </div>
          <div style="display:flex;gap:8px;">
            <button onclick="document.getElementById('safetyPhotoCamera').click()" style="display:flex;align-items:center;gap:6px;padding:9px 14px;background:white;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--text-mid);">📷 Camera</button>
            <button onclick="document.getElementById('safetyPhotoInput').click()" style="display:flex;align-items:center;gap:6px;padding:9px 14px;background:white;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--text-mid);">🖼️ Gallery</button>
          </div>
        </div>
        <button onclick="submitSafetyReport()" style="width:100%;padding:12px;background:#E63946;color:white;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Post Alert</button>
        <div id="safetyErr" style="color:var(--coral);font-size:13px;margin-top:8px;display:none;"></div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

let selectedSafetySev = 'low';

function selectSafetyCategory(catId) {
  safetySelectedCategory = catId;
  SAFETY_CATEGORIES.forEach(c => {
    const btn = document.getElementById('safetycat-' + c.id.replace(/\s/g,'_'));
    if (!btn) return;
    if (c.id === catId) {
      btn.style.borderColor = c.color;
      btn.style.background = c.color + '18';
    } else {
      btn.style.borderColor = 'var(--border)';
      btn.style.background = 'white';
    }
  });
  document.getElementById('safetyDetailSection').style.display = 'block';
}

function selectSafetySeverity(sev, btn) {
  selectedSafetySev = sev;
  const colors = { low: '#2A9D8F', medium: '#F4A261', high: '#E63946' };
  document.querySelectorAll('.safety-sev-btn').forEach(b => {
    b.style.borderColor = 'var(--border)'; b.style.background = 'white'; b.style.color = 'var(--text-mid)';
  });
  btn.style.borderColor = colors[sev]; btn.style.background = colors[sev] + '18'; btn.style.color = colors[sev];
}

function attachSafetyPhoto(input) {
  if (!input.files || !input.files[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let { width: w, height: h } = img;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      safetyPhotoDataUrl = canvas.toDataURL('image/jpeg', 0.82);
      document.getElementById('safetyPhotoImg').src = safetyPhotoDataUrl;
      document.getElementById('safetyPhotoPreview').style.display = 'block';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(input.files[0]);
}

function removeSafetyPhoto() {
  safetyPhotoDataUrl = null;
  document.getElementById('safetyPhotoPreview').style.display = 'none';
  document.getElementById('safetyPhotoInput').value = '';
  document.getElementById('safetyPhotoCamera').value = '';
}

async function submitSafetyReport() {
  const desc = document.getElementById('safetyDesc')?.value.trim();
  const errEl = document.getElementById('safetyErr');
  if (!safetySelectedCategory) { errEl.textContent = 'Please select a category.'; errEl.style.display = 'block'; return; }
  if (!desc) { errEl.textContent = 'Please add a description.'; errEl.style.display = 'block'; return; }
  const body = { type: 'safety', section: 'safety', content: desc, alertType: safetySelectedCategory, severity: selectedSafetySev };
  if (safetyPhotoDataUrl) body.image = safetyPhotoDataUrl;
  try {
    const res = await fetch('/api/posts', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) {
      document.getElementById('safetyReportModal')?.remove();
      await renderSafety(document.getElementById('sectionContent'));
      showToast('Safety alert posted 🚨');
    } else {
      const d = await res.json().catch(() => ({}));
      errEl.textContent = d.error || `Error ${res.status} — try again.`;
      errEl.style.display = 'block';
    }
  } catch(e) {
    errEl.textContent = 'Network error — check connection and try again.';
    errEl.style.display = 'block';
  }
}

// ─── Businesses ─────────────────────────────────────────────────


const BIZ_CATEGORIES = [
  { label: 'AC Service',           icon: '❄️' },
  { label: 'Auto Repair',          icon: '🔩' },
  { label: 'Bar & Grill',          icon: '🍺' },
  { label: 'Beauty & Wellness',    icon: '💅' },
  { label: 'Cafe & Bakery',        icon: '☕' },
  { label: 'Delivery Service',     icon: '📦' },
  { label: 'Entertainment',        icon: '🎉' },
  { label: 'Expat Services',       icon: '✈️' },
  { label: 'Fish Market',          icon: '🐟' },
  { label: 'Fresh Market',         icon: '🥦' },
  { label: 'Handyman',             icon: '🪛' },
  { label: 'Health & Medical',     icon: '🏥' },
  { label: 'Home Services',        icon: '🔧' },
  { label: 'Immigration',          icon: '🛂' },
  { label: 'Pool Service',         icon: '🏊' },
  { label: 'Professional Services', icon: '💼' },
  { label: 'Real Estate',          icon: '🏠' },
  { label: 'Restaurant',           icon: '🍽️' },
  { label: 'Retail & Shopping',    icon: '🛍️' },
  { label: 'Sports & Fitness',     icon: '⚽' },
  { label: 'Supermarket',          icon: '🛒' },
  { label: 'Towing',               icon: '🚛' },
  { label: 'Transportation',       icon: '🚗' },
  { label: 'Veterans',             icon: '🎖️' },
  { label: 'Other',                icon: '📌' },
];

let allBusinesses = [];
let bizActiveCat = 'All';
let bizSearchQuery = '';

async function renderBusinesses(container) {
  container.innerHTML = '';
  currentBizId = null;

  const addBtnHtml = currentUser
    ? `<button onclick="openAddBusinessModal()" style="padding:9px 18px;background:var(--ocean);color:white;border:none;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">+ Add Business</button>`
    : '';

  const topBar = document.createElement('div');
  topBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;';
  topBar.innerHTML = `<div><h2 style="font-size:19px;font-weight:800;color:var(--text-dark);margin:0;">Business Directory</h2><p style="font-size:13px;color:var(--text-light);margin:2px 0 0;">Local restaurants and services near Farallón</p></div>${addBtnHtml}`;
  container.appendChild(topBar);

  // Search bar
  const searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'position:relative;margin-bottom:12px;';
  searchWrap.innerHTML = `
    <input id="bizSearch" type="text" placeholder="Search businesses…"
      oninput="bizSearchQuery=this.value;renderBizList()"
      style="width:100%;padding:10px 14px 10px 38px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;background:white;" />
    <span style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:16px;pointer-events:none;">🔍</span>`;
  container.appendChild(searchWrap);

  allBusinesses = await fetchJSON('/api/businesses') || [];

  // Category chips — always shown
  const chipOuter = document.createElement('div');
  chipOuter.style.cssText = 'position:relative;margin-bottom:16px;';

  const btnStyle = 'position:absolute;top:50%;transform:translateY(-50%);z-index:2;width:28px;height:28px;border-radius:50%;background:white;border:1.5px solid var(--border);box-shadow:0 1px 4px rgba(0,0,0,0.12);cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;';
  const leftBtn = document.createElement('button');
  leftBtn.innerHTML = '‹';
  leftBtn.style.cssText = btnStyle + 'left:0;';
  const rightBtn = document.createElement('button');
  rightBtn.innerHTML = '›';
  rightBtn.style.cssText = btnStyle + 'right:0;';

  const chipWrap = document.createElement('div');
  chipWrap.id = 'bizCatChips';
  chipWrap.style.cssText = 'display:flex;gap:8px;flex-wrap:nowrap;overflow-x:auto;padding:2px 34px 4px;scrollbar-width:none;-ms-overflow-style:none;';

  const allChips = [{ label: 'All', icon: '🏪' }, ...BIZ_CATEGORIES];
  chipWrap.innerHTML = allChips.map(c => `
    <button onclick="bizActiveCat='${c.label}';renderBizList()"
      style="flex-shrink:0;padding:7px 15px;border-radius:20px;font-size:13px;font-weight:600;font-family:inherit;cursor:pointer;border:1.5px solid ${c.label==='All'?'var(--ocean)':'var(--border)'};background:${c.label==='All'?'var(--ocean)':'white'};color:${c.label==='All'?'white':'var(--text-mid)'};">
      ${c.icon} ${c.label}
    </button>`).join('');

  leftBtn.onclick = () => chipWrap.scrollBy({ left: -200, behavior: 'smooth' });
  rightBtn.onclick = () => chipWrap.scrollBy({ left: 200, behavior: 'smooth' });

  chipOuter.appendChild(leftBtn);
  chipOuter.appendChild(chipWrap);
  chipOuter.appendChild(rightBtn);
  container.appendChild(chipOuter);

  const list = document.createElement('div');
  list.id = 'bizList';
  list.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  container.appendChild(list);

  bizActiveCat = 'All';
  bizSearchQuery = '';
  renderBizList();
}

function renderBizList() {
  const list = document.getElementById('bizList');
  if (!list) return;

  // Update chip styles
  document.querySelectorAll('#bizCatChips button').forEach(btn => {
    const chipCat = [...BIZ_CATEGORIES, { label: 'All' }].find(c => btn.textContent.trim().includes(c.label));
    const active = chipCat?.label === bizActiveCat;
    btn.style.background = active ? 'var(--ocean)' : 'white';
    btn.style.color = active ? 'white' : 'var(--text-mid)';
    btn.style.borderColor = active ? 'var(--ocean)' : 'var(--border)';
  });

  const q = bizSearchQuery.toLowerCase();
  const filtered = allBusinesses.filter(b => {
    const catMatch = bizActiveCat === 'All' || b.category === bizActiveCat;
    const searchMatch = !q || b.name?.toLowerCase().includes(q) || b.category?.toLowerCase().includes(q);
    return catMatch && searchMatch;
  });

  list.innerHTML = '';
  if (!filtered.length) {
    list.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-mid);font-size:14px;">No businesses found.</div>`;
    return;
  }
  filtered.forEach((biz, i) => {
    const card = buildBusinessListingCard(biz);
    card.style.animationDelay = `${i * 50}ms`;
    list.appendChild(card);
  });
}

const MEDICAL_BIZ_CATEGORIES = ['Health & Medical'];
const MEDICAL_BIZ_SERVICES = ['Emergency Room','ICU / Critical Care','Surgery','Maternity','Pediatrics','Cardiology','Neurology','Orthopedics','X-Ray / Radiology','CT Scan','Ultrasound','Laboratory','Pharmacy','Ambulance / Transport','Antivenom','Blood Donations','Dialysis','Oncology','Psychiatry','English Speaking Staff'];

function openAddBusinessModal() {
  const existing = document.getElementById('addBizModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'addBizModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:20px 24px 0;">
        <h3 style="margin:0;font-size:17px;font-weight:800;">Add Business</h3>
        <button onclick="document.getElementById('addBizModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
      </div>

      <!-- Banner picker -->
      <div style="position:relative;height:120px;background:linear-gradient(135deg,var(--ocean),var(--seafoam));margin:16px 0 0;cursor:pointer;overflow:hidden;" id="abBannerPreview" onclick="document.getElementById('abBannerInput').click()">
        <div id="abBannerPlaceholder" style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;color:rgba(255,255,255,0.85);gap:4px;">
          <span style="font-size:22px;">🖼️</span>
          <span style="font-size:12px;font-weight:600;">Add Banner Photo</span>
        </div>
        <input id="abBannerInput" type="file" accept="image/*" style="display:none;" onchange="previewAbBanner(this)"/>
      </div>

      <!-- Logo picker overlapping banner -->
      <div style="padding:0 24px;margin-top:-30px;position:relative;z-index:2;margin-bottom:12px;">
        <div id="abLogoPreview" onclick="document.getElementById('abLogoInput').click()" style="width:64px;height:64px;border-radius:50%;background:white;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;font-size:11px;color:#6b7a8d;font-weight:600;text-align:center;line-height:1.3;">
          <span>+ Logo</span>
        </div>
        <input id="abLogoInput" type="file" accept="image/*" style="display:none;" onchange="previewAbLogo(this)"/>
      </div>

      <div style="padding:0 24px 24px;">
        <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">NAME *</label><input id="abName" type="text" placeholder="e.g. Costa Coffee" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;"/></div>
        <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">CATEGORY</label><select id="abCategory" onchange="toggleAbMedical(this.value)" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;background:white;"><option value="">Select a category…</option>${BIZ_CATEGORIES.map(c=>`<option value="${c.label}">${c.icon} ${c.label}</option>`).join('')}</select></div>
        ${['ADDRESS:abAddress:text:Street address','PHONE:abPhone:tel:+507 xxx xxxx','HOURS:abHours:text:Mon–Fri 9am–6pm, 24/7, etc.','WEBSITE:abWebsite:url:https://...','INSTAGRAM:abInstagram:url:https://instagram.com/yourbusiness','FACEBOOK:abFacebook:url:https://facebook.com/yourbusiness'].map(f => {
          const [label, id, type, placeholder] = f.split(':');
          return `<div style="margin-bottom:12px;"><label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">${label}</label><input id="${id}" type="${type}" placeholder="${placeholder}" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;"/></div>`;
        }).join('')}
        <!-- Medical/EMS extra fields — shown only for health categories -->
        <div id="abMedicalSection" style="display:none;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:12px;padding:14px;margin-bottom:12px;">
          <div style="font-size:12px;font-weight:700;color:#059669;margin-bottom:10px;">🏥 Medical / Emergency Services Info</div>
          <div style="margin-bottom:10px;"><label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">WHATSAPP</label><input id="abWhatsapp" type="tel" placeholder="+507 xxx xxxx (for quick emergency contact)" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;background:white;"/></div>
          <div style="font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:8px;">SERVICES OFFERED</div>
          <div id="abServicesCheck" style="display:flex;flex-wrap:wrap;gap:6px;">${MEDICAL_BIZ_SERVICES.map(s=>`<label style="display:flex;align-items:center;gap:4px;font-size:12.5px;color:#1a2e44;cursor:pointer;background:white;border:1px solid #dde4ed;border-radius:8px;padding:4px 8px;"><input type="checkbox" value="${s}" style="cursor:pointer;"> ${s}</label>`).join('')}</div>
        </div>
        <div style="margin-bottom:18px;">
          <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">DESCRIPTION</label>
          <textarea id="abDesc" placeholder="What does this business offer?" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;resize:none;height:80px;box-sizing:border-box;"></textarea>
        </div>
        <button onclick="submitAddBusiness()" style="width:100%;padding:12px;background:var(--ocean);color:white;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Add to Directory</button>
        <div id="abErr" style="color:var(--coral);font-size:13px;margin-top:8px;display:none;"></div>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function toggleAbMedical(cat) {
  const sec = document.getElementById('abMedicalSection');
  if (sec) sec.style.display = MEDICAL_BIZ_CATEGORIES.includes(cat) ? 'block' : 'none';
}

function previewAbBanner(input) {
  if (!input.files?.[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('abBannerPreview');
    prev.style.backgroundImage = `url(${e.target.result})`;
    prev.style.backgroundSize = 'cover';
    prev.style.backgroundPosition = 'center';
    document.getElementById('abBannerPlaceholder').style.display = 'none';
  };
  reader.readAsDataURL(input.files[0]);
}

function previewAbLogo(input) {
  if (!input.files?.[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('abLogoPreview');
    prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
  };
  reader.readAsDataURL(input.files[0]);
}

async function submitAddBusiness() {
  const name = document.getElementById('abName')?.value.trim();
  const errEl = document.getElementById('abErr');
  if (!name) { errEl.textContent = 'Business name is required.'; errEl.style.display = 'block'; return; }
  const res = await fetch('/api/businesses', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      category: document.getElementById('abCategory')?.value.trim() || null,
      address: document.getElementById('abAddress')?.value.trim() || null,
      phone: document.getElementById('abPhone')?.value.trim() || null,
      hours: document.getElementById('abHours')?.value.trim() || null,
      whatsapp: document.getElementById('abWhatsapp')?.value.trim() || null,
      services: [...(document.querySelectorAll('#abServicesCheck input:checked')||[])].map(i=>i.value),
      website: document.getElementById('abWebsite')?.value.trim() || null,
      instagramUrl: document.getElementById('abInstagram')?.value.trim() || null,
      facebookUrl: document.getElementById('abFacebook')?.value.trim() || null,
      description: document.getElementById('abDesc')?.value.trim() || '',
    })
  });
  if (!res.ok) {
    const d = await res.json();
    errEl.textContent = d.error || 'Something went wrong.';
    errEl.style.display = 'block';
    return;
  }
  const { business } = await res.json();

  // Upload banner if selected
  const bannerFile = document.getElementById('abBannerInput')?.files?.[0];
  if (bannerFile && business?.id) {
    const dataUrl = await readAndCompress(bannerFile, 1400, 600);
    await fetch(`/api/businesses/${business.id}/banner`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) });
  }
  // Upload logo if selected
  const logoFile = document.getElementById('abLogoInput')?.files?.[0];
  if (logoFile && business?.id) {
    const dataUrl = await readAndCompress(logoFile, 800, 800, 0.88);
    await fetch(`/api/businesses/${business.id}/logo`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) });
  }

  document.getElementById('addBizModal').remove();
  await renderBusinesses(document.getElementById('sectionContent'));
  showToast('Business added to directory!');
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
const GROUP_CATEGORIES = [
  { key: 'social',     emoji: '🍷', label: 'Social' },
  { key: 'sports',     emoji: '⛳', label: 'Sports & Fitness' },
  { key: 'outdoors',   emoji: '🏖️', label: 'Beach & Outdoors' },
  { key: 'family',     emoji: '👨‍👩‍👧', label: 'Families & Kids' },
  { key: 'pets',       emoji: '🐕', label: 'Pets & Animals' },
  { key: 'food',       emoji: '🍳', label: 'Food & Cooking' },
  { key: 'arts',       emoji: '🎨', label: 'Hobbies & Arts' },
  { key: 'veterans',   emoji: '🎖️', label: 'Veterans' },
  { key: 'volunteer',  emoji: '🤝', label: 'Volunteer & Causes' },
  { key: 'general',    emoji: '🌐', label: 'General' }
];
function getGroupCategory(key) {
  const k = (key || '').toLowerCase();
  return GROUP_CATEGORIES.find(c => c.key === k) || GROUP_CATEGORIES.find(c => c.key === 'general');
}

let groupsState = { all: [], filter: 'all', search: '' };

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

  const groups = await fetchJSON('/api/groups?t=' + Date.now());
  groupsState.all = groups || [];

  if (!groups || !groups.length) {
    container.appendChild(Object.assign(document.createElement('div'), { innerHTML: emptyStateHTML('👥', 'No groups yet', 'Be the first to create one!') }));
    return;
  }

  // Search bar
  const searchWrap = document.createElement('div');
  searchWrap.style.cssText = 'margin:14px 0 10px;';
  searchWrap.innerHTML = `<input id="groupsSearch" type="search" placeholder="Search groups by name or description…" oninput="onGroupsSearch(this.value)" value="${escHtml(groupsState.search)}" style="width:100%;padding:11px 14px;border:1.5px solid #dde4ed;border-radius:12px;font-size:13.5px;font-family:inherit;outline:none;background:white;box-sizing:border-box;" />`;
  container.appendChild(searchWrap);

  // Filter chips
  const chips = document.createElement('div');
  chips.id = 'groupsFilters';
  chips.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;';
  container.appendChild(chips);

  const grid = document.createElement('div');
  grid.className = 'groups-grid';
  grid.id = 'groupsGrid';
  container.appendChild(grid);

  applyGroupsFilter();
}

function onGroupsSearch(v) { groupsState.search = (v || '').toLowerCase().trim(); applyGroupsFilter(); }
function setGroupsFilter(f) { groupsState.filter = f; applyGroupsFilter(); }

function applyGroupsFilter() {
  const groups = groupsState.all;
  const counts = { all: groups.length };
  GROUP_CATEGORIES.forEach(c => { counts[c.key] = groups.filter(g => (g.category || 'general').toLowerCase() === c.key).length; });

  const chips = document.getElementById('groupsFilters');
  if (chips) {
    const items = [['all','All', counts.all], ...GROUP_CATEGORIES.filter(c => counts[c.key] > 0).map(c => [c.key, `${c.emoji} ${c.label}`, counts[c.key]])];
    chips.innerHTML = items.map(([k, l, c]) =>
      `<button class="filter-chip ${groupsState.filter===k?'active':''}" onclick="setGroupsFilter('${k}')" style="padding:6px 13px;background:${groupsState.filter===k?'var(--ocean)':'white'};color:${groupsState.filter===k?'white':'#475569'};border:1.5px solid ${groupsState.filter===k?'var(--ocean)':'#dde4ed'};border-radius:20px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;">${l}<span style="opacity:0.7;margin-left:4px;font-weight:500;">(${c})</span></button>`
    ).join('');
  }

  let list = groups;
  if (groupsState.filter !== 'all') list = list.filter(g => (g.category || 'general').toLowerCase() === groupsState.filter);
  if (groupsState.search) list = list.filter(g =>
    (g.name || '').toLowerCase().includes(groupsState.search) ||
    (g.description || '').toLowerCase().includes(groupsState.search)
  );

  const grid = document.getElementById('groupsGrid');
  if (!grid) return;
  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;background:white;border:1px solid var(--border);border-radius:14px;padding:30px;text-align:center;color:var(--text-light);font-size:14px;">No groups match. Try a different category or search term.</div>`;
    return;
  }
  grid.innerHTML = '';
  list.forEach((g, i) => {
    const card = buildGroupCard(g);
    card.style.animationDelay = `${i * 60}ms`;
    grid.appendChild(card);
  });
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

  let verifyStatus = null;
  if (!user.verified) {
    try { const d = await fetchJSON('/api/verification/status'); verifyStatus = d?.status; } catch (_) {}
  }

  const bannerStyle = user.bannerUrl
    ? `background:url('${user.bannerUrl}') center/cover no-repeat`
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
        <label style="cursor:pointer;position:relative;display:block;" title="Change profile photo">
          <input type="file" accept="image/*" style="display:none" onchange="uploadAvatar(this)">
          <div class="profile-avatar" style="background:${user.avatar}">${avatarContent}</div>
          <div style="position:absolute;bottom:2px;right:2px;width:26px;height:26px;background:#0077B6;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;">
            <i data-lucide="camera" style="width:12px;height:12px;color:white;"></i>
          </div>
        </label>
      </div>
    </div>
    <div class="profile-info">
      <div class="profile-name">
        ${user.name}
        ${user.verified ? `<span class="badge-verified"><span style="font-size:10px">✓</span> Verified Neighbor</span>` : ''}
      </div>
      <div class="profile-location">
        <i data-lucide="map-pin" style="width:13px;height:13px;"></i>
        Costa Blanca Villas${user.role === 'admin' ? ` · <span style="color:var(--ocean);font-weight:600;">Admin</span>` : user.verified ? ` · <span style="color:var(--ocean);font-weight:600;">Verified</span>` : ''}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        <button onclick="openEditProfile()" style="padding:8px 18px;background:var(--ocean);color:white;border:none;border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">✏️ Edit Profile</button>
        ${!user.verified ? (verifyStatus === 'pending' ? `<span style="padding:8px 14px;background:#fef9c3;color:#854d0e;border:1.5px solid #fde047;border-radius:20px;font-size:13px;font-weight:700;">⏳ Verification Pending</span>` : `<button id="verifyBtn" onclick="openVerificationModal()" style="padding:8px 18px;background:white;color:var(--ocean);border:1.5px solid var(--ocean);border-radius:20px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">✓ Get Verified</button>`) : ''}
      </div>
      <div class="profile-stats">
        <div class="profile-stat">
          <div class="profile-stat-val">${user.posts || 0}</div>
          <div class="profile-stat-lbl">Posts</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-val">${user.neighbors || 0}</div>
          <div class="profile-stat-lbl">Neighbors</div>
        </div>
        <div class="profile-stat" title="${pointsLevelLabel(user.points)}">
          <div class="profile-stat-val">${user.points ?? 0}</div>
          <div class="profile-stat-lbl">Points · ${pointsLevelLabel(user.points)}</div>
        </div>
        <div class="profile-stat">
          <div class="profile-stat-val">${user.memberSince || new Date().getFullYear()}</div>
          <div class="profile-stat-lbl">Member Since</div>
        </div>
      </div>

      <!-- Points explanation -->
      <div style="margin-top:14px;background:#f0f6ff;border:1.5px solid #bfdbfe;border-radius:14px;padding:14px 16px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
          <span style="font-size:18px;">⚡</span>
          <div style="font-size:13px;font-weight:800;color:var(--text-dark);">How Points Work</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">
          ${[
            ['📝','Post on the feed','+5 pts'],
            ['💬','Comment on a post','+2 pts'],
            ['👍','Your post gets liked','+1 pt per like'],
            ['🛒','List an item for sale','+3 pts'],
            ['📅','RSVP to an event','+2 pts'],
            ['🏪','Add a business','+10 pts'],
            ['✅','Get verified as a neighbor','+20 pts'],
          ].map(([ic, action, pts]) => `
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:12.5px;">
              <div style="display:flex;align-items:center;gap:6px;color:var(--text-mid);">
                <span>${ic}</span><span>${action}</span>
              </div>
              <span style="font-weight:700;color:var(--ocean);white-space:nowrap;">${pts}</span>
            </div>`).join('')}
        </div>
        <div style="font-size:11.5px;font-weight:700;color:var(--text-mid);margin-bottom:6px;">YOUR LEVEL PROGRESSION</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          ${[['Newcomer','0+','#6b7280'],['Neighbor','50+','#059669'],['Member','200+','#0284c7'],['Regular','500+','#7c3aed'],['Champion','1000+','#d97706'],['Legend','2000+','#dc2626']].map(([name,pts,color]) => `
            <div style="background:${name === pointsLevelLabel(user.points) ? color : 'white'};color:${name === pointsLevelLabel(user.points) ? 'white' : color};border:1.5px solid ${color};border-radius:20px;font-size:11px;font-weight:700;padding:3px 9px;white-space:nowrap;">
              ${name === pointsLevelLabel(user.points) ? '★ ' : ''}${name} · ${pts}
            </div>`).join('')}
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

function openEditProfile() {
  const u = currentUser;
  document.getElementById('editProfileModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'editProfileModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <h3 style="margin:0;font-size:18px;font-weight:800;">Edit Profile</h3>
        <button onclick="document.getElementById('editProfileModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <label style="font-size:12px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px;">Full Name</label>
          <input id="epName" value="${escHtml(u.name||'')}" style="width:100%;margin-top:4px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px;">Neighborhood / Area <span style="font-weight:400;text-transform:none;color:#aaa;">(optional)</span></label>
          <input id="epAddress" value="${escHtml(u.address||'')}" placeholder="e.g. Villa 42, Farallón, Las Olas…" style="width:100%;margin-top:4px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px;">Member Since <span style="font-weight:400;text-transform:none;color:#aaa;">(optional)</span></label>
          <input id="epYears" type="number" min="2000" max="${new Date().getFullYear()}" value="${u.memberSince || new Date().getFullYear()}" placeholder="${new Date().getFullYear()}" style="width:100%;margin-top:4px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;box-sizing:border-box;">
        </div>
        <div id="epErr" style="display:none;color:var(--coral);font-size:13px;"></div>
        <button onclick="submitEditProfile()" style="width:100%;padding:12px;background:var(--ocean);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Save Changes</button>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function submitEditProfile() {
  const name = document.getElementById('epName')?.value.trim();
  const bio = document.getElementById('epBio')?.value.trim();
  const address = document.getElementById('epAddress')?.value.trim();
  const yearsInNeighborhood = document.getElementById('epYears')?.value ? new Date().getFullYear() - parseInt(document.getElementById('epYears').value) : 0;
  const errEl = document.getElementById('epErr');
  if (!name) { errEl.textContent = 'Name is required.'; errEl.style.display = 'block'; return; }
  const res = await fetch('/api/profile', {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, bio, address, yearsInNeighborhood })
  });
  if (!res.ok) { errEl.textContent = 'Could not save. Try again.'; errEl.style.display = 'block'; return; }
  document.getElementById('editProfileModal')?.remove();
  const fresh = await fetchJSON('/api/auth/me');
  if (fresh) { currentUser = fresh; renderUserUI(); }
  navigate('profile');
  showToast('Profile updated!');
}

// ─── Verification modal ──────────────────────────────────────────
function openVerificationModal() {
  document.getElementById('verifyModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'verifyModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:420px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
        <h3 style="margin:0;font-size:18px;font-weight:800;">Get Verified</h3>
        <button onclick="document.getElementById('verifyModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
      </div>
      <div style="background:#f0f6ff;border:1.5px solid #bfdbfe;border-radius:12px;padding:14px 16px;margin-bottom:18px;">
        <div style="font-size:13.5px;font-weight:700;color:var(--text-dark);margin-bottom:4px;">✓ What does Verified mean?</div>
        <div style="font-size:13px;color:var(--text-mid);line-height:1.5;">The <strong>Verified Neighbor</strong> badge lets the community know you live or rent here in Costa Blanca Villas. It builds trust with your neighbors and unlocks +20 points.</div>
      </div>
      <p style="margin:0 0 18px;font-size:13.5px;color:var(--text-mid);">Upload a document showing your name and address at Costa Blanca Villas — a utility bill, lease agreement, or official mail. Our team reviews requests within 1–2 days.</p>
      <div style="display:flex;flex-direction:column;gap:14px;">
        <div>
          <label style="font-size:12px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px;">Document Type</label>
          <select id="vrDocType" style="width:100%;margin-top:4px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;background:white;">
            <option value="utility_bill">Utility Bill</option>
            <option value="lease">Lease / Rental Agreement</option>
            <option value="official_mail">Official Mail / Letter</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px;">Upload Document <span style="color:var(--coral)">*</span></label>
          <div id="vrPreviewWrap" style="display:none;margin-top:6px;margin-bottom:6px;">
            <img id="vrPreview" style="max-width:100%;border-radius:8px;border:1px solid var(--border);">
          </div>
          <label style="display:block;margin-top:4px;padding:28px 12px;border:2px dashed var(--border);border-radius:10px;text-align:center;cursor:pointer;font-size:13px;color:var(--text-light);" id="vrUploadLabel">
            <div style="font-size:24px;margin-bottom:4px;">📄</div>
            Click to choose a photo or file
            <input id="vrFile" type="file" accept="image/*,application/pdf" style="display:none;" onchange="handleVerifyDocSelect(event)">
          </label>
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:0.5px;">Note <span style="font-weight:400;text-transform:none;color:#aaa;">(optional)</span></label>
          <textarea id="vrNote" placeholder="Any extra context for the admin…" rows="2" style="width:100%;margin-top:4px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;resize:vertical;box-sizing:border-box;"></textarea>
        </div>
        <div id="vrErr" style="display:none;color:var(--coral);font-size:13px;"></div>
        <button onclick="submitVerificationRequest()" style="width:100%;padding:12px;background:var(--ocean);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Submit for Verification</button>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function handleVerifyDocSelect(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    document.getElementById('vrPreview').src = ev.target.result;
    document.getElementById('vrPreviewWrap').style.display = 'block';
    document.getElementById('vrUploadLabel').style.paddingTop = '8px';
    document.getElementById('vrUploadLabel').childNodes[0].textContent = '📄 ';
  };
  reader.readAsDataURL(file);
}

async function submitVerificationRequest() {
  const errEl = document.getElementById('vrErr');
  errEl.style.display = 'none';
  const fileInput = document.getElementById('vrFile');
  if (!fileInput.files[0]) { errEl.textContent = 'Please upload a document.'; errEl.style.display = 'block'; return; }
  const docType = document.getElementById('vrDocType').value;
  const note = document.getElementById('vrNote').value.trim();
  const btn = document.querySelector('#verifyModal button:last-child');
  btn.disabled = true; btn.textContent = 'Submitting…';
  const documentData = await readAndCompress(fileInput.files[0], 1600, 1600, 0.88);
  const res = await fetch('/api/verification/request', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documentData, documentType: docType, note })
  });
  if (!res.ok) {
    const d = await res.json();
    errEl.textContent = d.error || 'Submission failed. Please try again.';
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Submit for Verification';
    return;
  }
  document.getElementById('verifyModal')?.remove();
  showToast('Verification request submitted! We\'ll review it shortly.');
  navigate('profile');
}

// ─── Settings ────────────────────────────────────────────────────
function renderSettings(container) {
  const u = currentUser || {};
  const bannerStyle = u.bannerUrl
    ? `background:url('${u.bannerUrl}') center/cover no-repeat`
    : `background:linear-gradient(135deg,var(--ocean),var(--seafoam))`;
  container.innerHTML = `
    <div class="profile-banner" style="${bannerStyle}">
      <div class="profile-avatar-wrap">
        <div class="profile-avatar" style="background:${u.avatar}">${u.avatarUrl ? `<img src="${u.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : u.initials}</div>
      </div>
    </div>
    <div class="profile-info" style="margin-bottom:16px;">
      <div class="profile-name">${u.name} ${u.verified ? `<span class="badge-verified"><span style="font-size:10px">✓</span> Verified</span>` : ''}</div>
      <div class="profile-location"><i data-lucide="map-pin" style="width:13px;height:13px"></i> Costa Blanca Villas${u.verified ? ` · <span style="color:var(--ocean);font-weight:600;">Verified</span>` : ''}</div>
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
        <div class="settings-row-info"><div class="settings-row-label">Display Name</div><div class="settings-row-sub">${u.name}</div></div>
        <button class="settings-btn" onclick="navigate('profile');openEditProfile()">Edit</button>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Username</div><div class="settings-row-sub">@${u.username || ''}</div></div>
        <span style="font-size:12px;color:var(--text-light);">Cannot be changed</span>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Email</div><div class="settings-row-sub">${u.email || '—'}</div></div>
        <span style="font-size:12px;color:var(--text-light);">Cannot be changed</span>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Password</div><div class="settings-row-sub">••••••••</div></div>
        <button class="settings-btn" onclick="window.location.href='/reset-password'">Change</button>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Address</div><div class="settings-row-sub">${u.address || 'Costa Blanca Villas'}</div></div>
        <button class="settings-btn" onclick="navigate('profile');openEditProfile()">Edit</button>
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
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Group Activity</div><div class="settings-row-sub">New posts in groups you've joined</div></div>
        <label class="toggle-switch"><input type="checkbox" checked onchange="showToast('Saved')"><span class="toggle-slider"></span></label>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Lost & Found</div><div class="settings-row-sub">New lost & found posts in the community</div></div>
        <label class="toggle-switch"><input type="checkbox" checked onchange="showToast('Saved')"><span class="toggle-slider"></span></label>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Marketplace</div><div class="settings-row-sub">New items listed in the marketplace</div></div>
        <label class="toggle-switch"><input type="checkbox" checked onchange="showToast('Saved')"><span class="toggle-slider"></span></label>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">New Neighbors</div><div class="settings-row-sub">When someone new joins the community</div></div>
        <label class="toggle-switch"><input type="checkbox" checked onchange="showToast('Saved')"><span class="toggle-slider"></span></label>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">Privacy</div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Show Address to Neighbors</div><div class="settings-row-sub">Neighbors can see your villa number</div></div>
        <label class="toggle-switch"><input type="checkbox" checked onchange="showToast('Saved')"><span class="toggle-slider"></span></label>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Receive Direct Messages</div><div class="settings-row-sub">Allow neighbors to send you private messages</div></div>
        <label class="toggle-switch"><input type="checkbox" id="allowMessagesToggle" ${u.allowMessages !== false ? 'checked' : ''} onchange="toggleAllowMessages(this.checked)"><span class="toggle-slider"></span></label>
      </div>
    </div>

    <div class="settings-group">
      <div class="settings-group-title">Account</div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label">Change Password</div><div class="settings-row-sub">Update your login password</div></div>
        <button class="settings-btn" onclick="openChangePassword()">Change</button>
      </div>
      <div class="settings-row">
        <div class="settings-row-info"><div class="settings-row-label" style="color:var(--coral)">Sign Out</div><div class="settings-row-sub">Log out of Costa Blanca Connect</div></div>
        <button class="settings-btn danger" onclick="logout()">Sign Out</button>
      </div>
    </div>
  `;
  lucide.createIcons();
}

async function toggleAllowMessages(allow) {
  const res = await fetch('/api/profile/allow-messages', {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ allow })
  });
  if (res.ok) {
    currentUser.allowMessages = allow;
    showToast(allow ? 'Messages enabled' : 'Messages turned off');
  } else {
    showToast('Failed to save. Try again.');
    document.getElementById('allowMessagesToggle').checked = !allow;
  }
}

function openChangePassword() {
  const existing = document.getElementById('changePwModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'changePwModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:18px;padding:24px;width:100%;max-width:380px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
        <div style="font-size:17px;font-weight:700;color:var(--text-dark);">Change Password</div>
        <button onclick="document.getElementById('changePwModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:var(--text-mid);">✕</button>
      </div>
      <input type="password" id="cpCurrent" placeholder="Current password" style="width:100%;padding:11px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;box-sizing:border-box;" />
      <input type="password" id="cpNew" placeholder="New password (min 8 characters)" style="width:100%;padding:11px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;box-sizing:border-box;" />
      <input type="password" id="cpConfirm" placeholder="Confirm new password" style="width:100%;padding:11px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;margin-bottom:10px;box-sizing:border-box;" />
      <div id="cpErr" style="color:var(--coral);font-size:13px;margin-bottom:10px;display:none;"></div>
      <button onclick="submitChangePassword()" style="width:100%;padding:12px;background:var(--ocean);color:white;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Update Password</button>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function submitChangePassword() {
  const currentPassword = document.getElementById('cpCurrent')?.value;
  const newPassword = document.getElementById('cpNew')?.value;
  const confirm = document.getElementById('cpConfirm')?.value;
  const errEl = document.getElementById('cpErr');
  errEl.style.display = 'none';
  if (newPassword !== confirm) { errEl.textContent = 'New passwords do not match.'; errEl.style.display = 'block'; return; }
  const btn = document.querySelector('#changePwModal button:last-child');
  btn.disabled = true; btn.textContent = 'Saving…';
  const res = await fetch('/api/profile/change-password', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, newPassword })
  });
  const d = await res.json();
  if (!res.ok) { errEl.textContent = d.error || 'Failed. Try again.'; errEl.style.display = 'block'; btn.disabled = false; btn.textContent = 'Update Password'; return; }
  document.getElementById('changePwModal').remove();
  showToast('Password updated successfully!');
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
          <div class="avatar-post" style="background:${post.avatar};overflow:hidden;">${post.avatarUrl ? `<img src="${post.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : escHtml(post.initials)}</div>
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
  if (post.author?.username) card.dataset.authorUsername = post.author.username;
  card.id = `post-${post.id}`;

  const totalReactions = Object.values(post.reactions || {}).reduce((a, b) => a + b, 0);
  const topReactions = getTopReactions(post.reactions);
  const canResolve = (currentUser?.role === 'admin' || currentUser?.role === 'hoa') && post.type === 'safety' && post.severity !== 'resolved';
  card.innerHTML = `
    <div class="post-card-inner">
      ${post.alertType ? `<div class="alert-badge ${post.severity === 'resolved' ? 'resolved' : (post.severity || 'medium')}">${post.severity === 'resolved' ? '✅ Resolved' : `⚠ ${post.alertType}`}</div>` : ''}
      ${post.price !== undefined ? `
        <span class="price-tag${post.free || post.price === 0 ? ' free' : ''}">
          ${post.free || post.price === 0 ? '🎁 FREE' : `$${post.price}`}
        </span>
        ${post.condition ? `<span class="condition-tag">${post.condition}</span>` : ''}
      ` : ''}

      <div class="post-header">
        <div class="post-author">
          <div class="avatar-post" id="pav-${post.id}" style="background:${post.author?.avatar || '#0077B6'};overflow:hidden;">
            ${post.author?.avatarUrl ? '' : (post.author?.initials || '??')}
          </div>
          <div class="post-author-info">
            <div class="post-author-name">
              ${post.businessId ? `<span style="cursor:pointer;color:var(--ocean);" onclick="openBusinessPage('${post.businessId}')">${escHtml(post.author?.name || 'Anonymous')}</span>` : escHtml(post.author?.name || 'Anonymous')}
              ${post.author?.role === 'admin' ? '<span style="display:inline-flex;align-items:center;justify-content:center;background:#0077B6;color:#fff;font-size:9px;font-weight:700;border-radius:4px;padding:1px 5px;margin-left:4px;letter-spacing:0.3px;">ADMIN</span>' : ''}
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

      ${post.image ? (post.image.match(/\.pdf($|\?)/i) ? `<a href="${post.image}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:8px 14px;background:rgba(0,119,182,0.07);border:1px solid rgba(0,119,182,0.18);border-radius:8px;font-size:13px;font-weight:600;color:var(--ocean);text-decoration:none;">📄 View PDF</a>` : `<div class="post-image-wrap"><img src="${post.image}" alt="Post image" style="width:100%;border-radius:10px;margin-top:12px;object-fit:cover;max-height:360px;display:block;cursor:zoom-in;" onclick="openLightbox('${post.image}')"></div>`) : ''}

      ${post.sharedPost ? buildSharedPostEmbed(post.sharedPost) : ''}

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
        ${(currentUser && (post.author?.id === currentUser.id || currentUser.role === 'admin')) ? `<button onclick="deletePost('${post.id}')" style="margin-left:auto;background:none;border:none;cursor:pointer;color:var(--text-light);font-size:12px;padding:4px 8px;border-radius:6px;" title="Delete post">🗑</button>` : ''}
      </div>
    </div>

    <div class="comments-area" id="comments-${post.id}">
      <div class="comments-inner" id="comments-inner-${post.id}">
        <div class="loading-spinner" style="width:24px;height:24px;margin:12px auto;"></div>
      </div>
    </div>
  `;

  if (post.author?.avatarUrl) {
    const av = card.querySelector(`#pav-${post.id}`);
    if (av) {
      av.style.backgroundImage = `url(${post.author.avatarUrl})`;
      av.style.backgroundSize = 'cover';
      av.style.backgroundPosition = 'center';
    }
  }

  return card;
}

function buildSharedPostEmbed(sp) {
  if (!sp) return '';
  const snippet = (sp.content || '').slice(0, 200);
  const dateLine = sp.eventDate ? new Date(sp.eventDate).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }) : '';
  return `
    <div onclick="event.stopPropagation();focusPost('${sp.id}')" style="margin-top:12px;border:1.5px solid #e5e7eb;border-radius:12px;overflow:hidden;cursor:pointer;background:#f8fafc;transition:background 0.15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='#f8fafc'">
      <div style="padding:11px 13px 8px;display:flex;align-items:center;gap:9px;">
        <div style="width:30px;height:30px;border-radius:50%;background:${sp.author?.avatar||'#0077B6'};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:white;flex-shrink:0;overflow:hidden;">${sp.author?.avatarUrl ? `<img src="${sp.author.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : escHtml(sp.author?.initials||'?')}</div>
        <div style="min-width:0;flex:1;">
          <div style="font-size:12.5px;font-weight:700;color:var(--text-dark);">${escHtml(sp.author?.name||'Someone')}</div>
          <div style="font-size:11px;color:var(--text-light);">Original post${dateLine?` · ${escHtml(dateLine)}`:''}</div>
        </div>
      </div>
      ${sp.eventTitle ? `<div style="padding:0 13px 6px;font-size:13.5px;font-weight:700;color:var(--text-dark);">📅 ${escHtml(sp.eventTitle)}</div>` : ''}
      ${snippet ? `<div style="padding:0 13px 10px;font-size:13px;color:var(--text-mid);line-height:1.5;">${escHtml(snippet)}${(sp.content||'').length>200?'…':''}</div>` : ''}
      ${sp.image ? `<img src="${sp.image}" style="width:100%;max-height:240px;object-fit:cover;display:block;" />` : ''}
      <div style="padding:8px 13px;border-top:1px solid #e5e7eb;font-size:11.5px;color:var(--ocean);font-weight:600;">View original post →</div>
    </div>
  `;
}

function goToEvent(eventId) {
  if (typeof navigate === 'function') navigate('events');
  let tries = 0;
  const tryFocus = () => {
    const el = document.querySelector(`[data-event-id="${eventId}"]`) || document.getElementById(`event-${eventId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'box-shadow 0.4s ease';
      el.style.boxShadow = '0 0 0 3px rgba(0,119,182,0.45)';
      setTimeout(() => { el.style.boxShadow = ''; }, 2400);
    } else if (++tries < 20) setTimeout(tryFocus, 200);
  };
  setTimeout(tryFocus, 250);
}

function focusPost(postId) {
  const url = new URL(window.location.href);
  url.searchParams.set('post', postId);
  window.history.pushState({}, '', url.toString());
  if (typeof navigate === 'function') navigate('feed');
  setTimeout(() => focusSharedPostFromUrl(), 200);
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

async function votePoll(postId, optId, el) {
  try {
    const res = await fetch(`/api/posts/${postId}/vote`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ optionId: optId })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      showToast(err.error || 'Could not record vote');
      return;
    }
    const data = await res.json();
    const card = el?.closest('.post-card');
    const pollWrap = card?.querySelector('.poll-container');
    if (pollWrap) {
      pollWrap.outerHTML = buildPollHTML({ id: postId, pollOptions: data.pollOptions, userVote: data.userVote });
    }
    showToast(data.userVote ? 'Vote recorded! 🗳️' : 'Vote removed');
  } catch (e) {
    showToast('Network error — please try again');
  }
}

function buildReactionPicker(postId) {
  const reactions = [
    { key: 'like',       emoji: '👍', label: 'Like'       },
    { key: 'insightful', emoji: '💡', label: 'Insightful' },
    { key: 'haha',       emoji: '😂', label: 'Haha'       },
    { key: 'wow',        emoji: '😮', label: 'Wow'        },
    { key: 'sad',        emoji: '😢', label: 'Sad'        },
    { key: 'agree',      emoji: '👏', label: 'Agree'      }
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
        inner.appendChild(buildCommentEl(c, postId));
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
      inner.insertBefore(buildCommentEl(comment, postId), inner.lastChild);
      lucide.createIcons();
    }
    refreshPoints();
    showToast('Comment posted! 💬');
  } catch {
    showToast('Could not post comment. Please try again.');
  }
}

function buildCommentEl(c, postId) {
  const div = document.createElement('div');
  div.className = 'comment-item';
  div.id = `comment-${c.id}`;
  const canDelete = currentUser && (c.author?.id === currentUser.id || currentUser.role === 'admin');
  const postCard = document.querySelector(`[data-post-id="${postId}"]`);
  const postAuthorUsername = postCard?.dataset?.authorUsername;
  const isPostAuthor = postAuthorUsername && c.author?.username === postAuthorUsername;
  const isMine = currentUser && c.author?.id === currentUser.id;
  const username = (c.author?.username || '').replace(/'/g, "\\'");
  div.innerHTML = `
    <div class="avatar-comment" style="background:${c.author?.avatar || '#0077B6'};">
      ${c.author?.avatarUrl ? `<img src="${c.author.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (c.author?.initials || '??')}
    </div>
    <div class="comment-body">
      <div class="comment-bubble${isPostAuthor ? ' is-author' : ''}">
        <div class="comment-author-row">
          <span class="comment-author">${escHtml(c.author?.name || 'Anonymous')}</span>
          ${isPostAuthor ? '<span class="comment-author-badge">Author</span>' : ''}
          ${isMine && !isPostAuthor ? '<span class="comment-author-badge" style="background:#64748b;">You</span>' : ''}
        </div>
        <div class="comment-text">${escHtml(c.content)}</div>
      </div>
      <div class="comment-meta-row">
        <span class="comment-meta-time">${relativeTime(c.createdAt)}</span>
        ${currentUser ? `<button class="comment-meta-action" onclick="replyToComment('${postId}','${username}')">Reply</button>` : ''}
        ${canDelete ? `<button class="comment-meta-action danger" onclick="deleteComment('${postId}','${c.id}')">Delete</button>` : ''}
      </div>
    </div>
  `;
  return div;
}

function replyToComment(postId, username) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input) return;
  const prefix = `@${username} `;
  if (!input.value.startsWith(prefix)) input.value = prefix + input.value.trim();
  input.focus();
  input.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function deletePost(postId) {
  if (!confirm('Delete this post?')) return;
  const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok) {
    document.getElementById(`post-${postId}`)?.remove();
    showToast('Post deleted.');
  } else showToast('Could not delete post.');
}

async function deleteComment(postId, commentId) {
  if (!confirm('Delete this comment?')) return;
  const res = await fetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok) { document.getElementById(`comment-${commentId}`)?.remove(); showToast('Comment deleted.'); }
  else showToast('Could not delete comment.');
}

// ─── Marketplace Card ────────────────────────────────────────────
const categoryIcons = {
  'Appliances': '🏠', 'Art & Collectibles': '🎨', 'Baby & Kids': '👶',
  'Books & Media': '📚', 'Clothing': '👕', 'Electronics': '🔊',
  'Free': '🎁', 'Furniture': '🪑', 'Home & Garden': '🪴',
  'Toys': '🧸', 'Tools & Equipment': '🔧', 'Vehicle': '🚗', 'Golf Cart': '⛳',
  'Other': '📦', 'default': '📦'
};

function buildMarketCard(item) {
  const card = document.createElement('div');
  card.className = 'market-card';
  if (item.sold) card.style.opacity = '0.65';
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
  const priceDisplay = item.sold ? 'SOLD' : (item.free || item.price === 0 ? 'FREE' : `$${item.price}`);
  const priceClass = item.sold ? 'sold-badge' : (item.free || item.price === 0 ? 'free-badge' : 'paid-badge');

  const imgContent = item.image
    ? `<img src="${item.image}" alt="${escHtml(item.title)}" style="width:100%;height:100%;object-fit:cover;display:block;cursor:zoom-in;" onclick="openLightbox('${item.image}')">`
    : `<span style="font-size:52px">${icon}</span>`;

  const isMine = currentUser && (currentUser.id === item.seller?.id || currentUser.role === 'admin');
  const sellerData = encodeURIComponent(JSON.stringify({ id: item.seller?.id, username: item.seller?.username, name: item.seller?.name, avatar: item.seller?.avatar, initials: item.seller?.initials }));

  const ownerButtons = isMine ? `
    <div style="display:flex;gap:6px;margin-top:8px;">
      ${!item.sold ? `<button onclick="event.stopPropagation();markMarketSold('${item.id}')" style="flex:1;padding:7px 4px;background:#52B788;color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">✓ Mark Sold</button>` : ''}
      <button onclick="event.stopPropagation();openEditMarketItem('${item.id}')" style="flex:1;padding:7px 4px;background:#e0f2fe;color:#0369a1;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">✏️ Edit</button>
      <button onclick="event.stopPropagation();deleteMarketItem('${item.id}')" style="flex:1;padding:7px 4px;background:var(--coral);color:white;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Delete</button>
    </div>` : '';

  card.innerHTML = `
    <div class="market-img" style="${item.image ? '' : `background:${bg}`}">
      ${imgContent}
      <div class="market-price-badge ${priceClass}">${priceDisplay}</div>
    </div>
    <div class="market-info">
      <div class="market-title">${escHtml(item.title)}</div>
      <div class="market-seller">
        <div class="avatar-sm" style="background:${item.seller?.avatar || '#0077B6'};width:20px;height:20px;font-size:8px;overflow:hidden;">${item.seller?.avatarUrl ? `<img src="${item.seller.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (item.seller?.initials || '??')}</div>
        ${escHtml(item.seller?.name?.split(' ')[0] || 'Neighbor')}
        <span class="post-meta-dot" style="margin:0 2px"></span>
        ${relativeTime(item.createdAt)}
      </div>
      <div class="market-condition">${escHtml(item.condition || '')}</div>
      ${(()=>{
        const desc = item.description || '';
        const short = desc.length > 120;
        const id = 'md-' + item.id;
        return short
          ? `<div style="font-size:12px;color:var(--text-mid);margin-bottom:6px;line-height:1.4;">
               <span id="${id}-text">${escHtml(desc.slice(0,120))}…</span>
               <button id="${id}-btn" onclick="event.stopPropagation();(function(){const t=document.getElementById('${id}-text'),b=document.getElementById('${id}-btn'),open=b.dataset.open==='1';t.textContent=open?'${escHtml(desc.slice(0,120)).replace(/'/g,"\\'")}…':'${escHtml(desc).replace(/'/g,"\\'")}';b.textContent=open?'Read more':'Show less';b.dataset.open=open?'':'1';})()" style="background:none;border:none;color:var(--ocean);font-size:11px;font-weight:600;cursor:pointer;padding:0;font-family:inherit;">Read more</button>
             </div>`
          : `<div style="font-size:12px;color:var(--text-mid);margin-bottom:6px;line-height:1.4;">${escHtml(desc)}</div>`;
      })()}
      ${!item.sold ? `<button class="btn-contact" onclick="event.stopPropagation();contactSeller(decodeURIComponent('${sellerData}'))">Message Seller</button>` : '<div style="font-size:12px;color:var(--text-mid);font-weight:700;text-align:center;">This item has been sold</div>'}
      ${ownerButtons}
    </div>
  `;
  return card;
}

function contactSeller(encodedData) {
  let seller;
  try { seller = typeof encodedData === 'string' ? JSON.parse(encodedData) : encodedData; } catch(e) { seller = {}; }
  const existing = document.getElementById('contactSellerModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'contactSellerModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:360px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="margin:0;font-size:17px;font-weight:800;">Seller Info</h3>
        <button onclick="document.getElementById('contactSellerModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
      </div>
      <div style="display:flex;align-items:center;gap:12px;padding:14px;background:var(--bg);border-radius:12px;margin-bottom:14px;">
        <div class="avatar-sm" style="background:${seller.avatar || '#0077B6'};width:44px;height:44px;font-size:16px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;flex-shrink:0;overflow:hidden;">${seller.avatarUrl ? `<img src="${seller.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (seller.initials || '??')}</div>
        <div>
          <div style="font-weight:800;font-size:15px;">${escHtml(seller.name || 'Neighbor')}</div>
          ${seller.username ? `<div style="font-size:12px;color:var(--text-mid);">@${escHtml(seller.username)}</div>` : ''}
        </div>
      </div>
      ${seller.phone ? `<a href="tel:${seller.phone}" style="display:flex;align-items:center;gap:8px;padding:11px 14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;margin-bottom:10px;text-decoration:none;color:#166534;font-weight:700;font-size:14px;">📞 Call ${seller.phone}</a>` : ''}
      ${seller.username ? `<button onclick="document.getElementById('contactSellerModal').remove();startConversation('${seller.username}')" style="width:100%;padding:11px;background:var(--ocean);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px;">💬 Message ${escHtml(seller.name?.split(' ')[0] || 'Seller')}</button>` : ''}
      <button onclick="document.getElementById('contactSellerModal').remove()" style="width:100%;padding:11px;background:var(--bg);color:var(--text-mid);border:1px solid var(--border);border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;">Close</button>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function deleteMarketItem(id) {
  if (!confirm('Delete this listing? This cannot be undone.')) return;
  const res = await fetch(`/api/marketplace/${id}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok) {
    _marketFilter = 'All';
    await renderMarketplace(document.getElementById('sectionContent'));
    showToast('Listing deleted.');
  } else {
    showToast('Could not delete listing.');
  }
}

async function openEditMarketItem(id) {
  const items = await fetchJSON('/api/marketplace');
  const item = (items||[]).find(i => i.id === id);
  if (!item) return showToast('Could not load listing.');

  const existing = document.getElementById('editMarketModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'editMarketModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;padding:24px;width:100%;max-width:460px;max-height:90vh;overflow-y:auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <h3 style="margin:0;font-size:17px;font-weight:800;">✏️ Edit Listing</h3>
        <button onclick="document.getElementById('editMarketModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;color:#94a3b8;">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="font-size:12px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">TITLE</label>
          <input id="emTitle" value="${escHtml(item.title)}" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">PRICE ($)</label>
          <input id="emPrice" type="number" min="0" value="${item.price||0}" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;">
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">CONDITION</label>
          <select id="emCondition" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;">
            ${['New','Like New','Good','Fair','Parts Only'].map(c=>`<option value="${c}" ${item.condition===c?'selected':''}>${c}</option>`).join('')}
          </select>
        </div>
        <div>
          <label style="font-size:12px;font-weight:700;color:#64748b;display:block;margin-bottom:4px;">DESCRIPTION</label>
          <textarea id="emDesc" rows="5" style="width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;resize:vertical;box-sizing:border-box;">${escHtml(item.description||'')}</textarea>
        </div>
        <div id="emErr" style="color:#dc2626;font-size:13px;display:none;"></div>
        <button onclick="saveEditMarketItem('${id}')" style="width:100%;padding:12px;background:var(--ocean);color:white;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Save Changes</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

async function saveEditMarketItem(id) {
  const title = document.getElementById('emTitle')?.value.trim();
  const price = document.getElementById('emPrice')?.value;
  const condition = document.getElementById('emCondition')?.value;
  const description = document.getElementById('emDesc')?.value.trim();
  const errEl = document.getElementById('emErr');
  if (!title) { errEl.textContent = 'Title is required.'; errEl.style.display = 'block'; return; }
  const res = await fetch(`/api/marketplace/${id}`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, price, condition, description })
  });
  if (res.ok) {
    document.getElementById('editMarketModal')?.remove();
    await renderMarketplace(document.getElementById('sectionContent'));
    showToast('Listing updated!');
  } else {
    errEl.textContent = 'Could not save changes.'; errEl.style.display = 'block';
  }
}

async function markMarketSold(id) {
  const res = await fetch(`/api/marketplace/${id}/sold`, { method: 'PATCH', credentials: 'include' });
  if (res.ok) {
    await renderMarketplace(document.getElementById('sectionContent'));
    showToast('Marked as sold!');
  } else {
    showToast('Could not update listing.');
  }
}

async function cancelEvent(id) {
  if (!confirm('Mark this event as CANCELLED?')) return;
  const res = await fetch(`/api/events/${id}/cancel`, { method: 'PATCH', credentials: 'include' });
  if (res.ok) { showToast('Event marked as cancelled.'); navigate('events'); loadSidebarWidgets(); }
  else showToast('Could not cancel event.');
}

async function deleteEvent(id) {
  if (!confirm('Permanently delete this event?')) return;
  const res = await fetch(`/api/events/${id}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok) { showToast('Event deleted.'); navigate('events'); loadSidebarWidgets(); }
  else { const d = await res.json().catch(() => ({})); showToast('Error: ' + (d.error || res.status)); }
}

// ─── Event Card ──────────────────────────────────────────────────
function buildEventCard(ev) {
  const card = document.createElement('div');
  card.className = 'event-card' + (ev.cancelled ? ' event-cancelled' : '');
  const dateObj = new Date((ev.date || '').substring(0, 10) + 'T12:00:00');
  const month = dateObj.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const day = dateObj.getDate();
  const totalGoing = ev.rsvp?.going || 0;
  const isOwner = currentUser && ev.host?.id === currentUser.id;
  const isAdmin = currentUser?.role === 'admin';

  card.innerHTML = `
    <div class="event-date-badge${ev.cancelled ? ' cancelled' : ''}">
      <div class="event-date-inner">
        <div class="event-month">${month}</div>
        <div class="event-day">${day}</div>
      </div>
    </div>
    <div class="event-body">
      ${ev.cancelled ? `<div style="display:inline-block;background:#dc3545;color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:4px;letter-spacing:0.5px;margin-bottom:8px;">CANCELLED</div>` : ''}
      ${ev.image ? `<img src="${ev.image}" alt="Event photo" style="width:100%;border-radius:8px;object-fit:cover;max-height:180px;display:block;margin-bottom:10px;cursor:zoom-in;" onclick="openLightbox('${ev.image}')">` : ''}
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div class="event-category-tag">${ev.category || 'Community'}</div>
        ${(isOwner || isAdmin) ? `
          <div style="position:relative;display:inline-block;">
            <button onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='block'?'none':'block'" style="background:none;border:none;cursor:pointer;padding:2px 6px;font-size:18px;color:var(--text-light);line-height:1;">⋯</button>
            <div style="display:none;position:absolute;right:0;top:100%;background:#fff;border:1px solid #E5EBF2;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,.12);z-index:100;min-width:150px;">
              ${!ev.cancelled ? `<button onclick="cancelEvent('${ev.id}')" style="display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;cursor:pointer;font-size:14px;color:#856404;">⚠ Cancel Event</button>` : ''}
              <button onclick="deleteEvent('${ev.id}')" style="display:block;width:100%;text-align:left;padding:10px 14px;background:none;border:none;cursor:pointer;font-size:14px;color:#dc3545;">🗑 Delete Event</button>
            </div>
          </div>` : ''}
      </div>
      <div class="event-title">${escHtml(ev.title)}</div>
      <div class="event-desc">${escHtml(ev.description)}</div>
      <div class="event-meta-row">
        <div class="event-meta-item">
          <i data-lucide="clock" style="width:12px;height:12px"></i>
          ${ev.time && ev.time !== 'null' ? ev.time : 'TBD'}${ev.endTime && ev.endTime !== 'null' ? ` – ${ev.endTime}` : ''}
        </div>
        <div class="event-meta-item">
          <i data-lucide="map-pin" style="width:12px;height:12px"></i>
          ${escHtml(ev.location)}
        </div>
        <div class="event-meta-item">
          <i data-lucide="user" style="width:12px;height:12px"></i>
          ${ev.businessId ? `<span style="color:var(--ocean);cursor:pointer;font-weight:600;" onclick="openBusinessPage('${ev.businessId}')">${escHtml(ev.host?.name || 'Organizer')}</span>` : escHtml(ev.host?.name || 'Organizer')}
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
      const btns = row.querySelectorAll('.rsvp-btn');
      btns[0].className = `rsvp-btn${data.userRsvp === 'going' ? ' going' : ''}`;
      btns[1].className = `rsvp-btn${data.userRsvp === 'maybe' ? ' maybe' : ''}`;
      btns[2].className = `rsvp-btn${data.userRsvp === 'cantGo' ? ' cantgo' : ''}`;
      const countEl = row.querySelector('.going-count');
      if (countEl) countEl.textContent = `${data.rsvp?.going || 0} going`;
    }

    const msgs = { going: '🎉 You\'re going!', maybe: '🤔 Marked as maybe!', cantGo: 'Marked as can\'t go.' };
    showToast(msgs[status] || 'RSVP updated!');
    loadSidebarWidgets();
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
            <div style="width:34px;height:34px;border-radius:50%;background:${r.avatar};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0;overflow:hidden;">${r.avatarUrl ? `<img src="${r.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : escHtml(r.initials)}</div>
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

  const card = document.createElement('div');
  card.className = 'biz-listing-card';
  card.onclick = () => openBusinessPage(biz.id);
  const logoContent = biz.logoUrl
    ? `<img src="${biz.logoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:12px;">`
    : icon;
  card.innerHTML = `
    <div class="biz-listing-logo" style="background:${biz.logoUrl ? 'transparent' : bg};color:${fg};">${logoContent}</div>
    <div class="biz-listing-body">
      <div class="biz-listing-name">
        ${escHtml(biz.name)}
        ${biz.claimed ? '<span class="biz-verified-badge">✓</span>' : '<span style="font-size:11px;font-weight:700;color:#92400E;background:#FEF3C7;border:1px solid #F59E0B;padding:2px 7px;border-radius:20px;">📋 Unclaimed</span>'}
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
        <span style="font-size:12px;color:var(--text-light);">${biz.reviewCount > 0 ? `${biz.reviewCount} review${biz.reviewCount !== 1 ? 's' : ''}` : 'No reviews yet'}</span>
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
  const [biz, bizPosts] = await Promise.all([
    fetchJSON(`/api/businesses/${bizId}`),
    fetchJSON(`/api/businesses/${bizId}/posts`).catch(() => [])
  ]);
  if (!biz) { container.innerHTML = '<p style="padding:30px;color:var(--coral);">Could not load business.</p>'; return; }

  const icon = bizIcons[biz.category] || bizIcons.default;
  const bgColors = { 'Restaurant': '#FFF3E0', 'Bar & Grill': '#FCE4EC', 'Transportation': '#E8F5E9', 'default': '#E3F2FD' };
  const bg = bgColors[biz.category] || bgColors.default;
  const photos = biz.photos || [];
  const reviews = biz.reviews || [];
  const isPageOwner = currentUser && (currentUser.id === biz.claimedByUserId || currentUser.id === biz.addedByUserId || currentUser.role === 'admin');

  const wrap = document.createElement('div');
  wrap.className = 'biz-page';
  wrap.innerHTML = `
    <button class="group-back-btn" onclick="navigate('businesses')">← Back to Businesses</button>

    <!-- Header card -->
    <div class="biz-page-header-card" style="flex-direction:column;padding:0;overflow:visible;gap:0;">
      <!-- Full-width banner -->
      <div class="biz-banner-area" style="position:relative;height:280px;overflow:hidden;flex-shrink:0;background:linear-gradient(135deg,#0077B6,#00B4D8);border-radius:12px 12px 0 0;">
        ${biz.bannerUrl ? `<img src="${biz.bannerUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" />` : ''}
        <div style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(0,0,0,0) 40%, rgba(0,0,0,0.45) 100%);pointer-events:none;border-radius:12px 12px 0 0;"></div>
        ${isPageOwner ? `<label title="Change banner" style="position:absolute;bottom:14px;right:14px;background:rgba(0,0,0,0.55);color:white;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;z-index:1;"><input type="file" accept="image/*" style="display:none" onchange="uploadBizBanner('${biz.id}',this)">📷 Edit Cover</label>` : ''}
      </div>
      <!-- Logo overlapping banner (Facebook-style) -->
      <div style="display:flex;align-items:flex-end;justify-content:space-between;padding:0 24px 0;margin-top:-52px;position:relative;z-index:1;">
        <div style="position:relative;flex-shrink:0;">
          <div class="biz-logo-circle" style="background:${biz.logoUrl ? 'white' : bg};font-size:44px;width:108px;height:108px;border:4px solid white;box-shadow:0 2px 10px rgba(0,0,0,0.2);overflow:hidden;">
            ${biz.logoUrl ? `<img src="${biz.logoUrl}" style="width:100%;height:100%;object-fit:cover;">` : icon}
          </div>
          ${isPageOwner ? `<label title="Change logo" style="position:absolute;bottom:4px;right:4px;width:30px;height:30px;background:var(--ocean);border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;"><input type="file" accept="image/*" style="display:none" onchange="uploadBizLogo('${biz.id}',this)">📷</label>` : `<div style="position:absolute;bottom:2px;right:2px;width:26px;height:26px;background:${biz.claimed ? 'var(--ocean)' : '#F59E0B'};border-radius:50%;border:2px solid white;display:flex;align-items:center;justify-content:center;font-size:11px;color:white;font-weight:700;">${biz.claimed ? '✓' : '!'}</div>`}
        </div>
        <div style="padding-bottom:8px;"></div>
      </div>
      <!-- Name + category -->
      <div style="padding:12px 24px 4px;">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:2px;">
          <span style="font-size:22px;font-weight:800;color:var(--text-dark);">${escHtml(biz.name)}</span>
          ${!biz.claimed ? '<span style="font-size:11px;font-weight:700;color:#92400E;background:#FEF3C7;border:1px solid #F59E0B;padding:2px 8px;border-radius:20px;">📋 Unclaimed</span>' : ''}
          <span style="font-size:14px;font-weight:600;color:var(--text-light);">${biz.recommendedBy}</span>
        </div>
        <div style="font-size:14px;color:var(--ocean);font-weight:500;margin-bottom:${biz.description ? '10px' : '12px'};">${escHtml(biz.category)}</div>
        ${biz.description ? `<div style="font-size:14px;color:var(--text-mid);line-height:1.65;margin-bottom:12px;">${escHtml(biz.description)}</div>` : ''}
      </div>
      <!-- Action bar -->
      <div style="padding:0 24px 12px;">
        <div class="biz-action-bar">
          <button class="btn-biz-message" onclick="switchBizTab('reviews');document.getElementById('bizReviewBox')?.focus();">✍️ Write a Review</button>
          ${biz.contactEmail ? `<a href="mailto:${escHtml(biz.contactEmail)}" class="btn-biz-message" style="text-decoration:none;">✉️ Email Us</a>` : ''}

          <div style="position:relative;">
            <button class="btn-biz-more" onclick="toggleBizMoreMenu('${biz.id}')">⋯</button>
            <div class="biz-more-dropdown" id="bizMoreMenu-${biz.id}" style="display:none;">
              ${isPageOwner ? `<div class="biz-more-item" onclick="setBizContactEmail('${biz.id}','${escHtml(biz.contactEmail||'')}');toggleBizMoreMenu('${biz.id}')"><span class="biz-more-item-icon">✉️</span><div><div class="biz-more-item-text">Set Contact Email</div><div class="biz-more-item-sub">${biz.contactEmail ? escHtml(biz.contactEmail) : 'Add an email for the Email Us button'}</div></div></div>` : ''}
              ${isPageOwner && MEDICAL_BIZ_CATEGORIES.includes(biz.category) ? `<div class="biz-more-item" onclick="editBizServices('${biz.id}');toggleBizMoreMenu('${biz.id}')"><span class="biz-more-item-icon">🏥</span><div><div class="biz-more-item-text">Edit Services & Hours</div><div class="biz-more-item-sub">Update services offered and opening hours</div></div></div>` : ''}
              <div class="biz-more-item" onclick="showToast('${escHtml(biz.name)} muted.');toggleBizMoreMenu('${biz.id}')"><span class="biz-more-item-icon">🔇</span><div><div class="biz-more-item-text">Mute</div><div class="biz-more-item-sub">Hide all posts from ${escHtml(biz.name)}</div></div></div>
              <div class="biz-more-item" onclick="openReportModal('business','${biz.id}','${escHtml(biz.name).replace(/'/g,"\\'")}');toggleBizMoreMenu('${biz.id}')"><span class="biz-more-item-icon">⚑</span><div><div class="biz-more-item-text">Report</div><div class="biz-more-item-sub">Flag for review</div></div></div>
            </div>
          </div>
        </div>
      </div>
      <!-- Claim banner (only if unclaimed) -->
      ${!biz.claimed ? `<div style="border-top:1px solid var(--border);padding:12px 24px;display:flex;align-items:center;justify-content:space-between;background:#FFFBEA;">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#92400E;font-weight:600;">📋 This business hasn't been claimed yet</div>
        <button onclick="openClaimModal('${biz.id}','${escHtml(biz.name).replace(/'/g,"\\'")}');" style="font-size:13px;font-weight:700;color:var(--ocean);background:none;border:none;cursor:pointer;font-family:inherit;">Claim this business →</button>
      </div>` : ''}
    </div>

    <!-- Two-column layout -->
    <div class="biz-page-layout">
      <!-- Main content -->
      <div class="biz-page-main">
        <div class="biz-tab-bar">
          <button class="biz-tab active" onclick="switchBizTab('overview')">Overview</button>
          <button class="biz-tab" onclick="switchBizTab('reviews')">Reviews</button>
          ${biz.menuUrl || biz.menuText ? `<button class="biz-tab" onclick="switchBizTab('menu')">Pricing</button>` : ''}
          <button class="biz-tab" onclick="switchBizTab('posts')">Posts</button>
          <button class="biz-tab" onclick="switchBizTab('promotions')">Promotions</button>
        </div>

        <!-- Overview tab -->
        <div id="bizTab-overview">

          <!-- Details -->
          <div style="background:white;border:1px solid var(--border);border-radius:14px;padding:20px 22px;margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:var(--text-light);letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px;">Business Details</div>
            ${biz.hours ? `<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border);"><span style="font-size:18px;flex-shrink:0;">🕐</span><div><div style="font-size:11px;color:var(--text-light);font-weight:600;margin-bottom:2px;">Hours</div><div style="font-size:14px;color:var(--text-dark);font-weight:500;">${escHtml(biz.hours)}</div></div></div>` : ''}
            ${biz.phone ? `<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border);"><span style="font-size:18px;flex-shrink:0;">📞</span><div><div style="font-size:11px;color:var(--text-light);font-weight:600;margin-bottom:2px;">Phone</div><div style="font-size:14px;color:var(--text-dark);font-weight:500;">${escHtml(biz.phone)}</div></div></div>` : ''}
            ${biz.address ? `<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border);"><span style="font-size:18px;flex-shrink:0;">📍</span><div><div style="font-size:11px;color:var(--text-light);font-weight:600;margin-bottom:2px;">Location</div><div style="font-size:14px;color:var(--text-dark);font-weight:500;">${escHtml(biz.address)}</div></div></div>` : ''}
            ${biz.website && biz.website !== '#' ? `<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border);"><span style="font-size:18px;flex-shrink:0;">🌐</span><div><div style="font-size:11px;color:var(--text-light);font-weight:600;margin-bottom:2px;">Website</div><a href="${escHtml(biz.website)}" target="_blank" rel="noopener" style="font-size:14px;color:var(--ocean);font-weight:500;text-decoration:none;">${escHtml(biz.website)}</a></div></div>` : ''}
            ${biz.instagramUrl ? `<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border);"><span style="font-size:18px;flex-shrink:0;">📸</span><div><div style="font-size:11px;color:var(--text-light);font-weight:600;margin-bottom:2px;">Instagram</div><a href="${escHtml(biz.instagramUrl)}" target="_blank" rel="noopener" style="font-size:14px;color:#E1306C;font-weight:500;text-decoration:none;">${escHtml(biz.instagramUrl).replace('https://','')}</a></div></div>` : ''}
            ${biz.facebookUrl ? `<div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;"><span style="font-size:18px;flex-shrink:0;">👤</span><div><div style="font-size:11px;color:var(--text-light);font-weight:600;margin-bottom:2px;">Facebook</div><a href="${escHtml(biz.facebookUrl)}" target="_blank" rel="noopener" style="font-size:14px;color:#1877F2;font-weight:500;text-decoration:none;">${escHtml(biz.facebookUrl).replace('https://','')}</a></div></div>` : ''}
          </div>

          <!-- Services (Health & Medical) -->
          ${(biz.services||[]).length ? `
          <div style="background:white;border:1px solid var(--border);border-radius:14px;padding:20px 22px;margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:var(--text-light);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;">Services Offered</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${(biz.services||[]).map(s=>`<span style="background:#f0fdf4;color:#059669;font-size:13px;font-weight:600;padding:5px 14px;border-radius:20px;border:1px solid #bbf7d0;">✓ ${escHtml(s)}</span>`).join('')}
            </div>
            ${biz.lastVerifiedAt ? `<div style="font-size:12px;color:var(--text-light);margin-top:10px;">Last verified ${timeAgo(new Date(biz.lastVerifiedAt).getTime())}</div>` : '<div style="font-size:12px;color:#d97706;margin-top:10px;">⚠️ Not yet community-verified — <button onclick="verifyBizInfo('+biz.id+')" style="background:none;border:none;color:#059669;font-weight:700;font-size:12px;cursor:pointer;padding:0;font-family:inherit;">Mark as accurate</button></div>'}
          </div>` : ''}

          <!-- Tags / Specialties -->
          ${(biz.tags||[]).length ? `
          <div style="background:white;border:1px solid var(--border);border-radius:14px;padding:20px 22px;margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:var(--text-light);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;">Specialties</div>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">
              ${(biz.tags||[]).map(t=>`<span style="background:#EFF6FF;color:#1D4ED8;font-size:13px;font-weight:600;padding:5px 14px;border-radius:20px;border:1px solid #BFDBFE;">${escHtml(t)}</span>`).join('')}
            </div>
          </div>` : ''}

          <!-- Rating summary -->
          <div style="background:white;border:1px solid var(--border);border-radius:14px;padding:20px 22px;margin-bottom:14px;">
            <div style="font-size:11px;font-weight:700;color:var(--text-light);letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px;">Ratings & Reviews</div>
            <div style="display:flex;align-items:center;gap:24px;margin-bottom:16px;">
              <div style="text-align:center;flex-shrink:0;">
                <div style="font-size:48px;font-weight:800;color:var(--text-dark);line-height:1;">${biz.rating}</div>
                <div style="margin:6px 0 4px;">${buildStars(biz.rating)}</div>
                <div style="font-size:12px;color:var(--text-light);">${biz.reviewCount} review${biz.reviewCount !== 1 ? 's' : ''}</div>
              </div>
              <div style="flex:1;">
                ${[5,4,3,2,1].map(n => {
                  const cnt = reviews.filter(r => Math.round(r.rating) === n).length;
                  const pct = reviews.length ? Math.round((cnt/reviews.length)*100) : 0;
                  return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;">
                    <span style="font-size:12px;color:var(--text-light);width:8px;text-align:right;">${n}</span>
                    <span style="font-size:11px;color:#F59E0B;">★</span>
                    <div style="flex:1;height:7px;background:#F3F4F6;border-radius:20px;overflow:hidden;">
                      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#F59E0B,#FBBF24);border-radius:20px;transition:width .4s;"></div>
                    </div>
                    <span style="font-size:12px;color:var(--text-light);width:20px;text-align:right;">${cnt}</span>
                  </div>`;
                }).join('')}
              </div>
            </div>
            ${reviews.length > 0 ? `
            <div style="border-top:1px solid var(--border);padding-top:16px;">
              <div style="font-size:13px;font-weight:700;color:var(--text-dark);margin-bottom:12px;">Recent Reviews</div>
              ${reviews.slice(0,2).map(r => `
              <div style="padding:14px 0;border-bottom:1px solid var(--border);">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                  <div style="width:38px;height:38px;border-radius:50%;background:${r.avatar};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;overflow:hidden;">${r.avatarUrl ? `<img src="${r.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : escHtml(r.initials)}</div>
                  <div>
                    <div style="font-size:14px;font-weight:700;color:var(--text-dark);">${escHtml(r.author)}</div>
                    <div style="display:flex;align-items:center;gap:6px;">${buildStars(r.rating)}<span style="font-size:11px;color:var(--text-light);">${r.date}</span></div>
                  </div>
                </div>
                <div style="font-size:14px;color:var(--text-mid);line-height:1.65;">${escHtml(r.text)}</div>
                ${r.photo ? `<img src="${r.photo}" style="margin-top:10px;max-height:160px;width:100%;object-fit:cover;border-radius:10px;cursor:pointer;" onclick="window.open('${r.photo}','_blank')">` : ''}
              </div>`).join('')}
              ${reviews.length > 2 ? `<button onclick="switchBizTab('reviews')" style="margin-top:12px;width:100%;padding:10px;background:none;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-weight:600;color:var(--ocean);cursor:pointer;font-family:inherit;">See all ${reviews.length} reviews →</button>` : ''}
            </div>` : `<div style="border-top:1px solid var(--border);padding-top:20px;text-align:center;color:var(--text-light);font-size:14px;">No reviews yet — be the first!</div>`}
          </div>

          <!-- Photos preview (link to tab) -->
          ${photos.length ? `
          <div style="background:white;border:1px solid var(--border);border-radius:14px;padding:20px 22px;margin-bottom:14px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <div style="font-size:11px;font-weight:700;color:var(--text-light);letter-spacing:.08em;text-transform:uppercase;">Photos</div>
              <button onclick="switchBizTab('photos')" style="font-size:12px;font-weight:600;color:var(--ocean);background:none;border:none;cursor:pointer;font-family:inherit;">See all →</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">
              ${photos.slice(0,3).map(url=>`<img src="${url}" loading="lazy" onclick="switchBizTab('photos')" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:8px;cursor:pointer;">`).join('')}
            </div>
          </div>` : ''}

        </div>

        <!-- Reviews tab (hidden) -->
        <div id="bizTab-reviews" style="display:none;">
          <!-- Write a review compose -->
          <div class="biz-rec-compose" style="margin-bottom:16px;">
            <div style="font-size:14px;font-weight:700;color:var(--text-dark);margin-bottom:12px;">Write a Review</div>
            <div style="display:flex;gap:6px;margin-bottom:12px;" id="bizStarPicker-${biz.id}">
              ${[1,2,3,4,5].map(n => `<span data-star="${n}" onclick="setBizStar('${biz.id}',${n})" style="font-size:28px;cursor:pointer;color:#D1D5DB;transition:color 0.15s;">★</span>`).join('')}
            </div>
            <textarea id="bizReviewBox" placeholder="Share your experience..." rows="3" style="width:100%;box-sizing:border-box;padding:11px 14px;border:1.5px solid var(--border);border-radius:12px;font-size:14px;font-family:inherit;outline:none;background:var(--bg);resize:none;margin-bottom:10px;"></textarea>
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
              <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--ocean);font-weight:600;cursor:pointer;">
                📷 Add Photo
                <input type="file" accept="image/*" id="bizReviewPhoto" style="display:none;" onchange="previewReviewPhoto(this)">
              </label>
              <span id="bizReviewPhotoName" style="font-size:12px;color:var(--text-light);"></span>
            </div>
            <img id="bizReviewPhotoPreview" style="display:none;max-height:140px;border-radius:10px;margin-bottom:10px;object-fit:cover;" />
            <button onclick="submitBizReview('${biz.id}')" style="padding:10px 24px;background:var(--ocean);color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Post Review</button>
          </div>
          <div style="font-size:13px;font-weight:700;color:var(--text-dark);margin-bottom:12px;">${reviews.length} Review${reviews.length !== 1 ? 's' : ''}</div>
          ${reviews.length === 0 ? '<div style="background:white;border:1px solid var(--border);border-radius:var(--radius);padding:30px;text-align:center;color:var(--text-light);font-size:14px;">No reviews yet — be the first!</div>' :
            reviews.map(r => `
              <div class="biz-rec-card">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                  <div style="width:40px;height:40px;border-radius:50%;background:${r.avatar};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;overflow:hidden;">${r.avatarUrl ? `<img src="${r.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : escHtml(r.initials)}</div>
                  <div>
                    <div style="font-size:14px;font-weight:700;color:var(--text-dark);">${escHtml(r.author)}</div>
                    <div style="display:flex;align-items:center;gap:6px;">${buildStars(r.rating)}<span style="font-size:11.5px;color:var(--text-light);">${r.date}</span></div>
                  </div>
                </div>
                <div style="font-size:14px;color:var(--text-mid);line-height:1.65;">${escHtml(r.text)}</div>
                ${r.photo ? `<img src="${r.photo}" style="margin-top:10px;max-height:200px;width:100%;object-fit:cover;border-radius:10px;cursor:pointer;" onclick="window.open('${r.photo}','_blank')">` : ''}
                ${r.ownerReply ? `<div style="margin-top:10px;padding:10px 12px;background:var(--bg);border-radius:10px;font-size:13px;color:var(--text-mid);border-left:3px solid var(--ocean);"><span style="font-weight:700;color:var(--text-dark);">Owner replied:</span> ${escHtml(r.ownerReply)}</div>` : ''}
              </div>`).join('')}
        </div>

        <!-- Photos tab (hidden) -->
        <div id="bizTab-photos" style="display:none;">
          ${(() => {
            const reviewPhotos = reviews.filter(r => r.photo).map(r => ({ url: r.photo, caption: r.author }));
            const allPhotos = [...photos.map(url => ({ url, caption: '' })), ...reviewPhotos];
            return allPhotos.length
              ? `<div class="biz-photo-grid">${allPhotos.map(p => `<img src="${p.url}" alt="${escHtml(p.caption)}" loading="lazy" title="${p.caption ? 'Photo by ' + escHtml(p.caption) : ''}" onclick="window.open('${p.url}','_blank')" style="cursor:pointer;" />`).join('')}</div>`
              : '<div style="background:white;border:1px solid var(--border);border-radius:var(--radius);padding:40px;text-align:center;color:var(--text-light);">No photos yet. Be the first to add one in your review!</div>';
          })()}
        </div>

        <!-- Menu tab (hidden) -->
        <div id="bizTab-menu" style="display:none;">
          ${biz.menuUrl ? (() => {
            const isPdf = biz.menuUrl.match(/\.pdf($|\?)/i);
            return isPdf
              ? `<div style="background:white;border:1px solid var(--border);border-radius:14px;padding:24px;text-align:center;">
                   <div style="font-size:40px;margin-bottom:12px;">📄</div>
                   <div style="font-size:16px;font-weight:700;color:var(--text-dark);margin-bottom:6px;">Pricing</div>
                   <div style="font-size:13px;color:var(--text-light);margin-bottom:16px;">Click below to open the full pricing sheet</div>
                   <a href="${escHtml(biz.menuUrl)}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 28px;background:var(--ocean);color:white;border-radius:10px;font-size:14px;font-weight:700;text-decoration:none;">📄 Open Pricing PDF</a>
                 </div>`
              : `<div style="background:white;border:1px solid var(--border);border-radius:14px;overflow:hidden;">
                   <img src="${escHtml(biz.menuUrl)}" style="width:100%;display:block;" onclick="window.open('${escHtml(biz.menuUrl)}','_blank')" loading="lazy">
                 </div>`;
          })() : ''}
          ${biz.menuText ? `
          <div style="background:white;border:1px solid var(--border);border-radius:14px;padding:22px 24px;margin-top:${biz.menuUrl ? '14px' : '0'};">
            <div style="font-size:11px;font-weight:700;color:var(--text-light);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;">Pricing</div>
            <pre style="font-size:14px;color:var(--text-dark);line-height:1.8;white-space:pre-wrap;font-family:inherit;margin:0;">${escHtml(biz.menuText)}</pre>
          </div>` : ''}
          ${!biz.menuUrl && !biz.menuText ? '<div style="background:white;border:1px solid var(--border);border-radius:14px;padding:40px;text-align:center;color:var(--text-light);font-size:14px;">No pricing posted yet.</div>' : ''}
        </div>

        <!-- Posts tab (hidden) -->
        <div id="bizTab-posts" style="display:none;">
          ${bizPosts.length === 0
            ? '<div style="background:white;border:1px solid var(--border);border-radius:var(--radius);padding:40px;text-align:center;color:var(--text-light);font-size:14px;">No posts yet.</div>'
            : bizPosts.map(p => {
                const isEvent = p.type === 'event';
                const isPromo = p.type === 'promotion';
                const badgeColor = isEvent ? 'background:rgba(42,157,143,0.1);color:#2A9D8F;' : isPromo ? 'background:rgba(231,111,81,0.1);color:#E76F51;' : 'background:rgba(0,119,182,0.1);color:#0077B6;';
                const badgeLabel = isEvent ? '🎟️ Event' : isPromo ? '🎉 Promotion' : '📢 Announcement';
                const eventDateStr = p.eventDate ? new Date(p.eventDate + 'T00:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' }) : '';
                const totalReactions = p.reactions ? Object.values(p.reactions).reduce((a,b) => a+b, 0) : 0;
                return `<div style="background:white;border:1px solid var(--border);border-radius:14px;padding:18px 20px;margin-bottom:12px;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                    <span style="display:inline-flex;align-items:center;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;${badgeColor}">${badgeLabel}</span>
                    <span style="font-size:12px;color:var(--text-light);margin-left:auto;">${relativeTime(p.createdAt)}</span>
                  </div>
                  ${isEvent && p.eventTitle ? `<div style="font-size:15px;font-weight:700;color:#2A9D8F;margin-bottom:6px;">🎟️ ${escHtml(p.eventTitle)}</div>` : ''}
                  ${isEvent ? `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:8px;font-size:12px;color:var(--text-light);">
                    ${p.eventDate ? `<span>📅 ${eventDateStr}</span>` : ''}
                    ${p.eventTime ? `<span>🕐 ${escHtml(p.eventTime)}</span>` : ''}
                    ${p.eventLocation ? `<span>📍 ${escHtml(p.eventLocation)}</span>` : ''}
                  </div>` : ''}
                  ${!isEvent && p.offerTitle ? `<div style="font-size:13px;font-weight:700;color:#E76F51;margin-bottom:4px;">🏷️ ${escHtml(p.offerTitle)}</div>` : ''}
                  ${!isEvent && p.offerExpiry ? `<div style="font-size:11.5px;color:var(--text-light);margin-bottom:6px;">Expires: ${escHtml(p.offerExpiry)}</div>` : ''}
                  <div style="font-size:14px;color:var(--text-mid);line-height:1.6;margin-bottom:10px;">${escHtml(p.content)}</div>
                  ${p.image ? (p.image.match(/\.pdf($|\?)/i)
                    ? `<a href="${escHtml(p.image)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;margin-bottom:10px;padding:8px 14px;background:rgba(0,119,182,0.07);border:1px solid rgba(0,119,182,0.18);border-radius:8px;font-size:13px;font-weight:600;color:var(--ocean);text-decoration:none;">📄 View PDF</a>`
                    : `<img src="${escHtml(p.image)}" alt="" loading="lazy" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin-bottom:10px;cursor:pointer;" onclick="window.open(this.src,'_blank')">`
                  ) : ''}
                  <div style="display:flex;gap:14px;font-size:12px;color:var(--text-light);">
                    <span>👍 ${totalReactions} reaction${totalReactions !== 1 ? 's' : ''}</span>
                    <span>💬 ${p.commentCount} comment${p.commentCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>`;
              }).join('')
          }
        </div>

        <!-- Promotions tab (hidden) -->
        <div id="bizTab-promotions" style="display:none;">
          ${(() => {
              const promos = bizPosts.filter(p => p.type === 'promotion');
              if (promos.length === 0) return '<div style="background:white;border:1px solid var(--border);border-radius:var(--radius);padding:40px;text-align:center;color:var(--text-light);font-size:14px;">No promotions yet.</div>';
              return promos.map(p => {
                const totalReactions = p.reactions ? Object.values(p.reactions).reduce((a,b) => a+b, 0) : 0;
                return `<div style="background:white;border:1px solid var(--border);border-radius:14px;padding:18px 20px;margin-bottom:12px;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                    <span style="display:inline-flex;align-items:center;padding:3px 9px;border-radius:20px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;background:rgba(231,111,81,0.1);color:#E76F51;">🎉 Promotion</span>
                    <span style="font-size:12px;color:var(--text-light);margin-left:auto;">${relativeTime(p.createdAt)}</span>
                  </div>
                  ${p.offerTitle ? `<div style="font-size:14px;font-weight:700;color:#E76F51;margin-bottom:4px;">🏷️ ${escHtml(p.offerTitle)}</div>` : ''}
                  ${p.offerExpiry ? `<div style="font-size:12px;color:var(--text-light);margin-bottom:8px;">Expires: ${escHtml(p.offerExpiry)}</div>` : ''}
                  <div style="font-size:14px;color:var(--text-mid);line-height:1.6;margin-bottom:10px;">${escHtml(p.content)}</div>
                  ${p.image ? (p.image.match(/\.pdf($|\?)/i)
                    ? `<a href="${escHtml(p.image)}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;margin-bottom:10px;padding:8px 14px;background:rgba(0,119,182,0.07);border:1px solid rgba(0,119,182,0.18);border-radius:8px;font-size:13px;font-weight:600;color:var(--ocean);text-decoration:none;">📄 View PDF</a>`
                    : `<img src="${escHtml(p.image)}" alt="" loading="lazy" style="width:100%;max-height:220px;object-fit:cover;border-radius:10px;margin-bottom:10px;cursor:pointer;" onclick="window.open(this.src,'_blank')">`
                  ) : ''}
                  <div style="display:flex;gap:14px;font-size:12px;color:var(--text-light);">
                    <span>👍 ${totalReactions} reaction${totalReactions !== 1 ? 's' : ''}</span>
                    <span>💬 ${p.commentCount} comment${p.commentCount !== 1 ? 's' : ''}</span>
                  </div>
                </div>`;
              }).join('');
            })()
          }
        </div>
      </div>

      <!-- Right sidebar -->
      <div class="biz-page-sidebar">
        <div class="biz-sidebar-card">
          <div style="font-size:11px;font-weight:700;color:var(--text-light);letter-spacing:.08em;text-transform:uppercase;margin-bottom:14px;">Contact & Info</div>
          ${biz.phone ? `<div class="biz-sidebar-row"><span class="biz-sidebar-icon">📞</span><span style="font-size:14px;">${escHtml(biz.phone)}</span></div>` : ''}
          ${biz.hours ? `<div class="biz-sidebar-row"><span class="biz-sidebar-icon">🕐</span><span style="font-size:14px;">${escHtml(biz.hours)}</span></div>` : ''}
          ${biz.address ? `<div class="biz-sidebar-row"><span class="biz-sidebar-icon">📍</span><span style="font-size:14px;">${escHtml(biz.address)}</span></div>` : ''}
          <div class="biz-sidebar-row"><span class="biz-sidebar-icon">🧭</span><span style="color:var(--ocean);cursor:pointer;font-weight:600;font-size:14px;" onclick="showToast('Opening directions...')">Get directions</span></div>
          ${biz.website && biz.website !== '#' ? `<div class="biz-sidebar-row"><span class="biz-sidebar-icon">🌐</span><a href="${escHtml(biz.website)}" target="_blank" rel="noopener" style="color:var(--ocean);text-decoration:none;font-size:14px;">Website</a></div>` : ''}
          ${biz.instagramUrl ? `<div class="biz-sidebar-row"><span class="biz-sidebar-icon">📸</span><a href="${escHtml(biz.instagramUrl)}" target="_blank" rel="noopener" style="color:#E1306C;text-decoration:none;font-weight:600;font-size:14px;">Instagram</a></div>` : ''}
          ${biz.facebookUrl ? `<div class="biz-sidebar-row"><span class="biz-sidebar-icon">👤</span><a href="${escHtml(biz.facebookUrl)}" target="_blank" rel="noopener" style="color:#1877F2;text-decoration:none;font-weight:600;font-size:14px;">Facebook</a></div>` : ''}
        </div>
        <div class="biz-sidebar-card" style="text-align:center;">
          <div style="font-size:36px;font-weight:800;color:var(--text-dark);line-height:1;">${biz.rating}</div>
          <div style="display:flex;justify-content:center;margin:6px 0 4px;">${buildStars(biz.rating)}</div>
          <div style="font-size:13px;color:var(--text-light);margin-bottom:14px;">${biz.reviewCount} review${biz.reviewCount !== 1 ? 's' : ''}</div>
          <button onclick="switchBizTab('reviews');document.getElementById('bizReviewBox')?.focus();" style="width:100%;padding:10px;background:var(--ocean);color:white;border:none;border-radius:10px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;">✍️ Write a Review</button>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = '';
  container.appendChild(wrap);
}

async function setBizContactEmail(bizId, current) {
  const email = prompt('Enter contact email for this business:', current || '');
  if (email === null) return;
  const res = await fetch(`/api/businesses/${bizId}`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contactEmail: email.trim() })
  });
  if (res.ok) { showToast('Contact email saved!'); navigate('business/' + bizId); }
  else showToast('Could not save email.');
}

async function verifyBizInfo(bizId) {
  const res = await fetch(`/api/businesses/${bizId}/verify`, { method: 'POST', credentials: 'include' });
  if (res.ok) { showToast('✓ Thank you for verifying!'); navigate('business/' + bizId); }
  else showToast('Please log in to verify.');
}

async function editBizServices(bizId) {
  const biz = allBusinesses.find(b => String(b.id) === String(bizId)) || (await fetchJSON(`/api/businesses/${bizId}`));
  if (!biz) return;
  const modal = document.createElement('div');
  modal.id = 'editBizServicesModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:justify-content;padding:16px;justify-content:center;';
  const currentServices = biz.services || [];
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;width:100%;max-width:480px;max-height:90vh;overflow-y:auto;padding:24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="margin:0;font-size:17px;font-weight:800;">Edit Services & Hours</h3>
        <button onclick="document.getElementById('editBizServicesModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:6px;">HOURS</label>
        <input id="esHours" type="text" value="${escHtml(biz.hours||'')}" placeholder="e.g. 24/7 or Mon–Fri 8am–6pm" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;"/>
      </div>
      <div style="margin-bottom:14px;">
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:6px;">WHATSAPP</label>
        <input id="esWhatsapp" type="tel" value="${escHtml(biz.whatsapp||'')}" placeholder="+507 xxx xxxx" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;"/>
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:8px;">SERVICES OFFERED</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px;">
        ${MEDICAL_BIZ_SERVICES.map(s=>`<label style="display:flex;align-items:center;gap:4px;font-size:12.5px;cursor:pointer;background:${currentServices.includes(s)?'#f0fdf4':'#f8fafc'};border:1px solid ${currentServices.includes(s)?'#bbf7d0':'#dde4ed'};border-radius:8px;padding:5px 10px;">
          <input type="checkbox" value="${s}" ${currentServices.includes(s)?'checked':''} style="cursor:pointer;"> ${s}
        </label>`).join('')}
      </div>
      <button onclick="saveEditBizServices('${bizId}')" style="width:100%;padding:12px;background:var(--ocean);color:white;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Save Changes</button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

async function saveEditBizServices(bizId) {
  const services = [...document.querySelectorAll('#editBizServicesModal input[type=checkbox]:checked')].map(i => i.value);
  const hours = document.getElementById('esHours')?.value.trim() || null;
  const whatsapp = document.getElementById('esWhatsapp')?.value.trim() || null;
  const res = await fetch(`/api/businesses/${bizId}`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ services, hours, whatsapp })
  });
  if (res.ok) {
    document.getElementById('editBizServicesModal')?.remove();
    showToast('Services updated!');
    navigate('business/' + bizId);
  } else showToast('Could not save changes.');
}

async function uploadBizBanner(bizId, input) {
  if (!input.files || !input.files[0]) return;
  const dataUrl = await readAndCompress(input.files[0], 1400, 600);
  const res = await fetch(`/api/businesses/${bizId}/banner`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) });
  if (res.ok) { await openBusinessPage(bizId); showToast('Banner updated!'); }
  else showToast('Upload failed');
}

async function uploadBizLogo(bizId, input) {
  if (!input.files || !input.files[0]) return;
  const dataUrl = await readAndCompress(input.files[0], 800, 800, 0.88);
  const res = await fetch(`/api/businesses/${bizId}/logo`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) });
  if (res.ok) { await openBusinessPage(bizId); showToast('Logo updated!'); }
  else showToast('Upload failed');
}

function switchBizTab(tabName) {
  ['overview','reviews','photos','menu','posts','promotions'].forEach(t => {
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
  const isBizUser = currentUser?.role === 'business';

  if (isBizUser) {
    overlay.innerHTML = `
      <div style="background:white;border-radius:20px;width:min(440px,100%);padding:28px;box-shadow:0 24px 60px rgba(0,0,0,0.3);max-height:90vh;overflow-y:auto;">
        <div style="font-size:24px;margin-bottom:6px;">🏪</div>
        <h3 style="font-size:17px;font-weight:800;margin-bottom:4px;color:#0d1b2a;">Claim ${escHtml(bizName)}</h3>
        <p style="font-size:13px;color:#4a6378;margin-bottom:20px;">We'll send a 6-digit verification code to your email address on file.</p>
        <div id="claimSendSection">
          <button onclick="sendInlineClaimCode('${bizId}',this)" style="width:100%;padding:12px;background:#0077B6;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;">Send Verification Code</button>
        </div>
        <div id="claimCodeSection" style="display:none;">
          <p style="font-size:13px;color:#4a6378;margin-bottom:10px;">Enter the 6-digit code sent to your email:</p>
          <div style="display:flex;gap:8px;">
            <input type="text" id="inlineClaimCode" maxlength="6" placeholder="000000" style="flex:1;padding:11px 14px;border:1.5px solid #d1dce6;border-radius:10px;font-size:18px;letter-spacing:6px;font-family:inherit;outline:none;text-align:center;" />
            <button onclick="verifyInlineClaim('${bizId}',this)" style="padding:11px 18px;background:#0077B6;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;white-space:nowrap;">Verify</button>
          </div>
        </div>
        <button onclick="this.closest('[style*=fixed]').remove()" style="width:100%;padding:10px;background:none;border:none;font-size:14px;color:#4a6378;cursor:pointer;font-family:inherit;margin-top:12px;">Cancel</button>
      </div>`;
  } else {
    overlay.innerHTML = `
      <div style="background:white;border-radius:20px;width:min(440px,100%);padding:32px 28px;box-shadow:0 24px 60px rgba(0,0,0,0.3);text-align:center;">
        <div style="font-size:40px;margin-bottom:12px;">🏪</div>
        <h3 style="font-size:18px;font-weight:800;margin-bottom:8px;color:#0d1b2a;">Own ${escHtml(bizName)}?</h3>
        <p style="font-size:14px;color:#4a6378;margin-bottom:24px;line-height:1.6;">Create a free business account to claim this listing, respond to reviews, and post announcements directly to your neighbors.</p>
        <button onclick="this.closest('[style*=fixed]').remove();window.location.href='/login'" style="width:100%;padding:13px;background:#0077B6;color:white;border:none;border-radius:10px;font-size:15px;font-weight:700;font-family:inherit;cursor:pointer;margin-bottom:10px;">Create Business Account →</button>
        <button onclick="this.closest('[style*=fixed]').remove()" style="width:100%;padding:10px;background:none;border:none;font-size:14px;color:#4a6378;cursor:pointer;font-family:inherit;">Cancel</button>
      </div>`;
  }
  document.body.appendChild(overlay);
}

async function sendInlineClaimCode(bizId, btn) {
  btn.disabled = true; btn.textContent = 'Sending…';
  const res = await fetch(`/api/businesses/${bizId}/claim/send-code`, { method: 'POST', credentials: 'include' });
  if (res.ok) {
    document.getElementById('claimSendSection').style.display = 'none';
    document.getElementById('claimCodeSection').style.display = 'block';
  } else {
    const d = await res.json();
    showToast(d.error || 'Could not send code');
    btn.disabled = false; btn.textContent = 'Send Verification Code';
  }
}

async function verifyInlineClaim(bizId, btn) {
  const code = document.getElementById('inlineClaimCode')?.value.trim();
  if (!code) { showToast('Enter the code'); return; }
  btn.disabled = true; btn.textContent = 'Verifying…';
  const res = await fetch(`/api/businesses/${bizId}/claim/verify-code`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code })
  });
  if (res.ok) {
    btn.closest('[style*=fixed]').remove();
    showToast('Business claimed! Redirecting to your dashboard…');
    setTimeout(() => window.location.href = '/business', 1500);
  } else {
    const d = await res.json();
    showToast(d.error || 'Invalid code');
    btn.disabled = false; btn.textContent = 'Verify';
  }
}

let bizReviewStars = {};

function setBizStar(bizId, n) {
  bizReviewStars[bizId] = n;
  const picker = document.getElementById(`bizStarPicker-${bizId}`);
  if (!picker) return;
  picker.querySelectorAll('span').forEach(s => {
    s.style.color = parseInt(s.dataset.star) <= n ? '#F59E0B' : '#D1D5DB';
  });
}

function previewReviewPhoto(input) {
  const file = input.files[0];
  if (!file) return;
  document.getElementById('bizReviewPhotoName').textContent = file.name;
  const reader = new FileReader();
  reader.onload = e => {
    const preview = document.getElementById('bizReviewPhotoPreview');
    preview.src = e.target.result;
    preview.style.display = 'block';
  };
  reader.readAsDataURL(file);
}

async function submitBizReview(bizId) {
  const box = document.getElementById('bizReviewBox');
  const text = box?.value.trim();
  const rating = bizReviewStars[bizId] || 0;
  if (!rating) { showToast('Please select a star rating'); return; }
  if (!text) { showToast('Please write something about your experience'); return; }
  const photoInput = document.getElementById('bizReviewPhoto');
  let image = '';
  if (photoInput?.files[0]) {
    image = await readAndCompress(photoInput.files[0]);
  }
  const res = await fetch(`/api/businesses/${bizId}/recommend`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, rating, image })
  });
  if (res.ok) {
    delete bizReviewStars[bizId];
    await renderBusinessPage(bizId, document.getElementById('sectionContent'));
    switchBizTab('reviews');
    showToast('Review posted! ⭐');
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
  const memberYear = neighbor.memberSince || (neighbor.yearsInNeighborhood ? new Date().getFullYear() - neighbor.yearsInNeighborhood : new Date().getFullYear());
  const yearsText = `Member since ${memberYear}`;

  card.innerHTML = `
    <div class="neighbor-avatar" style="background:${neighbor.avatar};overflow:hidden;">
      ${neighbor.avatarUrl ? `<img src="${neighbor.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : neighbor.initials}
      ${neighbor.verified ? '<div class="neighbor-verified">✓</div>' : ''}
    </div>
    <div class="neighbor-name">${escHtml(neighbor.name)}</div>
    <div class="neighbor-years">
      ${yearsText} in Costa Blanca Villas
    </div>
    <button class="btn-wave-neighbor" onclick="startConversation('${neighbor.username}')">💬 Message</button>
  `;
  return card;
}

// ─── Direct Messages ─────────────────────────────────────────────
let activeConversationId = null;

async function renderMessages(container) {
  container.innerHTML = sectionHeaderHTML('messages');
  const conversations = await fetchJSON('/api/conversations') || [];

  const layout = document.createElement('div');
  layout.className = 'messages-layout';

  const leftPanel = document.createElement('div');
  leftPanel.className = 'conv-list-panel';
  leftPanel.id = 'convListPanel';

  if (!conversations.length) {
    leftPanel.innerHTML = `<div style="padding:24px;text-align:center;color:var(--text-light);font-size:14px;">No conversations yet.<br>Go to Neighbors and hit Message to start one.</div>`;
  } else {
    conversations.forEach(conv => {
      const item = document.createElement('div');
      item.className = 'conv-item' + (conv.id === activeConversationId ? ' active' : '');
      item.dataset.convId = conv.id;
      item.innerHTML = `
        <div class="conv-avatar" style="background:${conv.partner.avatar};overflow:hidden;">
          ${conv.partner.avatarUrl ? `<img src="${conv.partner.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : escHtml(conv.partner.initials)}
        </div>
        <div class="conv-info">
          <div class="conv-name">${escHtml(conv.partner.name)}</div>
          <div class="conv-preview">${conv.lastMessage ? escHtml(conv.lastMessage.slice(0, 50)) : 'Start a conversation'}</div>
        </div>
        ${conv.unreadCount > 0 ? `<div class="conv-unread">${conv.unreadCount}</div>` : ''}
      `;
      item.onclick = () => openConversationPanel(conv.id, conv.partner, layout, conv.youBlockedThem);
      leftPanel.appendChild(item);
    });
  }

  const rightPanel = document.createElement('div');
  rightPanel.className = 'chat-panel';
  rightPanel.id = 'chatPanel';
  rightPanel.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-light);font-size:14px;">Select a conversation</div>`;

  layout.appendChild(leftPanel);
  layout.appendChild(rightPanel);
  container.appendChild(layout);

  if (activeConversationId) {
    const conv = conversations.find(c => c.id === activeConversationId);
    if (conv) openConversationPanel(conv.id, conv.partner, layout, conv.youBlockedThem);
  } else if (conversations.length) {
    openConversationPanel(conversations[0].id, conversations[0].partner, layout, conversations[0].youBlockedThem);
  }
}

async function openConversationPanel(convId, partner, layout, youBlockedThem) {
  activeConversationId = convId;
  layout?.querySelectorAll('.conv-item').forEach(el => el.classList.toggle('active', el.dataset.convId === convId));
  const panel = document.getElementById('chatPanel');
  if (!panel) return;
  fetch(`/api/conversations/${convId}/read`, { method: 'POST', credentials: 'include' });
  const messages = await fetchJSON(`/api/conversations/${convId}/messages`) || [];
  const isBlocked = youBlockedThem;
  panel.innerHTML = `
    <div class="chat-header">
      <div class="chat-header-avatar" style="background:${partner.avatar};overflow:hidden;">
        ${partner.avatarUrl ? `<img src="${partner.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : escHtml(partner.initials)}
      </div>
      <div class="chat-header-name">${escHtml(partner.name)}</div>
      <div style="margin-left:auto;">
        ${isBlocked
          ? `<button onclick="unblockUser('${convId}')" style="padding:6px 12px;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Unblock</button>`
          : `<button onclick="blockAndReport('${convId}','${escHtml(partner.name).replace(/'/g,"\\'")}',this)" style="padding:6px 12px;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Block & Report</button>`
        }
      </div>
    </div>
    ${isBlocked ? `<div style="background:#fef2f2;border-bottom:1px solid #fecaca;padding:10px 16px;font-size:13px;color:#dc2626;font-weight:600;">You have blocked this person. They cannot message you.</div>` : ''}
    <div class="chat-messages" id="chatMessages">
      ${buildMessageList(messages)}
      ${!messages.length ? '<div style="text-align:center;color:var(--text-light);font-size:13px;padding:24px;">Say hello!</div>' : ''}
    </div>
    <div class="chat-input-row">
      <input type="text" class="chat-input" id="chatInput" placeholder="Send a message…" onkeydown="if(event.key==='Enter')sendDirectMessage('${convId}')" ${isBlocked ? 'disabled' : ''}>
      <button class="chat-send-btn" onclick="sendDirectMessage('${convId}')" ${isBlocked ? 'disabled' : ''}>
        <i data-lucide="send" style="width:16px;height:16px;"></i>
      </button>
    </div>
  `;
  lucide.createIcons();
  const msgsEl = document.getElementById('chatMessages');
  if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
  document.getElementById('chatInput')?.focus();
  // Poll for new messages every 5s while this conversation is open
  clearInterval(window._msgPollTimer);
  window._msgPollTimer = setInterval(async () => {
    if (activeConversationId !== convId) { clearInterval(window._msgPollTimer); return; }
    const latest = await fetchJSON(`/api/conversations/${convId}/messages`);
    if (!latest) return;
    const msgsEl = document.getElementById('chatMessages');
    if (!msgsEl) { clearInterval(window._msgPollTimer); return; }
    const existing = msgsEl.querySelectorAll('.msg-row').length;
    if (latest.length > existing) {
      latest.slice(existing).forEach(m => msgsEl.insertAdjacentHTML('beforeend', buildMessageBubble(m)));
      msgsEl.scrollTop = msgsEl.scrollHeight;
      fetch(`/api/conversations/${convId}/read`, { method: 'POST', credentials: 'include' });
    }
  }, 5000);
}

async function blockAndReport(convId, partnerName, btn) {
  if (!confirm(`Block ${partnerName}? They won't be able to message you and a report will be filed automatically.`)) return;
  btn.disabled = true; btn.textContent = 'Blocking…';
  const res = await fetch(`/api/conversations/${convId}/block`, { method: 'POST', credentials: 'include' });
  if (res.ok) {
    showToast(`${partnerName} has been blocked and reported.`);
    await renderMessages(document.getElementById('sectionContent'));
  } else {
    showToast('Something went wrong. Try again.');
    btn.disabled = false; btn.textContent = 'Block & Report';
  }
}

async function unblockUser(convId) {
  const res = await fetch(`/api/conversations/${convId}/unblock`, { method: 'POST', credentials: 'include' });
  if (res.ok) {
    showToast('User unblocked.');
    await renderMessages(document.getElementById('sectionContent'));
  }
}

function buildMessageBubble(msg, opts = {}) {
  const isMine = msg.senderId === currentUser.id;
  const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const groupClass = opts.groupPos ? `group-${opts.groupPos}` : '';
  const showTime = opts.showTime ? 'show-time' : '';
  return `<div class="msg-row ${isMine ? 'mine' : 'theirs'} ${groupClass} ${showTime}">
    <div class="msg-bubble ${isMine ? 'mine' : 'theirs'}">${escHtml(msg.content)}</div>
    <div class="msg-time">${time}</div>
  </div>`;
}

function fmtMsgDateDivider(d) {
  const date = new Date(d);
  const today = new Date();
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  const diffDays = Math.floor((today - date) / 86400000);
  if (diffDays < 7) return date.toLocaleDateString(undefined, { weekday: 'long' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function buildMessageList(messages) {
  if (!messages || !messages.length) return '';
  const GROUP_GAP_MS = 5 * 60 * 1000;
  const out = [];
  let lastDay = null;
  messages.forEach((m, i) => {
    const date = new Date(m.createdAt);
    const dayKey = date.toDateString();
    if (dayKey !== lastDay) {
      out.push(`<div class="msg-date-divider">${fmtMsgDateDivider(m.createdAt)}</div>`);
      lastDay = dayKey;
    }
    const prev = i > 0 ? messages[i-1] : null;
    const next = i < messages.length - 1 ? messages[i+1] : null;
    const sameAsPrev = prev && prev.senderId === m.senderId &&
      (new Date(m.createdAt) - new Date(prev.createdAt)) < GROUP_GAP_MS &&
      new Date(prev.createdAt).toDateString() === dayKey;
    const sameAsNext = next && next.senderId === m.senderId &&
      (new Date(next.createdAt) - new Date(m.createdAt)) < GROUP_GAP_MS &&
      new Date(next.createdAt).toDateString() === dayKey;
    let groupPos = 'single';
    if (sameAsPrev && sameAsNext) groupPos = 'mid';
    else if (sameAsPrev) groupPos = 'end';
    else if (sameAsNext) groupPos = 'start';
    const showTime = !sameAsNext; // show time on the LAST in a group
    out.push(buildMessageBubble(m, { groupPos, showTime }));
  });
  return out.join('');
}

async function sendDirectMessage(convId) {
  const input = document.getElementById('chatInput');
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  try {
    const res = await fetch(`/api/conversations/${convId}/messages`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
    if (!res.ok) return;
    const msg = await res.json();
    const msgsEl = document.getElementById('chatMessages');
    if (msgsEl) { msgsEl.insertAdjacentHTML('beforeend', buildMessageBubble(msg)); msgsEl.scrollTop = msgsEl.scrollHeight; }
  } catch {}
}

async function startConversation(username) {
  try {
    const res = await fetch(`/api/conversations/${username}`, { method: 'POST', credentials: 'include' });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Could not start conversation'); return; }
    activeConversationId = data.conversationId;
    navigate('messages');
  } catch (e) { showToast('Could not start conversation'); }
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
      <div class="group-card-icon" style="overflow:hidden;">${(group.iconUrl||/^(data:|https?:)/.test(group.icon)) ? `<img src="${group.iconUrl||group.icon}" style="width:100%;height:100%;object-fit:cover;border-radius:13px;">` : group.icon}</div>
    </div>
    <div class="group-card-body">
      <div class="group-card-name">${escHtml(group.name)}</div>
      <div class="group-card-meta">
        👥 ${group.members} members
        ${(() => { const c = getGroupCategory(group.category); return `<span style="background:#eff6ff;color:#1e40af;padding:2px 8px;border-radius:7px;font-weight:700;font-size:10.5px;">${c.emoji} ${c.label}</span>`; })()}
        ${group.privacy === 'private' ? '<span style="background:rgba(231,111,81,0.1);color:var(--coral);padding:1px 6px;border-radius:7px;font-weight:700;font-size:10px;">Private</span>' : ''}
      </div>
      <div class="group-card-desc">${escHtml(group.description)}</div>
      <div class="group-card-actions">
        ${group.joined
          ? `<button class="btn-group-open" onclick="openGroupPage('${group.id}')" style="flex:1;">View Group →</button>`
          : group.pendingRequest
            ? `<button class="btn-join-group" style="background:#f0f3f7;color:var(--text-mid);cursor:default;" disabled>Requested</button>`
            : `<button class="btn-join-group" id="group-btn-${group.id}" onclick="toggleGroup('${group.id}',this)">${group.privacy === 'private' ? '🔒 Request to Join' : 'Join Group'}</button>`}
        ${(group.joined && group.createdBy !== currentUser?.username) ? `<button class="btn-join-group" id="group-btn-${group.id}" onclick="toggleGroup('${group.id}',this)" style="flex:0 0 auto;padding:8px 16px;background:#fee2e2;color:#dc2626;border-color:#fca5a5;">Leave</button>` : ''}
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
    const actions = btn?.closest('.group-card-actions');
    if (data.requested) {
      showToast('Request sent — the group owner will review it.');
      if (btn) { btn.textContent = 'Requested'; btn.disabled = true; btn.style.cssText += ';background:#f0f3f7;color:var(--text-mid);'; }
    } else if (data.joined) {
      showToast('You joined the group! 🎉');
      if (actions) {
        actions.innerHTML = `
          <button class="btn-group-open" onclick="openGroupPage('${groupId}')" style="flex:1;">View Group →</button>
          <button class="btn-join-group" id="group-btn-${groupId}" onclick="toggleGroup('${groupId}',this)" style="flex:0 0 auto;padding:8px 16px;background:#fee2e2;color:#dc2626;border-color:#fca5a5;">Leave</button>`;
      }
    } else {
      showToast('You left the group.');
      if (actions) {
        actions.innerHTML = `<button class="btn-join-group" id="group-btn-${groupId}" onclick="toggleGroup('${groupId}',this)">Join Group</button>`;
      }
    }
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
      <!-- Banner -->
      <div class="group-page-banner" style="${bannerStyle};position:relative;">
        ${(group.isCreator || group.isCoAdmin || group.isAdmin) ? `
        <label style="position:absolute;top:10px;right:10px;padding:7px 12px;background:rgba(0,0,0,0.5);color:white;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:5px;backdrop-filter:blur(4px);">
          <input type="file" accept="image/*" style="display:none;" onchange="uploadGroupBanner('${group.id}',this)">
          📷 Change Cover
        </label>` : ''}
      </div>
      <div class="group-page-header">
        <!-- Icon with click-to-change for admin -->
        <div class="group-page-icon" style="overflow:hidden;${(group.isCreator||group.isCoAdmin||group.isAdmin)?'cursor:pointer;':''}" ${(group.isCreator||group.isCoAdmin||group.isAdmin)?`onclick="document.getElementById('groupIconInput-${group.id}').click()"`:''}>
          ${(group.iconUrl||/^(data:|https?:)/.test(group.icon)) ? `<img src="${group.iconUrl||group.icon}" style="width:100%;height:100%;object-fit:cover;border-radius:18px;">` : group.icon}
          ${(group.isCreator||group.isCoAdmin||group.isAdmin) ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,0);border-radius:18px;display:flex;align-items:center;justify-content:center;transition:.15s;" onmouseover="this.style.background='rgba(0,0,0,0.35)'" onmouseout="this.style.background='rgba(0,0,0,0)'"><span style="color:white;font-size:18px;opacity:0;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0'">📷</span></div>` : ''}
        </div>
        ${(group.isCreator||group.isCoAdmin||group.isAdmin) ? `<input id="groupIconInput-${group.id}" type="file" accept="image/*" style="display:none;" onchange="uploadGroupIcon('${group.id}',this)">` : ''}
        <div class="group-page-info">
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap;">
            <div class="group-page-name">${escHtml(group.name)}</div>
            <div style="display:flex;gap:8px;flex-shrink:0;margin-top:4px;flex-wrap:wrap;">
              ${(group.isCreator||group.isCoAdmin||group.isAdmin) ? `<button onclick="openEditGroupModal('${group.id}')" style="padding:7px 13px;background:var(--ocean);color:white;border:none;border-radius:10px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;">✏️ Edit Group</button>` : ''}
              <button onclick="reportGroup('${group.id}')" style="padding:7px 13px;background:none;border:1.5px solid var(--border);border-radius:10px;cursor:pointer;font-size:12px;font-weight:600;color:var(--text-mid);font-family:inherit;">⚑ Report</button>
              ${(group.isCreator||group.isAdmin) ? `<button onclick="deleteGroup('${group.id}',null,true)" style="padding:7px 13px;background:none;border:1.5px solid #fca5a5;border-radius:10px;cursor:pointer;font-size:12px;font-weight:700;color:var(--coral);font-family:inherit;">🗑️ Delete</button>` : ''}
            </div>
          </div>
          <div class="group-page-meta">
            <span>👥 ${group.members} members</span>
            <span>${group.privacy === 'private' ? '🔒 Private' : '🌐 Public'}</span>
          </div>
          <div class="group-page-desc">${escHtml(group.description)}</div>
          ${(group.instagramUrl || group.tiktokUrl || group.facebookUrl) ? `
          <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
            ${group.instagramUrl ? `<a href="${escHtml(group.instagramUrl)}" target="_blank" rel="noopener noreferrer" title="Instagram" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);color:white;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;">📸 Instagram</a>` : ''}
            ${group.tiktokUrl ? `<a href="${escHtml(group.tiktokUrl)}" target="_blank" rel="noopener noreferrer" title="TikTok" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#000;color:white;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;">🎵 TikTok</a>` : ''}
            ${group.facebookUrl ? `<a href="${escHtml(group.facebookUrl)}" target="_blank" rel="noopener noreferrer" title="Facebook" style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;background:#1877F2;color:white;border-radius:8px;font-size:12px;font-weight:700;text-decoration:none;">📘 Facebook</a>` : ''}
          </div>` : ''}
        </div>
      </div>
    </div>

    ${(group.isCreator || group.isCoAdmin || group.isAdmin) && group.joinRequests?.length ? `
    <div style="background:white;border:1px solid #fde68a;border-radius:var(--radius);padding:16px 20px;margin-bottom:16px;box-shadow:var(--shadow-sm);">
      <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:12px;">🔒 Join Requests (${group.joinRequests.length})</div>
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${group.joinRequests.map(r => `
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:36px;height:36px;border-radius:50%;background:${r.avatar};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0;overflow:hidden;">${r.avatarUrl ? `<img src="${r.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : escHtml(r.initials)}</div>
            <div style="flex:1;font-size:14px;font-weight:600;color:var(--text-dark);">${escHtml(r.name)}</div>
            <button onclick="handleJoinRequest('${group.id}','${r.username}','approve')" style="padding:7px 14px;background:#16a34a;color:white;border:none;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;">Approve</button>
            <button onclick="handleJoinRequest('${group.id}','${r.username}','deny')" style="padding:7px 14px;background:none;border:1.5px solid var(--border);border-radius:8px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit;color:var(--coral);">Deny</button>
          </div>
        `).join('')}
      </div>
    </div>` : ''}

    <div style="background:white;border:1px solid var(--border);border-radius:var(--radius);padding:16px;margin-bottom:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:13px;font-weight:700;color:var(--text-dark);">👥 Members (${(group.memberList||[]).length})</div>
        ${(group.isCreator||group.isCoAdmin||group.isAdmin) ? `<button onclick="openInviteNeighborModal('${group.id}')" style="padding:6px 13px;background:var(--ocean);color:white;border:none;border-radius:10px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;">+ Invite Neighbor</button>` : ''}
      </div>
      <!-- Avatar strip: first 8 -->
      <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:10px;">
        ${(group.memberList||[]).slice(0,8).map(m => `
          <div title="${escHtml(m.name)}" style="width:38px;height:38px;border-radius:50%;background:${m.avatar};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;overflow:hidden;flex-shrink:0;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.12);">
            ${m.avatarUrl ? `<img src="${m.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : escHtml(m.initials)}
          </div>
        `).join('')}
        ${(group.memberList||[]).length > 8 ? `<div style="width:38px;height:38px;border-radius:50%;background:#e2e8f0;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:var(--text-mid);flex-shrink:0;">+${(group.memberList||[]).length - 8}</div>` : ''}
      </div>
      ${(group.memberList||[]).length > 0 ? `
      <button onclick="toggleGroupMembers('${group.id}')" id="membersToggleBtn-${group.id}" style="width:100%;padding:7px;background:#f8fafc;border:1.5px solid var(--border);border-radius:10px;font-size:12px;font-weight:600;color:var(--text-mid);cursor:pointer;font-family:inherit;">
        See all ${(group.memberList||[]).length} members ▾
      </button>
      <div id="membersFull-${group.id}" style="display:none;margin-top:10px;flex-direction:column;gap:8px;">
        ${(group.memberList||[]).map(m => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f1f5f9;">
            <div style="display:flex;align-items:center;gap:10px;min-width:0;">
              <div style="width:34px;height:34px;border-radius:50%;background:${m.avatar};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;overflow:hidden;flex-shrink:0;">
                ${m.avatarUrl ? `<img src="${m.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : escHtml(m.initials)}
              </div>
              <div style="font-size:13px;font-weight:600;color:var(--text-dark);overflow:hidden;text-overflow:ellipsis;">${escHtml(m.name)}</div>
              ${m.isCreator ? `<span style="font-size:10px;font-weight:800;background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:6px;letter-spacing:0.5px;flex-shrink:0;">👑 CREATOR</span>` : (m.isAdmin ? `<span style="font-size:10px;font-weight:800;background:#dbeafe;color:#1e40af;padding:2px 7px;border-radius:6px;letter-spacing:0.5px;flex-shrink:0;">⭐ CO-ADMIN</span>` : '')}
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0;">
              ${group.isCreator && !m.isCreator && m.username !== currentUser?.username ? (m.isAdmin
                ? `<button onclick="demoteGroupCoAdmin('${group.id}','${m.username}')" style="padding:4px 10px;background:none;border:1.5px solid var(--border);border-radius:8px;font-size:11px;font-weight:600;color:var(--text-mid);cursor:pointer;font-family:inherit;">Remove Co-Admin</button>`
                : `<button onclick="promoteGroupCoAdmin('${group.id}','${m.username}')" style="padding:4px 10px;background:none;border:1.5px solid #93c5fd;border-radius:8px;font-size:11px;font-weight:600;color:#1e40af;cursor:pointer;font-family:inherit;">Make Co-Admin</button>`
              ) : ''}
              ${(group.isCreator || group.isCoAdmin) && !m.isCreator && m.username !== currentUser?.username ? `
                <button onclick="removeGroupMember('${group.id}','${m.username}')" style="padding:4px 10px;background:none;border:1.5px solid var(--border);border-radius:8px;font-size:11px;font-weight:600;color:var(--coral);cursor:pointer;font-family:inherit;">Remove</button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>` : ''}
    </div>

    <div class="group-compose-box" id="groupComposeBox">
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="width:38px;height:38px;border-radius:50%;background:${currentUser?.avatar || '#0077B6'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;overflow:hidden;">${currentUser?.avatarUrl ? `<img src="${currentUser.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (currentUser?.initials || '?')}</div>
        <div style="flex:1;">
          <textarea id="groupPostBox" placeholder="Write something to ${escHtml(group.name)}…"></textarea>
          <div id="groupPollBuilder" style="display:none;margin-top:8px;background:#f8fafc;border:1.5px solid var(--border);border-radius:10px;padding:10px;">
            <div style="font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:8px;">Poll Question</div>
            <input id="groupPollQuestion" type="text" placeholder="Ask a question…" style="width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;outline:none;margin-bottom:6px;box-sizing:border-box;" />
            <div id="groupPollOptions">
              <input class="group-poll-opt" type="text" placeholder="Option 1" style="width:100%;padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;outline:none;margin-bottom:4px;box-sizing:border-box;" />
              <input class="group-poll-opt" type="text" placeholder="Option 2" style="width:100%;padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;outline:none;margin-bottom:4px;box-sizing:border-box;" />
            </div>
            <button onclick="addGroupPollOption()" style="font-size:12px;color:var(--ocean);background:none;border:none;cursor:pointer;font-weight:600;padding:0;">+ Add option</button>
          </div>
          <div id="groupEventBuilder" style="display:none;margin-top:8px;background:#fef3c7;border:1.5px solid #fcd34d;border-radius:10px;padding:12px;">
            <div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:8px;">📅 Group Event</div>
            <input id="groupEventTitle" type="text" placeholder="Event title (e.g. Beach cleanup)" style="width:100%;padding:9px 10px;border:1.5px solid #fde68a;border-radius:8px;font-size:13px;font-family:inherit;outline:none;margin-bottom:8px;box-sizing:border-box;background:white;" />
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:8px;">
              <input id="groupEventDate" type="date" style="padding:9px 10px;border:1.5px solid #fde68a;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:white;" />
              <input id="groupEventTime" type="time" style="padding:9px 10px;border:1.5px solid #fde68a;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:white;" />
              <input id="groupEventEndTime" type="time" placeholder="End" style="padding:9px 10px;border:1.5px solid #fde68a;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:white;" />
            </div>
            <input id="groupEventLocation" type="text" placeholder="Location (e.g. Costa Blanca beach)" style="width:100%;padding:9px 10px;border:1.5px solid #fde68a;border-radius:8px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;background:white;" />
            <div style="font-size:11.5px;color:#92400e;margin-top:6px;">Group members will be notified. The event also appears on the community Events page with a group tag.</div>
          </div>
          <div id="groupImagePreview" style="display:none;margin-top:8px;"></div>
          <div id="groupPdfPreview" style="display:none;margin-top:8px;"></div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <label title="Add photo" style="cursor:pointer;padding:6px 10px;border:1.5px solid var(--border);border-radius:20px;font-size:12px;font-weight:600;color:var(--text-mid);display:flex;align-items:center;gap:4px;background:white;">
                <input type="file" accept="image/*" style="display:none;" onchange="previewGroupPostImage(this)">
                📷 Photo
              </label>
              <label title="Attach PDF" style="cursor:pointer;padding:6px 10px;border:1.5px solid var(--border);border-radius:20px;font-size:12px;font-weight:600;color:var(--text-mid);display:flex;align-items:center;gap:4px;background:white;">
                <input type="file" accept="application/pdf,.pdf" style="display:none;" onchange="previewGroupPostPdf(this)">
                📄 PDF
              </label>
              <button onclick="toggleGroupPoll()" title="Create poll" style="padding:6px 10px;border:1.5px solid var(--border);border-radius:20px;font-size:12px;font-weight:600;color:var(--text-mid);background:white;cursor:pointer;font-family:inherit;">📊 Poll</button>
              <button onclick="toggleGroupEvent()" title="Create event" style="padding:6px 10px;border:1.5px solid var(--border);border-radius:20px;font-size:12px;font-weight:600;color:var(--text-mid);background:white;cursor:pointer;font-family:inherit;">📅 Event</button>
            </div>
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
          <div class="group-post-card" id="gpost-${p.id}">
            ${p.pinned ? `<div style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:var(--ocean);margin-bottom:8px;">📌 Pinned post</div>` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:40px;height:40px;border-radius:50%;background:${p.author.avatar};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;overflow:hidden;">${p.author.avatarUrl ? `<img src="${p.author.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : escHtml(p.author.initials)}</div>
                <div>
                  <div style="font-size:14px;font-weight:700;color:var(--text-dark);">${escHtml(p.author.name)}</div>
                  <div style="font-size:11.5px;color:var(--text-light);">${groupTimeAgo(p.createdAt)}</div>
                </div>
              </div>
              <div style="display:flex;gap:6px;">
                ${group.isAdmin || group.isCreator || group.isCoAdmin ? `<button onclick="${p.pinned ? `unpinGroupPost('${group.id}','${p.id}')` : `pinGroupPost('${group.id}','${p.id}')`}" title="${p.pinned ? 'Unpin' : 'Pin to top'}" style="padding:5px 10px;background:none;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;font-size:12px;">${p.pinned ? '📌 Unpin' : '📌 Pin'}</button>` : ''}
                ${(group.isAdmin || group.isCreator || group.isCoAdmin || p.author?.username === currentUser?.username) ? `<button onclick="deleteGroupPost('${group.id}','${p.id}')" title="Delete" style="padding:5px 10px;background:none;border:1.5px solid var(--border);border-radius:8px;cursor:pointer;font-size:12px;color:var(--coral);">🗑️</button>` : ''}
              </div>
            </div>
            ${p.event ? buildGroupEventCard(p.event) : ''}
            ${p.content ? `<div style="font-size:14px;color:var(--text-mid);line-height:1.65;margin-bottom:${p.imageUrl||p.pdfUrl||p.pollQuestion?'10px':'0'}">${escHtml(p.content)}</div>` : ''}
            ${p.imageUrl ? `<img src="${p.imageUrl}" style="width:100%;border-radius:10px;max-height:360px;object-fit:cover;margin-bottom:${p.pdfUrl||p.pollQuestion?'10px':'0'}" />` : ''}
            ${p.pdfUrl ? `<a href="${p.pdfUrl}" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;padding:12px 14px;background:#f8fafc;border:1.5px solid var(--border);border-radius:10px;text-decoration:none;color:var(--text-dark);margin-bottom:${p.pollQuestion?'10px':'0'};">
              <div style="font-size:22px;">📄</div>
              <div style="flex:1;min-width:0;">
                <div style="font-size:13.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(p.pdfName || 'Document.pdf')}</div>
                <div style="font-size:11.5px;color:var(--text-light);font-weight:600;">PDF · Tap to open</div>
              </div>
              <div style="font-size:13px;color:var(--ocean);font-weight:700;">Open →</div>
            </a>` : ''}
            ${p.pollQuestion ? `
              <div style="background:#f8fafc;border:1.5px solid var(--border);border-radius:10px;padding:12px;">
                <div style="font-size:13px;font-weight:700;color:var(--text-dark);margin-bottom:10px;">📊 ${escHtml(p.pollQuestion)}</div>
                ${(p.pollOptions||[]).map((opt,i) => {
                  const votes = Object.values(p.pollVotes||{});
                  const count = votes.filter(v=>v===opt).length;
                  const total = votes.length || 1;
                  const pct = Math.round((count/total)*100);
                  const myVote = p.pollVotes?.[currentUser?.id];
                  return `<div style="margin-bottom:6px;">
                    <button onclick="voteGroupPoll('${group.id}','${p.id}','${escHtml(opt)}')" style="width:100%;text-align:left;padding:8px 12px;border:1.5px solid ${myVote===opt?'var(--ocean)':'var(--border)'};border-radius:8px;background:${myVote===opt?'rgba(0,119,182,0.06)':'white'};cursor:pointer;font-family:inherit;font-size:13px;position:relative;overflow:hidden;">
                      <div style="position:absolute;left:0;top:0;height:100%;width:${myVote?pct:0}%;background:rgba(0,119,182,0.08);border-radius:6px;"></div>
                      <span style="position:relative;">${escHtml(opt)}${myVote?` <span style="color:var(--text-light);font-size:11px;">${pct}% (${count})</span>`:''}</span>
                    </button>
                  </div>`;
                }).join('')}
              </div>` : ''}
          </div>`).join('')}
    </div>
  `;

  container.innerHTML = '';
  container.appendChild(wrap);
}

let groupPostImageData = null;
let groupPostPdfData = null;
let groupPostPdfName = null;

async function previewGroupPostImage(input) {
  if (!input.files || !input.files[0]) return;
  groupPostImageData = await readAndCompress(input.files[0]);
  const prev = document.getElementById('groupImagePreview');
  if (prev) { prev.style.display = 'block'; prev.innerHTML = `<img src="${groupPostImageData}" style="max-width:100%;border-radius:10px;max-height:200px;object-fit:cover;" />`; }
}

function previewGroupPostPdf(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    showToast('Please select a PDF file.');
    input.value = '';
    return;
  }
  if (file.size > 9 * 1024 * 1024) {
    showToast('PDF too large (max 9 MB).');
    input.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    groupPostPdfData = reader.result;
    groupPostPdfName = file.name;
    const prev = document.getElementById('groupPdfPreview');
    if (prev) {
      prev.style.display = 'block';
      prev.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:#f8fafc;border:1.5px solid var(--border);border-radius:10px;">
        <div style="font-size:20px;">📄</div>
        <div style="flex:1;font-size:13px;font-weight:600;color:var(--text-dark);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(file.name)}</div>
        <button onclick="removeGroupPostPdf()" style="background:none;border:none;color:var(--coral);cursor:pointer;font-size:14px;font-weight:700;padding:4px 8px;">✕</button>
      </div>`;
    }
  };
  reader.readAsDataURL(file);
}

function removeGroupPostPdf() {
  groupPostPdfData = null;
  groupPostPdfName = null;
  const prev = document.getElementById('groupPdfPreview');
  if (prev) { prev.style.display = 'none'; prev.innerHTML = ''; }
}

function toggleGroupPoll() {
  const el = document.getElementById('groupPollBuilder');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  const ev = document.getElementById('groupEventBuilder');
  if (ev && el?.style.display === 'block') ev.style.display = 'none';
}

function toggleGroupEvent() {
  const el = document.getElementById('groupEventBuilder');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  const pl = document.getElementById('groupPollBuilder');
  if (pl && el?.style.display === 'block') pl.style.display = 'none';
}

function addGroupPollOption() {
  const container = document.getElementById('groupPollOptions');
  if (!container) return;
  const count = container.querySelectorAll('.group-poll-opt').length + 1;
  const inp = document.createElement('input');
  inp.className = 'group-poll-opt';
  inp.type = 'text';
  inp.placeholder = `Option ${count}`;
  inp.style.cssText = 'width:100%;padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-family:inherit;outline:none;margin-bottom:4px;box-sizing:border-box;';
  container.appendChild(inp);
}

function buildGroupEventCard(ev) {
  const dateLabel = ev.date ? new Date(ev.date).toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric', year:'numeric' }) : '';
  const timeLabel = ev.time ? (ev.endTime ? `${ev.time} – ${ev.endTime}` : ev.time) : '';
  const cancelled = ev.cancelled;
  const opts = [
    { key:'going',  label:'✓ Going',   active:ev.userRsvp==='going' },
    { key:'maybe',  label:'? Maybe',   active:ev.userRsvp==='maybe' },
    { key:'cantGo', label:"✕ Can't Go", active:ev.userRsvp==='cantGo' }
  ];
  return `
    <div style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:1.5px solid #f59e0b;border-radius:12px;padding:14px;margin-bottom:10px;${cancelled?'opacity:0.6;':''}">
      ${cancelled ? `<div style="background:#dc2626;color:white;font-size:11px;font-weight:800;letter-spacing:0.5px;padding:3px 9px;border-radius:6px;display:inline-block;margin-bottom:8px;">CANCELLED</div>` : ''}
      <div style="display:flex;align-items:flex-start;gap:12px;">
        <div style="background:white;border-radius:10px;padding:8px 12px;text-align:center;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <div style="font-size:10px;font-weight:700;color:#92400e;letter-spacing:0.5px;text-transform:uppercase;">${ev.date ? new Date(ev.date).toLocaleDateString(undefined,{month:'short'}) : ''}</div>
          <div style="font-size:20px;font-weight:800;color:#0d1b2a;line-height:1;">${ev.date ? new Date(ev.date).getDate() : ''}</div>
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:15px;font-weight:800;color:#0d1b2a;">📅 ${escHtml(ev.title)}</div>
          <div style="font-size:12.5px;color:#92400e;margin-top:3px;">${escHtml(dateLabel)}${timeLabel?` · ${escHtml(timeLabel)}`:''}</div>
          ${ev.location ? `<div style="font-size:12.5px;color:var(--text-mid);margin-top:3px;">📍 ${escHtml(ev.location)}</div>` : ''}
        </div>
      </div>
      ${ev.imageUrl ? `<img src="${ev.imageUrl}" style="width:100%;border-radius:8px;max-height:200px;object-fit:cover;margin-top:10px;" />` : ''}
      ${cancelled ? '' : `
      <div style="display:flex;gap:6px;margin-top:12px;">
        ${opts.map(o => `
          <button onclick="rsvpGroupEvent('${ev.id}','${o.key}',this)" style="flex:1;padding:8px;border:1.5px solid ${o.active?'#0077B6':'#fde68a'};background:${o.active?'#0077B6':'white'};color:${o.active?'white':'#0d1b2a'};border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;">${o.label}</button>
        `).join('')}
      </div>
      <div style="display:flex;gap:14px;margin-top:8px;font-size:11.5px;color:#92400e;font-weight:600;">
        <span>✓ ${ev.rsvp?.going||0} going</span>
        <span>? ${ev.rsvp?.maybe||0} maybe</span>
        <span>✕ ${ev.rsvp?.cantGo||0} can't go</span>
      </div>`}
    </div>`;
}

async function rsvpGroupEvent(eventId, status, btn) {
  try {
    const res = await fetch(`/api/events/${eventId}/rsvp`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) { showToast('Could not RSVP'); return; }
    const card = btn.closest('.group-post-card');
    const groupIdMatch = window.location.hash.match(/group\/([^/]+)/) || document.getElementById('groupComposeBox')?.outerHTML.match(/groups\/([^"']+)\/posts/);
    const groupId = groupIdMatch ? groupIdMatch[1] : null;
    if (groupId) await renderGroupPage(groupId, document.getElementById('sectionContent'));
    showToast(`RSVP saved!`);
  } catch (e) {
    showToast('Network error');
  }
}

async function submitGroupPost(groupId) {
  const box = document.getElementById('groupPostBox');
  const content = box?.value.trim();
  const pollQuestion = document.getElementById('groupPollQuestion')?.value.trim();
  const pollOpts = [...document.querySelectorAll('.group-poll-opt')].map(i => i.value.trim()).filter(Boolean);

  const eventBuilder = document.getElementById('groupEventBuilder');
  const isEvent = eventBuilder && eventBuilder.style.display !== 'none';
  const eventTitle = isEvent ? document.getElementById('groupEventTitle')?.value.trim() : '';
  const eventDate = isEvent ? document.getElementById('groupEventDate')?.value : '';
  const eventTime = isEvent ? document.getElementById('groupEventTime')?.value : '';
  const eventEndTime = isEvent ? document.getElementById('groupEventEndTime')?.value : '';
  const eventLocation = isEvent ? document.getElementById('groupEventLocation')?.value.trim() : '';

  if (isEvent && (!eventTitle || !eventDate)) { showToast('Event needs a title and date.'); return; }
  if (!isEvent && !content && !pollQuestion && !groupPostPdfData) { showToast('Write something first.'); return; }
  if (pollQuestion && pollOpts.length < 2) { showToast('Add at least 2 poll options.'); return; }

  const body = { content, image: groupPostImageData || undefined };
  if (groupPostPdfData) { body.pdf = groupPostPdfData; body.pdfName = groupPostPdfName; }
  if (pollQuestion) { body.pollQuestion = pollQuestion; body.pollOptions = pollOpts; }
  if (isEvent) {
    body.eventTitle = eventTitle;
    body.eventDate = eventDate;
    if (eventTime) body.eventTime = eventTime;
    if (eventEndTime) body.eventEndTime = eventEndTime;
    if (eventLocation) body.eventLocation = eventLocation;
    if (content) body.eventDescription = content;
    if (groupPostImageData) body.eventImage = groupPostImageData;
  }

  const res = await fetch(`/api/groups/${groupId}/posts`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (res.ok) {
    box.value = '';
    groupPostImageData = null;
    groupPostPdfData = null;
    groupPostPdfName = null;
    const prev = document.getElementById('groupImagePreview');
    if (prev) { prev.style.display = 'none'; prev.innerHTML = ''; }
    const pdfPrev = document.getElementById('groupPdfPreview');
    if (pdfPrev) { pdfPrev.style.display = 'none'; pdfPrev.innerHTML = ''; }
    const pollBuilder = document.getElementById('groupPollBuilder');
    if (pollBuilder) pollBuilder.style.display = 'none';
    if (eventBuilder) {
      eventBuilder.style.display = 'none';
      ['groupEventTitle','groupEventDate','groupEventTime','groupEventEndTime','groupEventLocation'].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = '';
      });
    }
    await renderGroupPage(groupId, document.getElementById('sectionContent'));
    showToast(isEvent ? 'Event posted to the group! 📅' : 'Posted to the group! 🎉');
  } else {
    const err = await res.json().catch(() => ({}));
    showToast(err.error || 'Could not post.');
  }
}

function toggleGroupMembers(groupId) {
  const panel = document.getElementById(`membersFull-${groupId}`);
  const btn = document.getElementById(`membersToggleBtn-${groupId}`);
  if (!panel) return;
  const open = panel.style.display === 'flex';
  panel.style.display = open ? 'none' : 'flex';
  if (btn) btn.textContent = open ? `See all members ▾` : `Hide members ▴`;
}

async function removeGroupMember(groupId, username) {
  if (!confirm(`Remove ${username} from this group?`)) return;
  const res = await fetch(`/api/groups/${groupId}/members/${username}`, { method: 'DELETE', credentials: 'include' });
  if (res.ok) { await renderGroupPage(groupId, document.getElementById('sectionContent')); showToast('Member removed.'); }
}

async function promoteGroupCoAdmin(groupId, username) {
  if (!confirm(`Make ${username} a co-admin? They'll be able to manage posts, members, and group settings — but not delete the group.`)) return;
  const res = await fetch(`/api/groups/${groupId}/members/${username}/promote`, { method: 'POST', credentials: 'include' });
  if (res.ok) {
    await renderGroupPage(groupId, document.getElementById('sectionContent'));
    showToast(`${username} is now a co-admin ⭐`);
  } else {
    const err = await res.json().catch(() => ({}));
    showToast(err.error || 'Could not promote.');
  }
}

async function demoteGroupCoAdmin(groupId, username) {
  if (!confirm(`Remove co-admin status from ${username}?`)) return;
  const res = await fetch(`/api/groups/${groupId}/members/${username}/demote`, { method: 'POST', credentials: 'include' });
  if (res.ok) {
    await renderGroupPage(groupId, document.getElementById('sectionContent'));
    showToast(`${username} is no longer a co-admin.`);
  } else {
    const err = await res.json().catch(() => ({}));
    showToast(err.error || 'Could not demote.');
  }
}

async function uploadGroupBanner(groupId, input) {
  if (!input.files?.[0]) return;
  openImageCropper(input.files[0], { aspectRatio: 4, circular: false, onCrop: async (dataUrl) => {
    if (!dataUrl) return;
    showToast('Uploading…');
    const res = await fetch(`/api/groups/${groupId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ coverPhoto: dataUrl })
    });
    if (res.ok) { showToast('Cover photo updated!'); await renderGroupPage(groupId, document.getElementById('sectionContent')); }
    else showToast('Upload failed.');
  }});
}

async function uploadGroupIcon(groupId, input) {
  if (!input.files?.[0]) return;
  openImageCropper(input.files[0], { aspectRatio: 1, circular: true, onCrop: async (dataUrl) => {
    if (!dataUrl) return;
    showToast('Uploading…');
    const res = await fetch(`/api/groups/${groupId}`, {
      method: 'PATCH', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ iconUrl: dataUrl })
    });
    if (res.ok) { showToast('Group icon updated!'); await renderGroupPage(groupId, document.getElementById('sectionContent')); }
    else { const err = await res.json().catch(()=>{}); showToast('Upload failed: ' + (err?.error||res.status)); }
  }});
}

function openEditGroupModal(groupId) {
  const group = { id: groupId };
  document.getElementById('editGroupModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'editGroupModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;width:100%;max-width:420px;padding:24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
        <h3 style="margin:0;font-size:17px;font-weight:800;">Edit Group</h3>
        <button onclick="document.getElementById('editGroupModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
      </div>
      <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">GROUP NAME</label><input id="egName" type="text" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;" /></div>
      <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">DESCRIPTION</label><textarea id="egDesc" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;resize:none;height:80px;box-sizing:border-box;"></textarea></div>
      <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">CATEGORY</label>
        <select id="egCategory" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:white;box-sizing:border-box;">
          ${GROUP_CATEGORIES.map(c => `<option value="${c.key}">${c.emoji} ${c.label}</option>`).join('')}
        </select>
      </div>
      <div style="margin-bottom:12px;"><label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">PRIVACY</label>
        <select id="egPrivacy" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:white;box-sizing:border-box;">
          <option value="public">🌐 Public — anyone can join</option>
          <option value="private">🔒 Private — invite only</option>
        </select>
      </div>
      <div style="margin-bottom:6px;"><label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);margin-bottom:5px;">SOCIAL LINKS <span style="font-weight:400;color:var(--text-light);text-transform:none;letter-spacing:0;">(optional)</span></label></div>
      <div style="margin-bottom:8px;"><input id="egInstagram" type="url" placeholder="📸 Instagram URL — https://instagram.com/yourhandle" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;" /></div>
      <div style="margin-bottom:8px;"><input id="egTiktok" type="url" placeholder="🎵 TikTok URL — https://tiktok.com/@yourhandle" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;" /></div>
      <div style="margin-bottom:18px;"><input id="egFacebook" type="url" placeholder="📘 Facebook URL — https://facebook.com/yourpage" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;" /></div>
      <button onclick="saveEditGroup('${groupId}')" style="width:100%;padding:12px;background:var(--ocean);color:white;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Save Changes</button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  // Pre-fill with current group data
  fetchJSON(`/api/groups/${groupId}`).then(g => {
    if (!g) return;
    document.getElementById('egName').value = g.name || '';
    document.getElementById('egDesc').value = g.description || '';
    document.getElementById('egPrivacy').value = g.privacy || 'public';
    document.getElementById('egInstagram').value = g.instagramUrl || '';
    document.getElementById('egTiktok').value = g.tiktokUrl || '';
    document.getElementById('egFacebook').value = g.facebookUrl || '';
    const cat = (g.category || 'general').toLowerCase();
    const sel = document.getElementById('egCategory');
    if (sel) sel.value = GROUP_CATEGORIES.find(c => c.key === cat) ? cat : 'general';
  });
}

async function saveEditGroup(groupId) {
  const name = document.getElementById('egName')?.value.trim();
  const description = document.getElementById('egDesc')?.value.trim();
  const privacy = document.getElementById('egPrivacy')?.value;
  const category = document.getElementById('egCategory')?.value;
  const instagramUrl = document.getElementById('egInstagram')?.value.trim();
  const tiktokUrl = document.getElementById('egTiktok')?.value.trim();
  const facebookUrl = document.getElementById('egFacebook')?.value.trim();
  if (!name) { showToast('Group name is required'); return; }
  const res = await fetch(`/api/groups/${groupId}`, {
    method: 'PATCH', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, privacy, category, instagramUrl, tiktokUrl, facebookUrl })
  });
  if (res.ok) {
    document.getElementById('editGroupModal')?.remove();
    showToast('Group updated!');
    await renderGroupPage(groupId, document.getElementById('sectionContent'));
  } else showToast('Could not save changes.');
}

async function openInviteNeighborModal(groupId) {
  const neighbors = await fetchJSON('/api/neighbors') || [];
  document.getElementById('inviteNeighborModal')?.remove();
  const modal = document.createElement('div');
  modal.id = 'inviteNeighborModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;';
  modal.innerHTML = `
    <div style="background:white;border-radius:16px;width:100%;max-width:400px;max-height:80vh;overflow-y:auto;padding:24px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">
        <h3 style="margin:0;font-size:17px;font-weight:800;">Invite a Neighbor</h3>
        <button onclick="document.getElementById('inviteNeighborModal').remove()" style="background:none;border:none;font-size:20px;cursor:pointer;">✕</button>
      </div>
      <input id="neighborSearchInput" type="text" placeholder="Search neighbors…" oninput="filterInviteList(this.value)" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:12px;" />
      <div id="inviteNeighborList" style="display:flex;flex-direction:column;gap:8px;">
        ${neighbors.map(n => `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);" data-name="${escHtml(n.name).toLowerCase()}">
            <div style="display:flex;align-items:center;gap:10px;">
              <div style="width:36px;height:36px;border-radius:50%;background:${n.avatar};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;overflow:hidden;flex-shrink:0;">
                ${n.avatarUrl ? `<img src="${n.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : escHtml(n.initials)}
              </div>
              <div style="font-size:13.5px;font-weight:600;color:var(--text-dark);">${escHtml(n.name)}</div>
            </div>
            <button onclick="inviteToGroup('${groupId}','${n.username}',this)" style="padding:6px 14px;background:var(--ocean);color:white;border:none;border-radius:9px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">Invite</button>
          </div>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function filterInviteList(query) {
  document.querySelectorAll('#inviteNeighborList [data-name]').forEach(row => {
    row.style.display = row.dataset.name.includes(query.toLowerCase()) ? '' : 'none';
  });
}

async function inviteToGroup(groupId, username, btn) {
  const res = await fetch(`/api/groups/${groupId}/invite`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username })
  });
  if (res.ok) {
    btn.textContent = '✓ Added';
    btn.style.background = '#059669';
    btn.disabled = true;
    showToast(`${username} added to group!`);
  } else showToast('Could not invite — they may already be a member.');
}

async function pinGroupPost(groupId, postId) {
  const res = await fetch(`/api/groups/${groupId}/posts/${postId}/pin`, { method: 'POST', credentials: 'include' });
  if (res.ok) { await renderGroupPage(groupId, document.getElementById('sectionContent')); showToast('Post pinned 📌'); }
}

async function unpinGroupPost(groupId, postId) {
  const res = await fetch(`/api/groups/${groupId}/posts/${postId}/unpin`, { method: 'POST', credentials: 'include' });
  if (res.ok) { await renderGroupPage(groupId, document.getElementById('sectionContent')); showToast('Post unpinned'); }
}

async function voteGroupPoll(groupId, postId, option) {
  const res = await fetch(`/api/groups/${groupId}/posts/${postId}/poll-vote`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ option })
  });
  if (res.ok) await renderGroupPage(groupId, document.getElementById('sectionContent'));
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
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Category *</label>
        <select id="cgCategory" style="width:100%;padding:11px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:white;">
          ${GROUP_CATEGORIES.map(c => `<option value="${c.key}">${c.emoji} ${c.label}</option>`).join('')}
        </select>
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
        <label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Cover Photo <span style="font-weight:400;text-transform:none;letter-spacing:0;">(optional)</span></label>
        <label style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;height:88px;border:1.5px dashed var(--border);border-radius:13px;cursor:pointer;background:#f8fafc;transition:border-color 0.15s;" onmouseover="this.style.borderColor='var(--ocean)'" onmouseout="this.style.borderColor='var(--border)'">
          <input type="file" accept="image/*" style="display:none;" onchange="previewGroupCover(this)">
          <div id="cgCoverPreview" style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;">
            <span style="font-size:22px;">🖼️</span>
            <span style="font-size:11px;color:var(--text-mid);font-weight:600;">Upload cover photo</span>
          </div>
        </label>
        <div style="font-size:11px;color:var(--text-light);margin-top:4px;">Recommended: 1200 × 400px (wide banner)</div>
      </div>
      <div style="margin-bottom:6px;"><label style="display:block;font-size:12px;font-weight:700;color:var(--text-mid);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">Social Links <span style="font-weight:400;color:var(--text-light);text-transform:none;letter-spacing:0;">(optional)</span></label></div>
      <div style="margin-bottom:8px;"><input id="cgInstagram" type="url" placeholder="📸 Instagram URL" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;" /></div>
      <div style="margin-bottom:8px;"><input id="cgTiktok" type="url" placeholder="🎵 TikTok URL" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;" /></div>
      <div style="margin-bottom:14px;"><input id="cgFacebook" type="url" placeholder="📘 Facebook URL" style="width:100%;padding:10px 13px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;" /></div>
      <button onclick="submitCreateGroup()" style="width:100%;padding:12px;background:var(--ocean);color:white;border:none;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;">Create Group</button>
    </div>
  `;
  openModal('eventDetailModal');
}

let cgPhotoDataUrl = null;
let cgCoverDataUrl = null;

async function previewGroupPhoto(input) {
  if (!input.files || !input.files[0]) return;
  cgPhotoDataUrl = await readAndCompress(input.files[0], 800, 800, 0.85);
  const preview = document.getElementById('cgPhotoPreview');
  if (preview) preview.innerHTML = `<img src="${cgPhotoDataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:11px;">`;
}

async function previewGroupCover(input) {
  if (!input.files || !input.files[0]) return;
  cgCoverDataUrl = await readAndCompress(input.files[0]);
  const preview = document.getElementById('cgCoverPreview');
  if (preview) preview.innerHTML = `<img src="${cgCoverDataUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:11px;">`;
}

async function submitCreateGroup() {
  const name = document.getElementById('cgName')?.value.trim();
  if (!name) { showToast('Please enter a group name.'); return; }
  const body = {
    name,
    description: document.getElementById('cgDesc')?.value.trim(),
    icon: cgPhotoDataUrl || '👥',
    privacy: document.getElementById('cgPrivacy')?.value || 'public',
    category: document.getElementById('cgCategory')?.value || 'general',
    coverPhoto: cgCoverDataUrl || '',
    instagramUrl: document.getElementById('cgInstagram')?.value.trim() || null,
    tiktokUrl: document.getElementById('cgTiktok')?.value.trim() || null,
    facebookUrl: document.getElementById('cgFacebook')?.value.trim() || null
  };
  cgPhotoDataUrl = null;
  cgCoverDataUrl = null;
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
    <div class="notif-avatar" style="background:${notif.avatar || '#0077B6'};overflow:hidden;">${notif.avatarUrl ? `<img src="${notif.avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">` : (notif.initials || '??')}</div>
    <div class="notif-body">
      <div class="notif-msg">${escHtml(notif.message)}</div>
      <div class="notif-time">${relativeTime(notif.time)}</div>
    </div>
    ${!notif.read ? '<div class="notif-unread-dot"></div>' : ''}
  `;
  return card;
}

// ─── Create Post Modal ───────────────────────────────────────────
function openCreatePost(type, prefill) {
  if (type) selectPostType(type);
  openModal('createPostModal');
  if (prefill) {
    const ta = document.getElementById('postContent');
    if (ta) { ta.value = prefill; ta.focus(); }
  }
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

async function attachPostPhoto(input) {
  if (!input.files || !input.files[0]) return;
  postPhotoDataUrl = await readAndCompress(input.files[0]);
  document.getElementById('postPhotoImg').src = postPhotoDataUrl;
  document.getElementById('postPhotoPreview').style.display = 'block';
}

function removePostPhoto() {
  postPhotoDataUrl = null;
  document.getElementById('postPhotoPreview').style.display = 'none';
  document.getElementById('postPhotoInput').value = '';
}

async function pickPostLocation(btn) {
  if (postLocationValue) { removePostLocation(); return; }
  if (!navigator.geolocation) { showToast('Location not supported on this device'); return; }

  btn.textContent = '📍 Getting location…';
  btn.disabled = true;

  navigator.geolocation.getCurrentPosition(async pos => {
    try {
      const { latitude: lat, longitude: lon } = pos.coords;
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`, {
        headers: { 'Accept-Language': 'en' }
      });
      const data = await res.json();
      const addr = data.address || {};
      postLocationValue = addr.road
        ? `${addr.road}${addr.suburb ? ', ' + addr.suburb : ''}${addr.city || addr.town || addr.village ? ', ' + (addr.city || addr.town || addr.village) : ''}`
        : data.display_name?.split(',').slice(0, 2).join(',').trim() || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    } catch {
      postLocationValue = `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`;
    }
    document.getElementById('postLocationText').textContent = postLocationValue;
    const tag = document.getElementById('postLocationTag');
    tag.style.display = 'flex';
    if (window.lucide) lucide.createIcons();
    btn.innerHTML = '<i data-lucide="map-pin" style="width:16px;height:16px"></i> Location';
    btn.style.color = 'var(--ocean)';
    btn.disabled = false;
    if (window.lucide) lucide.createIcons();
  }, err => {
    showToast(err.code === 1 ? 'Location permission denied' : 'Could not get location');
    btn.innerHTML = '<i data-lucide="map-pin" style="width:16px;height:16px"></i> Location';
    btn.disabled = false;
    if (window.lucide) lucide.createIcons();
  }, { timeout: 8000 });
}

function removePostLocation() {
  postLocationValue = null;
  document.getElementById('postLocationTag').style.display = 'none';
  const btn = document.getElementById('locationBtn');
  if (btn) btn.style.color = '';
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

  // Exclusive partnership note
  const note = document.createElement('div');
  note.style.cssText = 'background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;padding:11px 14px;margin:12px 0;font-size:12.5px;color:#0c4a6e;line-height:1.5;display:flex;align-items:flex-start;gap:8px;';
  note.innerHTML = `
    <span style="font-size:14px;flex-shrink:0;">ℹ️</span>
    <div>Listings are exclusively managed by <b>Uncover Panama Real Estate</b>, our official partner. To list your property for sale or rent, please contact them directly via the link above.</div>
  `;
  container.appendChild(note);

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
  const typeBadge = isRent ? 'For Rent' : 'For Sale';
  const typeCls = isRent ? 'for-rent' : 'for-sale';
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'realtor';
  const priceLabel = listing.price ? `$${Number(listing.price).toLocaleString()}` : '';
  const externalUrl = listing.externalUrl || 'https://www.uncoverpanamarealestate.com';
  const imgSrc = listing.image || null;

  card.innerHTML = `
    <div class="re-card-img-wrap">
      ${imgSrc ? `<img src="${imgSrc}" alt="${escHtml(listing.title)}" class="re-card-img" onerror="this.style.display='none';this.parentElement.insertAdjacentHTML('afterbegin','<div style=\'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px;background:var(--bg)\'>🏡</div>')">` : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px;background:var(--bg)">🏡</div>`}
      ${priceLabel ? `<div class="re-price-badge">${priceLabel}</div>` : ''}
      <div class="re-type-badge ${typeCls}">${typeBadge}</div>
    </div>
    <div class="re-card-body">
      <div class="re-card-title">${escHtml(listing.title)}</div>
      <div class="re-card-location" style="margin-bottom:4px;">
        <i data-lucide="building-2" style="width:12px;height:12px;color:var(--coral)"></i>
        Uncover Panama Real Estate
      </div>
      <div style="font-size:11px;color:var(--text-light);margin-bottom:12px;">${relativeTime(listing.listedAt)}</div>
      <div class="re-card-actions">
        <a href="${externalUrl}" target="_blank" rel="noopener" class="re-btn-view" style="flex:1;text-align:center;">
          <i data-lucide="external-link" style="width:13px;height:13px"></i>
          View Full Listing
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
  ['rlUrl','rlTitle','rlPrice','rlImage'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  openModal('addListingModal');
}

async function submitListing() {
  const get = id => document.getElementById(id)?.value?.trim() || '';
  const url = get('rlUrl');
  const title = get('rlTitle');
  if (!url || !title) { showToast('URL and Title are required'); return; }

  try {
    const res = await fetch('/api/realestate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        externalUrl: url,
        title,
        type: get('rlType') || 'for_sale',
        price: Number(get('rlPrice')) || 0,
        image: get('rlImage') || null
      })
    });
    if (!res.ok) throw new Error();
    closeModal('addListingModal');
    showToast('Listing added! 🏡');
    await loadRealEstateGrid('all');
    document.querySelectorAll('.re-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  } catch {
    showToast('Could not save listing. Please try again.');
  }
}

// ─── First Responders ─────────────────────────────────────────────
function switchFRTab(tab) {
  document.querySelectorAll('.fr-tab-btn').forEach(b => {
    b.style.background = 'transparent';
    b.style.color = 'var(--text-mid)';
    b.style.borderBottom = '3px solid transparent';
  });
  document.querySelectorAll('.fr-tab-panel').forEach(p => p.style.display = 'none');
  const btn = document.getElementById('frtab-' + tab);
  if (btn) { btn.style.background = 'transparent'; btn.style.color = '#1d4ed8'; btn.style.borderBottom = '3px solid #1d4ed8'; }
  const panel = document.getElementById('frpanel-' + tab);
  if (panel) panel.style.display = 'block';
}

const HOSPITAL_SERVICES = ['X-Ray / Radiology','Ultrasound','CT Scan','Laboratory','Pediatric Care','Major Surgery','Antivenom','Trauma Care','Blood Transfusion','Blood Donations','Minor Surgery','ICU / Critical Care','24/7 Emergency','English Speaking','Ambulance On-Site'];
const CRITICAL_SERVICES = ['Antivenom','Trauma Care','Blood Transfusion','ICU / Critical Care','24/7 Emergency'];

function hospitalVerifyBadge(h) {
  if (!h.last_verified_at) return `<span style="background:#fef3c7;color:#d97706;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;border:1px solid #fde68a;">⚠️ Never verified</span>`;
  const days = Math.floor((Date.now() - new Date(h.last_verified_at)) / 86400000);
  if (days < 30) return `<span style="background:#f0fdf4;color:#059669;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;border:1px solid #bbf7d0;">✓ Verified ${days === 0 ? 'today' : days + 'd ago'}${h.verified_by_name ? ' by ' + escHtml(h.verified_by_name) : ''}</span>`;
  if (days < 90) return `<span style="background:#fffbeb;color:#d97706;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;border:1px solid #fde68a;">⚠️ Verified ${days}d ago — please re-verify</span>`;
  return `<span style="background:#fef2f2;color:#dc2626;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;border:1px solid #fecaca;">🚨 ${days}d since last verification — may be outdated</span>`;
}

async function loadHospitals() {
  const el = document.getElementById('hospitalsList');
  if (!el) return;
  const hospitals = await fetchJSON('/api/hospitals') || [];
  if (!hospitals.length) {
    el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text-light);">
      <div style="font-size:32px;margin-bottom:8px;">🏥</div>
      <div style="font-size:14px;font-weight:600;margin-bottom:4px;">No hospitals added yet</div>
      <div style="font-size:13px;">An admin is working on adding verified facilities.</div>
    </div>`;
    return;
  }
  el.innerHTML = hospitals.map(h => {
    const services = Array.isArray(h.services) ? h.services : (JSON.parse(h.services||'[]'));
    const criticalFound = services.filter(s => CRITICAL_SERVICES.includes(s));
    return `
    <div style="background:white;border:1.5px solid var(--border);border-radius:14px;padding:16px;margin-bottom:12px;${h.open_reports > 0 ? 'border-color:#fca5a5;' : ''}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:8px;">
        <div>
          <div style="font-size:15px;font-weight:800;color:var(--text-dark);">${escHtml(h.name)}</div>
          <div style="font-size:12px;color:var(--text-light);margin-top:2px;">${h.hospital_type || 'Facility'} ${h.distance_km ? '· 📍 ' + h.distance_km + ' away' : ''} ${h.drive_time ? '· 🚗 ' + h.drive_time : ''}</div>
        </div>
        ${h.open_reports > 0 ? `<span style="background:#fef2f2;color:#dc2626;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;border:1px solid #fecaca;white-space:nowrap;">⚠️ ${h.open_reports} issue${h.open_reports>1?'s':''} reported</span>` : ''}
      </div>
      <div style="margin-bottom:10px;">${hospitalVerifyBadge(h)}</div>
      ${criticalFound.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">${criticalFound.map(s=>`<span style="background:#fef2f2;color:#dc2626;font-size:11px;font-weight:700;padding:3px 8px;border-radius:20px;border:1px solid #fecaca;">🔴 ${s}</span>`).join('')}</div>` : ''}
      ${services.filter(s=>!CRITICAL_SERVICES.includes(s)).length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:10px;">${services.filter(s=>!CRITICAL_SERVICES.includes(s)).map(s=>`<span style="background:#f0fdf4;color:#059669;font-size:11px;font-weight:600;padding:3px 8px;border-radius:20px;border:1px solid #bbf7d0;">✓ ${s}</span>`).join('')}</div>` : ''}
      <div style="font-size:12.5px;color:var(--text-mid);margin-bottom:4px;">${h.address ? '📍 ' + escHtml(h.address) : ''}</div>
      <div style="font-size:12.5px;color:var(--text-mid);margin-bottom:4px;">${h.hours_weekday ? '🕐 Weekdays: ' + escHtml(h.hours_weekday) : ''} ${h.hours_weekend ? '· Weekends: ' + escHtml(h.hours_weekend) : ''}</div>
      ${h.notes ? `<div style="font-size:12.5px;color:#d97706;background:#fffbeb;border-radius:8px;padding:8px 10px;margin-top:6px;margin-bottom:8px;border:1px solid #fde68a;">📝 ${escHtml(h.notes)}</div>` : ''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
        ${h.phone ? `<a href="tel:${h.phone.replace(/\s/g,'')}" style="padding:8px 14px;background:#1d4ed8;color:white;border-radius:10px;font-size:12.5px;font-weight:700;text-decoration:none;">📞 ${escHtml(h.phone)}</a>` : ''}
        ${h.whatsapp ? `<a href="https://wa.me/${h.whatsapp.replace(/\D/g,'')}" target="_blank" style="padding:8px 14px;background:#25D366;color:white;border-radius:10px;font-size:12.5px;font-weight:700;text-decoration:none;">💬 WhatsApp</a>` : ''}
        <button onclick="verifyHospital(${h.id})" style="padding:8px 14px;background:#f0fdf4;color:#059669;border:1.5px solid #bbf7d0;border-radius:10px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;">✓ Info is correct</button>
        <button onclick="reportHospital(${h.id},'${escHtml(h.name).replace(/'/g,"\\'")}')" style="padding:8px 14px;background:#fef2f2;color:#dc2626;border:1.5px solid #fecaca;border-radius:10px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;">⚠️ Report issue</button>
      </div>
    </div>`;
  }).join('');
}

async function verifyHospital(id) {
  const res = await fetch(`/api/hospitals/${id}/verify`, { method: 'POST', credentials: 'include' });
  if (res.ok) { showToast('✓ Thank you for verifying!'); loadHospitals(); }
  else showToast('Please log in to verify.');
}

async function reportHospital(id, name) {
  const msg = prompt(`What's wrong with the info for ${name}?\n(e.g. "Wrong phone number", "Closed on weekends", "No longer has antivenom")`);
  if (!msg) return;
  const res = await fetch(`/api/hospitals/${id}/report`, { method: 'POST', credentials: 'include', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ message: msg }) });
  if (res.ok) { showToast('Report submitted — thank you. An admin will review it.'); loadHospitals(); }
  else showToast('Please log in to report.');
}

async function renderFirstResponders(container) {
  const emtsServices = await fetchJSON('/api/emts-services') || [];
  container.innerHTML = `
    <div style="max-width:680px;margin:0 auto;padding:0 0 40px;">
      <div style="background:white;border:1px solid var(--border);border-radius:14px;padding:18px 20px;margin-bottom:16px;display:flex;align-items:center;gap:14px;box-shadow:var(--shadow-sm);">
        <div style="font-size:30px;line-height:1;">🚨</div>
        <div style="min-width:0;">
          <h2 style="font-size:20px;font-weight:800;color:var(--text-dark);margin:0 0 3px;">EMTS</h2>
          <p style="font-size:13.5px;color:var(--text-mid);margin:0;line-height:1.4;">Emergency medical services, preparedness & community support</p>
        </div>
      </div>

      <!-- Tabs -->
      <div style="background:white;border-radius:14px;border:1px solid var(--border);overflow:hidden;margin-bottom:16px;">
        <div style="display:flex;overflow-x:auto;border-bottom:1px solid var(--border);padding:0 4px;">
          ${[['services','🚑 Services'],['call','📞 Emergency Phrases'],['prepared','⚡ Be Prepared'],['links','🔗 Important Links'],['myinfo','👤 My Info']].map(([id,label]) => `
            <button id="frtab-${id}" class="fr-tab-btn" onclick="switchFRTab('${id}')" style="padding:13px 14px;font-size:13px;font-weight:600;border:none;cursor:pointer;font-family:inherit;white-space:nowrap;background:transparent;color:var(--text-mid);border-bottom:3px solid transparent;transition:all .15s;">${label}</button>
          `).join('')}
        </div>

        <!-- Tab: Services -->
        <div id="frpanel-services" class="fr-tab-panel" style="padding:20px;">
          <!-- EMTS Panama -->
          <div style="background:linear-gradient(160deg,#1e3a8a,#1d4ed8);border-radius:16px;padding:20px;color:white;margin-bottom:14px;">
            <!-- Header -->
            <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px;">
              <div style="width:56px;height:56px;background:white;border-radius:14px;overflow:hidden;flex-shrink:0;box-shadow:0 4px 12px rgba(0,0,0,0.2);"><img src="/emts-logo.png" style="width:100%;height:100%;object-fit:cover;" alt="EMTS Panama"/></div>
              <div>
                <div style="font-size:20px;font-weight:900;letter-spacing:-.3px;">EMTS Panama</div>
                <div style="font-size:12px;opacity:.8;margin-top:1px;">Private EMS · Buenaventura & Surrounding Communities</div>
                <div style="font-size:11px;margin-top:3px;background:rgba(255,255,255,.15);display:inline-block;padding:2px 8px;border-radius:20px;">🇵🇦 Panamanian Owned and Operated · English Speaking</div>
              </div>
            </div>

            <!-- Slogan -->
            <div style="background:rgba(255,255,255,0.12);border-left:3px solid rgba(255,255,255,0.5);border-radius:0 10px 10px 0;padding:10px 14px;margin-bottom:16px;">
              <p style="font-size:14px;font-weight:700;margin:0 0 4px;font-style:italic;">"Don't wait until you have an emergency."</p>
              <p style="font-size:12px;opacity:.85;line-height:1.55;margin:0;">EMTS Panama is the closest private EMS provider to the Costa Blanca Villas community — positioned to reach you faster than any other private service in the area. When every second counts, proximity is everything.</p>
            </div>

            <!-- Costa Blanca Connect Member Pricing -->
            <div style="background:rgba(255,255,255,0.95);border-radius:12px;padding:14px 16px;margin-bottom:16px;color:#1a1a2e;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <span style="font-size:18px;">⭐</span>
                <div style="font-size:13px;font-weight:800;color:#1d4ed8;">Exclusive Member Pricing — Costa Blanca Connect</div>
              </div>
              <p style="font-size:12px;line-height:1.65;margin:0 0 10px;color:#374151;">As a valued member of the Costa Blanca Connect community, EMTS Panama is pleased to offer preferred rates that are not available to the general public. We believe that access to quality emergency care should be a priority — not an afterthought.</p>
              <div style="background:#f0f7ff;border-radius:8px;padding:10px 12px;margin-bottom:10px;">
                <div style="font-size:12px;font-weight:700;color:#1d4ed8;margin-bottom:6px;">Member Rate Schedule</div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #e5e7eb;">
                  <div><div style="font-size:12px;color:#374151;">🚑 Monthly ALS Membership</div><div style="font-size:11px;color:#6b7280;">Guaranteed ALS response with paramedics dispatched directly to you</div></div>
                  <span style="font-size:14px;font-weight:800;color:#16a34a;white-space:nowrap;margin-left:10px;">$20<span style="font-size:10px;font-weight:600;">/mo</span></span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #e5e7eb;">
                  <div><div style="font-size:12px;color:#374151;">🏥 Transport to Local Hospital (Panama)</div><div style="font-size:11px;color:#6b7280;">Emergency ground transport to nearest facility</div></div>
                  <span style="font-size:14px;font-weight:800;color:#16a34a;white-space:nowrap;margin-left:10px;">~$400</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid #e5e7eb;">
                  <div><div style="font-size:12px;color:#374151;">🏙️ Transport to Panama City</div><div style="font-size:11px;color:#6b7280;">Long-distance transport to city-based medical facilities</div></div>
                  <span style="font-size:14px;font-weight:800;color:#16a34a;white-space:nowrap;margin-left:10px;">~$950</span>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">
                  <div><div style="font-size:12px;color:#374151;">💊 Additional Services</div><div style="font-size:11px;color:#6b7280;">Call and mention your Costa Blanca Connect membership</div></div>
                  <span style="font-size:12px;font-weight:700;color:#1d4ed8;white-space:nowrap;margin-left:10px;">Member Discount</span>
                </div>
              </div>
              <div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:8px 12px;margin-bottom:10px;">
                <p style="font-size:11.5px;line-height:1.6;margin:0;color:#713f12;"><strong>Don't wait for an emergency to prepare for one.</strong> Take advantage of this exclusive promotion available only to Costa Blanca Connect members. Contact EMTS Panama today to register your household and lock in your member rates before you ever need them.</p>
              </div>
              <p style="font-size:11px;color:#6b7280;margin:0;line-height:1.5;">* Member pricing applies to Costa Blanca Connect registered users. Additional service fees may vary. Pricing excludes medications administered during transport. Contact EMTS Panama directly for a full schedule of member-discounted rates.</p>
            </div>

            <!-- Core Services Grid -->
            <div style="font-size:11px;font-weight:700;opacity:.6;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">What We Provide</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
              ${[
                ['🚑','ALS Response','Advanced Life Support on every call — IV, airway, cardiac monitoring'],
                ['👨‍⚕️','Paramedic at Every Call','A licensed paramedic & first responder respond together, every time'],
                ['🏥','Clinic in Buenaventura','Walk-in medical clinic on-site — non-emergency care & evaluation'],
                ['📱','Telehealth with Doctor','Virtual doctor consultations — right from your home, in English'],
                ['🫀','BLS / Basic Life Support','CPR, bleeding control, oxygen & stabilization for all emergencies'],
                ['🚐','Medical Transport','Safe, medically-supervised transport to hospital with your team'],
              ].map(([ic,name,desc]) => `
                <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:12px;">
                  <div style="font-size:22px;margin-bottom:5px;">${ic}</div>
                  <div style="font-size:12.5px;font-weight:800;margin-bottom:3px;">${name}</div>
                  <div style="font-size:11px;opacity:.8;line-height:1.4;">${desc}</div>
                </div>`).join('')}
            </div>

            <!-- Admin-editable service pricing -->
            ${emtsServices.length ? `
            <div style="font-size:11px;font-weight:700;opacity:.6;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">Service Pricing</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;">
              ${emtsServices.map(s=>`
                <div style="background:rgba(255,255,255,0.1);border-radius:10px;padding:10px 12px;display:flex;align-items:flex-start;gap:8px;">
                  <span style="font-size:18px;flex-shrink:0;">${s.icon||'🚑'}</span>
                  <div>
                    <div style="font-size:12px;font-weight:800;">${escHtml(s.name)}</div>
                    ${s.description ? `<div style="font-size:10.5px;opacity:.8;margin-top:1px;line-height:1.35;">${escHtml(s.description)}</div>` : ''}
                    ${s.cost ? `<div style="font-size:13px;font-weight:900;color:#fde68a;margin-top:4px;">${escHtml(s.cost)}</div>` : ''}
                  </div>
                </div>`).join('')}
            </div>` : ''}

            <!-- Game Plan CTA -->
            <div style="background:rgba(250,204,21,0.2);border:1px solid rgba(250,204,21,0.5);border-radius:10px;padding:12px 14px;margin-bottom:16px;">
              <div style="font-size:13px;font-weight:800;margin-bottom:5px;">📋 Have a Game Plan Before You Need One</div>
              <p style="font-size:12px;line-height:1.6;opacity:.9;margin:0 0 10px;">Don't wait for an emergency to figure out your options. Call EMTS Panama today to discuss a personalized plan for you and your family — before a crisis happens.</p>
              <a href="tel:+5076790-4807" style="display:block;text-align:center;padding:10px;background:white;color:#1d4ed8;border-radius:9px;font-size:13px;font-weight:800;text-decoration:none;">📞 Call Now to Make a Plan</a>
            </div>

            <!-- Call buttons -->
            <div style="display:flex;gap:8px;">
              <a href="tel:+5076790-4807" style="flex:1;text-align:center;padding:12px;background:white;color:#1d4ed8;border-radius:11px;font-size:13.5px;font-weight:800;text-decoration:none;">📞 507 6790-4807</a>
              <a href="https://www.instagram.com/emtspanama" target="_blank" style="flex:1;text-align:center;padding:12px;background:rgba(255,255,255,0.15);color:white;border-radius:11px;font-size:13.5px;font-weight:700;text-decoration:none;border:1.5px solid rgba(255,255,255,0.35);">📸 @emtspanama</a>
            </div>
          </div>
        </div>

        <!-- Tab: Call for Help -->
        <div id="frpanel-call" class="fr-tab-panel" style="padding:20px;display:none;">
          <div style="background:#fef2f2;border-radius:12px;padding:14px 16px;margin-bottom:16px;border:1px solid #fecaca;">
            <div style="font-size:13px;font-weight:700;color:#dc2626;margin-bottom:6px;">Step 1 — Opening Statement</div>
            <div style="font-size:13.5px;color:var(--text-dark);font-weight:600;">English: <span style="font-weight:400;">"This is an emergency. I need help at [your address]"</span></div>
            <div style="font-size:13.5px;color:#dc2626;font-weight:600;margin-top:4px;">Spanish: <span style="font-weight:400;color:var(--text-dark);">"Esta es una emergencia. Necesito ayuda en..."</span></div>
          </div>
          ${[
            {cat:'🔥 Fire / Fuego', color:'#ea580c', bg:'#fff7ed', border:'#fed7aa', rows:[
              ['There is a fire','Hay un incendio','Eye oon in-SEN-dee-oh'],
              ['My house is on fire','Mi casa está en llamas','Mee CAH-sah es-TAH en YA-mas'],
              ['Smoke inside','Hay humo adentro','Eye OO-moh ah-DEN-tro'],
              ['Person trapped','Hay una persona atrapada','Eye OO-nah per-SOH-nah ah-trah-PAH-dah'],
              ['Gas leak','Hay una fuga de gas','Eye OO-nah FOO-gah deh gahs'],
              ['Car accident','Hay un accidente de carro','Eye oon ahk-see-DEN-teh deh CAH-roh'],
            ]},
            {cat:'🚑 Medical / Médico', color:'#059669', bg:'#f0fdf4', border:'#bbf7d0', rows:[
              ['Not breathing','No está respirando','No es-TAH res-pee-RAN-doh'],
              ['Severe bleeding','Está sangrando mucho','Es-TAH san-GRAN-doh MOO-choh'],
              ['Unconscious','Está inconsciente','Es-TAH in-con-syen-TEE-ehn-teh'],
              ['Chest pain','Dolor en el pecho','Doh-LOR en el PEH-choh'],
              ['Allergic reaction','Reacción alérgica','Ree-ak-SEE-on ah-LER-hee-kah'],
              ['Broken bone','Hueso roto','WEH-soh ROH-toh'],
              ['Drowning','Persona ahogándose','Per-SOH-nah ah-oh-GAN-doh-seh'],
            ]},
            {cat:'👮 Police / Policía', color:'#1d4ed8', bg:'#eff6ff', border:'#bfdbfe', rows:[
              ['Break-in','Hay un robo','Eye oon ROH-boh'],
              ['Someone trying to hurt me','Alguien intenta hacerme daño','AHL-gyen in-TEN-tah ah-SER-meh DAHN-yoh'],
              ['Suspicious person','Hay una persona sospechosa','Eye OO-nah pair-SOH-nah soh-speh-CHOH-sah'],
              ['I was attacked','Fui agredido','Fwee ah-greh-DEE-doh'],
              ['Someone stole my belongings','Alguien se llevó mis cosas','AHL-gee-en seh yeh-BOH mees COH-sahs'],
            ]},
          ].map(s=>`
            <div style="margin-bottom:14px;">
              <div style="font-size:13px;font-weight:700;color:${s.color};margin-bottom:8px;">${s.cat}</div>
              <div style="display:flex;flex-direction:column;gap:5px;">
                ${s.rows.map(([en,es,ph])=>`
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;padding:9px 12px;background:${s.bg};border-radius:10px;border:1px solid ${s.border};">
                    <div style="font-size:12.5px;font-weight:600;color:var(--text-dark);">${en}</div>
                    <div><div style="font-size:12.5px;font-weight:700;color:${s.color};">${es}</div><div style="font-size:11px;color:var(--text-light);font-style:italic;">${ph}</div></div>
                  </div>`).join('')}
              </div>
            </div>`).join('')}
        </div>

        <!-- Tab: Be Prepared -->
        <div id="frpanel-prepared" class="fr-tab-panel" style="padding:20px;display:none;">
          ${[
            {title:'🔦 Flashlights', color:'#ea580c', bg:'#fff7ed', border:'#fed7aa', items:[
              'Keep at least 2 flashlights — one in living area, one in bedroom',
              'Include extra batteries or use rechargeable + power bank',
              'Headlamps are extremely useful — they free your hands',
              'Power outages are common in Panama beach communities',
            ]},
            {title:'💊 First Aid Kit — Essentials', color:'#059669', bg:'#f0fdf4', border:'#bbf7d0', items:[
              'Bandages (various sizes), gauze pads & roller gauze, tape',
              'Antiseptic wipes, tweezers, scissors, gloves',
              'Elastic bandage (ACE wrap), burn gel, pain relievers',
              'Allergy medication (antihistamine), saline solution',
              'CPR face shield, emergency blanket',
            ]},
            {title:'🩹 First Aid Kit — Advanced (Recommended)', color:'#7c3aed', bg:'#f5f3ff', border:'#ddd6fe', items:[
              'Tourniquet (quality — not imitation)',
              'QuickClot or hemostatic gauze',
              'Extra gloves, triangle bandage',
              'AED (Automated External Defibrillator)',
            ]},
            {title:'🚗 Vehicle Emergency Kit', color:'#1d4ed8', bg:'#eff6ff', border:'#bfdbfe', items:[
              'Flashlight, portable tire inflator, Fix-a-Flat or tire plug kit',
              'First aid kit, batteries, power bank',
              'Basic tools — being stuck on a Panama road is dangerous',
            ]},
            {title:'🔋 Backup Power & Generators', color:'#d97706', bg:'#fffbeb', border:'#fde68a', items:[
              'Keeps fridge running — protects food & temperature-sensitive medications',
              'Fans — critical for children, elderly & pets in Panama heat',
              'Portable oxygen equipment for respiratory needs',
              'Phone chargers & lights — stay connected during outages',
              'Always use generators with proper ventilation & safe fuel storage',
            ]},
            {title:'📱 Community Preparedness', color:'#0891b2', bg:'#ecfeff', border:'#a5f3fc', items:[
              'Create an Emergency WhatsApp group for your neighborhood',
              'Know if your community has an AED and exactly where it is',
              'AEDs dramatically increase cardiac arrest survival rates',
              'Know your community admin\'s emergency protocol (Munily, security, etc.)',
            ]},
          ].map(s=>`
            <div style="background:${s.bg};border:1px solid ${s.border};border-radius:14px;padding:16px;margin-bottom:12px;">
              <div style="font-size:14px;font-weight:700;color:${s.color};margin-bottom:10px;">${s.title}</div>
              <div style="display:flex;flex-direction:column;gap:6px;">
                ${s.items.map(i=>`<div style="display:flex;gap:8px;font-size:13px;color:var(--text-dark);line-height:1.5;"><span style="color:${s.color};flex-shrink:0;font-weight:700;">•</span>${i}</div>`).join('')}
              </div>
            </div>`).join('')}
        </div>

        <!-- Tab: Important Links -->
        <div id="frpanel-links" class="fr-tab-panel" style="padding:20px;display:none;">
          <div style="font-size:13px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:0.6px;margin-bottom:10px;">🌐 Utility &amp; Service Providers</div>
          <p style="font-size:13.5px;color:var(--text-mid);line-height:1.6;margin:0 0 16px;">Quick access to utility, weather, and service providers in Panama. Open in a new tab — check here during outages, storms, or service interruptions.</p>
          <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">
            ${[
              {
                emoji: '⚡', name: 'Naturgy Panamá', tagline: 'Power outages & service updates',
                desc: 'Follow their Facebook page for live outage notifications and scheduled maintenance windows in your area.',
                url: 'https://www.facebook.com/NaturgyPanama/', cta: 'Open Facebook Page →',
                bg: 'linear-gradient(135deg,#fff7ed,#fed7aa)', border: '#fb923c', accent: '#9a3412'
              },
              {
                emoji: '🌦️', name: 'IMHPA — Hidromet Panamá', tagline: 'Official weather & climate authority',
                desc: 'Forecasts, storm warnings, river levels, and hurricane season updates from the national weather service.',
                url: 'https://www.imhpa.gob.pa/es/', cta: 'Open IMHPA →',
                bg: 'linear-gradient(135deg,#eff6ff,#bfdbfe)', border: '#3b82f6', accent: '#1e40af'
              },
              {
                emoji: '💧', name: 'IDAAN', tagline: 'National water & sewer authority',
                desc: 'Report water service issues, check planned outages and maintenance, manage your account, or contact support.',
                url: 'https://www.idaan.gob.pa', cta: 'Open IDAAN →',
                bg: 'linear-gradient(135deg,#ecfeff,#a5f3fc)', border: '#06b6d4', accent: '#155e75'
              },
              {
                emoji: '📶', name: 'Mas Móvil', tagline: 'Mobile & home internet',
                desc: 'Check service status, recharge, manage your account, or contact support.',
                url: 'https://www.masmovilpanama.com', cta: 'Open Mas Móvil →',
                bg: 'linear-gradient(135deg,#f5f3ff,#ddd6fe)', border: '#8b5cf6', accent: '#5b21b6'
              },
              {
                emoji: '📺', name: 'Tigo Panamá', tagline: 'Internet, cable TV & mobile',
                desc: 'Service status, billing, technical support, and outage maps.',
                url: 'https://www.tigo.com.pa', cta: 'Open Tigo →',
                bg: 'linear-gradient(135deg,#eff6ff,#bae6fd)', border: '#0ea5e9', accent: '#075985'
              }
            ].map(l => `
              <a href="${l.url}" target="_blank" rel="noopener noreferrer" style="display:block;background:${l.bg};border:1.5px solid ${l.border};border-radius:14px;padding:16px;text-decoration:none;transition:transform 0.15s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform=''">
                <div style="display:flex;align-items:flex-start;gap:14px;">
                  <div style="font-size:32px;flex-shrink:0;line-height:1;">${l.emoji}</div>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:15px;font-weight:800;color:${l.accent};line-height:1.2;">${l.name}</div>
                    <div style="font-size:12px;color:${l.accent};opacity:0.8;margin-top:2px;font-weight:600;">${l.tagline}</div>
                    <div style="font-size:13px;color:var(--text-mid);margin-top:8px;line-height:1.5;">${l.desc}</div>
                    <div style="font-size:12.5px;color:${l.accent};font-weight:700;margin-top:10px;">${l.cta}</div>
                  </div>
                </div>
              </a>
            `).join('')}
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px;margin-bottom:20px;">
            <p style="font-size:12.5px;color:#059669;font-weight:700;margin:0 0 4px;">💡 Tip</p>
            <p style="font-size:12.5px;color:var(--text-mid);line-height:1.55;margin:0;">For real-time power-outage updates, follow Naturgy Panamá on Facebook directly so you get notifications even when the app is closed. Same for IMHPA storm alerts.</p>
          </div>

          <div style="background:linear-gradient(135deg,#dc2626,#ef4444);border-radius:14px;padding:20px;color:white;margin-bottom:16px;text-align:center;">
            <div style="font-size:32px;margin-bottom:8px;">📄</div>
            <div style="font-size:18px;font-weight:800;margin-bottom:14px;">Panama Emergency Guide</div>
            <a href="/panama-emergency-guide.pdf" download style="display:inline-block;padding:12px 28px;background:white;color:#dc2626;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;">⬇️ Download Full Guide (PDF)</a>
          </div>

          <div style="background:linear-gradient(135deg,#dc2626,#b91c1c);border-radius:14px;padding:22px;text-align:center;color:white;">
            <div style="width:170px;height:200px;background:white;border-radius:20px;margin:0 auto 16px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;padding:14px;box-sizing:border-box;"><img src="/images/ierf-logo.png" alt="IERF Response" style="width:100%;height:100%;object-fit:contain;display:block;"></div>
            <p style="font-size:18px;font-weight:900;margin:0 0 8px;letter-spacing:-0.3px;">When seconds count, training saves lives.</p>
            <p style="font-size:13px;line-height:1.6;margin:0 0 14px;color:rgba(255,255,255,0.92);">IERF Response is on the ground in Panama — training local first responders, equipping rural communities, and producing free preparedness resources like the guide above. Your donation directly funds:</p>
            <div style="background:rgba(255,255,255,0.12);border-radius:10px;padding:12px 16px;margin-bottom:14px;text-align:left;">
              <div style="font-size:12.5px;line-height:1.7;color:white;">
                <div style="display:flex;gap:8px;"><span style="flex-shrink:0;">🚑</span><span><strong>First-responder training</strong> for volunteers in underserved Panama communities</span></div>
                <div style="display:flex;gap:8px;margin-top:6px;"><span style="flex-shrink:0;">🩹</span><span><strong>Life-saving equipment</strong> — AEDs, oxygen, trauma kits</span></div>
                <div style="display:flex;gap:8px;margin-top:6px;"><span style="flex-shrink:0;">📘</span><span><strong>Free preparedness guides</strong> distributed across Panama in English &amp; Spanish</span></div>
                <div style="display:flex;gap:8px;margin-top:6px;"><span style="flex-shrink:0;">🇵🇦</span><span><strong>Disaster readiness</strong> for communities like Costa Blanca Villas</span></div>
              </div>
            </div>
            <p style="font-size:13px;font-weight:700;margin:0 0 14px;color:white;">Every dollar trains someone who can save a life. Will you help?</p>
            <a href="https://ierfresponse.org/donate/" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 36px;background:white;color:#dc2626;border-radius:12px;font-size:15px;font-weight:900;text-decoration:none;box-shadow:0 4px 14px rgba(0,0,0,0.2);">Donate Now →</a>
            <p style="font-size:11px;color:rgba(255,255,255,0.75);margin:12px 0 0;">100% volunteer-run · Every gift makes a difference</p>
          </div>
        </div>

        <!-- Tab: My Info -->
        <div id="frpanel-myinfo" class="fr-tab-panel" style="padding:20px;display:none;">
          <p style="font-size:13.5px;color:var(--text-mid);line-height:1.6;margin:0 0 16px;">Fill in your personal emergency information. This is stored privately on your device and can be shown to first responders in an emergency.</p>
          <div style="display:flex;flex-direction:column;gap:12px;">
            ${[
              ['Blood Type','frmi-blood','text','e.g. A+, O-, B+'],
              ['Severe Allergies','frmi-allergies','text','e.g. Penicillin, bee stings'],
              ['Current Medications','frmi-meds','text','e.g. Metformin 500mg, Lisinopril'],
              ['Family Doctor & Phone','frmi-doctor','text','e.g. Dr. Gomez — 507 123-4567'],
              ['Emergency Contact','frmi-contact','text','Name & phone number'],
              ['Insurance Provider & Policy #','frmi-insurance','text','e.g. Blue Cross #12345'],
              ['Preferred Hospital','frmi-hospital','text','e.g. Hospital San Benito, Penonomé'],
            ].map(([label, id, type, placeholder])=>`
              <div>
                <label style="font-size:12.5px;font-weight:700;color:var(--text-dark);display:block;margin-bottom:5px;">${label}</label>
                <input id="${id}" type="${type}" placeholder="${placeholder}" style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:13.5px;font-family:inherit;box-sizing:border-box;" />
              </div>`).join('')}
            <div>
              <label style="font-size:12.5px;font-weight:700;color:var(--text-dark);display:block;margin-bottom:8px;">Medical Conditions</label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                ${['Diabetes','Epilepsy','Hemophilia','Heart Condition','Asthma','Other'].map(c=>`
                  <label style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f8fafc;border-radius:10px;border:1.5px solid var(--border);font-size:13px;cursor:pointer;">
                    <input type="checkbox" id="frmi-cond-${c.toLowerCase().replace(/\s/g,'')}" style="width:16px;height:16px;" /> ${c}
                  </label>`).join('')}
              </div>
            </div>
            <button onclick="saveFRMyInfo()" style="width:100%;padding:13px;background:#1d4ed8;color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">💾 Save My Emergency Info</button>
            <button onclick="generateEmergencyCard()" style="width:100%;padding:13px;background:linear-gradient(135deg,#dc2626,#b91c1c);color:white;border:none;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">📲 Generate Emergency Card (English / Español)</button>
          </div>
        </div>

      </div>

    </div>
  `;
  switchFRTab('services');
  loadFRMyInfo();
  lucide.createIcons();
}

function saveFRMyInfo() {
  const fields = ['blood','allergies','meds','doctor','contact','insurance','hospital'];
  const data = {};
  fields.forEach(f => { data[f] = document.getElementById('frmi-' + f)?.value || ''; });
  const conds = ['diabetes','epilepsy','hemophilia','heartcondition','asthma','other'];
  data.conditions = conds.filter(c => document.getElementById('frmi-cond-' + c)?.checked);
  localStorage.setItem('frMyInfo', JSON.stringify(data));
  showToast('Emergency info saved!');
}

function loadFRMyInfo() {
  try {
    const data = JSON.parse(localStorage.getItem('frMyInfo') || '{}');
    ['blood','allergies','meds','doctor','contact','insurance','hospital'].forEach(f => {
      const el = document.getElementById('frmi-' + f);
      if (el && data[f]) el.value = data[f];
    });
    (data.conditions || []).forEach(c => {
      const el = document.getElementById('frmi-cond-' + c);
      if (el) el.checked = true;
    });
  } catch(e) {}
}

function generateEmergencyCard() {
  const data = JSON.parse(localStorage.getItem('frMyInfo') || '{}');
  const fieldDefs = [
    { en: 'Blood Type', es: 'Tipo de Sangre', key: 'blood' },
    { en: 'Severe Allergies', es: 'Alergias Graves', key: 'allergies' },
    { en: 'Medications', es: 'Medicamentos', key: 'meds' },
    { en: 'Emergency Contact', es: 'Contacto Emergencia', key: 'contact' },
    { en: 'Doctor & Phone', es: 'Medico de Familia', key: 'doctor' },
    { en: 'Insurance', es: 'Seguro Medico', key: 'insurance' },
    { en: 'Preferred Hospital', es: 'Hospital Preferido', key: 'hospital' },
  ];
  const filled = fieldDefs.filter(f => data[f.key]);
  const hasConds = data.conditions && data.conditions.length;
  if (!filled.length && !hasConds) { showToast('Fill in your emergency info first, then generate the card.'); return; }

  // Wallet / landscape — credit card ratio 3.375 × 2.125 inches @ 200dpi
  const W = 680, H = 428, leftW = 160, footerH = 32, scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = W * scale; canvas.height = H * scale;
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);

  // Card rounded background
  const drawRR = (x, yy, w, h, r) => {
    ctx.beginPath(); ctx.moveTo(x+r,yy);
    ctx.lineTo(x+w-r,yy); ctx.quadraticCurveTo(x+w,yy,x+w,yy+r);
    ctx.lineTo(x+w,yy+h-r); ctx.quadraticCurveTo(x+w,yy+h,x+w-r,yy+h);
    ctx.lineTo(x+r,yy+h); ctx.quadraticCurveTo(x,yy+h,x,yy+h-r);
    ctx.lineTo(x,yy+r); ctx.quadraticCurveTo(x,yy,x+r,yy); ctx.closePath();
  };
  ctx.fillStyle = '#fff'; drawRR(0, 0, W, H, 18); ctx.fill();

  // Left blue panel
  const lg = ctx.createLinearGradient(0, 0, 0, H);
  lg.addColorStop(0, '#1e3a8a'); lg.addColorStop(1, '#2563eb');
  ctx.fillStyle = lg;
  ctx.save(); ctx.beginPath();
  ctx.moveTo(18, 0); ctx.lineTo(leftW, 0); ctx.lineTo(leftW, H);
  ctx.lineTo(18, H); ctx.quadraticCurveTo(0, H, 0, H-18);
  ctx.lineTo(0, 18); ctx.quadraticCurveTo(0, 0, 18, 0); ctx.closePath();
  ctx.fill(); ctx.restore();

  // Star of Life (white circle bg + red 3-rect star)
  const solCx = leftW / 2, solCy = 90, solR = 38;
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(solCx, solCy, solR + 6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ef4444';
  const armW = solR * 0.34, armH = solR * 1.85;
  for (let i = 0; i < 3; i++) {
    ctx.save(); ctx.translate(solCx, solCy); ctx.rotate(i * Math.PI / 3);
    ctx.fillRect(-armW/2, -armH/2, armW, armH); ctx.restore();
  }
  // Snake (Rod of Asclepius — simplified)
  ctx.strokeStyle = 'white'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(solCx, solCy - solR * 0.75);
  ctx.bezierCurveTo(solCx + solR*0.22, solCy - solR*0.3, solCx - solR*0.22, solCy + solR*0.1, solCx, solCy + solR*0.75);
  ctx.stroke();
  // Staff
  ctx.strokeStyle = 'white'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.moveTo(solCx, solCy - solR*0.8); ctx.lineTo(solCx, solCy + solR*0.8); ctx.stroke();

  // Left panel text
  ctx.textAlign = 'center';
  ctx.fillStyle = 'white'; ctx.font = 'bold 10.5px system-ui,Arial';
  ctx.fillText('EMERGENCY', leftW/2, 148);
  ctx.fillText('MEDICAL INFO', leftW/2, 162);
  ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.font = '8.5px system-ui,Arial';
  ctx.fillText('INFORMACION', leftW/2, 178);
  ctx.fillText('MEDICA DE EMERGENCIA', leftW/2, 190);

  ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(14, 202); ctx.lineTo(leftW - 14, 202); ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '8px system-ui,Arial';
  ctx.fillText('Show to first responder', leftW/2, 218);
  ctx.fillText('Mostrar al socorrista', leftW/2, 230);
  ctx.fillText('en una emergencia', leftW/2, 242);

  ctx.strokeStyle = 'rgba(255,255,255,.2)';
  ctx.beginPath(); ctx.moveTo(14, 254); ctx.lineTo(leftW - 14, 254); ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = 'bold 8px system-ui,Arial';
  ctx.fillText('Costa Blanca Connect', leftW/2, 270);
  ctx.fillText('Costa Blanca Villas', leftW/2, 282);
  ctx.fillText(new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}), leftW/2, 296);
  ctx.textAlign = 'left';

  // Right panel fields — 2 columns
  const fitText = (txt, maxW) => {
    let t = String(txt);
    while (ctx.measureText(t).width > maxW && t.length > 4) t = t.slice(0,-3) + '…';
    return t;
  };

  const rX = leftW + 10, rW = W - leftW - 14;
  const colW = (rW / 2) - 4;
  const fH = 50, fPad = 4;
  const left4 = filled.slice(0, 4), right3 = filled.slice(4);

  const drawField = (f, x, y, w) => {
    ctx.fillStyle = '#f1f5f9'; drawRR(x, y, w, fH - fPad, 6); ctx.fill();
    ctx.fillStyle = '#1d4ed8'; ctx.fillRect(x, y, 3, fH - fPad);
    ctx.font = 'bold 8px system-ui,Arial'; ctx.fillStyle = '#64748b';
    ctx.fillText((f.en + ' / ' + f.es).toUpperCase(), x + 8, y + 13);
    ctx.font = 'bold 13px system-ui,Arial'; ctx.fillStyle = '#0f172a';
    ctx.fillText(fitText(data[f.key], w - 16), x + 8, y + 34);
  };

  const startY = 14;
  left4.forEach((f, i) => drawField(f, rX, startY + i * fH, colW));
  right3.forEach((f, i) => drawField(f, rX + colW + 8, startY + i * fH, colW));

  // Medical conditions — spans below both columns if needed
  if (hasConds) {
    const condMap = { diabetes:'Diabetes', epilepsy:'Epilepsy', hemophilia:'Hemophilia', heartcondition:'Heart Condition', asthma:'Asthma', other:'Other' };
    const condY = startY + Math.max(left4.length, right3.length) * fH + 4;
    const condH2 = 44;
    ctx.fillStyle = '#fef2f2'; drawRR(rX, condY, rW, condH2, 6); ctx.fill();
    ctx.strokeStyle = '#fca5a5'; ctx.lineWidth = 1; drawRR(rX, condY, rW, condH2, 6); ctx.stroke();
    ctx.fillStyle = '#dc2626'; ctx.fillRect(rX, condY, 3, condH2);
    ctx.font = 'bold 8px system-ui,Arial'; ctx.fillStyle = '#dc2626';
    ctx.fillText('MEDICAL CONDITIONS / CONDICIONES MEDICAS', rX + 8, condY + 13);
    ctx.font = 'bold 12px system-ui,Arial'; ctx.fillStyle = '#0f172a';
    ctx.fillText(fitText(data.conditions.map(c => condMap[c]||c).join('  ·  '), rW - 16), rX + 8, condY + 33);
  }

  // Footer strip (right side only)
  ctx.fillStyle = '#1e3a8a';
  ctx.save(); ctx.beginPath();
  ctx.moveTo(leftW, H - footerH); ctx.lineTo(W - 18, H - footerH);
  ctx.quadraticCurveTo(W, H - footerH, W, H - footerH + 4);
  ctx.lineTo(W, H - 18); ctx.quadraticCurveTo(W, H, W - 18, H);
  ctx.lineTo(leftW, H); ctx.closePath(); ctx.fill(); ctx.restore();
  ctx.font = '8.5px system-ui,Arial'; ctx.fillStyle = 'rgba(255,255,255,.6)';
  ctx.textAlign = 'center';
  ctx.fillText('Stored privately on this device only · Solo en este dispositivo privadamente', leftW + (W - leftW)/2, H - footerH + 13);
  ctx.fillText('In emergency show this card · En emergencia muestre esta tarjeta', leftW + (W - leftW)/2, H - footerH + 25);
  ctx.textAlign = 'left';

  // Show modal
  const dataUrl = canvas.toDataURL('image/png');
  const modal = document.createElement('div');
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:14px;overflow-y:auto;';
  const img = document.createElement('img');
  img.src = dataUrl;
  img.style.cssText = 'max-width:100%;border-radius:14px;box-shadow:0 8px 40px rgba(0,0,0,0.6);';
  const tip = document.createElement('div');
  tip.style.cssText = 'color:white;text-align:center;font-size:13px;line-height:1.7;max-width:360px;font-family:inherit;';
  tip.innerHTML = '<strong style="font-size:15px;">Save to your phone 📱</strong><br>Mobile: <strong>long-press the card → Save Image</strong><br>Desktop: <strong>right-click → Save image as</strong>';
  const dlBtn = document.createElement('a');
  dlBtn.href = dataUrl; dlBtn.download = 'emergency-medical-card.png';
  dlBtn.style.cssText = 'padding:12px 32px;background:#1d4ed8;color:white;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;display:inline-block;font-family:inherit;';
  dlBtn.textContent = '⬇️ Download Card';
  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕ Close'; closeBtn.onclick = () => modal.remove();
  closeBtn.style.cssText = 'padding:9px 24px;background:rgba(255,255,255,.1);color:white;border:1px solid rgba(255,255,255,.3);border-radius:10px;font-size:13px;cursor:pointer;font-family:inherit;';
  modal.append(img, tip, dlBtn, closeBtn);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
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

  renderCartListings();
  renderTransportFares();
  if (window.lucide) lucide.createIcons();
}

// ─── Golf Cart & Transport (DB-backed) ───────────────────────────
let editingCartId = null;
let editingCartImageRemoved = false;

function openCartListingForm(cart) {
  editingCartId = cart?.id || null;
  editingCartImageRemoved = false;
  const isEdit = !!cart;
  const existingImg = cart?.image_url || '';
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:400;display:flex;align-items:center;justify-content:center;padding:20px;';
  overlay.innerHTML = `
    <div style="background:white;border-radius:20px;width:min(460px,100%);padding:28px;box-shadow:0 24px 60px rgba(0,0,0,0.3);">
      <div style="font-size:24px;margin-bottom:6px;">🛺</div>
      <h3 style="font-size:17px;font-weight:800;margin-bottom:4px;color:#0d1b2a;">${isEdit ? 'Edit Your Cart Listing' : 'List Your Golf Cart'}</h3>
      <p style="font-size:13px;color:#4a6378;margin-bottom:18px;">Let neighbors rent your cart. You handle the arrangement directly.</p>
      <div style="display:flex;flex-direction:column;gap:12px;margin-bottom:16px;">
        <div>
          <label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Photo</label>
          <div id="cartImgPreview" onclick="document.getElementById('cartImgInput').click()" style="width:100%;height:130px;border-radius:10px;border:${existingImg?'1.5px solid #dde4ed':'2px dashed #dde4ed'};background:#f8fafc;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;font-size:12.5px;color:#94a3b8;font-weight:600;${existingImg?'padding:0;':''}">
            ${existingImg ? `<img src="${existingImg}" style="width:100%;height:100%;object-fit:cover;">` : '📷 Tap to add photo'}
          </div>
          ${existingImg ? `<button type="button" onclick="clearCartImage()" style="margin-top:6px;background:none;border:none;color:var(--coral);font-size:12px;font-weight:600;cursor:pointer;padding:0;font-family:inherit;">Remove photo</button>` : ''}
          <input id="cartImgInput" type="file" accept="image/*" style="display:none;" onchange="previewCartImage(this)" />
        </div>
        <div><label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Cart description</label>
          <input id="cartDesc" type="text" placeholder="e.g. 4-seater, 2023, good condition" value="${escHtml(cart?.make_model || '')}" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" /></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div><label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Rate</label>
            <input id="cartRate" type="text" placeholder="e.g. $25/day" value="${escHtml(cart?.rate || '')}" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" /></div>
          <div><label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">WhatsApp</label>
            <input id="cartContact" type="text" placeholder="+507 6790-4807 or +1 555-123-4567" value="${escHtml(cart?.phone || '')}" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" />
            <div style="font-size:11px;color:#6b7280;margin-top:4px;">Include country code (+507 Panama, +1 USA/Canada)</div></div>
        </div>
        <div><label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Notes</label>
          <input id="cartNotes" type="text" placeholder="e.g. Weekends only" value="${escHtml(cart?.notes || '')}" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" /></div>
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="this.closest('[style*=fixed]').remove()" style="flex:1;padding:11px;background:#f0f3f7;border:none;border-radius:10px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;">Cancel</button>
        <button onclick="submitCartListing(this)" style="flex:1;padding:11px;background:#0077B6;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;">${isEdit ? 'Save Changes' : 'Post Listing'}</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function clearCartImage() {
  editingCartImageRemoved = true;
  const prev = document.getElementById('cartImgPreview');
  if (prev) {
    prev.style.cssText = 'width:100%;height:130px;border-radius:10px;border:2px dashed #dde4ed;background:#f8fafc;display:flex;align-items:center;justify-content:center;cursor:pointer;overflow:hidden;font-size:12.5px;color:#94a3b8;font-weight:600;';
    prev.innerHTML = '📷 Tap to add photo';
  }
  const input = document.getElementById('cartImgInput');
  if (input) input.value = '';
}

function previewCartImage(input) {
  if (!input.files?.[0]) return;
  const reader = new FileReader();
  reader.onload = e => {
    const prev = document.getElementById('cartImgPreview');
    prev.style.cssText = prev.style.cssText + ';padding:0;border-style:solid;';
    prev.innerHTML = `<img src="${e.target.result}" style="width:100%;height:100%;object-fit:cover;">`;
  };
  reader.readAsDataURL(input.files[0]);
}

async function submitCartListing(btn) {
  const makeModel = document.getElementById('cartDesc')?.value.trim();
  const rate = document.getElementById('cartRate')?.value.trim();
  const phone = document.getElementById('cartContact')?.value.trim();
  const notes = document.getElementById('cartNotes')?.value.trim();
  if (!makeModel) { showToast('Cart description required'); return; }
  btn.disabled = true;

  let image = null;
  const file = document.getElementById('cartImgInput')?.files?.[0];
  if (file) {
    image = await readAndCompress(file);
  }

  const isEdit = !!editingCartId;
  const url = isEdit ? `/api/transport/carts/${editingCartId}` : '/api/transport/carts';
  const method = isEdit ? 'PATCH' : 'POST';
  const body = { makeModel, rate, phone, notes, image };
  if (isEdit && editingCartImageRemoved && !image) body.removeImage = true;

  const res = await fetch(url, { method, credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body) });
  btn.closest('[style*=fixed]').remove();
  editingCartId = null;
  editingCartImageRemoved = false;
  if (res.ok) { await renderCartListings(); showToast(isEdit ? 'Listing updated!' : 'Cart listed!'); }
  else showToast(isEdit ? 'Could not save changes.' : 'Could not post listing.');
}

async function renderCartListings() {
  const el = document.getElementById('cartListings');
  if (!el) return;
  const carts = await fetchJSON('/api/transport/carts') || [];
  if (!carts.length) { el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-light);font-size:13.5px;">No carts listed yet — be the first!</div>'; return; }
  window.__cartListingsCache = carts;
  el.innerHTML = carts.map(c => `
    <div style="background:#f8fafc;border-radius:12px;border:1px solid var(--border);overflow:hidden;">
      ${c.image_url ? `<img src="${c.image_url}" style="width:100%;height:160px;object-fit:cover;display:block;">` : ''}
      <div style="display:flex;align-items:flex-start;gap:12px;padding:14px;">
      <div style="width:38px;height:38px;border-radius:10px;background:${c.avatar_hex||'#0077B6'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;">${c.initials||'?'}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;color:var(--text-dark);">🛺 ${escHtml(c.make_model)}</div>
        <div style="display:flex;gap:12px;margin-top:4px;flex-wrap:wrap;">
          ${c.rate ? `<span style="font-size:12.5px;color:#16a34a;font-weight:700;">💵 ${escHtml(c.rate)}</span>` : ''}
          ${c.notes ? `<span style="font-size:12.5px;color:var(--text-mid);">📝 ${escHtml(c.notes)}</span>` : ''}
        </div>
        <div style="font-size:12px;color:var(--text-light);margin-top:4px;">Posted by ${escHtml(c.owner_name)} · ${relativeTime(c.created_at)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0;">
        ${c.phone ? `<a href="https://wa.me/${c.phone.replace(/\D/g,'')}?text=${encodeURIComponent(`Hi! I saw your golf cart "${c.make_model}" listed on Costa Blanca Connect — is it available?`)}" target="_blank" rel="noopener" style="padding:7px 12px;background:#25D366;color:white;border-radius:8px;font-size:12.5px;font-weight:700;text-decoration:none;white-space:nowrap;">💬 WhatsApp</a>` : ''}
        ${currentUser && (c.owner_id === currentUser.id || currentUser.role === 'admin') ? `
          <button onclick="editCart('${c.id}')" style="padding:6px 12px;background:#e0f2fe;color:#0369a1;border:none;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">✏️ Edit</button>
          <button onclick="deleteCart('${c.id}')" style="padding:6px 12px;background:#fee2e2;color:#b91c1c;border:none;border-radius:8px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">🗑 Remove</button>
        ` : ''}
      </div>
    </div></div>`).join('');
}

async function deleteCart(id) {
  if (!confirm('Remove this listing?')) return;
  const res = await fetch(`/api/transport/carts/${id}`, { method:'DELETE', credentials:'include' });
  if (res.ok) { await renderCartListings(); showToast('Listing removed.'); }
}

function editCart(id) {
  const cart = (window.__cartListingsCache || []).find(c => c.id === id);
  if (!cart) { showToast('Listing not found.'); return; }
  openCartListingForm(cart);
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
        <div><label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Transport type</label>
          <select id="tpType" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;">
            <option value="Taxi">🚕 Taxi</option><option value="Bus">🚌 Bus</option><option value="Private Driver">🚗 Private Driver</option>
          </select></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div><label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">From</label>
            <input id="tpFrom" type="text" placeholder="e.g. Costa Blanca" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" /></div>
          <div><label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">To</label>
            <input id="tpTo" type="text" placeholder="e.g. PTY Airport" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" /></div>
        </div>
        <div><label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Cost</label>
          <input id="tpCost" type="text" placeholder="e.g. $65" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" /></div>
        <div><label style="font-size:12.5px;font-weight:600;color:#2d3748;display:block;margin-bottom:5px;">Notes (optional)</label>
          <input id="tpNotes" type="text" placeholder="e.g. driver contact, took ~2.5 hrs" style="width:100%;padding:10px 12px;border:1.5px solid #dde4ed;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#f8fafc;box-sizing:border-box;" /></div>
      </div>
      <div style="display:flex;gap:10px;">
        <button onclick="this.closest('[style*=fixed]').remove()" style="flex:1;padding:11px;background:#f0f3f7;border:none;border-radius:10px;font-size:14px;font-weight:600;font-family:inherit;cursor:pointer;">Cancel</button>
        <button onclick="submitTransportPost(this)" style="flex:1;padding:11px;background:#f57c00;color:white;border:none;border-radius:10px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;">Post Fare</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

async function submitTransportPost(btn) {
  const fromPlace = document.getElementById('tpFrom')?.value.trim();
  const toPlace = document.getElementById('tpTo')?.value.trim();
  const fare = document.getElementById('tpCost')?.value.trim();
  const transportType = document.getElementById('tpType')?.value;
  const notes = document.getElementById('tpNotes')?.value.trim();
  if (!fromPlace || !toPlace || !fare) { showToast('From, to, and cost are required'); return; }
  btn.disabled = true;
  const res = await fetch('/api/transport/fares', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ fromPlace, toPlace, fare, transportType, notes }) });
  btn.closest('[style*=fixed]').remove();
  if (res.ok) { await renderTransportFares(); showToast('Fare posted — thanks!'); }
  else showToast('Could not post fare.');
}

const typeEmoji = { 'Taxi': '🚕', 'Bus': '🚌', 'Private Driver': '🚗' };

async function renderTransportFares() {
  const el = document.getElementById('transportPosts');
  if (!el) return;
  const fares = await fetchJSON('/api/transport/fares') || [];
  if (!fares.length) { el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-light);font-size:13.5px;">No fares posted yet — share what you paid!</div>'; return; }
  el.innerHTML = fares.map(p => `
    <div style="display:flex;align-items:flex-start;gap:12px;padding:14px;background:#f8fafc;border-radius:12px;border:1px solid var(--border);">
      <div style="width:38px;height:38px;border-radius:10px;background:${p.avatar_hex||'#f57c00'};display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:white;flex-shrink:0;">${p.initials||'?'}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:14px;font-weight:700;color:var(--text-dark);">${typeEmoji[p.transport_type]||'🚗'} ${escHtml(p.from_place)} → ${escHtml(p.to_place)}</div>
        <div style="margin-top:4px;"><span style="font-size:13.5px;color:#16a34a;font-weight:800;">💵 ${escHtml(p.fare)}</span></div>
        ${p.notes ? `<div style="font-size:12.5px;color:var(--text-mid);margin-top:3px;">💬 ${escHtml(p.notes)}</div>` : ''}
        <div style="font-size:11.5px;color:var(--text-light);margin-top:4px;">Posted by ${escHtml(p.author_name)} · ${relativeTime(p.created_at)}${currentUser && (p.author_id === currentUser.id || currentUser.role === 'admin') ? ` · <span style="cursor:pointer" onclick="deleteFare('${p.id}')">🗑 Remove</span>` : ''}</div>
      </div>
    </div>`).join('');
}

async function deleteFare(id) {
  if (!confirm('Remove this fare?')) return;
  const res = await fetch(`/api/transport/fares/${id}`, { method:'DELETE', credentials:'include' });
  if (res.ok) { await renderTransportFares(); showToast('Removed.'); }
}

// ─── Section Headers ─────────────────────────────────────────────
const sectionMeta = {
  feed: { title: 'Neighborhood Feed', desc: 'What\'s happening in Costa Blanca Villas right now', emoji: '<img src="/logo.png" style="width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">' },
  marketplace: { title: 'Marketplace', desc: 'Buy, sell, and give away items with neighbors', emoji: '🛒' },
  events: { title: 'Events', desc: 'What\'s coming up in Costa Blanca Villas & Farallón', emoji: '📅' },
  safety: { title: 'Safety & Alerts', desc: 'Share safety & security concerns with neighbors. For immediate response in Costa Blanca Villas, contact the Gate Guard via the Munity app. Facilities concerns go directly to Decameron management.', emoji: '🛡️' },
  businesses: { title: 'Business Directory', desc: 'Local restaurants and services near Farallón', emoji: '🍽️' },
  neighbors: { title: 'My Neighbors', desc: 'Verified residents in Costa Blanca Villas', emoji: '👋' },
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
function buildPostShareUrl(postId) {
  const url = new URL(window.location.href);
  url.hash = '';
  url.search = '';
  url.searchParams.set('post', postId);
  return url.toString();
}

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (_) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;left:-1000px;opacity:0;';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch (_) { return false; }
}

function handleShare(postId) {
  openShareModal(postId);
}

function openShareModal(postId) {
  const existing = document.getElementById('shareModal');
  if (existing) existing.remove();
  const shareUrl = buildPostShareUrl(postId);
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  const snippet = (card?.querySelector('.post-content, .feed-content, [class*="content"]')?.textContent || '').trim().slice(0, 140);
  const waText = encodeURIComponent(`${snippet ? snippet + ' — ' : ''}Check out this post on Costa Blanca Connect: ${shareUrl}`);
  const emailSubj = encodeURIComponent('From Costa Blanca Connect');
  const emailBody = encodeURIComponent(`${snippet ? snippet + '\n\n' : ''}${shareUrl}`);

  const overlay = document.createElement('div');
  overlay.id = 'shareModal';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.6);z-index:1000;display:flex;align-items:center;justify-content:center;padding:16px;';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:white;border-radius:16px;width:min(420px,100%);overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,0.3);">
      <div style="padding:18px 20px;border-bottom:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
        <div style="font-size:16px;font-weight:800;color:#0d1b2a;">📤 Share this post</div>
        <button onclick="document.getElementById('shareModal').remove()" style="background:#f1f5f9;border:none;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:16px;color:#475569;">×</button>
      </div>
      <div style="padding:14px 16px;display:flex;flex-direction:column;gap:8px;">
        <button onclick="shareToFeed('${postId}')" style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:#eff6ff;border:1.5px solid #bfdbfe;border-radius:10px;cursor:pointer;font-family:inherit;text-align:left;width:100%;">
          <span style="font-size:22px;">📰</span>
          <div style="flex:1;"><div style="font-size:14px;font-weight:700;color:#1e3a8a;">Share to Community Feed</div><div style="font-size:12px;color:#3b82f6;">Posts to your feed with a preview of this post</div></div>
        </button>
        <a href="https://wa.me/?text=${waText}" target="_blank" rel="noopener" onclick="document.getElementById('shareModal').remove()" style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:#f0fdf4;border:1.5px solid #bbf7d0;border-radius:10px;text-decoration:none;font-family:inherit;">
          <span style="font-size:22px;">💬</span>
          <div style="flex:1;"><div style="font-size:14px;font-weight:700;color:#166534;">WhatsApp</div><div style="font-size:12px;color:#16a34a;">Send to a contact or group</div></div>
        </a>
        <a href="mailto:?subject=${emailSubj}&body=${emailBody}" onclick="document.getElementById('shareModal').remove()" style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:#fff7ed;border:1.5px solid #fed7aa;border-radius:10px;text-decoration:none;font-family:inherit;">
          <span style="font-size:22px;">✉️</span>
          <div style="flex:1;"><div style="font-size:14px;font-weight:700;color:#9a3412;">Email</div><div style="font-size:12px;color:#ea580c;">Open your email app</div></div>
        </a>
        <button onclick="copyShareUrl('${postId}')" style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:#f8fafc;border:1.5px solid #e2e8f0;border-radius:10px;cursor:pointer;font-family:inherit;text-align:left;width:100%;">
          <span style="font-size:22px;">📋</span>
          <div style="flex:1;"><div style="font-size:14px;font-weight:700;color:#0d1b2a;">Copy Link</div><div style="font-size:12px;color:#64748b;">Paste anywhere</div></div>
        </button>
        ${navigator.share ? `<button onclick="nativeShare('${postId}')" style="display:flex;align-items:center;gap:14px;padding:12px 14px;background:#f5f3ff;border:1.5px solid #ddd6fe;border-radius:10px;cursor:pointer;font-family:inherit;text-align:left;width:100%;">
          <span style="font-size:22px;">📲</span>
          <div style="flex:1;"><div style="font-size:14px;font-weight:700;color:#5b21b6;">More Apps…</div><div style="font-size:12px;color:#8b5cf6;">Open your device's share menu</div></div>
        </button>` : ''}
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function copyShareUrl(postId) {
  const url = buildPostShareUrl(postId);
  const ok = await copyToClipboard(url);
  document.getElementById('shareModal')?.remove();
  showToast(ok ? 'Link copied to clipboard! 🔗' : 'Could not copy — try long-pressing the URL.');
}

async function nativeShare(postId) {
  const url = buildPostShareUrl(postId);
  try { await navigator.share({ title: 'Costa Blanca Connect', url }); } catch (e) {}
  document.getElementById('shareModal')?.remove();
}

async function shareToFeed(postId) {
  document.getElementById('shareModal')?.remove();
  const note = prompt('Add a note (optional):', '') ?? '';
  const res = await fetch('/api/posts', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'general', content: note.trim(), sharedPostId: postId })
  });
  if (res.ok) {
    showToast('Shared to your feed! 📰');
    if (typeof loadPosts === 'function') await loadPosts();
    else if (typeof navigate === 'function') navigate('feed');
  } else {
    const err = await res.json().catch(() => ({}));
    showToast(err.error || 'Could not share.');
  }
}

function focusSharedPostFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('post');
  if (!id) return;
  let attempts = 0;
  const tryScroll = () => {
    const el = document.querySelector(`[data-post-id="${id}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.transition = 'box-shadow 0.4s ease';
      el.style.boxShadow = '0 0 0 3px rgba(0,119,182,0.45)';
      setTimeout(() => { el.style.boxShadow = ''; }, 2400);
      const url = new URL(window.location.href);
      url.searchParams.delete('post');
      window.history.replaceState({}, '', url.toString());
    } else if (attempts++ < 20) {
      setTimeout(tryScroll, 250);
    }
  };
  tryScroll();
}

// ─── Avatar Upload ───────────────────────────────────────────────
function openImageCropper(file, { aspectRatio, circular, onCrop }) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:99999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:16px;';

    const PREVIEW_W = Math.min(window.innerWidth - 32, 520);
    const PREVIEW_H = Math.round(PREVIEW_W / aspectRatio);

    // State
    let scale = Math.max(PREVIEW_W / img.naturalWidth, PREVIEW_H / img.naturalHeight);
    let ox = (PREVIEW_W - img.naturalWidth * scale) / 2;
    let oy = (PREVIEW_H - img.naturalHeight * scale) / 2;
    let dragging = false, lastX = 0, lastY = 0;

    const clamp = () => {
      const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
      ox = Math.min(0, Math.max(PREVIEW_W - w, ox));
      oy = Math.min(0, Math.max(PREVIEW_H - h, oy));
    };

    const canvas = document.createElement('canvas');
    canvas.width = PREVIEW_W; canvas.height = PREVIEW_H;
    canvas.style.cssText = `width:${PREVIEW_W}px;height:${PREVIEW_H}px;display:block;cursor:grab;border-radius:${circular ? '50%' : '10px'};touch-action:none;`;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H);
      if (circular) { ctx.save(); ctx.beginPath(); ctx.arc(PREVIEW_W/2, PREVIEW_H/2, PREVIEW_W/2, 0, Math.PI*2); ctx.clip(); }
      ctx.drawImage(img, ox, oy, img.naturalWidth * scale, img.naturalHeight * scale);
      if (circular) ctx.restore();
    };

    // Drag
    canvas.addEventListener('mousedown', e => { dragging = true; lastX = e.clientX; lastY = e.clientY; canvas.style.cursor = 'grabbing'; });
    window.addEventListener('mousemove', e => { if (!dragging) return; ox += e.clientX - lastX; oy += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; clamp(); draw(); });
    window.addEventListener('mouseup', () => { dragging = false; canvas.style.cursor = 'grab'; });

    // Touch drag
    let lastTouches = null;
    canvas.addEventListener('touchstart', e => { e.preventDefault(); lastTouches = e.touches; });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && lastTouches?.length === 1) {
        ox += e.touches[0].clientX - lastTouches[0].clientX;
        oy += e.touches[0].clientY - lastTouches[0].clientY;
      } else if (e.touches.length === 2 && lastTouches?.length === 2) {
        const d0 = Math.hypot(lastTouches[0].clientX - lastTouches[1].clientX, lastTouches[0].clientY - lastTouches[1].clientY);
        const d1 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2 - canvas.getBoundingClientRect().left;
        const cy = (e.touches[0].clientY + e.touches[1].clientY) / 2 - canvas.getBoundingClientRect().top;
        const factor = d1 / d0;
        ox = cx - (cx - ox) * factor; oy = cy - (cy - oy) * factor;
        scale *= factor;
        scale = Math.max(Math.max(PREVIEW_W / img.naturalWidth, PREVIEW_H / img.naturalHeight), Math.min(scale, 5));
      }
      lastTouches = e.touches; clamp(); draw();
    }, { passive: false });

    // Scroll to zoom
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.93;
      const cx = e.offsetX, cy = e.offsetY;
      ox = cx - (cx - ox) * factor; oy = cy - (cy - oy) * factor;
      scale = Math.max(Math.max(PREVIEW_W / img.naturalWidth, PREVIEW_H / img.naturalHeight), Math.min(scale * factor, 5));
      clamp(); draw();
    }, { passive: false });

    draw();

    overlay.innerHTML = `
      <div style="color:white;font-size:15px;font-weight:700;margin-bottom:12px;">${circular ? 'Drag & scroll to reposition' : 'Drag & scroll to adjust cover'}</div>
    `;
    overlay.appendChild(canvas);
    overlay.insertAdjacentHTML('beforeend', `
      <div style="display:flex;gap:10px;margin-top:16px;">
        <button id="cropCancel" style="padding:10px 24px;background:rgba(255,255,255,0.15);color:white;border:1px solid rgba(255,255,255,0.3);border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Cancel</button>
        <button id="cropSave" style="padding:10px 28px;background:#0077B6;color:white;border:none;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;">Save Photo</button>
      </div>
    `);

    document.body.appendChild(overlay);

    overlay.querySelector('#cropCancel').onclick = () => { URL.revokeObjectURL(url); overlay.remove(); };
    overlay.querySelector('#cropSave').onclick = () => {
      const out = document.createElement('canvas');
      const OUTPUT = circular ? 400 : 1200;
      const OUTPUT_H = circular ? 400 : Math.round(1200 / aspectRatio);
      out.width = OUTPUT; out.height = OUTPUT_H;
      const ctx = out.getContext('2d');
      const scaleUp = OUTPUT / PREVIEW_W;
      ctx.drawImage(img, ox * scaleUp, oy * scaleUp, img.naturalWidth * scale * scaleUp, img.naturalHeight * scale * scaleUp);
      const dataUrl = out.toDataURL('image/jpeg', 0.88);
      URL.revokeObjectURL(url); overlay.remove(); onCrop(dataUrl);
    };
  };
  img.src = url;
}

async function uploadAvatar(input) {
  if (!input.files || !input.files[0]) return;
  openImageCropper(input.files[0], { aspectRatio: 1, circular: true, onCrop: async (dataUrl) => {
    if (!dataUrl) { showToast('Could not process image — try a different file'); return; }
    showToast('Uploading…');
    try {
      const res = await fetch('/api/profile/avatar', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); showToast(d.error || `Upload failed (${res.status})`); return; }
      const { avatarUrl } = await res.json();
      currentUser.avatarUrl = avatarUrl;
      updateAvatarDisplays(avatarUrl);
      showToast('Profile photo updated! ✓');
    } catch (e) { showToast('Upload failed — ' + (e.message || 'network error')); }
  }});
}

async function uploadBanner(input) {
  if (!input.files || !input.files[0]) return;
  openImageCropper(input.files[0], { aspectRatio: 4, circular: false, onCrop: async (dataUrl) => {
    if (!dataUrl) { showToast('Could not process image — try a different file'); return; }
    showToast('Uploading…');
    try {
      const res = await fetch('/api/profile/banner', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); showToast(d.error || `Upload failed (${res.status})`); return; }
      const { bannerUrl } = await res.json();
      currentUser.bannerUrl = bannerUrl;
      const banner = document.getElementById('profileBanner');
      if (banner) { banner.style.background = `url("${bannerUrl}") center/cover no-repeat`; }
      showToast('Cover photo updated! ✓');
    } catch (e) { showToast('Upload failed — ' + (e.message || 'network error')); }
  }});
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
  // Profile / settings page avatar
  const profileAv = document.querySelector('.profile-avatar');
  if (profileAv) { profileAv.innerHTML = `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`; }
  // New Neighbors sidebar — update current user's avatar if present
  document.querySelectorAll('#newNeighborsList .avatar-sm img').forEach(img => {
    const nameEl = img.closest('.new-neighbor')?.querySelector('.nn-name');
    if (nameEl && currentUser && nameEl.textContent.trim() === (currentUser.name || '').trim()) {
      img.src = avatarUrl;
    }
  });
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

const REACTION_MAP = { like: '👍', insightful: '💡', haha: '😂', wow: '😮', sad: '😢', agree: '👏' };

function reactionEmoji(key) {
  return REACTION_MAP[key] || '👍';
}

function getTopReactions(reactions) {
  if (!reactions) return [];
  return Object.entries(reactions)
    .filter(([, count]) => count > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([key]) => ({ key, emoji: REACTION_MAP[key] || '👍' }));
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
    closeSearchDropdown();
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault();
    document.getElementById('searchInput')?.focus();
  }
});

// ─── Global Search ────────────────────────────────────────────────
let searchDebounce = null;
let searchDropdownEl = null;

function closeSearchDropdown() {
  if (searchDropdownEl) { searchDropdownEl.remove(); searchDropdownEl = null; }
}

const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const q = searchInput.value.trim();
    if (!q) { closeSearchDropdown(); return; }
    searchDebounce = setTimeout(() => runSearch(q), 300);
  });
  searchInput.addEventListener('blur', () => setTimeout(closeSearchDropdown, 200));
}

async function runSearch(q) {
  const results = await fetchJSON(`/api/search?q=${encodeURIComponent(q)}`);
  if (!results) return;
  renderSearchDropdown(results, q);
}

function renderSearchDropdown(results, q) {
  closeSearchDropdown();
  const bar = document.getElementById('searchInput');
  if (!bar) return;
  const wrap = bar.closest('.search-bar') || bar.parentElement;
  const rect = wrap.getBoundingClientRect();

  const drop = document.createElement('div');
  drop.style.cssText = `position:fixed;top:${rect.bottom + 6}px;left:${rect.left}px;width:${Math.max(rect.width, 340)}px;background:white;border-radius:14px;box-shadow:0 8px 32px rgba(0,0,0,0.18);z-index:9999;overflow:hidden;max-height:420px;overflow-y:auto;`;
  searchDropdownEl = drop;

  const sectionShortcuts = [
    { key: 'feed', label: 'Neighborhood Feed', icon: '🏠', aliases: ['feed','neighborhood','general','news'] },
    { key: 'safety', label: 'Safety', icon: '🛡️', aliases: ['safety','alert','emergency','crime'] },
    { key: 'marketplace', label: 'Marketplace', icon: '🛒', aliases: ['marketplace','buy','sell','shop'] },
    { key: 'events', label: 'Events', icon: '📅', aliases: ['events','event','party','happening'] },
    { key: 'businesses', label: 'Business Directory', icon: '🏪', aliases: ['business','businesses','restaurant','cafe','shop','salon','store','service','handyman','bar','grill'] },
    { key: 'neighbors', label: 'Neighbors', icon: '👋', aliases: ['neighbor','neighbors','people','residents'] },
    { key: 'groups', label: 'Groups', icon: '👥', aliases: ['groups','group','community'] },
    { key: 'real-estate', label: 'Real Estate', icon: '🏡', aliases: ['real estate','realestate','house','home','property','rent','buy'] },
  ];
  const lq = q.toLowerCase();
  const matchedSection = sectionShortcuts.find(s => s.aliases.some(a => a.includes(lq) || lq.includes(a)));

  const all = [
    ...(results.safety||[]).map(r => ({ ...r, _type: 'safety', _section: 'safety' })),
    ...(results.events||[]).map(r => ({ ...r, _type: 'event', _section: 'events' })),
    ...(results.marketplace||[]).map(r => ({ ...r, _type: 'listing', _section: 'marketplace' })),
    ...(results.groups||[]).map(r => ({ ...r, _type: 'group', _section: 'groups' })),
  ];

  let html = '';

  if (matchedSection) {
    html += `<div style="display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;background:#f0f8ff;border-bottom:1px solid var(--border);" onmousedown="searchGoTo('${matchedSection.key}','')">
      <span style="font-size:20px;">${matchedSection.icon}</span>
      <div style="flex:1;">
        <div style="font-size:14px;font-weight:700;color:var(--ocean);">Go to ${matchedSection.label}</div>
        <div style="font-size:12px;color:var(--text-light);">Browse section</div>
      </div>
      <span style="font-size:12px;color:var(--ocean);">→</span>
    </div>`;
  }

  if (all.length) {
    const icons = { safety: '🛡️', event: '📅', listing: '🛒', group: '👥' };
    const labels = { safety: 'Safety Alert', event: 'Event', listing: 'Marketplace', group: 'Group' };
    html += all.map(r => `
      <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;border-bottom:1px solid var(--border);" onmousedown="searchGoTo('${r._section}','${r.id||''}')">
        <span style="font-size:20px;">${icons[r._type]}</span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:14px;font-weight:700;color:var(--text-dark);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(r.title || r.name || r.content || '')}</div>
          <div style="font-size:12px;color:var(--text-light);margin-top:1px;">${labels[r._type]}${r.category ? ' · ' + escHtml(r.category) : ''}${r.price ? ' · $' + r.price.toLocaleString() : ''}</div>
        </div>
      </div>
    `).join('');
  }

  if (!html) {
    html = `<div style="padding:20px;text-align:center;color:var(--text-light);font-size:14px;">No results for "${escHtml(q)}"</div>`;
  }

  drop.innerHTML = html;
  document.body.appendChild(drop);
}

function searchGoTo(section, id) {
  closeSearchDropdown();
  const si = document.getElementById('searchInput');
  if (si) si.value = '';
  navigate(section);
}
