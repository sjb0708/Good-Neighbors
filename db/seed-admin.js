/**
 * Seed the super-admin user.
 * Run once after the schema has been applied:
 *   node db/seed-admin.js
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { sql } = require('./client');

async function seed() {
  console.log('Seeding super-admin user…');

  const passwordHash = await bcrypt.hash('Paintball$1', 12);

  const rows = await sql`
    INSERT INTO users (
      username, email, password_hash, role,
      name, initials, avatar_hex, address, bio,
      verified, is_owner, points, years_in_neighborhood
    ) VALUES (
      'admin',
      'costablancavillaspanama@gmail.com',
      ${passwordHash},
      'admin',
      'Costa Blanca Villas',
      'CB',
      '#2E7D32',
      'Costa Blanca Villas, Farallón',
      'Official community account for Costa Blanca Villas, Farallón, Coclé, Panamá.',
      TRUE,
      TRUE,
      0,
      0
    )
    ON CONFLICT (username) DO UPDATE SET
      email         = EXCLUDED.email,
      password_hash = EXCLUDED.password_hash,
      role          = 'admin',
      is_owner      = TRUE,
      verified      = TRUE
    RETURNING id, username, email, role, is_owner
  `;

  console.log('✓ Admin seeded:', rows[0]);
  process.exit(0);
}

seed().catch(err => {
  console.error('✗ Seed failed:', err.message);
  process.exit(1);
});
