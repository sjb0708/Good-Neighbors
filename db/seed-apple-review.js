/**
 * Seed a demo account for the Apple App Store review team.
 *
 * Paste these credentials into App Store Connect →
 *   App Information → App Review Information → Sign-In Information.
 *
 * Run:
 *   npm run seed:apple
 * or:
 *   node -r dotenv/config db/seed-apple-review.js
 *
 * Re-running resets the password and keeps the account active.
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { sql } = require('./client');

const USERNAME = 'applereview';
const EMAIL    = 'applereview@goodneighbors.app';
const PASSWORD = 'AppleReview2026!';

async function seed() {
  console.log('Seeding Apple App Store review account…');

  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const rows = await sql`
    INSERT INTO users (
      username, email, password_hash, role,
      name, initials, avatar_hex, address, bio,
      verified, is_owner, points, years_in_neighborhood
    ) VALUES (
      ${USERNAME},
      ${EMAIL},
      ${passwordHash},
      'neighbor',
      'Apple Reviewer',
      'AR',
      '#000000',
      'App Store Review Account',
      'Demo account for the Apple App Store review team.',
      TRUE,
      FALSE,
      0,
      0
    )
    ON CONFLICT (username) DO UPDATE SET
      email         = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash,
      role          = 'neighbor',
      verified      = TRUE
    RETURNING id, username, email, role
  `;

  console.log('✓ Apple review account seeded:', rows[0]);
  console.log('');
  console.log('  Use these credentials in App Store Connect:');
  console.log('    Username: ' + USERNAME);
  console.log('    Email:    ' + EMAIL);
  console.log('    Password: ' + PASSWORD);
  console.log('');
  process.exit(0);
}

seed().catch(err => {
  console.error('✗ Seed failed:', err.message);
  process.exit(1);
});
