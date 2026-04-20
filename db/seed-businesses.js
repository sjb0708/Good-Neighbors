/**
 * Seed demo businesses, reviews, and a sample neighbor user.
 * Run once: node db/seed-businesses.js
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const { sql } = require('./client');

async function seed() {
  console.log('Seeding demo businesses…');

  // ── Demo neighbor user (to author reviews) ───────────────────────────────
  const pw = await bcrypt.hash('Demo1234!', 10);
  let [reviewer] = await sql`SELECT id FROM users WHERE username='maria_demo'`;
  if (!reviewer) {
    [reviewer] = await sql`
      INSERT INTO users (username, email, password_hash, role, name, initials, avatar_hex, verified, points, years_in_neighborhood)
      VALUES ('maria_demo','maria@demo.com',${pw},'neighbor','Maria Sandoval','MS','#E76F51',true,45,3)
      RETURNING id
    `;
  }
  const reviewerId = reviewer.id;
  console.log('✓ Demo reviewer ready:', reviewerId);

  // ── Businesses ────────────────────────────────────────────────────────────
  const businesses = [
    {
      name: 'La Palapa Beach Bar',
      category: 'Bar & Grill',
      description: 'Right on the sand at Farallón. Cold beers, fresh ceviche, grilled fish, and the best sunset views in Coclé. A Costa Blanca staple since 2015.',
      address: 'Playa Farallón, Coclé, Panamá',
      phone: '+507 6212-3344',
      hours: 'Mon–Sun 11am–10pm',
      website: '',
      tags: ['Seafood', 'Beach Bar', 'Cocktails', 'Ceviche'],
      reviews: [
        { rating: 5, text: 'Best spot after a beach day. The fish tacos are incredible and the staff is so friendly. Been coming here every weekend for two years.' },
        { rating: 4, text: 'Great atmosphere and cold beers. Service can be slow on busy Sundays but the food is always worth the wait.' },
        { rating: 5, text: 'The ceviche is the best in the area — fresh fish, perfect seasoning. Love this place!' },
      ],
      faves: 18,
    },
    {
      name: 'Super Farallón',
      category: 'Supermarket',
      description: 'The closest supermarket to Costa Blanca Villas. Stocks everything from fresh produce and meats to imported goods, cleaning supplies, and liquor. Delivery available for larger orders.',
      address: 'Calle Principal, Farallón, Coclé',
      phone: '+507 6589-7712',
      hours: 'Mon–Sat 7am–9pm · Sun 8am–7pm',
      website: '',
      tags: ['Groceries', 'Produce', 'Liquor', 'Delivery'],
      reviews: [
        { rating: 4, text: 'Surprisingly well-stocked for a small town supermarket. They carry a lot of imported products and the produce is usually fresh.' },
        { rating: 3, text: 'Convenient and the owner is very nice. Prices are a bit higher than the city but the convenience is worth it when you don\'t want to drive to Penonomé.' },
        { rating: 4, text: 'They started doing delivery last month which is a game changer. Helpful staff.' },
      ],
      faves: 11,
    },
    {
      name: 'Carlos & Sons — Plumbing',
      category: 'Home Services',
      description: 'Family-owned plumbing and general maintenance service. Carlos has been working in the Farallón area for over 12 years. Fair prices, reliable, and always shows up on time.',
      address: 'Farallón, Coclé, Panamá',
      phone: '+507 6671-0293',
      hours: 'Mon–Sat 7am–6pm · Emergency calls available',
      website: '',
      tags: ['Plumbing', 'Maintenance', 'Reliable', 'Emergency'],
      reviews: [
        { rating: 5, text: 'Carlos fixed our water pump on a Sunday morning with no extra charge. Honest pricing and quality work. Highly recommend to all Costa Blanca neighbors.' },
        { rating: 5, text: 'Used Carlos three times now. He shows up when he says he will, which is rare here. Fixed a leak that two other plumbers couldn\'t solve.' },
        { rating: 4, text: 'Very professional. Gave a clear quote upfront and stuck to it. Will use again.' },
      ],
      faves: 24,
      faveYear: true,
    },
    {
      name: 'Restaurante El Capitán',
      category: 'Restaurant',
      description: 'Traditional Panamanian food in a relaxed open-air setting. Famous for the sancocho, whole fried snapper, and fresh coconut rice. Local favorite for Sunday lunch.',
      address: 'Via Farallón, 500m from the beach',
      phone: '+507 6334-9921',
      hours: 'Thu–Sun 10am–8pm',
      website: '',
      tags: ['Panamanian', 'Seafood', 'Sancocho', 'Lunch'],
      reviews: [
        { rating: 5, text: 'The whole fried snapper here is the best I\'ve had in Panama. Huge portions, fair prices, and a great family atmosphere.' },
        { rating: 5, text: 'Authentic Panamanian cooking. The sancocho cured my hangover better than anything else. Don\'t miss the coconut rice.' },
        { rating: 4, text: 'Only open Thursday to Sunday which is the only downside. Food is excellent every time we\'ve been.' },
      ],
      faves: 31,
      faveYear: true,
    },
    {
      name: 'Leo\'s Auto & Tires',
      category: 'Transportation',
      description: 'Tire changes, oil changes, battery replacements, and basic auto repairs. Closest mechanic to Costa Blanca. Speaks English and Spanish. Quick turnaround.',
      address: 'Carretera Interamericana, Farallón',
      phone: '+507 6802-1155',
      hours: 'Mon–Sat 8am–6pm',
      website: '',
      tags: ['Mechanic', 'Tires', 'Auto Repair', 'English Spoken'],
      reviews: [
        { rating: 5, text: 'Got a flat on the way to the beach and Leo had me back on the road in 20 minutes. Honest and fast. Keep his number saved.' },
        { rating: 4, text: 'Good mechanic, speaks decent English which helps. Prices are fair for the area.' },
      ],
      faves: 9,
    },
    {
      name: 'Mireya\'s Salon & Spa',
      category: 'Beauty & Wellness',
      description: 'Hair, nails, waxing, and facial treatments in a relaxing beachside setting. Mireya has over 15 years of experience and a loyal following from the expat community.',
      address: 'Playa Blanca Road, Farallón',
      phone: '+507 6644-2287',
      hours: 'Tue–Sat 9am–7pm',
      website: '',
      tags: ['Hair', 'Nails', 'Waxing', 'Facials'],
      reviews: [
        { rating: 5, text: 'Mireya is amazing — she listens to what you want and delivers every time. Her prices are very reasonable and she\'s always on time with appointments.' },
        { rating: 5, text: 'Best manicure I\'ve had since leaving the States. Clean, professional, and a lovely atmosphere.' },
        { rating: 4, text: 'Great salon. Book in advance on weekends as she fills up fast.' },
      ],
      faves: 16,
    },
  ];

  const currentYear = new Date().getFullYear();

  for (const b of businesses) {
    // Upsert business
    let [biz] = await sql`SELECT id FROM businesses WHERE name=${b.name}`;
    if (!biz) {
      [biz] = await sql`
        INSERT INTO businesses (name, category, description, address, phone, hours, website, tags, claimed)
        VALUES (${b.name}, ${b.category}, ${b.description}, ${b.address}, ${b.phone}, ${b.hours}, ${b.website||''}, ${JSON.stringify(b.tags)}, false)
        RETURNING id
      `;
      console.log('  + Business:', b.name);
    } else {
      console.log('  ~ Business already exists:', b.name);
    }
    const bizId = biz.id;

    // Reviews
    const existing = await sql`SELECT id FROM business_reviews WHERE business_id=${bizId} AND author_id=${reviewerId}`;
    if (!existing.length) {
      for (const r of b.reviews) {
        await sql`
          INSERT INTO business_reviews (business_id, author_id, rating, text)
          VALUES (${bizId}, ${reviewerId}, ${r.rating}, ${r.text})
        `;
      }
      const avgRating = (b.reviews.reduce((s, r) => s + r.rating, 0) / b.reviews.length).toFixed(1);
      await sql`UPDATE businesses SET rating=${avgRating}, review_count=${b.reviews.length} WHERE id=${bizId}`;
    }

    // Faves
    const faveExists = await sql`SELECT id FROM business_faves WHERE business_id=${bizId} AND user_id=${reviewerId} AND year=${currentYear}`;
    if (!faveExists.length) {
      for (let i = 0; i < Math.min(b.faves, 3); i++) {
        await sql`
          INSERT INTO business_faves (business_id, user_id, year)
          VALUES (${bizId}, ${reviewerId}, ${currentYear})
          ON CONFLICT DO NOTHING
        `;
      }
      await sql`UPDATE businesses SET recommended_by=${b.faves} WHERE id=${bizId}`;
    }

    // Neighbourhood Fave year award
    if (b.faveYear) {
      await sql`UPDATE businesses SET fave_years=${JSON.stringify([currentYear - 1])}::jsonb WHERE id=${bizId}`;
    }
  }

  console.log('\n✓ Done! Run the app and visit the Business Directory to see the demo data.');
  process.exit(0);
}

seed().catch(err => {
  console.error('✗ Seed failed:', err.message);
  process.exit(1);
});
