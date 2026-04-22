'use strict';
require('dotenv').config();

const express      = require('express');
const cookieParser = require('cookie-parser');
const path         = require('path');
const crypto       = require('crypto');
const multer       = require('multer');
const { Resend }   = require('resend');
const bcrypt       = require('bcrypt');
const { sql }      = require('./db/client');

const app = express();
app.use(express.json({ limit: '10mb' }));
const COOKIE_SECRET = process.env.COOKIE_SECRET || 'gn-secret-2026';
app.use(cookieParser(COOKIE_SECRET));
app.use(express.static(path.join(__dirname, 'public')));


const upload       = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5  * 1024 * 1024 } });
const uploadBanner = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8  * 1024 * 1024 } });

// ─── Points constants ────────────────────────────────────────────────────────
const POINTS = {
  post: 5, comment: 2, react_received: 1,
  group_join: 3, group_create: 10, event_rsvp: 2,
  marketplace_list: 5, safety_post: 8
};

// ─── Email (Resend) ───────────────────────────────────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY || 're_3CTghUDW_7N13M3NHkgoKctGHjWLVCYr5');

async function sendEmail({ to, subject, html }) {
  try {
    await resend.emails.send({ from: 'Costa Blanca Connect <noreply@costablancaconnect.org>', to, subject, html });
  } catch (err) { console.error('sendEmail failed:', err.message); }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(date) {
  if (!date) return 'recently';
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60)     return 'just now';
  if (s < 3600)   return `${Math.floor(s / 60)} minutes ago`;
  if (s < 86400)  return `${Math.floor(s / 3600)} hours ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} days ago`;
  return `${Math.floor(s / 604800)} weeks ago`;
}

function formatUser(row) {
  if (!row) return null;
  return {
    id: row.id, username: row.username, email: row.email || undefined,
    role: row.role, name: row.name, fullName: row.full_name || undefined,
    initials: row.initials, avatar: row.avatar_hex,
    avatarUrl: row.avatar_url || undefined, bannerUrl: row.banner_url || undefined,
    address: row.address || undefined, bio: row.bio || '',
    verified: row.verified, points: row.points || 0,
    yearsInNeighborhood: row.years_in_neighborhood || 0,
    isOwner: row.is_owner || false, managedAccount: row.managed_account || false,
    businessId: row.business_id || undefined,
    contactEmail: row.contact_email || undefined, contactPhone: row.contact_phone || undefined,
  };
}

function formatAuthor(row) {
  return {
    id: row.author_id || row.id,
    username: row.author_username || row.username,
    name: row.author_name || row.name,
    avatar: row.author_avatar || row.avatar_hex,
    initials: row.author_initials || row.initials,
    verified: row.author_verified !== undefined ? row.author_verified : row.verified,
    address: row.author_address || row.address || undefined,
    role: row.author_role || row.role || undefined,
  };
}

function buildReactionsObj(reactionRows, postId) {
  const base = { like: 0, insightful: 0, agree: 0, haha: 0, wow: 0, sad: 0 };
  reactionRows.filter(r => r.post_id === postId).forEach(r => {
    base[r.reaction_type] = parseInt(r.cnt, 10);
  });
  return base;
}

function formatPost(row, reactionRows, commentCountMap, userReactionMap, pollVoteMap, userPollVoteMap) {
  const author = formatAuthor(row);
  if (row.is_business_post) author.isBusiness = true;
  if (row.is_hoa_post)      author.isHoa      = true;

  const post = {
    id: row.id, type: row.type, section: row.section,
    content: row.content, author,
    createdAt: row.created_at,
    reactions: buildReactionsObj(reactionRows, row.id),
    commentCount: parseInt(commentCountMap[row.id] || 0, 10),
    userReaction: userReactionMap[row.id] || null,
    isBusinessPost: row.is_business_post || false,
    isHoaPost:      row.is_hoa_post      || false,
    isOfficial:     row.is_official      || false,
    forwardedToDecameron: row.forwarded_to_decameron || false,
    isPinned:       row.is_pinned        || false,
  };

  if (row.image_url)   post.image    = row.image_url;
  if (row.location)    post.location = row.location;
  if (row.business_id) post.businessId = row.business_id;
  if (row.alert_type)  post.alertType  = row.alert_type;
  if (row.severity)    post.severity   = row.severity;
  if (row.resolved_by_name) { post.resolvedBy = row.resolved_by_name; post.resolvedAt = row.resolved_at; }
  if (row.price   !== null && row.price   !== undefined) post.price     = parseFloat(row.price);
  if (row.condition)   post.condition  = row.condition;
  if (row.category)    post.category   = row.category;
  if (row.offer_title) post.offerTitle = row.offer_title;
  if (row.offer_expiry) post.offerExpiry = row.offer_expiry;

  if (row.poll_options) {
    const votes = pollVoteMap[row.id] || {};
    post.pollOptions = row.poll_options.map(o => ({ id: o.id, text: o.text, votes: parseInt(votes[o.id] || 0, 10) }));
    post.userVote = (userPollVoteMap && userPollVoteMap[row.id]) || null;
  }
  return post;
}

async function fetchPostsWithMeta(whereSql, userId) {
  const rows = await sql(`
    SELECT p.*,
      u.username  AS author_username,
      u.name      AS author_name,
      u.avatar_hex AS author_avatar,
      u.initials  AS author_initials,
      u.verified  AS author_verified,
      u.address   AS author_address,
      u.role      AS author_role,
      rb.name     AS resolved_by_name
    FROM posts p
    JOIN users u ON p.author_id = u.id
    LEFT JOIN users rb ON p.resolved_by_user_id = rb.id
    ${whereSql}
    ORDER BY p.created_at DESC
  `);
  if (!rows.length) return [];

  const ids = rows.map(r => r.id);

  const [reactionRows, commentRows, pollVoteRows, userReactionRows, userPollRows] = await Promise.all([
    sql`SELECT post_id, reaction_type, COUNT(*)::int AS cnt FROM post_reactions WHERE post_id = ANY(${ids}) GROUP BY post_id, reaction_type`,
    sql`SELECT post_id, COUNT(*)::int AS cnt FROM comments WHERE post_id = ANY(${ids}) GROUP BY post_id`,
    sql`SELECT post_id, option_id, COUNT(*)::int AS cnt FROM poll_votes WHERE post_id = ANY(${ids}) GROUP BY post_id, option_id`,
    userId ? sql`SELECT post_id, reaction_type FROM post_reactions WHERE user_id = ${userId} AND post_id = ANY(${ids})` : Promise.resolve([]),
    userId ? sql`SELECT post_id, option_id FROM poll_votes WHERE user_id = ${userId} AND post_id = ANY(${ids})` : Promise.resolve([]),
  ]);

  const commentCountMap   = {};
  commentRows.forEach(r => { commentCountMap[r.post_id] = r.cnt; });
  const userReactionMap   = {};
  userReactionRows.forEach(r => { userReactionMap[r.post_id] = r.reaction_type; });
  const pollVoteMap       = {};
  pollVoteRows.forEach(r => { if (!pollVoteMap[r.post_id]) pollVoteMap[r.post_id] = {}; pollVoteMap[r.post_id][r.option_id] = r.cnt; });
  const userPollVoteMap   = {};
  userPollRows.forEach(r => { userPollVoteMap[r.post_id] = r.option_id; });

  return rows.map(r => formatPost(r, reactionRows, commentCountMap, userReactionMap, pollVoteMap, userPollVoteMap));
}

async function storeImage(imageData, folder = 'images') {
  if (!imageData) return null;
  if (!imageData.startsWith('data:')) return imageData;
  if (!process.env.BLOB_READ_WRITE_TOKEN) return imageData;
  try {
    const { put } = require('@vercel/blob');
    const [header, data] = imageData.split(',');
    const mime   = (header.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
    const ext    = mime.split('/')[1] || 'jpg';
    const buffer = Buffer.from(data, 'base64');
    const blob   = await put(`${folder}/${Date.now()}.${ext}`, buffer, { access: 'public', contentType: mime });
    return blob.url;
  } catch (err) {
    console.error('Blob upload error:', err.message);
    return imageData;
  }
}

async function awardPoints(userId, action, amount) {
  if (!userId || !amount) return;
  await sql`UPDATE users SET points = GREATEST(0, points + ${amount}) WHERE id = ${userId}`;
  if (amount > 0) await sql`INSERT INTO points_log (user_id, action, points_earned) VALUES (${userId}, ${action}, ${amount})`;
}

// ─── Auth middleware ──────────────────────────────────────────────────────────

async function getUser(req) {
  const token = req.signedCookies && req.signedCookies.user;
  if (!token) return null;
  const rows = await sql`
    SELECT u.* FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ${token} AND s.expires_at > NOW()
    LIMIT 1
  `;
  return rows[0] || null;
}

function requireAuth(handler) {
  return async (req, res) => {
    try {
      const user = await getUser(req);
      if (!user) return res.status(401).json({ error: 'Not authenticated' });
      req.currentUser = user;
      await handler(req, res);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  };
}

function requireAdmin(handler) {
  return requireAuth(async (req, res) => {
    if (req.currentUser.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    await handler(req, res);
  });
}

function requireOwner(handler) {
  return requireAuth(async (req, res) => {
    if (!req.currentUser.is_owner) return res.status(403).json({ error: 'Owner only' });
    await handler(req, res);
  });
}

// ─── Auth routes ─────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username/email and password are required.' });

    const rows = await sql`
      SELECT * FROM users
      WHERE username = ${username} OR (email IS NOT NULL AND LOWER(email) = LOWER(${username}))
      LIMIT 1
    `;
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const ban = await sql`SELECT id FROM banned_users WHERE (username = ${user.username} OR (email IS NOT NULL AND LOWER(email) = LOWER(${user.email||''}))) AND lifted_at IS NULL LIMIT 1`;
    if (ban.length) return res.status(403).json({ error: 'banned', reason: 'Your account has been suspended.' });

    if (!user.email_verified) return res.status(403).json({ error: 'unverified', reason: 'Please verify your email before logging in. Check your inbox for a confirmation link.' });

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    await sql`INSERT INTO sessions (user_id, token, expires_at) VALUES (${user.id}, ${token}, ${expiresAt})`;

    res.cookie('user', token, { httpOnly: true, signed: true, maxAge: 7 * 24 * 3600 * 1000, sameSite: 'lax' });
    res.json(formatUser(user));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    const token = req.signedCookies && req.signedCookies.user;
    if (token) await sql`DELETE FROM sessions WHERE token = ${token}`;
    res.clearCookie('user');
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/auth/me', requireAuth(async (req, res) => {
  const [pc] = await sql`SELECT COUNT(*)::int AS c FROM posts WHERE author_id = ${req.currentUser.id}`;
  res.json({ ...formatUser(req.currentUser), posts: pc?.c || 0 });
}));

app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, username, password, role, businessName, businessCategory } = req.body;

    if (!fullName || !email || !username || !password || !role)
      return res.status(400).json({ error: 'Missing required fields.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    if (!/^[a-z0-9_]{3,20}$/.test(username))
      return res.status(400).json({ error: 'Username must be 3–20 lowercase letters, numbers, or underscores.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    if (!['neighbor','business'].includes(role))
      return res.status(400).json({ error: 'Invalid account type.' });

    const existing = await sql`SELECT id FROM users WHERE username = ${username} OR email = ${email} UNION SELECT id FROM pending_registrations WHERE username = ${username} OR email = ${email} LIMIT 1`;
    if (existing.length) return res.status(409).json({ error: 'That username or email is already registered.' });

    const banned = await sql`SELECT id FROM banned_users WHERE (username = ${username} OR (email IS NOT NULL AND LOWER(email) = LOWER(${email}))) AND lifted_at IS NULL LIMIT 1`;
    if (banned.length) return res.status(403).json({ error: 'This account is not eligible to register.' });

    const initials     = fullName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    const COLORS       = ['#0077B6','#F4A261','#E76F51','#2A9D8F','#E9C46A','#264653','#A8DADC','#457B9D','#E63946','#6D6875','#1D3557','#48CAE4'];
    const avatarHex    = COLORS[Math.floor(Math.random() * COLORS.length)];
    const passwordHash = await bcrypt.hash(password, 12);
    const displayName  = role === 'business' ? (businessName || fullName) : fullName;

    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    if (role === 'neighbor') {
      const [newUser] = await sql`
        INSERT INTO users (username, email, password_hash, role, name, full_name, avatar_hex, initials, email_verified)
        VALUES (${username}, ${email}, ${passwordHash}, ${role}, ${displayName}, ${fullName}, ${avatarHex}, ${initials}, false)
        RETURNING *
      `;
      const verifyToken = crypto.randomBytes(32).toString('hex');
      await sql`INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (${newUser.id}, ${verifyToken}, ${new Date(Date.now() + 24 * 3600 * 1000)})`;
      await sendEmail({
        to: email,
        subject: 'Confirm your Costa Blanca Connect account',
        html: `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
            <h2 style="color:#0077B6;">Welcome to Costa Blanca Connect!</h2>
            <p>Hi ${displayName},</p>
            <p>Thank you for registering! Please confirm your email address to activate your account.</p>
            <a href="${appUrl}/verify-email?token=${verifyToken}" style="display:inline-block;background:#0077B6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;">Confirm Email</a>
            <p>This link expires in 24 hours.</p>
            <hr style="border:none;border-top:1px solid #eee;margin-top:24px;">
            <p style="color:#888;font-size:12px;">Costa Blanca Connect · Costa Blanca Villas, Farallón, Coclé, Panamá</p>
          </div>
        `
      });
      return res.json({ ok: true, role: 'neighbor', message: 'Check your email to confirm your account.' });
    }

    // Businesses — create account directly, require email verification (no admin approval)
    const [newBiz] = await sql`
      INSERT INTO users (username, email, password_hash, role, name, full_name, avatar_hex, initials, email_verified)
      VALUES (${username}, ${email}, ${passwordHash}, ${role}, ${displayName}, ${fullName}, ${avatarHex}, ${initials}, false)
      RETURNING *
    `;
    if (businessName) {
      const [biz] = await sql`
        INSERT INTO businesses (name, category, description, claimed, claimed_by_user_id)
        VALUES (${businessName}, ${businessCategory||null}, '', true, ${newBiz.id})
        RETURNING id
      `;
      await sql`UPDATE users SET business_id=${biz.id} WHERE id=${newBiz.id}`;
    }
    const verifyToken = crypto.randomBytes(32).toString('hex');
    await sql`INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (${newBiz.id}, ${verifyToken}, ${new Date(Date.now() + 24 * 3600 * 1000)})`;
    await sendEmail({
      to: email,
      subject: 'Confirm your Costa Blanca Connect business account',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
          <h2 style="color:#0077B6;">Welcome to Costa Blanca Connect!</h2>
          <p>Hi ${displayName},</p>
          <p>Thank you for registering! Please confirm your email to activate your account.</p>
          <a href="${appUrl}/verify-email?token=${verifyToken}" style="display:inline-block;background:#0077B6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;">Confirm Email</a>
          <p>This link expires in 24 hours.</p>
          <hr style="border:none;border-top:1px solid #eee;margin-top:24px;">
          <p style="color:#888;font-size:12px;">Costa Blanca Connect · Costa Blanca Villas, Farallón, Coclé, Panamá</p>
        </div>
      `
    });
    res.json({ ok: true, role: 'business', message: 'Check your email to confirm your account.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Forgot password
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const rows = await sql`SELECT id, email, name FROM users WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;
    // Always respond success to prevent email enumeration
    res.json({ ok: true, message: 'If that email is registered, a reset link has been sent.' });

    if (!rows.length) return;
    const user = rows[0];

    const token     = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 3600 * 1000); // 1 hour
    await sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${token}, ${expiresAt})
    `;

    const appUrl  = process.env.APP_URL || 'http://localhost:3000';
    const link    = `${appUrl}/reset-password?token=${token}`;
    await sendEmail({
      to: user.email,
      subject: 'Reset your Costa Blanca Connect password',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
          <h2 style="color:#0077B6;">Password Reset</h2>
          <p>Hi ${user.name},</p>
          <p>We received a request to reset your password. Click the button below to set a new one. This link expires in 1 hour.</p>
          <a href="${link}" style="display:inline-block;background:#0077B6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;">Reset Password</a>
          <p>If you didn't request this, you can safely ignore this email.</p>
          <hr style="border:none;border-top:1px solid #eee;margin-top:24px;">
          <p style="color:#888;font-size:12px;">Costa Blanca Connect · Costa Blanca Villas, Farallón, Coclé, Panamá</p>
        </div>
      `
    });
  } catch (err) { console.error('Forgot password error:', err.message); }
});

// Validate reset token
app.get('/api/auth/reset-password/validate', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ valid: false });
    const rows = await sql`
      SELECT id FROM password_reset_tokens
      WHERE token = ${token} AND expires_at > NOW() AND used_at IS NULL
      LIMIT 1
    `;
    res.json({ valid: rows.length > 0 });
  } catch (err) { console.error(err); res.status(500).json({ valid: false }); }
});

// Reset password
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: 'Token and new password required.' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const rows = await sql`
      SELECT prt.*, u.id AS user_id FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token = ${token} AND prt.expires_at > NOW() AND prt.used_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired reset link.' });

    const hash = await bcrypt.hash(newPassword, 12);
    await sql`UPDATE users SET password_hash = ${hash} WHERE id = ${rows[0].user_id}`;
    await sql`UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ${rows[0].id}`;
    // Invalidate all sessions for this user
    await sql`DELETE FROM sessions WHERE user_id = ${rows[0].user_id}`;

    res.json({ ok: true, message: 'Password updated. Please log in.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Verify email
app.get('/api/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Invalid link.' });
    const [row] = await sql`
      SELECT evt.*, u.id AS uid, u.role, u.name, u.username, u.avatar_hex, u.initials
      FROM email_verification_tokens evt
      JOIN users u ON evt.user_id = u.id
      WHERE evt.token = ${token} AND evt.expires_at > NOW() AND evt.used_at IS NULL
      LIMIT 1
    `;
    if (!row) return res.status(400).json({ error: 'This link is invalid or has expired.' });
    await sql`UPDATE users SET email_verified = true WHERE id = ${row.uid}`;
    await sql`UPDATE email_verification_tokens SET used_at = NOW() WHERE id = ${row.id}`;
    // For neighbors, notify existing members
    if (row.role === 'neighbor') {
      const allNeighbors = await sql`SELECT id FROM users WHERE role IN ('neighbor','admin') AND id != ${row.uid} AND email_verified = true`;
      if (allNeighbors.length) {
        await Promise.all(allNeighbors.map(n =>
          sql`INSERT INTO notifications (user_id, type, message, avatar_hex, initials)
              VALUES (${n.id}, 'new_neighbor', ${`${row.name} just joined Costa Blanca Connect — say hello! 👋`}, ${row.avatar_hex}, ${row.initials})`
        ));
      }
    }
    res.json({ ok: true, message: 'Email verified! You can now log in.' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// Resend verification email
app.post('/api/auth/resend-verification', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });
    const [user] = await sql`SELECT * FROM users WHERE LOWER(email) = LOWER(${email}) AND email_verified = false LIMIT 1`;
    if (!user) return res.json({ ok: true }); // Don't reveal if email exists
    await sql`DELETE FROM email_verification_tokens WHERE user_id = ${user.id}`;
    const verifyToken = crypto.randomBytes(32).toString('hex');
    const appUrl = process.env.APP_URL || 'http://localhost:3000';
    await sql`INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (${user.id}, ${verifyToken}, ${new Date(Date.now() + 24 * 3600 * 1000)})`;
    await sendEmail({
      to: user.email,
      subject: 'Confirm your Costa Blanca Connect account',
      html: `
        <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
          <h2 style="color:#0077B6;">Confirm your email</h2>
          <p>Hi ${user.name},</p>
          <p>Click below to confirm your email and activate your account.</p>
          <a href="${appUrl}/verify-email?token=${verifyToken}" style="display:inline-block;background:#0077B6;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;margin:16px 0;">Confirm Email</a>
          <p>This link expires in 24 hours.</p>
          <hr style="border:none;border-top:1px solid #eee;margin-top:24px;">
          <p style="color:#888;font-size:12px;">Costa Blanca Connect · Costa Blanca Villas, Farallón, Coclé, Panamá</p>
        </div>
      `
    });
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ─── Reports ─────────────────────────────────────────────────────────────────

app.post('/api/reports', requireAuth(async (req, res) => {
  const { targetType, targetId, targetLabel, reason, note } = req.body;
  if (!targetType || !targetId || !reason) return res.status(400).json({ error: 'Missing fields' });
  const u = req.currentUser;
  const [report] = await sql`
    INSERT INTO reports (target_type, target_id, target_label, reason, note, reported_by_user_id)
    VALUES (${targetType}, ${targetId}, ${targetLabel || targetId}, ${reason}, ${note || ''}, ${u.id})
    RETURNING *
  `;
  res.json({ ok: true, report });
}));

app.get('/api/admin/reports', requireAdmin(async (req, res) => {
  const rows = await sql`
    SELECT r.*, u.username AS reporter_username, u.name AS reporter_name, u.avatar_hex AS reporter_avatar, u.initials AS reporter_initials,
           ru.username AS resolver_username
    FROM reports r
    JOIN users u ON r.reported_by_user_id = u.id
    LEFT JOIN users ru ON r.resolved_by_user_id = ru.id
    ORDER BY r.created_at DESC
  `;
  res.json(rows.map(r => ({
    id: r.id, targetType: r.target_type, targetId: r.target_id, targetLabel: r.target_label,
    reason: r.reason, note: r.note,
    reportedBy: { id: r.reported_by_user_id, name: r.reporter_name, username: r.reporter_username, initials: r.reporter_initials, avatar: r.reporter_avatar },
    status: r.status, resolvedBy: r.resolver_username, resolvedAt: r.resolved_at,
    forwardedToDecameron: r.forwarded_to_decameron, createdAt: r.created_at,
  })));
}));

app.post('/api/admin/reports/:id/resolve', requireAdmin(async (req, res) => {
  await sql`UPDATE reports SET status='resolved', resolved_by_user_id=${req.currentUser.id}, resolved_at=NOW() WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

app.post('/api/admin/reports/:id/dismiss', requireAdmin(async (req, res) => {
  await sql`UPDATE reports SET status='dismissed' WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

// ─── Access requests ──────────────────────────────────────────────────────────

app.post('/api/request-access', async (req, res) => {
  try {
    const { nameVilla } = req.body;
    if (!nameVilla?.trim()) return res.status(400).json({ error: 'Please provide your name and villa.' });
    await sql`INSERT INTO access_requests (name_villa) VALUES (${nameVilla.trim()})`;
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/access-requests', requireAdmin(async (req, res) => {
  const rows = await sql`SELECT * FROM access_requests ORDER BY submitted_at DESC`;
  res.json(rows.map(r => ({ id: r.id, nameVilla: r.name_villa, status: r.status, submittedAt: r.submitted_at })));
}));

app.post('/api/admin/access-requests/:id/dismiss', requireAdmin(async (req, res) => {
  await sql`UPDATE access_requests SET status='dismissed' WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

// ─── Member management ────────────────────────────────────────────────────────

app.delete('/api/admin/users/:username', requireAdmin(async (req, res) => {
  const target = req.params.username;
  const [u] = await sql`SELECT id, is_owner FROM users WHERE username=${target}`;
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.id === req.currentUser.id) return res.status(400).json({ error: 'Cannot remove yourself' });
  if (u.is_owner) return res.status(400).json({ error: 'Cannot remove the platform owner' });
  await sql`DELETE FROM users WHERE id=${u.id}`;
  res.json({ ok: true });
}));

// ─── Admin team ───────────────────────────────────────────────────────────────

app.get('/api/admin/team', requireOwner(async (req, res) => {
  const rows = await sql`SELECT * FROM users WHERE role='admin' ORDER BY created_at`;
  res.json(rows.map(formatUser));
}));

app.post('/api/admin/team/promote/:username', requireOwner(async (req, res) => {
  const [u] = await sql`SELECT id, role FROM users WHERE username=${req.params.username}`;
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.role === 'admin') return res.status(400).json({ error: 'Already an admin' });
  if (u.role === 'hoa') return res.status(400).json({ error: 'Cannot promote HOA accounts' });
  const [updated] = await sql`UPDATE users SET role='admin', is_owner=false WHERE id=${u.id} RETURNING *`;
  res.json({ ok: true, user: formatUser(updated) });
}));

app.delete('/api/admin/team/:username', requireOwner(async (req, res) => {
  const [u] = await sql`SELECT id, role, is_owner FROM users WHERE username=${req.params.username}`;
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.is_owner) return res.status(400).json({ error: 'Cannot remove the owner' });
  if (u.role !== 'admin') return res.status(400).json({ error: 'User is not an admin' });
  await sql`UPDATE users SET role='neighbor', is_owner=false WHERE id=${u.id}`;
  res.json({ ok: true });
}));

// ─── Ban system ───────────────────────────────────────────────────────────────

app.post('/api/admin/users/:username/ban', requireAdmin(async (req, res) => {
  const { reason } = req.body;
  const [u] = await sql`SELECT * FROM users WHERE username=${req.params.username}`;
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (u.id === req.currentUser.id) return res.status(400).json({ error: 'Cannot ban yourself' });
  if (u.is_owner) return res.status(400).json({ error: 'Cannot ban the platform owner' });
  if (u.role === 'hoa') return res.status(400).json({ error: 'Cannot ban HOA accounts' });

  const [ban] = await sql`
    INSERT INTO banned_users (user_id, username, email, name, address, avatar_hex, initials, original_role, reason, banned_by_user_id)
    VALUES (${u.id}, ${u.username}, ${u.email||null}, ${u.name}, ${u.address}, ${u.avatar_hex}, ${u.initials}, ${u.role}, ${reason || 'Violation of Member Agreement'}, ${req.currentUser.id})
    RETURNING *
  `;
  await sql`DELETE FROM users WHERE id=${u.id}`;
  res.json({ ok: true, ban: { id: ban.id, username: ban.username, name: ban.name, reason: ban.reason, bannedAt: ban.banned_at } });
}));

app.post('/api/admin/banned/:id/unban', requireAdmin(async (req, res) => {
  await sql`UPDATE banned_users SET lifted_at=NOW() WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

app.get('/api/admin/banned', requireAdmin(async (req, res) => {
  const rows = await sql`SELECT * FROM banned_users WHERE lifted_at IS NULL ORDER BY banned_at DESC`;
  res.json(rows.map(r => ({
    id: r.id, username: r.username, email: r.email, name: r.name, address: r.address,
    avatar: r.avatar_hex, initials: r.initials, role: r.original_role,
    reason: r.reason, bannedAt: r.banned_at,
  })));
}));

// ─── Security alerts & HOA contacts ──────────────────────────────────────────

app.get('/api/admin/community-safety', requireAdmin(async (req, res) => {
  const safetyPosts = await fetchPostsWithMeta(`WHERE p.type = 'safety'`, req.currentUser.id);
  const reportRows  = await sql`
    SELECT r.*, u.name AS reporter_name FROM reports r
    JOIN users u ON r.reported_by_user_id = u.id
    WHERE r.target_type = 'post' OR r.reason ILIKE '%safety%' OR r.reason ILIKE '%threat%'
    ORDER BY r.created_at DESC
  `;
  const formatted = [
    ...safetyPosts.map(p => ({
      id: p.id, type: 'community_post',
      title: p.alertType ? `${p.alertType} alert` : 'Safety Post',
      message: p.content, severity: p.severity || 'medium',
      author: p.author?.name || 'Unknown', createdAt: p.createdAt,
      forwardedToDecameron: p.forwardedToDecameron,
    })),
    ...reportRows.map(r => ({
      id: r.id, type: 'report',
      title: `Report: ${r.target_label || r.target_type}`,
      message: `Reason: ${r.reason}${r.note ? '\nNote: ' + r.note : ''}`,
      severity: 'medium', author: r.reporter_name, createdAt: r.created_at,
      forwardedToDecameron: r.forwarded_to_decameron,
    })),
  ];
  formatted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(formatted);
}));

app.post('/api/admin/decameron-email', requireOwner(async (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
  await sql`INSERT INTO app_settings (key, value) VALUES ('decameron_email', ${email}) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`;
  res.json({ ok: true });
}));

app.get('/api/admin/decameron-email', requireAdmin(async (req, res) => {
  const [row] = await sql`SELECT value FROM app_settings WHERE key='decameron_email'`;
  res.json({ email: row?.value || '' });
}));

app.post('/api/admin/forward-to-decameron', requireAdmin(async (req, res) => {
  const { itemId, itemType, title, message, severity, author, createdAt } = req.body;
  const [decRow] = await sql`SELECT value FROM app_settings WHERE key='decameron_email'`;
  if (!decRow?.value) return res.status(400).json({ error: 'Decameron email not configured' });
  const sevColors = { low:'#16a34a', medium:'#d97706', high:'#ea580c', urgent:'#dc2626' };
  const sevLabels = { low:'Low', medium:'Medium', high:'High', urgent:'URGENT' };
  try {
    await sendEmail({
      to: decRow.value,
      subject: `[Safety Alert] ${title} — Costa Blanca Villas`,
      html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="background:#0077B6;color:white;padding:20px;border-radius:8px 8px 0 0;"><h2 style="margin:0;">🏘️ Costa Blanca Villas — Safety Alert</h2></div><div style="background:#fff3cd;border-left:4px solid ${sevColors[severity]||'#d97706'};padding:14px 20px;"><strong>Severity:</strong> ${sevLabels[severity]||severity} · <strong>Reported by:</strong> ${author} · <strong>Time:</strong> ${new Date(createdAt).toLocaleString()}</div><div style="padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;"><h3 style="color:#0077B6;margin-top:0;">${title}</h3><p style="white-space:pre-wrap;">${message}</p></div></div>`
    });
    if (itemId) {
      await sql`UPDATE posts   SET forwarded_to_decameron=true WHERE id=${itemId}`;
      await sql`UPDATE reports SET forwarded_to_decameron=true WHERE id=${itemId}`;
    }
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: 'Email failed: ' + err.message }); }
}));

app.get('/api/admin/hoa-contacts', requireAdmin(async (req, res) => {
  const rows = await sql`SELECT * FROM hoa_contacts ORDER BY created_at`;
  res.json(rows.map(r => ({ id: r.id, name: r.name, email: r.email, addedAt: r.created_at })));
}));

app.post('/api/admin/hoa-contacts', requireAdmin(async (req, res) => {
  const { name, email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
  const [row] = await sql`
    INSERT INTO hoa_contacts (email, name, added_by_user_id) VALUES (${email}, ${name||email}, ${req.currentUser.id})
    ON CONFLICT (email) DO NOTHING
    RETURNING *
  `;
  if (!row) return res.status(409).json({ error: 'Email already in list' });
  res.json({ ok: true, contact: { id: row.id, name: row.name, email: row.email } });
}));

app.delete('/api/admin/hoa-contacts/:id', requireAdmin(async (req, res) => {
  await sql`DELETE FROM hoa_contacts WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

app.post('/api/admin/email-config', requireOwner(async (req, res) => {
  const { gmailUser, gmailAppPassword } = req.body;
  if (!gmailUser || !gmailAppPassword) return res.status(400).json({ error: 'Gmail address and App Password required' });
  await sql`INSERT INTO app_settings (key,value) VALUES ('gmail_user',${gmailUser}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;
  await sql`INSERT INTO app_settings (key,value) VALUES ('gmail_pass',${gmailAppPassword}) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`;
  res.json({ ok: true, configured: true });
}));

app.get('/api/admin/email-config', requireOwner(async (req, res) => {
  const cfg = await getEmailConfig();
  res.json({ configured: !!(cfg.gmail_user && cfg.gmail_pass), user: cfg.gmail_user || '' });
}));

app.get('/api/admin/security-alerts', requireAdmin(async (req, res) => {
  const rows = await sql`SELECT * FROM security_alerts ORDER BY created_at DESC`;
  res.json(rows.map(r => ({
    id: r.id, alertType: r.alert_type, severity: r.severity,
    title: r.title, message: r.message, postToFeed: r.post_to_feed,
    emailHOA: r.email_hoa, sentTo: r.sent_to, emailStatus: r.email_status,
    emailError: r.email_error, createdAt: r.created_at,
  })));
}));

app.post('/api/admin/security-alerts', requireAdmin(async (req, res) => {
  const { alertType, severity, title, message, postToFeed, emailHOA } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'Title and message required' });

  const contacts     = emailHOA ? await sql`SELECT email FROM hoa_contacts` : [];
  const sentTo       = contacts.map(c => c.email);
  let   emailStatus  = 'not_sent';
  let   emailError   = null;

  if (postToFeed) {
    await sql`
      INSERT INTO posts (type, section, content, author_id, alert_type, severity, is_official)
      VALUES ('safety', 'feed', ${`**${title}**\n\n${message}`}, ${req.currentUser.id}, ${alertType||'general'}, ${severity||'medium'}, true)
    `;
  }

  if (emailHOA && contacts.length) {
    try {
      await sendEmail({
        to: sentTo,
        subject: `[${severity||'Alert'}] ${title} — Costa Blanca Villas`,
        html: `<div style="font-family:sans-serif;max-width:600px;"><h2 style="color:#0077B6;">${title}</h2><p>${message.replace(/\n/g,'<br>')}</p><hr style="border:none;border-top:1px solid #eee;"><p style="color:#888;font-size:12px;">Costa Blanca Connect · Costa Blanca Villas, Farallón, Coclé, Panamá</p></div>`
      });
      emailStatus = 'sent';
    } catch (err) { emailStatus = 'failed'; emailError = err.message; }
  }

  const [alert] = await sql`
    INSERT INTO security_alerts (alert_type, severity, title, message, post_to_feed, email_hoa, sent_to, email_status, email_error, created_by_user_id)
    VALUES (${alertType||'general'}, ${severity||'medium'}, ${title}, ${message}, ${!!postToFeed}, ${!!emailHOA}, ${JSON.stringify(sentTo)}, ${emailStatus}, ${emailError}, ${req.currentUser.id})
    RETURNING *
  `;
  res.json({ ok: true, alert });
}));

// ─── Admin: managed accounts ─────────────────────────────────────────────────

app.post('/api/admin/create-account', requireOwner(async (req, res) => {
  const { displayName, username, password, role, address, bio } = req.body;
  if (!displayName || !username || !password || !role) return res.status(400).json({ error: 'Missing required fields' });
  if (!['hoa','business','realtor','neighbor'].includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const existing = await sql`SELECT id FROM users WHERE username=${username} UNION SELECT id FROM pending_registrations WHERE username=${username} LIMIT 1`;
  if (existing.length) return res.status(409).json({ error: 'Username already taken' });

  const initials = displayName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const COLORS   = ['#0077B6','#2A9D8F','#E76F51','#6D6875','#264653','#457B9D','#C0392B','#1D3557'];
  const avatarHex = COLORS[Math.floor(Math.random() * COLORS.length)];
  const hash     = await bcrypt.hash(password, 12);

  const [newUser] = await sql`
    INSERT INTO users (username, password_hash, role, name, initials, avatar_hex, address, bio, verified, managed_account)
    VALUES (${username}, ${hash}, ${role}, ${displayName}, ${initials}, ${avatarHex}, ${address||'Costa Blanca Villas, Farallón'}, ${bio||`Official ${role} account.`}, true, true)
    RETURNING *
  `;
  res.json({ ok: true, user: { username, displayName, role, password } });
}));

app.get('/api/admin/realtors', requireAdmin(async (req, res) => {
  const rows = await sql`SELECT * FROM users WHERE role='realtor' ORDER BY name`;
  res.json(rows.map(u => ({ username: u.username, name: u.name, avatar: u.avatar_hex, initials: u.initials, address: u.address, bio: u.bio })));
}));

app.get('/api/admin/managed-accounts', requireOwner(async (req, res) => {
  const rows = await sql`SELECT * FROM users WHERE managed_account=true OR role='hoa' ORDER BY name`;
  res.json(rows.map(u => ({ username: u.username, name: u.name, role: u.role, avatar: u.avatar_hex, initials: u.initials })));
}));

// ─── Pending registrations ────────────────────────────────────────────────────

app.get('/api/admin/pending', requireAdmin(async (req, res) => {
  const rows = await sql`SELECT * FROM pending_registrations WHERE status='pending' ORDER BY submitted_at DESC`;
  res.json(rows.map(r => ({
    id: r.id, username: r.username, role: r.role, name: r.name,
    fullName: r.full_name, address: r.address,
    businessName: r.business_name, businessCategory: r.business_category,
    bio: r.bio, avatar: r.avatar_hex, initials: r.initials,
    submittedAt: r.submitted_at, status: r.status,
  })));
}));

app.post('/api/admin/pending/:id/approve', requireAdmin(async (req, res) => {
  const [p] = await sql`SELECT * FROM pending_registrations WHERE id=${req.params.id} AND status='pending'`;
  if (!p) return res.status(404).json({ error: 'Not found' });

  const [newUser] = await sql`
    INSERT INTO users (username, email, password_hash, role, name, full_name, address, bio, avatar_hex, initials, verified, points, years_in_neighborhood)
    VALUES (${p.username}, ${p.email||null}, ${p.password_hash}, ${p.role}, ${p.name}, ${p.full_name}, ${p.address}, ${p.bio||''}, ${p.avatar_hex}, ${p.initials}, true, 0, 0)
    RETURNING *
  `;

  if (p.role === 'business' && p.business_name) {
    const [biz] = await sql`
      INSERT INTO businesses (name, category, description, claimed, claimed_by_user_id)
      VALUES (${p.business_name}, ${p.business_category||null}, ${p.bio||''}, true, ${newUser.id})
      RETURNING id
    `;
    await sql`UPDATE users SET business_id=${biz.id} WHERE id=${newUser.id}`;
  }

  await sql`UPDATE pending_registrations SET status='approved', reviewed_by_user_id=${req.currentUser.id}, reviewed_at=NOW() WHERE id=${p.id}`;
  res.json({ ok: true, user: formatUser(newUser) });
}));

app.post('/api/admin/pending/:id/reject', requireAdmin(async (req, res) => {
  await sql`UPDATE pending_registrations SET status='rejected', reviewed_by_user_id=${req.currentUser.id}, reviewed_at=NOW() WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

// ─── Sponsored posts ──────────────────────────────────────────────────────────

app.get('/api/admin/sponsored-posts', requireAdmin(async (req, res) => {
  const rows = await sql`SELECT * FROM sponsored_posts ORDER BY created_at DESC`;
  res.json(rows.map(r => ({
    id: r.id, type: 'sponsored', businessName: r.business_name, businessUsername: r.business_username,
    avatar: r.avatar_hex, initials: r.initials, content: r.content,
    linkUrl: r.link_url, linkLabel: r.link_label, image: r.image_url,
    active: r.active, createdAt: r.created_at,
  })));
}));

app.post('/api/admin/sponsored-posts', requireAdmin(async (req, res) => {
  const { businessName, businessUsername, content, linkUrl, linkLabel, image } = req.body;
  if (!businessName || !content) return res.status(400).json({ error: 'Business name and content required' });

  let avatarHex = '#0077B6', initials = businessName.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  if (businessUsername) {
    const [biz] = await sql`SELECT avatar_hex, initials FROM users WHERE username=${businessUsername}`;
    if (biz) { avatarHex = biz.avatar_hex; initials = biz.initials; }
  }
  const imageUrl = await storeImage(image, 'sponsored');

  const [sp] = await sql`
    INSERT INTO sponsored_posts (business_name, business_user_id, avatar_hex, initials, content, link_url, link_label, image_url, created_by_user_id)
    SELECT ${businessName},
           (SELECT id FROM users WHERE username=${businessUsername||''} LIMIT 1),
           ${avatarHex}, ${initials}, ${content}, ${linkUrl||null}, ${linkLabel||'Learn More'}, ${imageUrl}, ${req.currentUser.id}
    RETURNING *
  `;
  res.json({ ok: true, post: { id: sp.id, type:'sponsored', businessName: sp.business_name, avatar: sp.avatar_hex, initials: sp.initials, content: sp.content, linkUrl: sp.link_url, linkLabel: sp.link_label, image: sp.image_url, active: sp.active, createdAt: sp.created_at } });
}));

app.patch('/api/admin/sponsored-posts/:id/toggle', requireAdmin(async (req, res) => {
  const [sp] = await sql`UPDATE sponsored_posts SET active=NOT active WHERE id=${req.params.id} RETURNING active`;
  if (!sp) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true, active: sp.active });
}));

app.delete('/api/admin/sponsored-posts/:id', requireAdmin(async (req, res) => {
  await sql`DELETE FROM sponsored_posts WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

// ─── Posts ────────────────────────────────────────────────────────────────────

app.get('/api/posts', async (req, res) => {
  try {
    const user    = await getUser(req);
    const userId  = user?.id || null;
    const section = req.query.section || 'feed';

    if (section === 'marketplace' || section === 'safety') {
      await sql`DELETE FROM posts WHERE section=${section} AND created_at < NOW() - INTERVAL '90 days'`;
    }

    let posts;
    if (section === 'feed') {
      posts = await fetchPostsWithMeta(`WHERE (p.section = 'feed' OR p.section IS NULL)`, userId);
      // Inject active sponsored posts after position 2
      const sponsored = await sql`SELECT * FROM sponsored_posts WHERE active=true ORDER BY created_at DESC`;
      const formatted = sponsored.map(s => ({
        id: s.id, type: 'sponsored', section: 'feed',
        businessName: s.business_name, businessUsername: s.business_username,
        avatar: s.avatar_hex, initials: s.initials,
        content: s.content, linkUrl: s.link_url, linkLabel: s.link_label,
        image: s.image_url, active: s.active, createdAt: s.created_at,
      }));
      if (formatted.length) posts.splice(Math.min(2, posts.length), 0, ...formatted);
    } else {
      posts = await fetchPostsWithMeta(`WHERE p.section = '${section.replace(/'/g,"''")}'`, userId);
    }
    res.json(posts);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/posts', requireAuth(async (req, res) => {
  const { type, content, price, condition, category, pollOptions, image, location, alertType, severity, offerTitle, offerExpiry } = req.body;
  const u = req.currentUser;

  let resolvedSeverity = severity || 'medium';
  let isOfficial       = false;
  if (type === 'safety') {
    if (u.role === 'hoa' || u.role === 'admin') { isOfficial = true; resolvedSeverity = severity || 'high'; }
    else if (resolvedSeverity === 'high') resolvedSeverity = 'medium';
  }

  const imageUrl    = await storeImage(image, 'posts');
  const section     = type === 'safety' ? 'safety' : 'feed';
  const pollJson    = pollOptions ? JSON.stringify(pollOptions.map((text, i) => ({ id: `po${i}`, text }))) : null;

  const [post] = await sql`
    INSERT INTO posts (type, section, content, author_id, image_url, location, alert_type, severity, is_official,
      price, condition, category, poll_options, offer_title, offer_expiry)
    VALUES (${type||'general'}, ${section}, ${content}, ${u.id}, ${imageUrl}, ${location||null},
      ${type==='safety'?alertType||null:null}, ${type==='safety'?resolvedSeverity:null}, ${isOfficial},
      ${price!==undefined?Number(price):null}, ${condition||null}, ${category||null},
      ${pollJson||null}::jsonb,
      ${offerTitle||null}, ${offerExpiry||null})
    RETURNING *
  `;

  await awardPoints(u.id, type === 'safety' ? 'safety_post' : 'post', type === 'safety' ? POINTS.safety_post : POINTS.post);

  // Notify all neighbors about lost & found posts
  if (type === 'lost_found') {
    const allMembers = await sql`SELECT id FROM users WHERE role IN ('neighbor','admin') AND id != ${u.id}`;
    if (allMembers.length) {
      const msg = `${u.name} posted a Lost & Found: "${(content||'').slice(0,80)}${(content||'').length>80?'…':''}"`;
      await Promise.all(allMembers.map(m =>
        sql`INSERT INTO notifications (user_id, type, message, avatar_hex, initials)
            VALUES (${m.id}, 'lost_found', ${msg}, ${u.avatar_hex}, ${u.initials})`
      ));
    }
  }

  // Auto-cross-post to Safety & Security Watch group if high severity
  if (type === 'safety' && resolvedSeverity === 'high') {
    const [g6] = await sql`SELECT id FROM groups WHERE name ILIKE '%Safety%Security%Watch%' LIMIT 1`;
    if (g6) {
      await sql`INSERT INTO group_posts (group_id, author_id, content) VALUES (${g6.id}, ${u.id}, ${`[Safety Alert] ${content}`})`;
      await sql`UPDATE groups SET last_activity_at=NOW() WHERE id=${g6.id}`;
    }
  }

  // Build response matching frontend expectations
  const fullPost = await fetchPostsWithMeta(`WHERE p.id = '${post.id}'`, u.id);
  res.json(fullPost[0] || post);
}));

app.delete('/api/posts/:id', requireAuth(async (req, res) => {
  const [post] = await sql`SELECT author_id FROM posts WHERE id=${req.params.id}`;
  if (!post) return res.status(404).json({ error: 'Not found' });
  if (post.author_id !== req.currentUser.id && req.currentUser.role !== 'admin')
    return res.status(403).json({ error: 'Not authorized' });
  await sql`DELETE FROM posts WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

app.post('/api/posts/:id/resolve', requireAuth(async (req, res) => {
  const u = req.currentUser;
  if (u.role !== 'admin' && u.role !== 'hoa') return res.status(403).json({ error: 'Admin/HOA only' });
  const [post] = await sql`
    UPDATE posts SET severity='resolved', resolved_by_user_id=${u.id}, resolved_at=NOW()
    WHERE id=${req.params.id} RETURNING *
  `;
  if (!post) return res.status(404).json({ error: 'Not found' });
  res.json({ ...post, resolvedBy: u.name, resolvedAt: post.resolved_at });
}));

app.post('/api/posts/:id/react', requireAuth(async (req, res) => {
  const { reaction } = req.body;
  const valid = ['like','insightful','agree','haha','wow','sad'];
  if (!valid.includes(reaction)) return res.status(400).json({ error: 'Invalid reaction' });

  const [post] = await sql`SELECT id, author_id FROM posts WHERE id=${req.params.id}`;
  if (!post) return res.status(404).json({ error: 'Not found' });

  const [existing] = await sql`SELECT reaction_type FROM post_reactions WHERE post_id=${post.id} AND user_id=${req.currentUser.id}`;

  if (existing?.reaction_type === reaction) {
    // Toggle off
    await sql`DELETE FROM post_reactions WHERE post_id=${post.id} AND user_id=${req.currentUser.id}`;
    if (post.author_id !== req.currentUser.id) await awardPoints(post.author_id, 'react_received', -POINTS.react_received);
  } else {
    await sql`
      INSERT INTO post_reactions (post_id, user_id, reaction_type) VALUES (${post.id}, ${req.currentUser.id}, ${reaction})
      ON CONFLICT (post_id, user_id) DO UPDATE SET reaction_type=${reaction}, created_at=NOW()
    `;
    if (!existing && post.author_id !== req.currentUser.id) await awardPoints(post.author_id, 'react_received', POINTS.react_received);
  }

  const counts = await sql`SELECT reaction_type, COUNT(*)::int AS cnt FROM post_reactions WHERE post_id=${post.id} GROUP BY reaction_type`;
  const reactions = { like:0, insightful:0, agree:0, haha:0, wow:0, sad:0 };
  counts.forEach(r => { reactions[r.reaction_type] = r.cnt; });
  const [ur] = await sql`SELECT reaction_type FROM post_reactions WHERE post_id=${post.id} AND user_id=${req.currentUser.id}`;
  res.json({ reactions, userReaction: ur?.reaction_type || null });
}));

app.post('/api/posts/:id/vote', requireAuth(async (req, res) => {
  const { optionId } = req.body;
  const [post] = await sql`SELECT id, poll_options FROM posts WHERE id=${req.params.id}`;
  if (!post || !post.poll_options) return res.status(404).json({ error: 'Not a poll' });

  const [existing] = await sql`SELECT option_id FROM poll_votes WHERE post_id=${post.id} AND user_id=${req.currentUser.id}`;
  if (existing?.option_id === optionId) {
    await sql`DELETE FROM poll_votes WHERE post_id=${post.id} AND user_id=${req.currentUser.id}`;
  } else {
    await sql`
      INSERT INTO poll_votes (post_id, user_id, option_id) VALUES (${post.id}, ${req.currentUser.id}, ${optionId})
      ON CONFLICT (post_id, user_id) DO UPDATE SET option_id=${optionId}
    `;
  }
  const voteCounts = await sql`SELECT option_id, COUNT(*)::int AS cnt FROM poll_votes WHERE post_id=${post.id} GROUP BY option_id`;
  const voteMap = {};
  voteCounts.forEach(r => { voteMap[r.option_id] = r.cnt; });
  const [uv] = await sql`SELECT option_id FROM poll_votes WHERE post_id=${post.id} AND user_id=${req.currentUser.id}`;
  const pollOptions = post.poll_options.map(o => ({ id: o.id, text: o.text, votes: voteMap[o.id] || 0 }));
  res.json({ pollOptions, userVote: uv?.option_id || null });
}));

app.get('/api/posts/:id/comments', async (req, res) => {
  try {
    const rows = await sql`
      SELECT c.*, u.username, u.name, u.avatar_hex, u.initials
      FROM comments c JOIN users u ON c.author_id = u.id
      WHERE c.post_id=${req.params.id} ORDER BY c.created_at ASC
    `;
    res.json(rows.map(r => ({
      id: r.id, content: r.content, createdAt: r.created_at,
      author: { id: r.author_id, username: r.username, name: r.name, avatar: r.avatar_hex, initials: r.initials },
    })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.delete('/api/posts/:id/comments/:commentId', requireAuth(async (req, res) => {
  const [comment] = await sql`SELECT author_id FROM comments WHERE id=${req.params.commentId}`;
  if (!comment) return res.status(404).json({ error: 'Not found' });
  if (comment.author_id !== req.currentUser.id && req.currentUser.role !== 'admin')
    return res.status(403).json({ error: 'Not authorized' });
  await sql`DELETE FROM comments WHERE id=${req.params.commentId}`;
  res.json({ ok: true });
}));

app.post('/api/posts/:id/comments', requireAuth(async (req, res) => {
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Content required' });
  const u = req.currentUser;

  const [comment] = await sql`
    INSERT INTO comments (post_id, author_id, content) VALUES (${req.params.id}, ${u.id}, ${content.trim()})
    RETURNING *
  `;
  const [post] = await sql`SELECT author_id FROM posts WHERE id=${req.params.id}`;
  if (post?.author_id && post.author_id !== u.id) await awardPoints(post.author_id, 'comment', POINTS.react_received);
  await awardPoints(u.id, 'comment', POINTS.comment);

  res.json({
    id: comment.id, content: comment.content, createdAt: comment.created_at,
    author: { id: u.id, username: u.username, name: u.name, avatar: u.avatar_hex, initials: u.initials },
  });
}));

// ─── Events ───────────────────────────────────────────────────────────────────

app.get('/api/events', async (req, res) => {
  try {
    const user   = await getUser(req);
    const userId = user?.id || null;
    const rows   = await sql`
      SELECT e.*, u.username AS host_username, u.name AS host_name, u.avatar_hex AS host_avatar, u.initials AS host_initials, u.verified AS host_verified,
        COALESCE((SELECT COUNT(*)::int FROM event_rsvps WHERE event_id=e.id AND status='going'),0)    AS going_count,
        COALESCE((SELECT COUNT(*)::int FROM event_rsvps WHERE event_id=e.id AND status='maybe'),0)   AS maybe_count,
        COALESCE((SELECT COUNT(*)::int FROM event_rsvps WHERE event_id=e.id AND status='cant_go'),0) AS cant_go_count
      FROM events e JOIN users u ON e.host_id = u.id
      ORDER BY e.event_date ASC
    `;
    let userRsvps = {};
    if (userId) {
      const urs = await sql`SELECT event_id, status FROM event_rsvps WHERE user_id=${userId}`;
      urs.forEach(r => { userRsvps[r.event_id] = r.status; });
    }
    res.json(rows.map(e => ({
      id: e.id, title: e.title, description: e.description,
      host: { id: e.host_id, username: e.host_username, name: e.host_name, avatar: e.host_avatar, initials: e.host_initials, verified: e.host_verified },
      location: e.location, date: e.event_date, time: e.event_time, endTime: e.end_time,
      category: e.category, isHoaEvent: e.is_hoa_event, image: e.image_url || null, cancelled: e.cancelled || false,
      rsvp: { going: e.going_count, maybe: e.maybe_count, cantGo: e.cant_go_count },
      userRsvp: userRsvps[e.id] ? (userRsvps[e.id] === 'cant_go' ? 'cantGo' : userRsvps[e.id]) : null,
      goingAvatars: [],
    })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/events/:id/rsvp', requireAuth(async (req, res) => {
  const { status } = req.body;
  const validStatuses = ['going','maybe','cantGo'];
  const dbStatus = status === 'cantGo' ? 'cant_go' : status;

  const [event] = await sql`SELECT id FROM events WHERE id=${req.params.id}`;
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const [existing] = await sql`SELECT status FROM event_rsvps WHERE event_id=${event.id} AND user_id=${req.currentUser.id}`;

  if (!status || (existing && existing.status === dbStatus)) {
    // Cancel RSVP
    await sql`DELETE FROM event_rsvps WHERE event_id=${event.id} AND user_id=${req.currentUser.id}`;
    if (existing?.status === 'going') await awardPoints(req.currentUser.id, 'event_rsvp', -POINTS.event_rsvp);
  } else {
    await sql`
      INSERT INTO event_rsvps (event_id, user_id, status) VALUES (${event.id}, ${req.currentUser.id}, ${dbStatus})
      ON CONFLICT (event_id, user_id) DO UPDATE SET status=${dbStatus}
    `;
    if (dbStatus === 'going' && existing?.status !== 'going') await awardPoints(req.currentUser.id, 'event_rsvp', POINTS.event_rsvp);
    if (existing?.status === 'going' && dbStatus !== 'going') await awardPoints(req.currentUser.id, 'event_rsvp', -POINTS.event_rsvp);
  }

  const counts = await sql`
    SELECT
      SUM(CASE WHEN status='going'    THEN 1 ELSE 0 END)::int AS going,
      SUM(CASE WHEN status='maybe'    THEN 1 ELSE 0 END)::int AS maybe,
      SUM(CASE WHEN status='cant_go'  THEN 1 ELSE 0 END)::int AS cant_go
    FROM event_rsvps WHERE event_id=${event.id}
  `;
  const [ur] = await sql`SELECT status FROM event_rsvps WHERE event_id=${event.id} AND user_id=${req.currentUser.id}`;
  res.json({
    rsvp: { going: counts[0]?.going||0, maybe: counts[0]?.maybe||0, cantGo: counts[0]?.cant_go||0 },
    userRsvp: ur ? (ur.status === 'cant_go' ? 'cantGo' : ur.status) : null,
  });
}));

// ─── Businesses ───────────────────────────────────────────────────────────────

async function getBizFaveData(bizId, userId) {
  const year = new Date().getFullYear();
  const [row] = await sql`SELECT COUNT(*)::int AS cnt FROM business_faves WHERE business_id=${bizId} AND year=${year}`;
  const [threshold] = await sql`SELECT fave_threshold, fave_years FROM businesses WHERE id=${bizId}`;
  let userHasFaved = false;
  if (userId) {
    const [fv] = await sql`SELECT id FROM business_faves WHERE business_id=${bizId} AND user_id=${userId} AND year=${year}`;
    userHasFaved = !!fv;
  }
  return { currentYearFaves: row?.cnt||0, faveThreshold: threshold?.fave_threshold||30, userHasFaved, faveYears: threshold?.fave_years||[] };
}

function formatBusiness(b) {
  return {
    id: b.id, name: b.name, category: b.category, description: b.description,
    address: b.address, phone: b.phone, hours: b.hours, website: b.website,
    instagramUrl: b.instagram_url||null, facebookUrl: b.facebook_url||null,
    photos: b.photos||[], tags: b.tags||[], rating: parseFloat(b.rating)||0,
    reviewCount: b.review_count||0, recommendedBy: b.recommended_by||0,
    claimed: b.claimed,
    bannerUrl: b.banner_url||null, logoUrl: b.logo_url||null,
    addedByUserId: b.added_by_user_id||null, claimedByUserId: b.claimed_by_user_id||null,
  };
}

app.post('/api/businesses', requireAuth(async (req, res) => {
  const { name, category, description, address, phone, hours, website, instagramUrl, facebookUrl } = req.body;
  if (!name) return res.status(400).json({ error: 'Business name required' });
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS instagram_url TEXT`;
  await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS facebook_url TEXT`;
  const [biz] = await sql`
    INSERT INTO businesses (name, category, description, address, phone, hours, website, instagram_url, facebook_url, added_by_user_id, claimed)
    VALUES (${name}, ${category||null}, ${description||''}, ${address||null}, ${phone||null}, ${hours||null}, ${website||null}, ${instagramUrl||null}, ${facebookUrl||null}, ${req.currentUser.id}, false)
    RETURNING *
  `;
  res.json({ ok: true, business: formatBusiness(biz) });
}));

app.post('/api/admin/businesses', requireAdmin(async (req, res) => {
  const { name, category, description, address, phone, hours, website } = req.body;
  if (!name) return res.status(400).json({ error: 'Business name required' });
  const [biz] = await sql`
    INSERT INTO businesses (name, category, description, address, phone, hours, website, added_by_user_id, claimed)
    VALUES (${name}, ${category||null}, ${description||''}, ${address||null}, ${phone||null}, ${hours||null}, ${website||null}, ${req.currentUser.id}, false)
    RETURNING *
  `;
  res.json({ ok: true, business: formatBusiness(biz) });
}));

app.post('/api/businesses/:id/banner', requireAuth(upload.single('banner'), async (req, res) => {
  const [biz] = await sql`SELECT claimed_by_user_id, added_by_user_id FROM businesses WHERE id=${req.params.id}`;
  if (!biz) return res.status(404).json({ error: 'Not found' });
  const isOwner = biz.claimed_by_user_id === req.currentUser.id || biz.added_by_user_id === req.currentUser.id;
  if (!isOwner && req.currentUser.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  const url = await storeImage(b64, 'biz-banner');
  await sql`UPDATE businesses SET banner_url=${url} WHERE id=${req.params.id}`;
  res.json({ ok: true, bannerUrl: url });
}));

app.post('/api/businesses/:id/logo', requireAuth(upload.single('logo'), async (req, res) => {
  const [biz] = await sql`SELECT claimed_by_user_id, added_by_user_id FROM businesses WHERE id=${req.params.id}`;
  if (!biz) return res.status(404).json({ error: 'Not found' });
  const isOwner = biz.claimed_by_user_id === req.currentUser.id || biz.added_by_user_id === req.currentUser.id;
  if (!isOwner && req.currentUser.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const b64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  const url = await storeImage(b64, 'biz-logo');
  await sql`UPDATE businesses SET logo_url=${url} WHERE id=${req.params.id}`;
  res.json({ ok: true, logoUrl: url });
}));

app.get('/api/my-business', requireAuth(async (req, res) => {
  const [biz] = await sql`SELECT id FROM businesses WHERE claimed_by_user_id=${req.currentUser.id} OR added_by_user_id=${req.currentUser.id} LIMIT 1`;
  if (!biz) return res.status(404).json({ error: 'No business found' });
  res.json({ id: biz.id });
}));

app.get('/api/businesses', async (req, res) => {
  try {
    const user  = await getUser(req);
    const rows  = await sql`SELECT * FROM businesses ORDER BY name`;
    const year  = new Date().getFullYear();
    const faves = await sql`SELECT business_id, COUNT(*)::int AS cnt FROM business_faves WHERE year=${year} GROUP BY business_id`;
    const faveMap = {};
    faves.forEach(f => { faveMap[f.business_id] = f.cnt; });
    let userFaves = {};
    if (user) {
      const uf = await sql`SELECT business_id FROM business_faves WHERE user_id=${user.id} AND year=${year}`;
      uf.forEach(f => { userFaves[f.business_id] = true; });
    }
    res.json(rows.map(b => ({ ...formatBusiness(b), currentYearFaves: faveMap[b.id]||0, userHasFaved: !!userFaves[b.id] })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/businesses/:id', async (req, res) => {
  try {
    const user   = await getUser(req);
    const [biz]  = await sql`SELECT * FROM businesses WHERE id=${req.params.id}`;
    if (!biz) return res.status(404).json({ error: 'Not found' });
    const reviews = await sql`
      SELECT r.*, u.name AS author_name, u.avatar_hex, u.initials
      FROM business_reviews r JOIN users u ON r.author_id = u.id
      WHERE r.business_id=${biz.id} ORDER BY r.created_at DESC
    `;
    const fd = await getBizFaveData(biz.id, user?.id);
    res.json({
      ...formatBusiness(biz), ...fd,
      reviews: reviews.map(r => ({
        id: r.id, author: r.author_name, avatar: r.avatar_hex, initials: r.initials,
        rating: r.rating, text: r.text, date: timeAgo(r.created_at),
        ownerReply: r.owner_reply_text ? { text: r.owner_reply_text, date: r.owner_reply_date } : undefined,
      })),
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/businesses/:id/fave', requireAuth(async (req, res) => {
  const bizId = req.params.id;
  const [biz] = await sql`SELECT id, fave_years, fave_threshold FROM businesses WHERE id=${bizId}`;
  if (!biz) return res.status(404).json({ error: 'Not found' });
  const year = new Date().getFullYear();
  const [existing] = await sql`SELECT id FROM business_faves WHERE business_id=${bizId} AND user_id=${req.currentUser.id} AND year=${year}`;

  let faved;
  if (existing) {
    await sql`DELETE FROM business_faves WHERE id=${existing.id}`;
    faved = false;
  } else {
    await sql`INSERT INTO business_faves (business_id, user_id, year) VALUES (${bizId}, ${req.currentUser.id}, ${year})`;
    faved = true;
    const [cnt] = await sql`SELECT COUNT(*)::int AS c FROM business_faves WHERE business_id=${bizId} AND year=${year}`;
    if (cnt.c >= biz.fave_threshold && !(biz.fave_years||[]).includes(year)) {
      const newYears = [...(biz.fave_years||[]), year].sort();
      await sql`UPDATE businesses SET fave_years=${JSON.stringify(newYears)} WHERE id=${bizId}`;
    }
  }
  const fd = await getBizFaveData(bizId, req.currentUser.id);
  res.json({ faved, ...fd });
}));

app.post('/api/businesses/:id/recommend', requireAuth(async (req, res) => {
  const { text, rating } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'Text required' });
  const stars = Math.min(5, Math.max(1, parseInt(rating) || 5));
  const [biz] = await sql`SELECT id FROM businesses WHERE id=${req.params.id}`;
  if (!biz) return res.status(404).json({ error: 'Not found' });
  const u = req.currentUser;
  await sql`INSERT INTO business_reviews (business_id, author_id, rating, text) VALUES (${biz.id}, ${u.id}, ${stars}, ${text.trim()})`;
  const [avg] = await sql`SELECT ROUND(AVG(rating)::numeric, 1)::float AS avg, COUNT(*)::int AS cnt FROM business_reviews WHERE business_id=${biz.id}`;
  await sql`UPDATE businesses SET recommended_by = recommended_by + 1, rating = ${avg.avg}, review_count = ${avg.cnt} WHERE id=${biz.id}`;
  res.json({ ok: true });
}));

// ─── Business account routes ──────────────────────────────────────────────────

app.get('/api/business/me', requireAuth(async (req, res) => {
  const u = req.currentUser;
  if (u.role !== 'business') return res.status(403).json({ error: 'Not a business account' });
  const [biz] = await sql`SELECT * FROM businesses WHERE id=${u.business_id}`;
  if (!biz) return res.status(404).json({ error: 'Business not found' });
  const reviews   = await sql`SELECT r.*, u2.name AS author_name, u2.avatar_hex, u2.initials FROM business_reviews r JOIN users u2 ON r.author_id=u2.id WHERE r.business_id=${biz.id} ORDER BY r.created_at DESC`;
  const bizPosts  = await sql`SELECT id FROM posts WHERE business_id=${biz.id}`;
  const fd        = await getBizFaveData(biz.id, u.id);
  const allUsers  = await sql`SELECT COUNT(*)::int AS c FROM users`;
  res.json({
    ...formatBusiness(biz), ...fd,
    reviews: reviews.map(r => ({ id: r.id, author: r.author_name, avatar: r.avatar_hex, initials: r.initials, rating: r.rating, text: r.text, date: timeAgo(r.created_at) })),
    postsCount: bizPosts.length, totalReach: 0, neighborhoodSize: allUsers[0]?.c || 0,
  });
}));

app.post('/api/business/post', requireAuth(async (req, res) => {
  const u = req.currentUser;
  if (u.role !== 'business') return res.status(403).json({ error: 'Not a business account' });
  const [biz] = await sql`SELECT * FROM businesses WHERE id=${u.business_id}`;
  if (!biz) return res.status(404).json({ error: 'Business not found' });
  const { postType, content, offerTitle, offerExpiry, image } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const imageUrl = await storeImage(image, 'business');
  const type     = postType === 'promotion' ? 'promotion' : 'announcement';
  const [post]   = await sql`
    INSERT INTO posts (type, section, content, author_id, image_url, offer_title, offer_expiry, is_business_post, business_id)
    VALUES (${type}, 'feed', ${content}, ${u.id}, ${imageUrl}, ${offerTitle||null}, ${offerExpiry||null}, true, ${biz.id})
    RETURNING *
  `;
  const full = await fetchPostsWithMeta(`WHERE p.id = '${post.id}'`, u.id);
  res.json(full[0] || post);
}));

app.put('/api/business/profile', requireAuth(async (req, res) => {
  const u = req.currentUser;
  if (u.role !== 'business') return res.status(403).json({ error: 'Not a business account' });
  const { name, description, hours, phone, address, tags } = req.body;
  const tagsArr = tags ? (Array.isArray(tags) ? tags : tags.split(',').map(t=>t.trim()).filter(Boolean)) : undefined;
  const [biz] = await sql`
    UPDATE businesses SET
      name        = COALESCE(${name||null},        name),
      description = COALESCE(${description||null}, description),
      hours       = COALESCE(${hours||null},       hours),
      phone       = COALESCE(${phone||null},       phone),
      address     = COALESCE(${address||null},     address),
      tags        = COALESCE(${tagsArr?JSON.stringify(tagsArr):null}::jsonb, tags),
      updated_at  = NOW()
    WHERE id=${u.business_id}
    RETURNING *
  `;
  if (name) await sql`UPDATE users SET name=${name} WHERE id=${u.id}`;
  res.json(formatBusiness(biz));
}));

app.get('/api/business/posts', requireAuth(async (req, res) => {
  const u = req.currentUser;
  if (u.role !== 'business') return res.status(403).json({ error: 'Not a business account' });
  const posts = await fetchPostsWithMeta(`WHERE p.business_id = '${u.business_id}' AND p.is_business_post = true`, u.id);
  res.json(posts);
}));

app.post('/api/business/reviews/:id/reply', requireAuth(async (req, res) => {
  const u = req.currentUser;
  if (u.role !== 'business') return res.status(403).json({ error: 'Not a business account' });
  const { reply } = req.body;
  if (!reply) return res.status(400).json({ error: 'Reply text required' });
  const [review] = await sql`SELECT id, business_id FROM business_reviews WHERE id=${req.params.id}`;
  if (!review) return res.status(404).json({ error: 'Review not found' });
  if (review.business_id.toString() !== u.business_id?.toString()) return res.status(403).json({ error: 'Not your business' });
  const [updated] = await sql`
    UPDATE business_reviews SET owner_reply_text=${reply}, owner_reply_date='Just now' WHERE id=${review.id} RETURNING *
  `;
  res.json({ ok: true });
}));

// ─── Business claims ──────────────────────────────────────────────────────────

app.post('/api/business/claim', async (req, res) => {
  try {
    const { businessId, name, email, phone, role, message } = req.body;
    if (!businessId || !name || !email) return res.status(400).json({ error: 'Name and email are required' });
    const [biz] = await sql`SELECT id, claimed FROM businesses WHERE id=${businessId}`;
    if (!biz) return res.status(404).json({ error: 'Business not found' });
    if (biz.claimed) return res.status(409).json({ error: 'This business has already been claimed' });
    const [existing] = await sql`SELECT id FROM business_claims WHERE business_id=${businessId} AND status='pending'`;
    if (existing) return res.status(409).json({ error: 'A claim for this business is already under review' });
    await sql`INSERT INTO business_claims (business_id, claimant_name, email, phone, role_at_business, message) VALUES (${businessId}, ${name}, ${email}, ${phone||''}, ${role||'Owner'}, ${message||''})`;
    res.json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/admin/claims', requireAdmin(async (req, res) => {
  const rows = await sql`
    SELECT bc.*, b.name AS business_name, b.category AS business_category
    FROM business_claims bc JOIN businesses b ON bc.business_id = b.id
    ORDER BY bc.submitted_at DESC
  `;
  res.json(rows.map(r => ({
    id: r.id, businessId: r.business_id, businessName: r.business_name, businessCategory: r.business_category,
    name: r.claimant_name, email: r.email, phone: r.phone, role: r.role_at_business,
    message: r.message, status: r.status, submittedAt: r.submitted_at,
    approvedAt: r.reviewed_at, generatedUsername: r.generated_username,
  })));
}));

app.post('/api/admin/claims/:id/approve', requireAdmin(async (req, res) => {
  const [claim] = await sql`SELECT bc.*, b.name AS biz_name, b.description AS biz_desc, b.address AS biz_addr FROM business_claims bc JOIN businesses b ON bc.business_id=b.id WHERE bc.id=${req.params.id}`;
  if (!claim) return res.status(404).json({ error: 'Claim not found' });

  const slug  = claim.biz_name.toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,16) || 'biz';
  let username = slug, counter = 1;
  while (true) {
    const [ex] = await sql`SELECT id FROM users WHERE username=${username}`;
    if (!ex) break;
    username = slug + counter++;
  }
  const rawPassword = crypto.randomBytes(5).toString('base64').replace(/[^a-zA-Z0-9]/g,'').slice(0,8);
  const hash        = await bcrypt.hash(rawPassword, 12);
  const initials    = claim.claimant_name.trim().split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const COLORS      = ['#0077B6','#2A9D8F','#E76F51','#264653','#457B9D','#C0392B','#1D3557'];
  const avatarHex   = COLORS[Math.floor(Math.random()*COLORS.length)];

  const [newUser] = await sql`
    INSERT INTO users (username, password_hash, role, business_id, name, avatar_hex, initials, address, verified, bio, contact_email, contact_phone)
    VALUES (${username}, ${hash}, 'business', ${claim.business_id}, ${claim.biz_name}, ${avatarHex}, ${initials}, ${claim.biz_addr||'Farallón, Panama'}, true, ${claim.biz_desc||''}, ${claim.email}, ${claim.phone})
    RETURNING *
  `;
  await sql`UPDATE businesses SET claimed=true, claimed_by_user_id=${newUser.id} WHERE id=${claim.business_id}`;
  await sql`UPDATE business_claims SET status='approved', reviewed_by_user_id=${req.currentUser.id}, reviewed_at=NOW(), generated_username=${username} WHERE id=${claim.id}`;

  // Email credentials to business owner
  const appUrl = process.env.APP_URL || 'https://costablancaconnect.vercel.app';
  await sendEmail({
    to: claim.email,
    subject: `Welcome to Costa Blanca Connect — Your business login for ${claim.biz_name}`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;">
        <div style="background:#0077B6;color:white;padding:24px;border-radius:10px 10px 0 0;">
          <h2 style="margin:0;">🏘️ Costa Blanca Connect</h2>
          <p style="margin:6px 0 0;opacity:0.85;">Your business has been approved!</p>
        </div>
        <div style="padding:24px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 10px 10px;">
          <p>Hi ${claim.claimant_name},</p>
          <p>Great news — <strong>${claim.biz_name}</strong> has been approved on Costa Blanca Connect. Here are your login credentials:</p>
          <div style="background:#f4f8fb;border-radius:8px;padding:16px;margin:16px 0;">
            <p style="margin:0 0 8px;"><strong>Username:</strong> ${username}</p>
            <p style="margin:0;"><strong>Temporary Password:</strong> ${rawPassword}</p>
          </div>
          <p>Log in at <a href="${appUrl}">${appUrl}</a> and go to <strong>My Business</strong> to complete your profile, add photos, and post updates to the community.</p>
          <p style="color:#888;font-size:12px;margin-top:24px;">Please change your password after your first login.</p>
        </div>
      </div>
    `
  });

  res.json({ ok: true, credentials: { username, password: rawPassword, businessName: claim.biz_name } });
}));

app.post('/api/admin/claims/:id/deny', requireAdmin(async (req, res) => {
  await sql`UPDATE business_claims SET status='denied', reviewed_by_user_id=${req.currentUser.id}, reviewed_at=NOW() WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

// ─── Marketplace ──────────────────────────────────────────────────────────────

app.get('/api/marketplace', async (req, res) => {
  try {
    const rows = await sql`
      SELECT m.*, u.username, u.name AS seller_name, u.avatar_hex, u.initials, u.verified, u.address
      FROM marketplace_items m JOIN users u ON m.seller_id = u.id
      ORDER BY m.created_at DESC
    `;
    res.json(rows.map(r => ({
      id: r.id, title: r.title, price: parseFloat(r.price)||0, free: r.is_free,
      condition: r.condition, category: r.category, sold: r.sold || false,
      seller: { id: r.seller_id, username: r.username, name: r.seller_name, avatar: r.avatar_hex, initials: r.initials, verified: r.verified, address: r.address },
      description: r.description, image: r.image_url, color: r.color, createdAt: r.created_at,
    })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/marketplace', requireAuth(async (req, res) => {
  const { title, price, condition, category, description, image, color } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  const isFree   = !price || parseFloat(price) === 0;
  const imageUrl = await storeImage(image, 'marketplace');
  const [item]   = await sql`
    INSERT INTO marketplace_items (title, price, is_free, condition, category, seller_id, description, image_url, color)
    VALUES (${title}, ${parseFloat(price)||0}, ${isFree}, ${condition||null}, ${category||null}, ${req.currentUser.id}, ${description||''}, ${imageUrl}, ${color||'#0077B6'})
    RETURNING *
  `;
  await awardPoints(req.currentUser.id, 'marketplace_list', POINTS.marketplace_list);

  // Notify all neighbors about the new listing
  const u = req.currentUser;
  const neighbors = await sql`SELECT id FROM users WHERE role IN ('neighbor','admin') AND id != ${u.id}`;
  if (neighbors.length) {
    const msg = `${u.name} listed "${title}" in the Marketplace${isFree ? ' — Free!' : price ? ` for $${parseFloat(price).toFixed(2)}` : ''}`;
    await Promise.all(neighbors.map(n =>
      sql`INSERT INTO notifications (user_id, type, message, avatar_hex, initials)
          VALUES (${n.id}, 'marketplace', ${msg}, ${u.avatar_hex}, ${u.initials})`
    ));
  }

  res.json({ ok: true, item });
}));

app.delete('/api/marketplace/:id', requireAuth(async (req, res) => {
  const [item] = await sql`SELECT seller_id FROM marketplace_items WHERE id=${req.params.id}`;
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (item.seller_id !== req.currentUser.id && req.currentUser.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  await sql`DELETE FROM marketplace_items WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

app.patch('/api/marketplace/:id/sold', requireAuth(async (req, res) => {
  const [item] = await sql`SELECT seller_id FROM marketplace_items WHERE id=${req.params.id}`;
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (item.seller_id !== req.currentUser.id && req.currentUser.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  await sql`UPDATE marketplace_items SET sold=TRUE WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

// ─── Real estate ──────────────────────────────────────────────────────────────

app.get('/api/realestate', async (req, res) => {
  try {
    await sql`ALTER TABLE real_estate_listings ADD COLUMN IF NOT EXISTS external_url TEXT`;
    const { type } = req.query;
    const rows = type
      ? await sql`SELECT * FROM real_estate_listings WHERE type=${type} ORDER BY created_at DESC`
      : await sql`SELECT * FROM real_estate_listings ORDER BY created_at DESC`;
    res.json(rows.map(r => ({
      id: r.id, type: r.type, title: r.title, price: parseFloat(r.price)||0,
      image: r.image_url, externalUrl: r.external_url, listedAt: r.created_at,
    })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/realestate', requireAuth(async (req, res) => {
  const u = req.currentUser;
  if (u.role !== 'admin' && u.role !== 'realtor') return res.status(403).json({ error: 'Realtor or admin only' });
  const { title, type, price, externalUrl, image } = req.body;
  if (!title || !externalUrl) return res.status(400).json({ error: 'Title and URL are required' });
  await sql`ALTER TABLE real_estate_listings ADD COLUMN IF NOT EXISTS external_url TEXT`;

  let imageUrl = image || null;
  if (!imageUrl) try {
    const https = require('https'), http = require('http');
    const fetcher = externalUrl.startsWith('https') ? https : http;
    const parseOgImage = (html) => {
      const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
             || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      return m ? m[1] : null;
    };
    imageUrl = await new Promise((resolve) => {
      let done = false;
      const finish = (v) => { if (!done) { done = true; resolve(v); } };
      const req2 = fetcher.get(externalUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (r) => {
        let html = '';
        r.setEncoding('utf8');
        r.on('data', chunk => { html += chunk; if (html.length > 50000) { r.destroy(); finish(parseOgImage(html)); } });
        r.on('end', () => finish(parseOgImage(html)));
        r.on('error', () => finish(null));
      });
      req2.on('error', () => finish(null));
      req2.setTimeout(5000, () => { req2.destroy(); finish(null); });
    });
  } catch { imageUrl = null; }

  const [listing] = await sql`
    INSERT INTO real_estate_listings (type, title, price, image_url, external_url, description, location, agent_name, agent_phone, agent_email, features, bedrooms, bathrooms, sqft, posted_by_user_id)
    VALUES (${type||'for_sale'}, ${title}, ${Number(price)||0}, ${imageUrl}, ${externalUrl}, ${''}, ${'Costa Blanca Villas, Farallón'}, ${'Uncover Panama'}, ${''}, ${''}, ${'[]'}, ${0}, ${0}, ${0}, ${u.id})
    RETURNING *
  `;
  res.json({ id: listing.id, type: listing.type, title: listing.title, price: parseFloat(listing.price)||0, image: listing.image_url, externalUrl: listing.external_url, listedAt: listing.created_at });
}));

app.delete('/api/realestate/:id', requireAuth(async (req, res) => {
  const u = req.currentUser;
  if (u.role !== 'admin' && u.role !== 'realtor') return res.status(403).json({ error: 'Realtor or admin only' });
  await sql`DELETE FROM real_estate_listings WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

// ─── Global Search ────────────────────────────────────────────────────────────

app.get('/api/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q || q.length < 2) return res.json({ posts: [], businesses: [], events: [], neighbors: [] });
  const like = `%${q}%`;
  try {
    const [posts, businesses, events, neighbors] = await Promise.all([
      sql`SELECT id, content, type, section FROM posts WHERE content ILIKE ${like} OR type ILIKE ${like} OR section ILIKE ${like} ORDER BY created_at DESC LIMIT 5`,
      sql`SELECT id, name, category FROM businesses WHERE name ILIKE ${like} OR category ILIKE ${like} ORDER BY name LIMIT 5`,
      sql`SELECT id, title FROM events WHERE title ILIKE ${like} OR description ILIKE ${like} ORDER BY event_date DESC LIMIT 5`,
      sql`SELECT id, name, username FROM users WHERE (name ILIKE ${like} OR username ILIKE ${like}) AND role IN ('neighbor','admin') ORDER BY name LIMIT 5`,
    ]);
    res.json({
      posts: posts.map(r => ({ id: r.id, content: r.content?.substring(0, 80) })),
      businesses: businesses.map(r => ({ id: r.id, name: r.name, category: r.category })),
      events: events.map(r => ({ id: r.id, title: r.title })),
      neighbors: neighbors.map(r => ({ id: r.id, name: r.name })),
    });
  } catch (err) { console.error(err); res.json({ posts: [], businesses: [], events: [], neighbors: [] }); }
});

// ─── Groups ───────────────────────────────────────────────────────────────────

async function formatGroupRow(g, userId, isAdminUser) {
  return {
    id: g.id, name: g.name, description: g.description, icon: g.icon,
    category: g.category, privacy: g.privacy, coverPhoto: g.cover_photo,
    members: parseInt(g.member_count||0, 10),
    joined: g.user_joined || false,
    pendingRequest: g.user_pending || false,
    lastActivity: timeAgo(g.last_activity_at),
    createdBy: g.created_by_username,
    isCreator: userId ? (g.created_by_user_id === userId) : false,
    isAdmin: isAdminUser,
  };
}

app.get('/api/groups', async (req, res) => {
  try {
    const user        = await getUser(req);
    const userId      = user?.id || null;
    const isAdminUser = user?.role === 'admin';

    const rows = await sql`
      SELECT g.*, cb.username AS created_by_username,
        COUNT(DISTINCT gm.user_id)::int AS member_count,
        ${userId ? sql`EXISTS(SELECT 1 FROM group_members WHERE group_id=g.id AND user_id=${userId})` : sql`false`} AS user_joined,
        ${userId ? sql`EXISTS(SELECT 1 FROM group_join_requests WHERE group_id=g.id AND user_id=${userId} AND status='pending')` : sql`false`} AS user_pending
      FROM groups g
      JOIN users cb ON g.created_by_user_id = cb.id
      LEFT JOIN group_members gm ON gm.group_id = g.id
      GROUP BY g.id, cb.username
      ORDER BY g.created_at ASC
    `;

    const formatted = await Promise.all(rows.map(g => formatGroupRow(g, userId, isAdminUser)));

    // Attach join requests for admins/creators
    if (userId && (isAdminUser || rows.some(g => g.created_by_user_id === userId))) {
      const jrRows = await sql`
        SELECT gjr.group_id, gjr.user_id, gjr.requested_at, u.username, u.name, u.avatar_hex, u.initials
        FROM group_join_requests gjr JOIN users u ON gjr.user_id = u.id
        WHERE gjr.status='pending'
      `;
      formatted.forEach(g => {
        const og = rows.find(r => r.id === g.id);
        if (isAdminUser || (userId && og?.created_by_user_id === userId)) {
          g.joinRequests = jrRows.filter(r => r.group_id === g.id).map(r => ({
            username: r.username, name: r.name, initials: r.initials, avatar: r.avatar_hex, requestedAt: r.requested_at,
          }));
        }
      });
    }
    res.json(formatted);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.get('/api/groups/:id', async (req, res) => {
  try {
    const user        = await getUser(req);
    const userId      = user?.id || null;
    const isAdminUser = user?.role === 'admin';

    const [g] = await sql`
      SELECT g.*, cb.username AS created_by_username, cb.id AS created_by_user_id_val,
        COUNT(DISTINCT gm.user_id)::int AS member_count,
        ${userId ? sql`EXISTS(SELECT 1 FROM group_members WHERE group_id=g.id AND user_id=${userId})` : sql`false`} AS user_joined,
        ${userId ? sql`EXISTS(SELECT 1 FROM group_join_requests WHERE group_id=g.id AND user_id=${userId} AND status='pending')` : sql`false`} AS user_pending
      FROM groups g
      JOIN users cb ON g.created_by_user_id = cb.id
      LEFT JOIN group_members gm ON gm.group_id = g.id
      WHERE g.id=${req.params.id}
      GROUP BY g.id, cb.username, cb.id
    `;
    if (!g) return res.status(404).json({ error: 'Not found' });

    const posts = await sql`
      SELECT gp.*, u.username, u.name, u.avatar_hex, u.initials
      FROM group_posts gp JOIN users u ON gp.author_id = u.id
      WHERE gp.group_id=${g.id} ORDER BY gp.pinned DESC, gp.created_at DESC LIMIT 50
    `;

    const isCreator = userId && g.created_by_user_id === userId;
    let joinRequests = undefined;
    if (isCreator || isAdminUser) {
      const jr = await sql`
        SELECT gjr.*, u.username, u.name, u.avatar_hex, u.initials
        FROM group_join_requests gjr JOIN users u ON gjr.user_id = u.id
        WHERE gjr.group_id=${g.id} AND gjr.status='pending'
      `;
      joinRequests = jr.map(r => ({ username: r.username, name: r.name, initials: r.initials, avatar: r.avatar_hex, requestedAt: r.requested_at }));
    }

    res.json({
      ...(await formatGroupRow({ ...g, created_by_user_id: g.created_by_user_id || g.created_by_user_id_val }, userId, isAdminUser)),
      memberList: (await sql`
        SELECT u.id, u.username, u.name, u.avatar_hex, u.initials, u.avatar_url, gm.joined_at
        FROM group_members gm JOIN users u ON gm.user_id = u.id
        WHERE gm.group_id=${g.id} ORDER BY gm.joined_at ASC
      `).map(m => ({ id: m.id, username: m.username, name: m.name, avatar: m.avatar_hex, avatarUrl: m.avatar_url, initials: m.initials, joinedAt: m.joined_at })),
      posts: posts.map(p => ({
        id: p.id, content: p.content, imageUrl: p.image_url, pinned: p.pinned,
        pollQuestion: p.poll_question, pollOptions: p.poll_options, pollVotes: p.poll_votes,
        createdAt: p.created_at,
        author: { id: p.author_id, username: p.username, name: p.name, avatar: p.avatar_hex, initials: p.initials },
      })),
      joinRequests,
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.post('/api/groups', requireAuth(async (req, res) => {
  const { name, description, icon, category, privacy, coverPhoto } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const u = req.currentUser;
  const [g] = await sql`
    INSERT INTO groups (name, description, icon, category, privacy, cover_photo, created_by_user_id)
    VALUES (${name}, ${description||''}, ${icon||'👥'}, ${category||'Community'}, ${privacy||'public'}, ${coverPhoto||null}, ${u.id})
    RETURNING *
  `;
  await sql`INSERT INTO group_members (group_id, user_id, is_admin) VALUES (${g.id}, ${u.id}, true)`;
  await awardPoints(u.id, 'group_create', POINTS.group_create);
  res.json({ id: g.id, name: g.name, description: g.description, icon: g.icon, category: g.category, privacy: g.privacy, coverPhoto: g.cover_photo, members: 1, joined: true, lastActivity: 'just now', createdBy: u.username, isCreator: true, isAdmin: u.role === 'admin' });
}));

app.post('/api/groups/:id/report', requireAuth(async (req, res) => {
  const [g] = await sql`SELECT id, name FROM groups WHERE id=${req.params.id}`;
  if (!g) return res.status(404).json({ error: 'Not found' });
  const { reason, note } = req.body;
  await sql`INSERT INTO reports (target_type, target_id, target_label, reason, note, reported_by_user_id) VALUES ('group', ${g.id}, ${g.name}, ${reason||'Other'}, ${note||''}, ${req.currentUser.id})`;
  res.json({ ok: true });
}));

app.delete('/api/groups/:id', requireAdmin(async (req, res) => {
  await sql`DELETE FROM groups WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

app.post('/api/groups/:id/join', requireAuth(async (req, res) => {
  const [g] = await sql`SELECT * FROM groups WHERE id=${req.params.id}`;
  if (!g) return res.status(404).json({ error: 'Group not found' });
  const u = req.currentUser;

  const [member] = await sql`SELECT id FROM group_members WHERE group_id=${g.id} AND user_id=${u.id}`;
  if (member) {
    // Leave
    await sql`DELETE FROM group_members WHERE group_id=${g.id} AND user_id=${u.id}`;
    const [cnt] = await sql`SELECT COUNT(*)::int AS c FROM group_members WHERE group_id=${g.id}`;
    return res.json({ joined: false, members: cnt.c });
  }

  if (g.privacy === 'private') {
    await sql`
      INSERT INTO group_join_requests (group_id, user_id, status) VALUES (${g.id}, ${u.id}, 'pending')
      ON CONFLICT (group_id, user_id) DO UPDATE SET status='pending', requested_at=NOW()
    `;
    return res.json({ requested: true });
  }

  await sql`INSERT INTO group_members (group_id, user_id) VALUES (${g.id}, ${u.id}) ON CONFLICT DO NOTHING`;
  await awardPoints(u.id, 'group_join', POINTS.group_join);
  const [cnt] = await sql`SELECT COUNT(*)::int AS c FROM group_members WHERE group_id=${g.id}`;
  res.json({ joined: true, members: cnt.c });
}));

app.post('/api/groups/:id/join-requests/:username/approve', requireAuth(async (req, res) => {
  const [g] = await sql`SELECT * FROM groups WHERE id=${req.params.id}`;
  if (!g) return res.status(404).json({ error: 'Not found' });
  const u = req.currentUser;
  if (g.created_by_user_id !== u.id && u.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  const [target] = await sql`SELECT id FROM users WHERE username=${req.params.username}`;
  if (!target) return res.status(404).json({ error: 'User not found' });
  await sql`UPDATE group_join_requests SET status='approved' WHERE group_id=${g.id} AND user_id=${target.id}`;
  await sql`INSERT INTO group_members (group_id, user_id) VALUES (${g.id}, ${target.id}) ON CONFLICT DO NOTHING`;
  res.json({ ok: true });
}));

app.post('/api/groups/:id/join-requests/:username/deny', requireAuth(async (req, res) => {
  const [g] = await sql`SELECT id, created_by_user_id FROM groups WHERE id=${req.params.id}`;
  if (!g) return res.status(404).json({ error: 'Not found' });
  const u = req.currentUser;
  if (g.created_by_user_id !== u.id && u.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  const [target] = await sql`SELECT id FROM users WHERE username=${req.params.username}`;
  if (target) await sql`UPDATE group_join_requests SET status='denied' WHERE group_id=${g.id} AND user_id=${target.id}`;
  res.json({ ok: true });
}));

app.delete('/api/groups/:id/members/:username', requireAuth(async (req, res) => {
  const [g] = await sql`SELECT id, created_by_user_id FROM groups WHERE id=${req.params.id}`;
  if (!g) return res.status(404).json({ error: 'Not found' });
  const u = req.currentUser;
  if (g.created_by_user_id !== u.id && u.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  const [target] = await sql`SELECT id FROM users WHERE username=${req.params.username}`;
  if (!target) return res.status(404).json({ error: 'User not found' });
  await sql`DELETE FROM group_members WHERE group_id=${g.id} AND user_id=${target.id}`;
  res.json({ ok: true });
}));

app.post('/api/groups/:id/posts', requireAuth(async (req, res) => {
  const { content, image, pollQuestion, pollOptions } = req.body;
  if (!content && !pollQuestion) return res.status(400).json({ error: 'Content required' });
  const [g] = await sql`SELECT id, name FROM groups WHERE id=${req.params.id}`;
  if (!g) return res.status(404).json({ error: 'Group not found' });
  const u = req.currentUser;
  const imageUrl = await storeImage(image, 'group');
  const pollOpts = pollOptions && pollOptions.length >= 2 ? JSON.stringify(pollOptions) : null;
  const pollVotes = pollOpts ? JSON.stringify({}) : null;
  const [post] = await sql`
    INSERT INTO group_posts (group_id, author_id, content, image_url, poll_question, poll_options, poll_votes)
    VALUES (${g.id}, ${u.id}, ${content||''}, ${imageUrl}, ${pollQuestion||null}, ${pollOpts||null}::jsonb, ${pollVotes||null}::jsonb)
    RETURNING *`;
  await sql`UPDATE groups SET last_activity_at=NOW() WHERE id=${g.id}`;

  const members = await sql`SELECT user_id FROM group_members WHERE group_id=${g.id} AND user_id != ${u.id}`;
  if (members.length) {
    const msg = `${u.name} posted in ${g.name}: "${(content||pollQuestion||'').slice(0, 80)}…"`;
    await Promise.all(members.map(m =>
      sql`INSERT INTO notifications (user_id, type, message, avatar_hex, initials, related_id)
          VALUES (${m.user_id}, 'group_post', ${msg}, ${u.avatar_hex}, ${u.initials}, ${post.id})`
    ));
  }

  res.json({ id: post.id, content: post.content, imageUrl: post.image_url, pollQuestion: post.poll_question, pollOptions: post.poll_options, pollVotes: post.poll_votes, pinned: post.pinned, createdAt: post.created_at, author: { id: u.id, username: u.username, name: u.name, avatar: u.avatar_hex, initials: u.initials } });
}));

app.post('/api/groups/:id/posts/:postId/pin', requireAuth(async (req, res) => {
  const [g] = await sql`SELECT id, created_by_user_id FROM groups WHERE id=${req.params.id}`;
  if (!g) return res.status(404).json({ error: 'Not found' });
  const u = req.currentUser;
  if (g.created_by_user_id !== u.id && u.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  await sql`UPDATE group_posts SET pinned=false WHERE group_id=${g.id}`;
  const [post] = await sql`UPDATE group_posts SET pinned=true WHERE id=${req.params.postId} AND group_id=${g.id} RETURNING pinned`;
  res.json({ ok: true, pinned: post?.pinned });
}));

app.post('/api/groups/:id/posts/:postId/unpin', requireAuth(async (req, res) => {
  const [g] = await sql`SELECT id, created_by_user_id FROM groups WHERE id=${req.params.id}`;
  if (!g) return res.status(404).json({ error: 'Not found' });
  const u = req.currentUser;
  if (g.created_by_user_id !== u.id && u.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  await sql`UPDATE group_posts SET pinned=false WHERE id=${req.params.postId} AND group_id=${g.id}`;
  res.json({ ok: true });
}));

app.post('/api/groups/:id/posts/:postId/poll-vote', requireAuth(async (req, res) => {
  const { option } = req.body;
  const [post] = await sql`SELECT * FROM group_posts WHERE id=${req.params.postId}`;
  if (!post || !post.poll_options) return res.status(400).json({ error: 'Not a poll' });
  const votes = post.poll_votes || {};
  votes[req.currentUser.id] = option;
  await sql`UPDATE group_posts SET poll_votes=${JSON.stringify(votes)}::jsonb WHERE id=${req.params.postId}`;
  res.json({ ok: true, votes });
}));

app.delete('/api/groups/:id/posts/:postId', requireAuth(async (req, res) => {
  const [g] = await sql`SELECT id, created_by_user_id FROM groups WHERE id=${req.params.id}`;
  const u = req.currentUser;
  if (g?.created_by_user_id !== u.id && u.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  await sql`DELETE FROM group_posts WHERE id=${req.params.postId} AND group_id=${req.params.id}`;
  res.json({ ok: true });
}));

// ─── Notifications ────────────────────────────────────────────────────────────

app.get('/api/notifications', requireAuth(async (req, res) => {
  const rows = await sql`SELECT * FROM notifications WHERE user_id=${req.currentUser.id} ORDER BY created_at DESC LIMIT 50`;
  res.json(rows.map(r => ({ id: r.id, type: r.type, message: r.message, read: r.read, avatar: r.avatar_hex, initials: r.initials, time: r.created_at })));
}));

app.post('/api/notifications/read', requireAuth(async (req, res) => {
  await sql`UPDATE notifications SET read=true WHERE user_id=${req.currentUser.id}`;
  res.json({ ok: true });
}));

// ─── Neighbors ────────────────────────────────────────────────────────────────

app.get('/api/neighbors', async (req, res) => {
  try {
    const rows = await sql`SELECT id, username, name, email, avatar_hex, avatar_url, initials, verified, years_in_neighborhood, address, email_verified FROM users WHERE role IN ('neighbor','business','realtor') ORDER BY created_at DESC`;
    res.json(rows.map(u => ({ id: u.id, username: u.username, name: u.name, email: u.email, avatar: u.avatar_hex, avatarUrl: u.avatar_url, initials: u.initials, verified: u.verified, yearsInNeighborhood: u.years_in_neighborhood, address: u.address, emailVerified: u.email_verified })));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

// ─── Profile ──────────────────────────────────────────────────────────────────

app.get('/api/profile/:username', async (req, res) => {
  try {
    const [u] = await sql`SELECT * FROM users WHERE username=${req.params.username}`;
    if (!u) return res.status(404).json({ error: 'Not found' });
    res.json(formatUser(u));
  } catch (err) { console.error(err); res.status(500).json({ error: 'Server error' }); }
});

app.patch('/api/profile', requireAuth(async (req, res) => {
  const { name, bio, address, yearsInNeighborhood } = req.body;
  const u = req.currentUser;
  await sql`UPDATE users SET
    name = COALESCE(NULLIF(${name||''},''), name),
    bio = COALESCE(NULLIF(${bio||''},''), bio),
    address = COALESCE(NULLIF(${address||''},''), address),
    years_in_neighborhood = COALESCE(NULLIF(${yearsInNeighborhood||''},'')::int, years_in_neighborhood)
    WHERE id = ${u.id}`;
  res.json({ ok: true });
}));

// ─── Direct Messages ──────────────────────────────────────────────────────────

async function ensureMessagingTables() {
  await sql`CREATE TABLE IF NOT EXISTS conversations (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user1_id UUID REFERENCES users(id) ON DELETE CASCADE, user2_id UUID REFERENCES users(id) ON DELETE CASCADE, last_message_at TIMESTAMPTZ DEFAULT NOW(), created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(user1_id, user2_id))`;
  await sql`CREATE TABLE IF NOT EXISTS direct_messages (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE, sender_id UUID REFERENCES users(id) ON DELETE CASCADE, content TEXT NOT NULL, read BOOLEAN DEFAULT false, created_at TIMESTAMPTZ DEFAULT NOW())`;
}

app.post('/api/conversations/:username', requireAuth(async (req, res) => {
  await ensureMessagingTables();
  const [other] = await sql`SELECT id FROM users WHERE username=${req.params.username}`;
  if (!other) return res.status(404).json({ error: 'User not found' });
  const u1 = req.currentUser.id < other.id ? req.currentUser.id : other.id;
  const u2 = req.currentUser.id < other.id ? other.id : req.currentUser.id;
  const [conv] = await sql`INSERT INTO conversations (user1_id, user2_id) VALUES (${u1}, ${u2}) ON CONFLICT (user1_id, user2_id) DO UPDATE SET last_message_at = conversations.last_message_at RETURNING id`;
  res.json({ conversationId: conv.id });
}));

app.get('/api/conversations', requireAuth(async (req, res) => {
  await ensureMessagingTables();
  const userId = req.currentUser.id;
  const rows = await sql`
    SELECT c.id, c.last_message_at,
      CASE WHEN c.user1_id = ${userId} THEN c.user2_id ELSE c.user1_id END AS partner_id,
      u.name AS partner_name, u.username AS partner_username, u.avatar_hex AS partner_avatar,
      u.avatar_url AS partner_avatar_url, u.initials AS partner_initials,
      (SELECT content FROM direct_messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) AS last_message,
      (SELECT COUNT(*)::int FROM direct_messages WHERE conversation_id = c.id AND sender_id != ${userId} AND read = false) AS unread_count
    FROM conversations c
    JOIN users u ON u.id = CASE WHEN c.user1_id = ${userId} THEN c.user2_id ELSE c.user1_id END
    WHERE c.user1_id = ${userId} OR c.user2_id = ${userId}
    ORDER BY c.last_message_at DESC
  `;
  res.json(rows.map(r => ({ id: r.id, partner: { id: r.partner_id, name: r.partner_name, username: r.partner_username, avatar: r.partner_avatar, avatarUrl: r.partner_avatar_url, initials: r.partner_initials }, lastMessage: r.last_message, unreadCount: r.unread_count, lastMessageAt: r.last_message_at })));
}));

app.get('/api/conversations/:id/messages', requireAuth(async (req, res) => {
  await ensureMessagingTables();
  const userId = req.currentUser.id;
  const [conv] = await sql`SELECT id FROM conversations WHERE id=${req.params.id} AND (user1_id=${userId} OR user2_id=${userId})`;
  if (!conv) return res.status(404).json({ error: 'Not found' });
  const msgs = await sql`SELECT * FROM direct_messages WHERE conversation_id=${req.params.id} ORDER BY created_at ASC LIMIT 100`;
  res.json(msgs.map(m => ({ id: m.id, senderId: m.sender_id, content: m.content, read: m.read, createdAt: m.created_at })));
}));

app.post('/api/conversations/:id/messages', requireAuth(async (req, res) => {
  await ensureMessagingTables();
  const userId = req.currentUser.id;
  const { content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'Message cannot be empty' });
  const [conv] = await sql`SELECT * FROM conversations WHERE id=${req.params.id} AND (user1_id=${userId} OR user2_id=${userId})`;
  if (!conv) return res.status(404).json({ error: 'Not found' });
  const [msg] = await sql`INSERT INTO direct_messages (conversation_id, sender_id, content) VALUES (${req.params.id}, ${userId}, ${content.trim()}) RETURNING *`;
  await sql`UPDATE conversations SET last_message_at = NOW() WHERE id=${req.params.id}`;
  const partnerId = conv.user1_id === userId ? conv.user2_id : conv.user1_id;
  await sql`INSERT INTO notifications (user_id, type, message, avatar_hex, initials, related_id) VALUES (${partnerId}, 'message', ${`${req.currentUser.name} sent you a message`}, ${req.currentUser.avatar_hex}, ${req.currentUser.initials}, ${req.params.id})`;
  res.json({ id: msg.id, senderId: msg.sender_id, content: msg.content, read: msg.read, createdAt: msg.created_at });
}));

app.post('/api/conversations/:id/read', requireAuth(async (req, res) => {
  await ensureMessagingTables();
  await sql`UPDATE direct_messages SET read=true WHERE conversation_id=${req.params.id} AND sender_id!=${req.currentUser.id}`;
  res.json({ ok: true });
}));

// ─── Transport (persisted) ────────────────────────────────────────────────────
app.get('/api/transport/carts', async (req, res) => {
  await sql`CREATE TABLE IF NOT EXISTS transport_carts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id UUID REFERENCES users(id) ON DELETE CASCADE, make_model TEXT NOT NULL, seats INTEGER DEFAULT 4, rate TEXT, phone TEXT, notes TEXT, available BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW())`;
  const rows = await sql`SELECT c.*, u.name AS owner_name, u.username AS owner_username, u.avatar_hex, u.initials FROM transport_carts c JOIN users u ON c.owner_id=u.id ORDER BY c.created_at DESC`;
  res.json(rows);
});

app.post('/api/transport/carts', requireAuth(async (req, res) => {
  await sql`CREATE TABLE IF NOT EXISTS transport_carts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), owner_id UUID REFERENCES users(id) ON DELETE CASCADE, make_model TEXT NOT NULL, seats INTEGER DEFAULT 4, rate TEXT, phone TEXT, notes TEXT, available BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ DEFAULT NOW())`;
  await sql`ALTER TABLE transport_carts ADD COLUMN IF NOT EXISTS image_url TEXT`;
  const { makeModel, seats, rate, phone, notes, image } = req.body;
  if (!makeModel) return res.status(400).json({ error: 'Cart description required' });
  const imageUrl = await storeImage(image, 'carts');
  const [cart] = await sql`INSERT INTO transport_carts (owner_id, make_model, seats, rate, phone, notes, image_url) VALUES (${req.currentUser.id}, ${makeModel}, ${parseInt(seats)||4}, ${rate||''}, ${phone||''}, ${notes||''}, ${imageUrl||null}) RETURNING *`;
  res.json(cart);
}));

app.delete('/api/transport/carts/:id', requireAuth(async (req, res) => {
  const [cart] = await sql`SELECT owner_id FROM transport_carts WHERE id=${req.params.id}`;
  if (!cart) return res.status(404).json({ error: 'Not found' });
  if (cart.owner_id !== req.currentUser.id && req.currentUser.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  await sql`DELETE FROM transport_carts WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

app.get('/api/transport/fares', async (req, res) => {
  await sql`CREATE TABLE IF NOT EXISTS transport_fares (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), author_id UUID REFERENCES users(id) ON DELETE CASCADE, from_place TEXT NOT NULL, to_place TEXT NOT NULL, fare TEXT NOT NULL, transport_type TEXT DEFAULT 'taxi', notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`;
  const rows = await sql`SELECT f.*, u.name AS author_name, u.username, u.avatar_hex, u.initials FROM transport_fares f JOIN users u ON f.author_id=u.id ORDER BY f.created_at DESC LIMIT 50`;
  res.json(rows);
});

app.post('/api/transport/fares', requireAuth(async (req, res) => {
  await sql`CREATE TABLE IF NOT EXISTS transport_fares (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), author_id UUID REFERENCES users(id) ON DELETE CASCADE, from_place TEXT NOT NULL, to_place TEXT NOT NULL, fare TEXT NOT NULL, transport_type TEXT DEFAULT 'taxi', notes TEXT, created_at TIMESTAMPTZ DEFAULT NOW())`;
  const { fromPlace, toPlace, fare, transportType, notes } = req.body;
  if (!fromPlace || !toPlace || !fare) return res.status(400).json({ error: 'From, to, and fare required' });
  const [row] = await sql`INSERT INTO transport_fares (author_id, from_place, to_place, fare, transport_type, notes) VALUES (${req.currentUser.id}, ${fromPlace}, ${toPlace}, ${fare}, ${transportType||'taxi'}, ${notes||''}) RETURNING *`;
  res.json(row);
}));

app.delete('/api/transport/fares/:id', requireAuth(async (req, res) => {
  const [fare] = await sql`SELECT author_id FROM transport_fares WHERE id=${req.params.id}`;
  if (!fare) return res.status(404).json({ error: 'Not found' });
  if (fare.author_id !== req.currentUser.id && req.currentUser.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  await sql`DELETE FROM transport_fares WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

app.post('/api/profile/avatar', requireAuth(async (req, res) => {
  const { dataUrl } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'No image data' });
  const u = req.currentUser;
  let avatarUrl = dataUrl;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = require('@vercel/blob');
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      const blob = await put(`avatars/${u.id}-${Date.now()}.jpg`, buffer, { access: 'public', contentType: 'image/jpeg' });
      avatarUrl = blob.url;
    } catch (e) { console.error('Blob avatar upload failed:', e.message); }
  }
  await sql`UPDATE users SET avatar_url=${avatarUrl} WHERE id=${u.id}`;
  res.json({ avatarUrl });
}));

app.post('/api/profile/banner', requireAuth(async (req, res) => {
  const { dataUrl } = req.body;
  if (!dataUrl) return res.status(400).json({ error: 'No image data' });
  const u = req.currentUser;
  let bannerUrl = dataUrl;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const { put } = require('@vercel/blob');
      const base64 = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64, 'base64');
      const blob = await put(`banners/${u.id}-${Date.now()}.jpg`, buffer, { access: 'public', contentType: 'image/jpeg' });
      bannerUrl = blob.url;
    } catch (e) { console.error('Blob banner upload failed:', e.message); }
  }
  await sql`UPDATE users SET banner_url=${bannerUrl} WHERE id=${u.id}`;
  res.json({ bannerUrl });
}));

// ─── HOA ─────────────────────────────────────────────────────────────────────

app.get('/api/hoa/me', requireAuth(async (req, res) => {
  const u = req.currentUser;
  if (u.role !== 'hoa') return res.status(403).json({ error: 'Not an HOA account' });
  const [eventCount] = await sql`SELECT COUNT(*)::int AS c FROM events WHERE event_date >= CURRENT_DATE`;
  const [residentCount] = await sql`SELECT COUNT(*)::int AS c FROM users`;
  const [groupCount] = await sql`SELECT COUNT(*)::int AS c FROM groups`;
  const [postCount]  = await sql`SELECT COUNT(*)::int AS c FROM posts WHERE is_hoa_post=true`;
  res.json({ ...formatUser(u), hoaPostsCount: postCount?.c||0, upcomingEvents: eventCount?.c||0, totalResidents: residentCount?.c||0, totalGroups: groupCount?.c||0 });
}));

app.post('/api/hoa/post', requireAuth(async (req, res) => {
  const u = req.currentUser;
  if (u.role !== 'hoa') return res.status(403).json({ error: 'Not an HOA account' });
  const { postType, content, image } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const imageUrl = await storeImage(image, 'hoa');
  const [post]   = await sql`
    INSERT INTO posts (type, section, content, author_id, image_url, is_hoa_post)
    VALUES (${postType||'general'}, 'feed', ${content}, ${u.id}, ${imageUrl}, true)
    RETURNING *
  `;
  const full = await fetchPostsWithMeta(`WHERE p.id = '${post.id}'`, u.id);
  res.json(full[0] || post);
}));

app.get('/api/hoa/posts', requireAuth(async (req, res) => {
  const u = req.currentUser;
  if (u.role !== 'hoa') return res.status(403).json({ error: 'Not an HOA account' });
  const posts = await fetchPostsWithMeta(`WHERE p.is_hoa_post = true`, u.id);
  res.json(posts);
}));

app.post('/api/events', requireAuth(async (req, res) => {
  try {
    const u = req.currentUser;
    const { title, description, location, eventDate, eventTime, endTime, category, image } = req.body;
    if (!title || !eventDate) return res.status(400).json({ error: 'Title and date required' });
    const imageUrl = await storeImage(image, 'events');
    // Ensure image_url column exists before inserting
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT`;
    const [ev] = await sql`
      INSERT INTO events (title, description, host_id, location, event_date, event_time, end_time, category, is_hoa_event, image_url)
      VALUES (${title}, ${description||''}, ${u.id}, ${location||'Costa Blanca Villas'}, ${eventDate}, ${eventTime||'TBD'}, ${endTime||''}, ${category||'Community'}, false, ${imageUrl})
      RETURNING *
    `;
    res.json({ id: ev.id, title: ev.title, description: ev.description, host: formatUser(u), location: ev.location, date: ev.event_date, time: ev.event_time, endTime: ev.end_time, category: ev.category, isHoaEvent: false, image: ev.image_url || null, rsvp: { going:0, maybe:0, cantGo:0 }, userRsvp: null, goingAvatars: [] });
  } catch (err) {
    console.error('POST /api/events error:', err.message);
    res.status(500).json({ error: err.message });
  }
}));

app.patch('/api/events/:id/cancel', requireAuth(async (req, res) => {
  const [ev] = await sql`SELECT host_id FROM events WHERE id=${req.params.id}`;
  if (!ev) return res.status(404).json({ error: 'Not found' });
  if (ev.host_id !== req.currentUser.id && req.currentUser.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS cancelled BOOLEAN DEFAULT FALSE`;
  await sql`UPDATE events SET cancelled=TRUE WHERE id=${req.params.id}`;
  res.json({ ok: true });
}));

app.delete('/api/events/:id', requireAuth(async (req, res) => {
  try {
    const [ev] = await sql`SELECT host_id FROM events WHERE id=${req.params.id}`;
    if (!ev) return res.status(404).json({ error: 'Not found' });
    if (ev.host_id !== req.currentUser.id && req.currentUser.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
    await sql`DELETE FROM event_rsvps WHERE event_id=${req.params.id}`;
    await sql`DELETE FROM events WHERE id=${req.params.id}`;
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/events error:', err.message);
    res.status(500).json({ error: err.message });
  }
}));

app.post('/api/hoa/events', requireAuth(async (req, res) => {
  const u = req.currentUser;
  if (u.role !== 'hoa') return res.status(403).json({ error: 'Not an HOA account' });
  const { title, description, location, date, time, endTime, category } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'Title and date required' });
  const [ev] = await sql`
    INSERT INTO events (title, description, host_id, location, event_date, event_time, end_time, category, is_hoa_event)
    VALUES (${title}, ${description||''}, ${u.id}, ${location||'Costa Blanca Villas'}, ${date}, ${time||'TBD'}, ${endTime||''}, ${category||'Community'}, true)
    RETURNING *
  `;
  res.json({ id: ev.id, title: ev.title, description: ev.description, host: formatUser(u), location: ev.location, date: ev.event_date, time: ev.event_time, endTime: ev.end_time, category: ev.category, isHoaEvent: ev.is_hoa_event, rsvp: { going:0, maybe:0, cantGo:0 }, userRsvp: null, goingAvatars: [] });
}));

// ─── Community Stats ──────────────────────────────────────────────────────────

app.get('/api/community-stats', async (req, res) => {
  try {
    const [active] = await sql`
      SELECT COUNT(DISTINCT author_id)::int AS c FROM posts
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `;
    res.json({ activeThisWeek: active.c || 0 });
  } catch (err) {
    res.json({ activeThisWeek: 0 });
  }
});

// ─── Tides — Harmonic prediction using Balboa, Panama constituents ────────────
// Source: NOAA/IHO published harmonic constituents for Balboa, Canal Zone, Panama
// Accurate to ~15-20 min for Playa Farallón (same Pacific coast, ~100km west)

app.get('/api/tides', (req, res) => {
  // Balboa harmonic constituents: speed (°/hr), amplitude (m), phase lag g (°)
  const C = [
    { spd: 28.9841042, amp: 1.855, g: 188.0, V0: 136.48 }, // M2 principal lunar
    { spd: 30.0000000, amp: 0.559, g: 212.5, V0:   0.00 }, // S2 principal solar
    { spd: 28.4397295, amp: 0.380, g: 166.9, V0:   8.05 }, // N2 elliptic lunar
    { spd: 15.0410686, amp: 0.396, g: 316.5, V0: 180.00 }, // K1 luni-solar diurnal
    { spd: 13.9430356, amp: 0.267, g: 281.1, V0:  36.51 }, // O1 principal lunar diurnal
    { spd: 30.0821373, amp: 0.137, g: 213.0, V0:   0.00 }, // K2 luni-solar semi-diurnal
    { spd: 14.9589314, amp: 0.131, g: 313.6, V0: 236.46 }, // P1 principal solar diurnal
    { spd: 13.3986609, amp: 0.044, g: 257.4, V0: 268.08 }, // Q1 elliptic lunar diurnal
  ];
  // V0 values pre-computed at epoch Jan 1 2000 0:00 UTC using astronomical arguments
  // s=211.73° h=279.97° p=83.30° N=125.07° GMST=99.97°
  // tau(moon HA)=248.24° giving M2=2tau=136.48, S2≈0, etc.

  const EPOCH = Date.UTC(2000, 0, 1, 0, 0, 0);
  const Z0 = 2.3; // mean level above MLLW for Balboa (m)
  const DEG = Math.PI / 180;

  const height = ms => {
    const t = (ms - EPOCH) / 3_600_000; // hours since epoch
    return C.reduce((h, c) => h + c.amp * Math.cos(c.spd * DEG * t + (c.V0 - c.g) * DEG), Z0);
  };

  // Panama is UTC-5 (no DST)
  const TZ = -5 * 3_600_000;
  const now = Date.now();
  const midnightPanama = new Date(now + TZ);
  midnightPanama.setUTCHours(0, 0, 0, 0);
  const start = midnightPanama.getTime() - TZ; // midnight UTC offset

  // Scan at 3-min intervals over 27 hours, find turning points
  const STEP = 3 * 60_000;
  const extremes = [];
  let h0 = height(start), h1 = height(start + STEP);
  for (let t = start + 2 * STEP; t < start + 27 * 3_600_000; t += STEP) {
    const h2 = height(t);
    if (h1 > h0 && h1 > h2) extremes.push({ type: 'High', ts: t - STEP, ht: h1 });
    if (h1 < h0 && h1 < h2) extremes.push({ type: 'Low',  ts: t - STEP, ht: h1 });
    h0 = h1; h1 = h2;
  }

  const fmt = ts => {
    const d = new Date(ts + TZ);
    const h = d.getUTCHours(), m = d.getUTCMinutes(), ap = h >= 12 ? 'PM' : 'AM';
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ap}`;
  };

  const todayExtremes = extremes
    .filter(e => e.ts >= start && e.ts < start + 24 * 3_600_000)
    .map(e => ({ type: e.type, time: fmt(e.ts), height: Math.max(0, e.ht).toFixed(1) + 'm' }));

  res.json(todayExtremes);
});

// ─── HTML pages ───────────────────────────────────────────────────────────────

app.get('/',                (req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));
app.get('/login',           (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin',           (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/app',             (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
app.get('/app.html',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
app.get('/business',        (req, res) => res.sendFile(path.join(__dirname, 'public', 'business.html')));
app.get('/hoa',             (req, res) => res.sendFile(path.join(__dirname, 'public', 'hoa.html')));
app.get('/reset-password',  (req, res) => res.sendFile(path.join(__dirname, 'public', 'reset-password.html')));
app.get('/verify-email',    (req, res) => res.sendFile(path.join(__dirname, 'public', 'verify-email.html')));

// ─── Start ────────────────────────────────────────────────────────────────────

async function runMigrations() {
  try {
    await sql`ALTER TABLE marketplace_items ADD COLUMN IF NOT EXISTS sold BOOLEAN DEFAULT FALSE`;
    await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS banner_url TEXT`;
    await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS logo_url TEXT`;
    await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS added_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL`;
    await sql`ALTER TABLE events ADD COLUMN IF NOT EXISTS image_url TEXT`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE`;
    await sql`UPDATE users SET email_verified = true WHERE email_verified = false AND created_at < NOW() - INTERVAL '1 minute'`;
    await sql`ALTER TABLE banned_users ADD COLUMN IF NOT EXISTS email VARCHAR(255)`;
    await sql`CREATE TABLE IF NOT EXISTS email_verification_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS rating DECIMAL(2,1) DEFAULT 0`;
    await sql`ALTER TABLE businesses ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0`;
    await sql`UPDATE businesses b SET rating = COALESCE((SELECT ROUND(AVG(r.rating)::numeric,1) FROM business_reviews r WHERE r.business_id=b.id), 0), review_count = (SELECT COUNT(*) FROM business_reviews r WHERE r.business_id=b.id)`;
    await sql`CREATE TABLE IF NOT EXISTS user_section_reads (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      section VARCHAR(50) NOT NULL,
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, section)
    )`;
  } catch (e) { console.error('Migration error:', e.message); }
}

// ─── Unread Counts ───────────────────────────────────────────────────────────
app.get('/api/unread', requireAuth(async (req, res) => {
  await sql`CREATE TABLE IF NOT EXISTS user_section_reads (user_id UUID REFERENCES users(id) ON DELETE CASCADE, section VARCHAR(50) NOT NULL, last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY (user_id, section))`;
  const userId = req.currentUser.id;
  const sections = ['feed', 'safety', 'marketplace', 'events'];
  const reads = await sql`SELECT section, last_seen_at FROM user_section_reads WHERE user_id = ${userId}`;
  const readMap = Object.fromEntries(reads.map(r => [r.section, r.last_seen_at]));
  // Initialize missing sections to NOW() so new users start at 0
  for (const s of sections) {
    if (!readMap[s]) {
      await sql`INSERT INTO user_section_reads (user_id, section, last_seen_at) VALUES (${userId}, ${s}, NOW()) ON CONFLICT DO NOTHING`;
      readMap[s] = new Date();
    }
  }
  const [feed, safety, marketplace, events, msgs] = await Promise.all([
    sql`SELECT COUNT(*)::int AS c FROM posts WHERE section='feed' AND (type IS NULL OR type != 'safety') AND created_at > ${readMap.feed} AND author_id != ${userId}`,
    sql`SELECT COUNT(*)::int AS c FROM posts WHERE (section='safety' OR type='safety') AND COALESCE(severity,'medium') != 'resolved' AND created_at > ${readMap.safety} AND author_id != ${userId}`,
    sql`SELECT COUNT(*)::int AS c FROM marketplace_items WHERE created_at > ${readMap.marketplace} AND seller_id != ${userId}`,
    sql`SELECT COUNT(*)::int AS c FROM events WHERE created_at > ${readMap.events} AND host_id != ${userId} AND event_date >= CURRENT_DATE`,
    sql`SELECT COALESCE(SUM((SELECT COUNT(*)::int FROM direct_messages WHERE conversation_id=c.id AND sender_id!=${userId} AND read=false)),0)::int AS c FROM conversations c WHERE c.user1_id=${userId} OR c.user2_id=${userId}`.catch(() => [{ c: 0 }]),
  ]);
  res.json({ feed: feed[0].c, safety: safety[0].c, marketplace: marketplace[0].c, events: events[0].c, messages: msgs[0]?.c || 0 });
}));

app.post('/api/sections/:section/read', requireAuth(async (req, res) => {
  const allowed = ['feed', 'safety', 'marketplace', 'events', 'groups', 'realestate'];
  const section = req.params.section;
  if (!allowed.includes(section)) return res.status(400).json({ error: 'Unknown section' });
  await sql`INSERT INTO user_section_reads (user_id, section, last_seen_at) VALUES (${req.currentUser.id}, ${section}, NOW()) ON CONFLICT (user_id, section) DO UPDATE SET last_seen_at = NOW()`;
  res.json({ ok: true });
}));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Costa Blanca Connect running on http://localhost:${PORT}`);
});

app.get('/api/admin/run-migrations', requireAdmin(async (req, res) => {
  await runMigrations();
  res.json({ ok: true, message: 'Migrations complete' });
}));

app.get('/api/debug/events-schema', async (req, res) => {
  try {
    const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='events' ORDER BY ordinal_position`;
    res.json({ columns: cols.map(c => c.column_name) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = app;
