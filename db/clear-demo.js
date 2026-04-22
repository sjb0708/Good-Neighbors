require('dotenv').config();
const { sql } = require('./client');

async function clean() {
  const names = ['La Palapa Beach Bar', "Carlos & Sons \u2014 Plumbing", "Leo's Auto & Tires"];
  const bizRows = await sql`SELECT id FROM businesses WHERE name = ANY(${names})`;
  const bizIds = bizRows.map(b => b.id);
  console.log('Found demo businesses:', bizIds.length);
  if (bizIds.length) {
    await sql`DELETE FROM business_reviews WHERE business_id = ANY(${bizIds})`;
    await sql`DELETE FROM business_faves WHERE business_id = ANY(${bizIds})`;
    await sql`DELETE FROM posts WHERE business_id = ANY(${bizIds})`;
    await sql`DELETE FROM businesses WHERE id = ANY(${bizIds})`;
    console.log('Deleted demo businesses + reviews/faves/posts');
  }
  const [u] = await sql`SELECT id FROM users WHERE username='maria_demo'`;
  if (u) {
    await sql`DELETE FROM business_reviews WHERE author_id=${u.id}`;
    await sql`DELETE FROM users WHERE id=${u.id}`;
    console.log('Deleted maria_demo user');
  } else {
    console.log('maria_demo not found (already gone)');
  }
  process.exit(0);
}

clean().catch(e => { console.error(e); process.exit(1); });
