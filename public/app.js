/* ═══════════════════════════════════════════════════════════════
   GOOD NEIGHBORS — App Frontend Logic
   ═══════════════════════════════════════════════════════════════ */

// ─── State ──────────────────────────────────────────────────────
let currentUser = null;
let currentSection = 'feed';
let selectedPostType = 'general';
let openComments = new Set();

// ─── Init ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuth();
  lucide.createIcons();
  await loadNotifications();
  loadTides();
  navigate('feed');
});

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
    if (!res.ok) { window.location.href = '/'; return; }
    currentUser = await res.json();
    renderUserUI();
  } catch {
    window.location.href = '/';
  }
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
  if (createAv) createAv.style.background = currentUser.avatar;
  setTextSafe('createInitials', currentUser.initials);
  setTextSafe('createName', currentUser.name);
}

function setTextSafe(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
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
    <div class="avatar-post" style="background:${currentUser?.avatar || '#0077B6'};width:40px;height:40px;">
      ${currentUser?.initials || 'ME'}
    </div>
    <div class="create-post-input">What's happening in Costa Blanca Villas?</div>
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
  posts.forEach(post => container.appendChild(buildPostCard(post)));
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
  container.innerHTML = sectionHeaderHTML('businesses');
  const businesses = await fetchJSON('/api/businesses');
  if (!businesses || !businesses.length) {
    container.innerHTML += emptyStateHTML('🏪', 'No businesses listed', 'Know a great local business? Recommend it!');
    return;
  }
  const grid = document.createElement('div');
  grid.className = 'business-grid';
  businesses.forEach((biz, i) => {
    const card = buildBusinessCard(biz);
    card.style.animationDelay = `${i * 60}ms`;
    grid.appendChild(card);
  });
  container.appendChild(grid);
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
  container.innerHTML = sectionHeaderHTML('groups');
  const groups = await fetchJSON('/api/groups');
  if (!groups || !groups.length) {
    container.innerHTML += emptyStateHTML('👥', 'No groups yet', 'Create a group to connect with neighbors who share your interests!');
    return;
  }
  const list = document.createElement('div');
  list.className = 'groups-list';
  groups.forEach((g, i) => {
    const card = buildGroupCard(g);
    card.style.animationDelay = `${i * 60}ms`;
    list.appendChild(card);
  });
  container.appendChild(list);
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
        <div class="profile-stat">
          <div class="profile-stat-val">${user.points || 412}</div>
          <div class="profile-stat-lbl">Points</div>
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
        <div class="settings-row-info"><div class="settings-row-label" style="color:var(--coral)">Sign Out</div><div class="settings-row-sub">Log out of Good Neighbors</div></div>
        <button class="settings-btn danger" onclick="logout()">Sign Out</button>
      </div>
    </div>
  `;
  lucide.createIcons();
}

// ─── Build Post Card ─────────────────────────────────────────────
function buildPostCard(post) {
  const card = document.createElement('div');
  card.className = `post-card${post.type === 'safety' ? ' safety-card' : ''}`;
  card.dataset.postId = post.id;

  const totalReactions = Object.values(post.reactions || {}).reduce((a, b) => a + b, 0);
  const topReactions = getTopReactions(post.reactions);

  card.innerHTML = `
    <div class="post-card-inner">
      ${post.alertType ? `<div class="alert-badge ${post.severity || 'medium'}">⚠ ${post.alertType}</div>` : ''}
      ${post.price !== undefined ? `
        <span class="price-tag${post.free || post.price === 0 ? ' free' : ''}">
          ${post.free || post.price === 0 ? '🎁 FREE' : `$${post.price}`}
        </span>
        ${post.condition ? `<span class="condition-tag">${post.condition}</span>` : ''}
      ` : ''}

      <div class="post-header">
        <div class="post-author">
          <div class="avatar-post" style="background:${post.author?.avatar || '#0077B6'}">
            ${post.author?.initials || '??'}
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
      <div class="avatar-comment" style="background:${currentUser?.avatar || '#0077B6'};width:30px;height:30px;flex-shrink:0">
        ${currentUser?.initials || 'ME'}
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
  const card = document.createElement('div');
  card.className = 'group-card';

  card.innerHTML = `
    <div class="group-icon-wrap">${group.icon}</div>
    <div class="group-body">
      <div class="group-name">${escHtml(group.name)}</div>
      <div class="group-members">
        <i data-lucide="users" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i>
        ${group.members} members
      </div>
      <div class="group-desc">${escHtml(group.description)}</div>
      <div class="group-activity">Last active ${group.lastActivity}</div>
    </div>
    <div style="display:flex;gap:8px;margin-top:12px;">
      ${group.joined ? `<button class="btn-join-group open-group-btn" onclick="openGroupModal('${group.id}')">Open Group</button>` : ''}
      <button class="btn-join-group${group.joined ? ' joined' : ''}" id="group-btn-${group.id}" onclick="toggleGroup('${group.id}',this)" style="${group.joined ? 'flex:0 0 auto' : 'flex:1'}">
        ${group.joined ? '✓ Joined' : 'Join Group'}
      </button>
    </div>
  `;
  return card;
}

async function toggleGroup(groupId, btn) {
  try {
    const res = await fetch(`/api/groups/${groupId}/join`, {
      method: 'POST', credentials: 'include'
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    btn.textContent = data.joined ? '✓ Joined' : 'Join';
    btn.className = `btn-join-group${data.joined ? ' joined' : ''}`;

    // Update member count in card
    const memberEl = btn.closest('.group-card').querySelector('.group-members');
    if (memberEl) memberEl.innerHTML = `<i data-lucide="users" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i> ${data.members} members`;
    lucide.createIcons();

    showToast(data.joined ? 'You joined the group! 🎉' : 'You left the group.');
  } catch {
    showToast('Could not update group membership.');
  }
}

async function openGroupModal(groupId) {
  const modal = document.getElementById('eventDetailModal');
  const body = document.getElementById('eventDetailBody');
  const title = modal.querySelector('.modal-header h3');
  if (title) title.textContent = 'Group';
  body.innerHTML = '<div class="loading-spinner"></div>';
  openModal('eventDetailModal');

  const group = await fetchJSON(`/api/groups/${groupId}`);
  if (!group) { body.innerHTML = '<p style="padding:20px;color:var(--coral)">Could not load group.</p>'; return; }

  const posts = group.posts || [];

  body.innerHTML = `
    <div style="padding:20px;">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:6px;">
        <div style="font-size:38px;line-height:1">${group.icon}</div>
        <div>
          <div style="font-size:17px;font-weight:800;color:var(--text-dark);line-height:1.2">${escHtml(group.name)}</div>
          <div style="font-size:12px;color:var(--text-light);margin-top:3px;">
            <i data-lucide="users" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:3px;"></i>
            ${group.members} members · Last active ${group.lastActivity}
          </div>
        </div>
      </div>

      <div style="background:var(--bg);border-radius:12px;padding:12px 14px;font-size:13px;color:var(--text-mid);line-height:1.6;margin-bottom:18px;">
        ${escHtml(group.description)}
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <div style="font-size:14px;font-weight:700;color:var(--text-dark);">Recent Activity</div>
        <span style="font-size:11px;color:var(--text-light);background:var(--bg);padding:3px 10px;border-radius:10px;">${posts.length} posts</span>
      </div>

      ${posts.length === 0
        ? '<div style="text-align:center;padding:20px;color:var(--text-light);font-size:13px;">No posts yet in this group.</div>'
        : posts.map(p => `
          <div style="border-top:1px solid var(--border);padding:14px 0;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <div style="width:34px;height:34px;border-radius:50%;background:${p.author.avatar};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:white;flex-shrink:0;">${p.author.initials}</div>
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--text-dark)">${escHtml(p.author.name)}</div>
                <div style="font-size:11px;color:var(--text-light)">${p.time}</div>
              </div>
            </div>
            <div style="font-size:13px;color:var(--text-mid);line-height:1.65;padding-left:44px">${escHtml(p.content)}</div>
          </div>
        `).join('')}

      <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:16px;">
        <button class="btn-business-contact" style="width:100%;background:var(--ocean);" onclick="showToast('Post shared to the group! 🎉');closeModal('eventDetailModal')">
          Post to This Group
        </button>
      </div>
    </div>
  `;
  if (window.lucide) lucide.createIcons();
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

  // Admin bar
  if (currentUser?.username === 'admin') {
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
  const isAdmin = currentUser?.username === 'admin';

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
  realestate: { title: 'Real Estate', desc: 'Properties for sale & rent near Costa Blanca Villas', emoji: '🏡' }
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
function toggleMobileMenu() {
  document.getElementById('mobileMenuOverlay').classList.toggle('open');
  document.getElementById('mobileMenuDrawer').classList.toggle('open');
  lucide.createIcons();
}
function closeMobileMenu() {
  document.getElementById('mobileMenuOverlay').classList.remove('open');
  document.getElementById('mobileMenuDrawer').classList.remove('open');
}

// ─── Auth ────────────────────────────────────────────────────────
async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '/';
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
