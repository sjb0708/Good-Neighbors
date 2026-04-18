const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');

const app = express();
app.use(express.json({ limit: '10mb' }));
const COOKIE_SECRET = 'gn-secret-2026';
app.use(cookieParser(COOKIE_SECRET));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const uploadBanner = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

// ─── In-Memory Data Store ────────────────────────────────────────────────────

const users = {
  sarah: {
    id: 'u1', username: 'sarah', password: 'beach123',
    role: 'business', businessId: 'b1',
    name: 'Amar By La Playa Farallón', avatar: '#0077B6', initials: 'AM',
    address: 'Playa Farallón, Farallón, Coclé', verified: true,
    bio: 'Peruvian-Panamanian fusion with stunning Pacific views. Famous for our leche de tigre ceviche, grilled fresh catch, and creative cocktails.',
    posts: 27, neighbors: 94, points: 438
  },
  mike: {
    id: 'u2', username: 'mike', password: 'beach123',
    role: 'neighbor',
    name: 'Mike Hart', avatar: '#F4A261', initials: 'MH',
    address: 'Villa 94, Costa Blanca Villas', verified: true, yearsInNeighborhood: 6,
    bio: 'Retired from the US, best decision ever. Love the golf, the beach, and the community.',
    posts: 45, neighbors: 127, points: 712
  },
  admin: {
    id: 'u10', username: 'admin', email: 'costablancavillaspanama@gmail.com', password: 'Paintball$1',
    role: 'admin', isOwner: true,
    name: 'Costa Blanca Villas', avatar: '#2E7D32', initials: 'CB',
    address: 'Costa Blanca Villas, Farallón', verified: true, yearsInNeighborhood: 4,
    bio: 'Official community account for Costa Blanca Villas, Farallón, Coclé, Panamá.',
    posts: 18, neighbors: 142, points: 534
  },
  decameron: {
    id: 'u11', username: 'decameron', password: 'Decameron$1',
    role: 'hoa',
    name: 'Decameron', avatar: '#C0392B', initials: 'DC',
    address: 'Decameron Royal Beach, Farallón, Coclé', verified: true,
    bio: 'Official Decameron account for Costa Blanca Villas. Resort management, community communications, and resident services.',
    posts: 12, members: 198, points: 0
  },
  uncover: {
    id: 'u12', username: 'uncover', password: 'Paintball$1',
    role: 'realtor',
    name: 'Uncover Panama Real Estate', avatar: '#1D3557', initials: 'UP',
    address: 'Costa Blanca · Bijao · Vistamar · Farallón', verified: true,
    bio: 'Official real estate partner for Costa Blanca Villas. Specializing in luxury villa sales and vacation rentals in Farallón, Panama.',
    posts: 0, neighbors: 0, points: 0
  }
};

const allUsers = [
  { id: 'u1',  name: 'Sarah Bailey',  avatar: '#0077B6', initials: 'SB', verified: true, yearsInNeighborhood: 3,  address: 'Villa 270', username: 'sarah'  },
  { id: 'u2',  name: 'Mike Hart',     avatar: '#F4A261', initials: 'MH', verified: true, yearsInNeighborhood: 6,  address: 'Villa 94',  username: 'mike'   },
  { id: 'u3',  name: 'Brad Taylor',   avatar: '#E76F51', initials: 'BT', verified: true, yearsInNeighborhood: 4,  address: 'Villa 23',  username: 'brad'   },
  { id: 'u4',  name: 'Terry Smith',   avatar: '#2A9D8F', initials: 'TS', verified: true, yearsInNeighborhood: 8,  address: 'Villa 31',  username: 'terry'  },
  { id: 'u5',  name: 'Cody Wilson',   avatar: '#E9C46A', initials: 'CW', verified: true, yearsInNeighborhood: 2,  address: 'Villa 309', username: 'cody'   },
  { id: 'u6',  name: 'Don Darling',   avatar: '#264653', initials: 'DD', verified: true, yearsInNeighborhood: 9,  address: 'Villa 139', username: 'don'    },
  { id: 'u7',  name: 'Daniel Giroux', avatar: '#A8DADC', initials: 'DG', verified: true, yearsInNeighborhood: 5,  address: 'Villa 102', username: 'daniel' },
  { id: 'u8',  name: 'Kerry Maurer',  avatar: '#457B9D', initials: 'KM', verified: true, yearsInNeighborhood: 11, address: 'Villa 323', username: 'kerry'  },
  { id: 'u9',  name: 'Dennis Moore',  avatar: '#E63946', initials: 'DM', verified: true, yearsInNeighborhood: 7,  address: 'Villa 324', username: 'dennis' },
  { id: 'u10', name: 'Costa Blanca Villas', avatar: '#2E7D32', initials: 'CB', verified: true, yearsInNeighborhood: 4, address: 'Costa Blanca Villas, Farallón', username: 'admin' },
  { id: 'u11', name: 'Decameron', avatar: '#C0392B', initials: 'DC', verified: true, yearsInNeighborhood: 10, address: 'Decameron Royal Beach, Farallón', username: 'decameron' }
];

// Del Mar Beach Club admin user (for official announcements)
const delMarUser = { id: 'delmar', name: 'Del Mar Beach Club', avatar: '#0077B6', initials: 'DM', verified: true, yearsInNeighborhood: 10, address: 'Costa Blanca Golf & Villas', username: 'delmar' };

let posts = [
  {
    id: 'p0a', type: 'general', section: 'feed',
    author: delMarUser,
    content: '📢 HORARIO / SCHEDULE — Del Mar Beach Club & Restaurant\n\nMARTES A DOMINGOS: 9:00 AM – 5:00 PM\nLUNES: CERRADOS\n\nHorario de Cocina: 9:00 AM – 4:30 PM\n\nSchedule subject to change by the administration. Contact us: 993-2255 EXT 8071.',
    image: '/images/delmar-schedule.jpeg',
    createdAt: new Date(Date.now() - 1 * 3600000).toISOString(),
    reactions: { like: 78, insightful: 34, agree: 56, haha: 0, wow: 12, sad: 0 },
    commentCount: 8,
    userReaction: null
  },
  {
    id: 'p0b', type: 'general', section: 'feed',
    author: delMarUser,
    content: "🍽️ CHEF'S SPECIAL — Cazuela de Mariscos en bisque de langosta y esencia de coral\n\nSeafood casserole in lobster bisque and coral essence. A sublime encounter of lobster tail, octopus, and shrimp, merged in a silky artisanal bisque. Served with coconut rice.\n\n$19.90 + ITBMS",
    image: '/images/delmar-chefs-special-1.jpeg',
    createdAt: new Date(Date.now() - 1.5 * 3600000).toISOString(),
    reactions: { like: 91, insightful: 18, agree: 72, haha: 2, wow: 64, sad: 0 },
    commentCount: 19,
    userReaction: null
  },
  {
    id: 'p0c', type: 'general', section: 'feed',
    author: delMarUser,
    content: "🍽️ CHEF'S SPECIAL — Sinfonía de pesca blanca en velouté de camarón y calamar\n\nWhite fish symphony in shrimp and squid Velouté. Flame-seared fillet bathed in a silky shrimp and calamari velouté. Served with the sweetness of coconut rice.\n\n$17.90 + ITBMS",
    image: '/images/delmar-chefs-special-2.jpeg',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    reactions: { like: 83, insightful: 14, agree: 61, haha: 0, wow: 57, sad: 0 },
    commentCount: 14,
    userReaction: null
  },
  {
    id: 'p1', type: 'recommendation', section: 'feed',
    author: allUsers[1],
    content: 'Went to Amar By La Playa Farallón last night for the first time — wow. The leche de tigre ceviche is incredible, best I\'ve had in Panama. The owner came out personally to greet us and the service was top notch. Views of the Pacific while you eat. Definitely the best restaurant near the community right now. Highly recommend! 🦞🌊',
    createdAt: new Date(Date.now() - 2 * 3600000).toISOString(),
    reactions: { like: 52, insightful: 11, agree: 38, haha: 2, wow: 19, sad: 0 },
    commentCount: 14,
    userReaction: null
  },
  {
    id: 'p2', type: 'safety', section: 'feed',
    author: allUsers[2],
    content: '⚠️ HEADS UP: Unknown silver pickup truck parked near the pedestrian gate on the north side last night around 10:30 PM. It was there for about 45 minutes with no one visible. I reported it to the security guard on duty. Please keep your villa gates locked and report anything suspicious to security at extension 101. Stay safe everyone!',
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    reactions: { like: 14, insightful: 41, agree: 97, haha: 0, wow: 18, sad: 38 },
    commentCount: 22,
    userReaction: null,
    alertType: 'Suspicious Activity',
    severity: 'high'
  },
  {
    id: 'p3', type: 'lost_found', section: 'feed',
    author: allUsers[4],
    content: '🐕 FOUND: Small brown and white dog wandering near the community pool this morning around 7am. No collar. Very friendly and well fed — clearly someone\'s pet. I have him safe at Villa 309. Please share with anyone who may be missing a dog in the area! Contact me to identify and claim.',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    reactions: { like: 71, insightful: 4, agree: 15, haha: 3, wow: 29, sad: 7 },
    commentCount: 18,
    userReaction: null
  },
  {
    id: 'p4', type: 'for_sale', section: 'feed',
    author: allUsers[5],
    content: 'Moving back to the States after 9 wonderful years — selling my outdoor rattan patio set. 6-chair dining table + 2 lounge chairs + side table. Cushions included, some fading from sun but solid. All weather and perfect for a villa terrace. Pick up only from Villa 94. $250 or best offer. Priced to move fast!',
    createdAt: new Date(Date.now() - 6 * 3600000).toISOString(),
    reactions: { like: 31, insightful: 3, agree: 22, haha: 0, wow: 9, sad: 14 },
    commentCount: 9,
    userReaction: null,
    price: 250,
    condition: 'Good condition'
  },
  {
    id: 'p5', type: 'events', section: 'feed',
    author: allUsers[6],
    content: '🌊 PLAYA FARALLÓN BEACH CLEANUP — Saturday April 5th, 7:00 AM! Meet at the main beach access gate. Gloves and bags provided. The dry season brings a lot of debris along the shoreline. Last year\'s cleanup was amazing — let\'s do it again! Cold drinks and patacones after. Kids very welcome. The turtles thank you! 🐢',
    createdAt: new Date(Date.now() - 8 * 3600000).toISOString(),
    reactions: { like: 84, insightful: 13, agree: 72, haha: 2, wow: 21, sad: 0 },
    commentCount: 31,
    userReaction: null
  },
  {
    id: 'p6', type: 'recommendation', section: 'feed',
    author: allUsers[3],
    content: 'Big shoutout to Esteban the electrician who fixed our generator issue on a Sunday morning! Our AC went out during the night and he had it sorted within 90 minutes. Very fair price, speaks English, and was incredibly professional. I have his number if anyone needs it — just DM me. Electricians like him are gold out here! 🔧⚡',
    createdAt: new Date(Date.now() - 10 * 3600000).toISOString(),
    reactions: { like: 61, insightful: 27, agree: 74, haha: 0, wow: 15, sad: 0 },
    commentCount: 11,
    userReaction: null
  },
  {
    id: 'p7', type: 'general', section: 'feed',
    author: allUsers[8],
    content: 'The sunset from the beach last night was absolutely unreal 🌅 Five years living in Panama and I\'ve never seen colors like that — deep coral fading into violet with the whole Gulf of Panama on fire. Did anyone else catch it? My photos don\'t do it justice at all. This is why we moved here.',
    createdAt: new Date(Date.now() - 14 * 3600000).toISOString(),
    reactions: { like: 127, insightful: 7, agree: 58, haha: 1, wow: 104, sad: 0 },
    commentCount: 26,
    userReaction: null
  },
  {
    id: 'p8', type: 'free', section: 'feed',
    author: allUsers[9],
    content: 'FREE: Clearing out the storage room — miscellaneous kitchen items, extra pots, dishes, a small bookshelf, and a bag of kids\' toys. All good condition. Rather give them to a neighbor than throw them out! At Villa 135. First come first served. Just knock or WhatsApp me.',
    createdAt: new Date(Date.now() - 18 * 3600000).toISOString(),
    reactions: { like: 38, insightful: 2, agree: 31, haha: 1, wow: 3, sad: 0 },
    commentCount: 7,
    userReaction: null
  },
  {
    id: 'p9', type: 'general', section: 'feed',
    author: allUsers[7],
    content: 'Quick reminder: the rainy season starts in May — only about 6 weeks away. Now is the perfect time to check your roof, clear your drains, and service your generator before you need it. I waited last year and regretted it! Rodrigo\'s maintenance crew did our villa last week, very thorough. Happy to share the contact.',
    createdAt: new Date(Date.now() - 22 * 3600000).toISOString(),
    reactions: { like: 89, insightful: 67, agree: 142, haha: 0, wow: 8, sad: 0 },
    commentCount: 19,
    userReaction: null
  },
  {
    id: 'p10', type: 'general', section: 'feed',
    author: allUsers[0],
    content: 'Does anyone have a recommendation for a reliable housekeeper? Preferably someone who has experience with expats and speaks some English. We\'re looking for twice a week, a few hours each time. Happy to pay well for someone trustworthy. Would love a personal referral from a neighbor. Gracias!',
    createdAt: new Date(Date.now() - 26 * 3600000).toISOString(),
    reactions: { like: 18, insightful: 5, agree: 11, haha: 0, wow: 1, sad: 2 },
    commentCount: 17,
    userReaction: null
  },
  {
    id: 'p11', type: 'poll', section: 'feed',
    author: allUsers[7],
    content: 'Community poll for the HOA meeting: the main interior road through Costa Blanca Villas gets a lot of golf cart and vehicle traffic in the evenings. Should we add speed bumps near the pool and playground areas? This is going on the April HOA agenda — your vote matters!',
    createdAt: new Date(Date.now() - 30 * 3600000).toISOString(),
    reactions: { like: 47, insightful: 31, agree: 62, haha: 3, wow: 4, sad: 2 },
    commentCount: 28,
    userReaction: null,
    pollOptions: [
      { id: 'poll_a', text: 'Yes — add speed bumps near pool & playground', votes: 134 },
      { id: 'poll_b', text: 'Better signage only, no bumps', votes: 31 },
      { id: 'poll_c', text: 'Current speed is fine', votes: 12 }
    ],
    userVote: null
  },
  {
    id: 'p12', type: 'lost_found', section: 'feed',
    author: allUsers[4],
    content: '😿 LOST CAT: Orange tabby named Naranja went missing Thursday evening near Villa 165-175 (north section). He\'s 3 years old, very friendly, no collar. He\'s never been outside the community before. Please check under your vehicles and in any shaded spots. Reward offered. Please share! 🙏',
    createdAt: new Date(Date.now() - 36 * 3600000).toISOString(),
    reactions: { like: 29, insightful: 3, agree: 11, haha: 0, wow: 4, sad: 72 },
    commentCount: 21,
    userReaction: null
  },
  {
    id: 'p13', type: 'recommendation', section: 'feed',
    author: allUsers[8],
    content: 'La Fogata near Playa Farallón — had Sunday lunch there with the family and it was incredible. The grilled octopus and the coconut shrimp were out of this world. Great vibe, friendly staff, and the Caribbean flavors are unlike anything else in the area. 4.6 on TripAdvisor and I can see why. Highly recommend for a treat! 🦑🥥',
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    reactions: { like: 73, insightful: 14, agree: 81, haha: 2, wow: 28, sad: 0 },
    commentCount: 18,
    userReaction: null
  },
  {
    id: 'p14', type: 'for_sale', section: 'feed',
    author: allUsers[3],
    content: 'Selling my golf cart — Club Car, 4-seater, electric, great condition. Perfect for getting around the community and down to the beach. New batteries installed 8 months ago. Runs great. $1,800 USD. Negotiable for a neighbor. Contact me at Villa 309 or WhatsApp. 🏌️',
    createdAt: new Date(Date.now() - 2.5 * 86400000).toISOString(),
    reactions: { like: 41, insightful: 6, agree: 28, haha: 1, wow: 22, sad: 1 },
    commentCount: 13,
    userReaction: null,
    price: 1800,
    condition: 'Great condition'
  },
  {
    id: 'p15', type: 'events', section: 'feed',
    author: allUsers[5],
    content: '🏊 Morning water aerobics at the community pool — every Tuesday and Thursday at 7:00 AM! Instructor Mariela leads a fantastic 45-minute class. Perfect for all fitness levels, super fun, and a great way to meet your neighbors. $10/class or $35/month. Just show up! ☀️',
    createdAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    reactions: { like: 49, insightful: 9, agree: 43, haha: 4, wow: 12, sad: 0 },
    commentCount: 9,
    userReaction: null
  },
  {
    id: 'p16', type: 'safety', section: 'safety',
    author: allUsers[2],
    content: 'A pack of stray dogs (3-4 animals) has been spotted near the south entrance and along the beach access path in the early mornings. They haven\'t been aggressive but please keep small children and pets close. I\'ve contacted the administration office and they\'re coordinating with the local animal control office. Update to follow.',
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    reactions: { like: 38, insightful: 64, agree: 108, haha: 0, wow: 29, sad: 43 },
    commentCount: 35,
    userReaction: null,
    alertType: 'Stray Animals',
    severity: 'medium'
  },
  {
    id: 'p17', type: 'safety', section: 'safety',
    author: allUsers[7],
    content: 'NOTICE: The main entrance road is being repaved by the Decameron construction crew this Friday and Saturday from 7 AM to 4 PM. Single-lane alternating traffic expected. Please plan extra time when entering or exiting the community this weekend. Use the rear service entrance if possible.',
    createdAt: new Date(Date.now() - 3 * 3600000).toISOString(),
    reactions: { like: 41, insightful: 59, agree: 93, haha: 0, wow: 17, sad: 4 },
    commentCount: 12,
    userReaction: null,
    alertType: 'Road Works',
    severity: 'low'
  },
  {
    id: 'p18', type: 'safety', section: 'safety',
    author: allUsers[4],
    content: '✅ UPDATE — Lost dog found! The little guy from near the pool has been reunited with his family from Villa 3239. They had no idea he squeezed through the garden fence! Huge thank you to everyone who shared and kept an eye out. This community is absolutely wonderful 🐕❤️',
    createdAt: new Date(Date.now() - 5 * 3600000).toISOString(),
    reactions: { like: 158, insightful: 4, agree: 41, haha: 9, wow: 52, sad: 0 },
    commentCount: 19,
    userReaction: null,
    alertType: 'Lost Pet Found',
    severity: 'resolved'
  },
  {
    id: 'p19', type: 'safety', section: 'safety',
    author: allUsers[6],
    content: 'ENSA (power company) is reporting a planned outage for the Farallón sector this Wednesday from 9 AM to 1 PM for scheduled maintenance on the main lines. Make sure your generators are fueled and your devices are charged the night before. AC units may take 15-20 min to cool down after power returns.',
    createdAt: new Date(Date.now() - 4 * 3600000).toISOString(),
    reactions: { like: 27, insightful: 52, agree: 78, haha: 0, wow: 31, sad: 15 },
    commentCount: 11,
    userReaction: null,
    alertType: 'Planned Power Outage',
    severity: 'medium'
  },
  {
    id: 'p20', type: 'for_sale', section: 'marketplace',
    author: allUsers[1],
    content: 'Honda EU2200i generator — barely used, bought it for hurricane season last year. Runs super quiet, inverter technology. Perfect for power outages or camping. $450. This is the one everyone wants and they\'re hard to find here. Pick up from Villa 94.',
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    reactions: { like: 22, insightful: 4, agree: 17, haha: 0, wow: 11, sad: 0 },
    commentCount: 6,
    userReaction: null,
    price: 450,
    condition: 'Like new',
    category: 'Home & Garden'
  }
];

let events = [
  {
    id: 'e1',
    title: 'Playa Farallón Beach Cleanup',
    description: 'Join your neighbors for our seasonal beach cleanup along Playa Farallón! Gloves, bags, and sunscreen provided. The dry season winds bring in a lot of debris. Cold drinks and patacones con queso served after for all volunteers. Kids welcome, sea turtles will thank you!',
    host: allUsers[6],
    location: 'Playa Farallón — main beach access gate, Costa Blanca Villas',
    date: '2026-04-05',
    time: '7:00 AM',
    endTime: '10:00 AM',
    category: 'Community',
    rsvp: { going: 41, maybe: 18, cantGo: 4 },
    userRsvp: null,
    goingAvatars: ['#F4A261', '#E76F51', '#2A9D8F', '#E9C46A', '#264653']
  },
  {
    id: 'e2',
    title: 'Morning Water Aerobics',
    description: 'Fun 45-minute water aerobics class led by certified instructor Mariela. Great for all fitness levels, especially knees and joints in the warm Panama climate. Bring a water bottle. Ongoing every Tuesday & Thursday at the community pool.',
    host: allUsers[5],
    location: 'Costa Blanca Villas Community Pool',
    date: '2026-04-01',
    time: '7:00 AM',
    endTime: '7:45 AM',
    category: 'Health & Fitness',
    rsvp: { going: 23, maybe: 7, cantGo: 1 },
    userRsvp: null,
    goingAvatars: ['#E76F51', '#A8DADC', '#E63946', '#0077B6']
  },
  {
    id: 'e3',
    title: 'HOA & Security Meeting — April',
    description: 'Monthly HOA meeting covering Q1 finances, the speed bump proposal, security updates, upcoming maintenance schedule, and the new pool hours policy. All villa owners and long-term renters encouraged to attend. Conducted in English and Spanish.',
    host: allUsers[7],
    location: 'Costa Blanca Villas Clubhouse (main pavilion)',
    date: '2026-04-08',
    time: '6:00 PM',
    endTime: '7:30 PM',
    category: 'Community',
    rsvp: { going: 78, maybe: 31, cantGo: 9 },
    userRsvp: null,
    goingAvatars: ['#0077B6', '#F4A261', '#264653', '#457B9D', '#E63946', '#2A9D8F']
  },
  {
    id: 'e4',
    title: 'Community BBQ & Swap Meet',
    description: 'Bring something to grill, something to sell or give away, and your best attitude! The pavilion will be open from morning — food, drinks, music, and a great opportunity to meet neighbors you haven\'t connected with yet. One of the best days of the year. Kids\' pool activities running too!',
    host: allUsers[5],
    location: 'Costa Blanca Villas Main Pavilion & Pool Area',
    date: '2026-04-19',
    time: '10:00 AM',
    endTime: '4:00 PM',
    category: 'Community',
    rsvp: { going: 167, maybe: 54, cantGo: 11 },
    userRsvp: null,
    goingAvatars: ['#E76F51', '#A8DADC', '#2A9D8F', '#6D6875', '#E63946', '#F4A261']
  },
  {
    id: 'e5',
    title: 'Kids Snorkeling Lessons — Playa Farallón',
    description: 'Beginner snorkeling lessons for kids ages 6-14 with certified instructor Javier. Masks and fins provided. Playa Farallón has incredible marine life just offshore — angelfish, parrotfish, and more! Max 8 kids per session. Spots fill up fast, comment below to reserve!',
    host: allUsers[1],
    location: 'Playa Farallón — calm swimming area near beach access',
    date: '2026-04-26',
    time: '8:00 AM',
    endTime: '10:00 AM',
    category: 'Kids & Family',
    rsvp: { going: 19, maybe: 11, cantGo: 2 },
    userRsvp: null,
    goingAvatars: ['#E9C46A', '#A8DADC', '#457B9D']
  },
  {
    id: 'e6',
    title: 'Bingo Night — Costa Blanca Beach Club',
    description: 'Friday night Bingo at the Costa Blanca Beach Club! $5 entry per card, all proceeds go toward community fund. Cash prizes, cold drinks at the bar, and great company. Doors open at 6:30 PM, first game at 7:00 PM sharp. Bring your lucky dauber! This is always a blast.',
    host: allUsers[7],
    location: 'Costa Blanca Beach Club — main event hall',
    date: '2026-04-04',
    time: '7:00 PM',
    endTime: '9:30 PM',
    category: 'Entertainment',
    rsvp: { going: 48, maybe: 19, cantGo: 6 },
    userRsvp: null,
    goingAvatars: ['#0077B6', '#F4A261', '#E76F51', '#2A9D8F', '#E9C46A', '#264653']
  },
  {
    id: 'e7',
    title: 'Sunset Drinks & Social — Beach Club',
    description: 'Monthly happy hour social at the Costa Blanca Beach Club! Come meet your neighbors over cocktails and cold Balboas as the sun goes down over the Pacific. Appetizers included. No cover charge, just great vibes and even better sunsets. New residents especially welcome — come introduce yourself!',
    host: allUsers[0],
    location: 'Costa Blanca Beach Club — poolside terrace',
    date: '2026-04-11',
    time: '5:30 PM',
    endTime: '8:00 PM',
    category: 'Social',
    rsvp: { going: 63, maybe: 28, cantGo: 7 },
    userRsvp: null,
    goingAvatars: ['#E76F51', '#A8DADC', '#E63946', '#6D6875', '#F4A261']
  },
  {
    id: 'e8',
    title: 'Karaoke Night — Nico\'s Beach Bar',
    description: 'Karaoke every Saturday night at Nico\'s Beach Bar! Starting at 8 PM. Great sound system, huge song selection (English, Spanish, and more), cold drinks, and the best beach crowd on the coast. No cover charge. Come early for a table — it fills up fast. All skill levels welcome, just bring your voice! 🎤',
    host: allUsers[3],
    location: 'Nico\'s Beach Bar — Playa Farallón (0.9 mi from community)',
    date: '2026-04-05',
    time: '8:00 PM',
    endTime: '11:30 PM',
    category: 'Entertainment',
    rsvp: { going: 37, maybe: 22, cantGo: 4 },
    userRsvp: null,
    goingAvatars: ['#2A9D8F', '#E9C46A', '#457B9D', '#E63946']
  }
];

let businesses = [
  {
    id: 'b1',
    name: 'Amar By La Playa Farallón',
    category: 'Restaurant',
    description: 'Peruvian-Panamanian fusion with stunning Pacific views. Famous for their leche de tigre ceviche, grilled fresh catch, and creative cocktails. One of the highest-rated restaurants on the Coclé coast. Reservations recommended on weekends.',
    address: 'Playa Farallón, Farallón, Coclé — 1.3 mi from community',
    phone: '+507 6789-1234',
    hours: 'Wed-Mon 10:00 AM - 9:00 PM | Closed Tuesday',
    rating: 4.8,
    reviewCount: 287,
    recommendedBy: 94,
    website: 'amarbylaplayapanama.com',
    photos: ['https://picsum.photos/seed/amar1/420/260','https://picsum.photos/seed/amar2/420/260','https://picsum.photos/seed/amar3/420/260'],
    tags: ['Peruvian', 'Seafood', 'Ceviche', 'Ocean View', 'Cocktails']
  },
  {
    id: 'b2',
    name: 'La Fogata',
    category: 'Restaurant',
    description: 'Caribbean-Panamanian cuisine in a lush open-air setting. Their grilled octopus, coconut shrimp, and ropa vieja are legendary. Great for families and large groups. Live music on Friday evenings.',
    address: 'Carretera Farallón — 0.8 mi from community',
    phone: '+507 6543-9876',
    hours: 'Tue-Sun 11:00 AM - 10:00 PM | Closed Monday',
    rating: 4.6,
    reviewCount: 341,
    recommendedBy: 112,
    website: 'lafogatapanama.com',
    photos: ['https://picsum.photos/seed/fogata1/420/260','https://picsum.photos/seed/fogata2/420/260','https://picsum.photos/seed/fogata3/420/260'],
    tags: ['Caribbean', 'Seafood', 'Family Friendly', 'Live Music', 'Groups']
  },
  {
    id: 'b3',
    name: 'Restaurante Xoko',
    category: 'Restaurant',
    description: 'Beloved local seafood spot specializing in whole grilled fish, ceviche, and traditional Panamanian dishes. Casual beach atmosphere, incredibly fresh ingredients straight from local fishermen. A true hidden gem.',
    address: 'Playa Farallón Road — 2.0 mi from community',
    phone: '+507 6321-5678',
    hours: 'Mon-Sun 11:00 AM - 9:00 PM',
    rating: 4.5,
    reviewCount: 198,
    recommendedBy: 76,
    website: 'xokopanama.com',
    photos: ['https://picsum.photos/seed/xoko1/420/260','https://picsum.photos/seed/xoko2/420/260'],
    tags: ['Seafood', 'Local Cuisine', 'Grilled Fish', 'Casual', 'Budget Friendly']
  },
  {
    id: 'b4',
    name: "Nico's Beach Bar",
    category: 'Bar & Grill',
    description: 'The go-to beach bar in Farallón. Cold Balboas, tropical cocktails, simple bar food, and incredible sunset views. Great spot to wind down after a day on the beach. Lively atmosphere on weekends.',
    address: 'Playa Farallón beachfront — 0.9 mi from community',
    phone: '+507 6234-5678',
    hours: 'Mon-Sun Noon - 10:00 PM',
    rating: 3.8,
    reviewCount: 163,
    recommendedBy: 58,
    website: 'nicosbeachfarallon.com',
    photos: ['https://picsum.photos/seed/nicos1/420/260','https://picsum.photos/seed/nicos2/420/260'],
    tags: ['Bar', 'Beachfront', 'Cocktails', 'Sunset Views', 'Casual']
  },
  {
    id: 'b5',
    name: "Pipa's Beach",
    category: 'Restaurant',
    description: 'Casual open-air seafood restaurant right on the sand. Great for lunch after a morning swim. Their mixed ceviche platter and fried calamari are crowd favorites. Friendly staff and laid-back atmosphere.',
    address: 'Playa Farallón — 1.3 mi from community',
    phone: '+507 6891-2345',
    hours: 'Mon-Sun 9:00 AM - 6:00 PM',
    rating: 4.1,
    reviewCount: 214,
    recommendedBy: 67,
    website: 'pipasbeach.com',
    photos: ['https://picsum.photos/seed/pipas1/420/260','https://picsum.photos/seed/pipas2/420/260'],
    tags: ['Seafood', 'Beachfront', 'Lunch', 'Ceviche', 'Casual']
  },
  {
    id: 'b6',
    name: 'Kilian Restaurant',
    category: 'Restaurant',
    description: 'Upscale seafood and international menu with a beautiful terrace overlooking the coastline. Popular with Decameron resort guests and residents alike. Great wine selection and excellent service. Perfect for date night or special occasions.',
    address: 'Near Playa Farallón — 0.7 mi from community',
    phone: '+507 6765-4321',
    hours: 'Mon-Sun Noon - 10:00 PM',
    rating: 4.0,
    reviewCount: 178,
    recommendedBy: 51,
    website: 'kilianrestaurant.com',
    photos: ['https://picsum.photos/seed/kilian1/420/260','https://picsum.photos/seed/kilian2/420/260'],
    tags: ['Seafood', 'International', 'Upscale', 'Date Night', 'Wine']
  },
  {
    id: 'b7',
    name: 'Budget Rent a Car — Decameron',
    category: 'Transportation',
    description: 'Convenient car rental located at the Royal Decameron Panama resort entrance. Great for day trips to Penonomé, El Valle, or Panama City. Advance booking recommended during dry season. Airport drop-off available.',
    address: 'Royal Decameron Panama, Farallón, Coclé',
    phone: '+507 6123-4567',
    hours: 'Mon-Sun 8:00 AM - 6:00 PM',
    rating: 4.3,
    reviewCount: 124,
    recommendedBy: 43,
    website: 'budget.com.pa',
    photos: ['https://picsum.photos/seed/budget1/420/260','https://picsum.photos/seed/budget2/420/260'],
    tags: ['Car Rental', 'Day Trips', 'Airport Drop-off', 'SUVs Available']
  },
  {
    id: 'b8',
    name: 'Fonda La Tortuga',
    category: 'Restaurant',
    description: 'Authentic Panamanian home cooking at unbeatable prices. Run by the González family for over 20 years. Try the sancocho, arroz con pollo, and fresh tamales. A true community institution and a favorite among expat residents.',
    address: 'Farallón village, main road — 1.8 mi from community',
    phone: '+507 6654-3210',
    hours: 'Mon-Sat 7:00 AM - 3:00 PM | Closed Sunday',
    rating: 4.4,
    reviewCount: 89,
    recommendedBy: 61,
    website: 'fondalatortuga.com',
    photos: ['https://picsum.photos/seed/tortuga1/420/260','https://picsum.photos/seed/tortuga2/420/260'],
    tags: ['Panamanian', 'Local', 'Breakfast', 'Lunch', 'Budget Friendly', 'Authentic']
  }
];

const pendingClaims = [];

let marketplaceItems = [
  { id: 'm1', title: 'Outdoor Rattan Patio Set', price: 250, free: false, condition: 'Good condition', category: 'Furniture', seller: allUsers[5], description: '6-chair dining table + 2 loungers + side table. All-weather. Cushions included.', createdAt: new Date(Date.now() - 6 * 3600000).toISOString(), color: '#2A9D8F', image: '/images/furniture.png' },
  { id: 'm2', title: 'Club Car Golf Cart (4-seat)', price: 1800, free: false, condition: 'Great condition', category: 'Transportation', seller: allUsers[3], description: 'Electric, new batteries 8 months ago. Perfect for the community and beach access.', createdAt: new Date(Date.now() - 2.5 * 86400000).toISOString(), color: '#0077B6', image: '/images/golf-cart.png' },
  { id: 'm3', title: 'Titleist Golf Iron Set', price: 120, free: false, condition: 'Good condition', category: 'Sports', seller: allUsers[1], description: 'Full set of Titleist irons, 4-PW. Great for the Costa Blanca golf course. Selling because upgrading.', createdAt: new Date(Date.now() - 4 * 86400000).toISOString(), color: '#E76F51', image: '/images/golf-clubs.png' },
  { id: 'm4', title: 'Beach Chairs Set (2 chairs)', price: 45, free: false, condition: 'Good condition', category: 'Sports', seller: allUsers[7], description: 'Two folding beach chairs with carrying straps. Perfect for daily Playa Farallón trips.', createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), color: '#457B9D', image: '/images/beach-chairs.png' },
  { id: 'm5', title: 'Window AC Unit (12,000 BTU)', price: 120, free: false, condition: 'Good condition', category: 'Home & Garden', seller: allUsers[2], description: 'LG 12,000 BTU. Works great, upgrading to split system. Pick up Villa 23.', createdAt: new Date(Date.now() - 7 * 86400000).toISOString(), color: '#264653', image: '/images/ac-unit.jpg' },
  { id: 'm6', title: 'Tropical Plants — FREE', price: 0, free: true, condition: 'Thriving', category: 'Free', seller: allUsers[9], description: 'Heliconia, bird of paradise, and pothos cuttings. Perfect for villa gardens. Come take some!', createdAt: new Date(Date.now() - 18 * 3600000).toISOString(), color: '#52B788', image: '/images/tropical-plants.jpg' },
  { id: 'm7', title: 'Miscellaneous Kitchen Items — FREE', price: 0, free: true, condition: 'Good condition', category: 'Free', seller: allUsers[0], description: 'Pots, pans, dishes, glasses, small appliances. Clearing out. Villa 270. Come take what you need!', createdAt: new Date(Date.now() - 3 * 86400000).toISOString(), color: '#2A9D8F', image: '/images/kitchen-items.jpg' },
  { id: 'm8', title: 'Snorkeling Gear Set (adult)', price: 35, free: false, condition: 'Good condition', category: 'Sports', seller: allUsers[8], description: 'Mask, fins, snorkel + mesh bag. Size M. Playa Farallón has amazing reef fish to explore!', createdAt: new Date(Date.now() - 6 * 86400000).toISOString(), color: '#F4A261', image: '/images/snorkel.jpg' },
  { id: 'm9', title: 'JBL Charge 5 Bluetooth Speaker', price: 55, free: false, condition: 'Like new', category: 'Electronics', seller: allUsers[4], description: 'Waterproof, 20hr battery. Perfect for beach days. Barely used, upgrading to bigger model.', createdAt: new Date(Date.now() - 8 * 86400000).toISOString(), color: '#E63946', image: '/images/speaker.jpg' },
  { id: 'm10', title: 'Beach Umbrella + 2 Chairs Set', price: 45, free: false, condition: 'Good condition', category: 'Sports', seller: allUsers[6], description: 'UPF 50+ umbrella + 2 sand chairs with cup holders. Great set for Playa Farallón days.', createdAt: new Date(Date.now() - 10 * 86400000).toISOString(), color: '#6D6875', image: '/images/beach-chairs.png' }
];

let groups = [
  { id: 'g1', name: 'Costa Blanca Villas Owners', members: 198, description: 'Official group for villa owners and long-term residents. HOA updates, maintenance announcements, and community decisions. This is the primary community channel.', icon: '🏡', category: 'Community', joined: true, lastActivity: '1 hour ago', createdBy: 'admin', privacy: 'public', membersList: ['mike', 'admin'], coverPhoto: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=900&h=220&fit=crop&auto=format' },
  { id: 'g2', name: 'Expats in Farallón & Coclé', members: 341, description: 'For expats living or vacationing in the Farallón/Decameron area. Tips on visas, banking, doctors, Spanish lessons, and making the most of life in Panama!', icon: '🌎', category: 'Expat Life', joined: true, lastActivity: '30 minutes ago', createdBy: 'mike', privacy: 'public', membersList: ['mike', 'admin'], coverPhoto: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=900&h=220&fit=crop&auto=format' },
  { id: 'g3', name: 'Playa Farallón Beach Lovers', members: 287, description: 'Share sunrise photos, surf conditions, tide schedules, turtle nesting updates, and organize beach days. The ocean is our backyard!', icon: '🌊', category: 'Environment', joined: false, lastActivity: '2 hours ago', createdBy: 'mike', privacy: 'public', membersList: [], coverPhoto: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900&h=220&fit=crop&auto=format' },
  { id: 'g4', name: 'Lost & Found Pets — Costa Blanca', members: 156, description: 'Help reunite lost pets in and around Costa Blanca Villas and Farallón. Fast response from this group has reunited 23 pets since it started!', icon: '🐾', category: 'Pets', joined: false, lastActivity: '45 minutes ago', createdBy: 'mike', privacy: 'public', membersList: [], coverPhoto: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=900&h=220&fit=crop&auto=format' },
  { id: 'g5', name: 'Farallón Foodie Club', members: 203, description: 'Restaurant reviews, market days, local recipe swaps, and group dinners at spots near the community. From La Fogata to Fonda la Tortuga!', icon: '🍽️', category: 'Food & Drink', joined: true, lastActivity: '3 hours ago', createdBy: 'mike', privacy: 'public', membersList: ['mike'], coverPhoto: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=900&h=220&fit=crop&auto=format' },
  { id: 'g6', name: 'Safety & Security Watch', members: 224, description: 'Eyes and ears for a safe community. Report suspicious activity, share security tips, coordinate with the on-site security team, and keep Costa Blanca Villas safe.', icon: '🔒', category: 'Safety', joined: false, lastActivity: '4 hours ago', createdBy: 'admin', privacy: 'public', membersList: [], coverPhoto: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&h=220&fit=crop&auto=format' }
];

let groupReports = [];

let notifications = [
  { id: 'n1', type: 'reaction', read: false, message: 'Mike Hart reacted 👍 to your post about the housekeeper', time: new Date(Date.now() - 30 * 60000).toISOString(), avatar: '#F4A261', initials: 'MH' },
  { id: 'n2', type: 'comment', read: false, message: 'Jennifer Walsh commented on "Playa Farallón Beach Cleanup": "We\'ll be there! Bringing the whole family 🙌"', time: new Date(Date.now() - 1.5 * 3600000).toISOString(), avatar: '#E76F51', initials: 'JW' },
  { id: 'n3', type: 'reaction', read: false, message: 'Carlos Méndez and 4 others agreed with your post', time: new Date(Date.now() - 2 * 3600000).toISOString(), avatar: '#2A9D8F', initials: 'CM' },
  { id: 'n4', type: 'event', read: false, message: 'Reminder: HOA & Security Meeting is next Tuesday at 6:00 PM', time: new Date(Date.now() - 3 * 3600000).toISOString(), avatar: '#A8DADC', initials: 'LF' },
  { id: 'n5', type: 'neighbor', read: false, message: 'Welcome! Emily Hart moved to Villa 318 — say hi 👋', time: new Date(Date.now() - 5 * 3600000).toISOString(), avatar: '#E63946', initials: 'EH' },
  { id: 'n6', type: 'comment', read: true, message: 'Tom Murphy replied to your comment: "Great tip about the generator, thanks Sarah!"', time: new Date(Date.now() - 8 * 3600000).toISOString(), avatar: '#264653', initials: 'TM' },
  { id: 'n7', type: 'safety', read: true, message: 'New safety alert: suspicious silver pickup near north gate', time: new Date(Date.now() - 10 * 3600000).toISOString(), avatar: '#E76F51', initials: 'JW' },
  { id: 'n8', type: 'reaction', read: true, message: 'Lisa Fontaine found your free plants post insightful 💡', time: new Date(Date.now() - 14 * 3600000).toISOString(), avatar: '#A8DADC', initials: 'LF' },
  { id: 'n9', type: 'event', read: true, message: 'Ricardo González is going to the Community BBQ & Swap Meet', time: new Date(Date.now() - 1 * 86400000).toISOString(), avatar: '#457B9D', initials: 'RG' },
  { id: 'n10', type: 'comment', read: true, message: 'Amanda Torres commented on the lost cat post: "Sharing to the pet group now!"', time: new Date(Date.now() - 1.2 * 86400000).toISOString(), avatar: '#E9C46A', initials: 'AT' },
  { id: 'n11', type: 'group', read: true, message: 'Costa Blanca Villas Owners: New HOA agenda posted for April meeting', time: new Date(Date.now() - 2 * 86400000).toISOString(), avatar: '#0077B6', initials: 'SB' },
  { id: 'n12', type: 'reaction', read: true, message: 'Brad Taylor and 11 others reacted to your Gulf of Panama sunset post', time: new Date(Date.now() - 2.5 * 86400000).toISOString(), avatar: '#E76F51', initials: 'BT' }
];

let comments = {
  p1: [
    { id: 'c1', author: allUsers[3], content: 'Completely agree! The leche de tigre is the real deal. We go every Sunday now. Make sure you try the whole grilled pargo if they have it!', createdAt: new Date(Date.now() - 1.5 * 3600000).toISOString() },
    { id: 'c2', author: allUsers[0], content: 'We drove past but never stopped. Going this weekend for sure. Do they take cards or cash only?', createdAt: new Date(Date.now() - 1 * 3600000).toISOString() },
    { id: 'c3', author: allUsers[6], content: 'They take cards now! And the cocktails are wonderful — try the maracuyá sour. 🌺', createdAt: new Date(Date.now() - 30 * 60000).toISOString() }
  ],
  p2: [
    { id: 'c4', author: allUsers[7], content: 'Thanks for reporting this Jennifer. I also saw something unusual near the south fence around 10pm — might be related. I notified the overnight guard.', createdAt: new Date(Date.now() - 2.5 * 3600000).toISOString() },
    { id: 'c5', author: allUsers[3], content: 'Good to know. I\'ll mention this at the HOA meeting. We should talk about upgrading the gate cameras on the north side.', createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
    { id: 'c6', author: allUsers[0], content: 'I have a camera on my villa entrance. I\'ll check the footage and share if I caught anything useful.', createdAt: new Date(Date.now() - 1 * 3600000).toISOString() }
  ],
  p5: [
    { id: 'c7', author: allUsers[0], content: 'Count me in! This is my second year and last year was incredible. The kids loved it too 🐢', createdAt: new Date(Date.now() - 7 * 3600000).toISOString() },
    { id: 'c8', author: allUsers[3], content: 'Can we meet 15 min early to organize into groups? Also — should we bring our own gloves or are they provided?', createdAt: new Date(Date.now() - 6 * 3600000).toISOString() },
    { id: 'c9', author: allUsers[6], content: 'Gloves and bags are provided! Meet at 6:45 for early birds to organize. I\'ll have the sign-up sheet. 🌊', createdAt: new Date(Date.now() - 5 * 3600000).toISOString() }
  ]
};

// ─── Sessions ────────────────────────────────────────────────────────────────

function getUser(req) {
  const username = req.signedCookies && req.signedCookies.user;
  if (!username || !users[username]) return null;
  return { username, userId: users[username].id };
}

// ─── API Routes ───────────────────────────────────────────────────────────────

// ─── Reports ─────────────────────────────────────────────────────────────────
const reports = [];

app.post('/api/reports', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { targetType, targetId, targetLabel, reason, note } = req.body;
  if (!targetType || !targetId || !reason) return res.status(400).json({ error: 'Missing fields' });
  const u = users[user.username];
  reports.push({
    id: 'r' + Date.now(),
    targetType,   // 'post' | 'business' | 'group' | 'member'
    targetId,
    targetLabel: targetLabel || targetId,
    reason,
    note: note || '',
    reportedBy: { id: u.id, name: u.name, username: user.username, initials: u.initials, avatar: u.avatar },
    createdAt: new Date().toISOString(),
    status: 'open'
  });
  res.json({ ok: true });
});

app.get('/api/admin/reports', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  res.json(reports);
});

app.post('/api/admin/reports/:id/resolve', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const r = reports.find(r => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  r.status = 'resolved';
  r.resolvedBy = user.username;
  r.resolvedAt = new Date().toISOString();
  res.json({ ok: true });
});

app.post('/api/admin/reports/:id/dismiss', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const r = reports.find(r => r.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  r.status = 'dismissed';
  res.json({ ok: true });
});

// ─── Access Requests (landing page) ─────────────────────────────────────────
const accessRequests = [];

app.post('/api/request-access', (req, res) => {
  const { nameVilla } = req.body;
  if (!nameVilla || !nameVilla.trim()) return res.status(400).json({ error: 'Please provide your name and villa.' });
  accessRequests.push({ id: 'ar' + Date.now(), nameVilla: nameVilla.trim(), submittedAt: new Date().toISOString(), status: 'new' });
  res.json({ ok: true });
});

app.get('/api/admin/access-requests', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  res.json(accessRequests);
});

app.post('/api/admin/access-requests/:id/dismiss', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const r = accessRequests.find(r => r.id === req.params.id);
  if (r) r.status = 'dismissed';
  res.json({ ok: true });
});

// Admin: remove member (no ban)
app.delete('/api/admin/users/:username', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const target = req.params.username;
  if (!users[target]) return res.status(404).json({ error: 'User not found' });
  if (target === user.username) return res.status(400).json({ error: 'Cannot remove yourself' });
  if (users[target]?.isOwner) return res.status(400).json({ error: 'Cannot remove the platform owner' });
  delete users[target];
  const idx = allUsers.findIndex(u => u.username === target);
  if (idx !== -1) allUsers.splice(idx, 1);
  res.json({ ok: true });
});

// ─── Admin Team Management (owner only) ─────────────────────────────────────
app.get('/api/admin/team', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (u?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  if (!u?.isOwner) return res.status(403).json({ error: 'Owner only' });
  const team = Object.values(users).filter(u => u.role === 'admin').map(({ password, ...safe }) => safe);
  res.json(team);
});

app.post('/api/admin/team/promote/:username', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (!u?.isOwner) return res.status(403).json({ error: 'Only the owner can promote admins' });
  const target = users[req.params.username];
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'admin') return res.status(400).json({ error: 'Already an admin' });
  if (['hoa'].includes(target.role)) return res.status(400).json({ error: 'Cannot promote HOA accounts' });
  target.role = 'admin';
  target.isOwner = false;
  const { password, ...safe } = target;
  res.json({ ok: true, user: safe });
});

app.delete('/api/admin/team/:username', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (!u?.isOwner) return res.status(403).json({ error: 'Only the owner can remove admins' });
  const target = users[req.params.username];
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.isOwner) return res.status(400).json({ error: 'Cannot remove the owner' });
  if (target.role !== 'admin') return res.status(400).json({ error: 'User is not an admin' });
  target.role = 'neighbor';
  delete target.isOwner;
  res.json({ ok: true });
});

// ─── Ban System ──────────────────────────────────────────────────────────────
const bannedMembers = [];

app.post('/api/admin/users/:username/ban', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  const target = req.params.username;
  const { reason } = req.body;
  if (!users[target]) return res.status(404).json({ error: 'User not found' });
  if (target === user.username) return res.status(400).json({ error: 'Cannot ban yourself' });
  if (users[target]?.isOwner) return res.status(400).json({ error: 'Cannot ban the platform owner' });
  if (['hoa'].includes(users[target]?.role)) return res.status(400).json({ error: 'Cannot ban HOA accounts' });

  const u = users[target];
  const ban = {
    id: 'ban' + Date.now(),
    username: u.username,
    name: u.name,
    address: u.address || '',
    avatar: u.avatar,
    initials: u.initials,
    role: u.role,
    reason: reason || 'Violation of Member Agreement',
    bannedAt: new Date().toISOString(),
    bannedBy: user.username
  };
  bannedMembers.push(ban);

  // Remove from active users
  delete users[target];
  const idx = allUsers.findIndex(u => u.username === target);
  if (idx !== -1) allUsers.splice(idx, 1);

  res.json({ ok: true, ban });
});

app.post('/api/admin/banned/:id/unban', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const ban = bannedMembers.find(b => b.id === req.params.id);
  if (!ban) return res.status(404).json({ error: 'Ban not found' });
  ban.status = 'lifted';
  res.json({ ok: true });
});

app.get('/api/admin/banned', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  res.json(bannedMembers.filter(b => b.status !== 'lifted'));
});

// ─── Security Alerts & HOA Contacts ─────────────────────────────────────────
const hoaContacts = [];   // { id, name, email, addedAt }
const securityAlerts = []; // { id, type, severity, title, message, sentTo, createdAt, createdBy }
let decameronEmail = '';   // Decameron's notification email address

// Email transporter — configured with admin Gmail credentials stored in env or settings
let emailTransporter = null;
let emailConfig = { user: '', pass: '', configured: false };

// GET community safety posts (for admin Security Alerts view)
app.get('/api/admin/community-safety', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const safetyPosts = posts
    .filter(p => p.type === 'safety')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .map(p => ({
      id: p.id, type: 'community_post',
      title: p.alertType ? `${p.alertType} alert` : 'Safety Post',
      message: p.content,
      severity: p.severity || 'medium',
      author: p.author?.name || 'Unknown',
      createdAt: p.createdAt,
      forwardedToDecameron: p.forwardedToDecameron || false
    }));
  // Also include safety-related reports
  const safetyReports = reports
    .filter(r => r.targetType === 'post' || r.reason?.toLowerCase().includes('safety') || r.reason?.toLowerCase().includes('threat'))
    .map(r => ({
      id: r.id, type: 'report',
      title: `Report: ${r.targetLabel || r.targetType}`,
      message: `Reason: ${r.reason}${r.note ? '\nNote: ' + r.note : ''}`,
      severity: 'medium',
      author: r.reportedBy || 'Anonymous',
      createdAt: r.createdAt,
      forwardedToDecameron: r.forwardedToDecameron || false
    }));
  res.json([...safetyPosts, ...safetyReports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// SET Decameron email
app.post('/api/admin/decameron-email', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!users[user.username]?.isOwner) return res.status(403).json({ error: 'Owner only' });
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
  decameronEmail = email;
  res.json({ ok: true });
});

app.get('/api/admin/decameron-email', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  res.json({ email: decameronEmail });
});

// FORWARD to Decameron
app.post('/api/admin/forward-to-decameron', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  const { itemId, itemType, title, message, severity, author, createdAt } = req.body;
  if (!decameronEmail) return res.status(400).json({ error: 'Decameron email not configured' });
  if (!emailTransporter) return res.status(400).json({ error: 'Email not configured — add Gmail credentials in Security Alerts settings' });

  const sevColors = { low: '#16a34a', medium: '#d97706', high: '#ea580c', urgent: '#dc2626' };
  const sevLabels = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'URGENT' };

  try {
    await emailTransporter.sendMail({
      from: `"Costa Blanca Villas Admin" <${emailConfig.user}>`,
      to: decameronEmail,
      subject: `[Safety Alert] ${title} — Costa Blanca Villas`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#1a3a5c;color:white;padding:20px;border-radius:8px 8px 0 0;">
            <h2 style="margin:0;">🏘️ Costa Blanca Villas — Safety Alert</h2>
            <p style="margin:4px 0 0;opacity:0.8;">Forwarded by community admin · Requires Decameron attention</p>
          </div>
          <div style="background:#fff3cd;border-left:4px solid ${sevColors[severity] || '#d97706'};padding:14px 20px;">
            <strong>Severity:</strong> ${sevLabels[severity] || severity} &nbsp;·&nbsp; <strong>Reported by:</strong> ${author} &nbsp;·&nbsp; <strong>Time:</strong> ${new Date(createdAt).toLocaleString()}
          </div>
          <div style="padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
            <h3 style="color:#1a3a5c;margin-top:0;">${title}</h3>
            <p style="color:#333;line-height:1.6;white-space:pre-wrap;">${message}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
            <p style="color:#888;font-size:12px;">Forwarded from Panamá Connect · Costa Blanca Villas, Farallón, Coclé, Panamá<br>Please respond through official Decameron channels or contact the community admin.</p>
          </div>
        </div>
      `
    });
    // Mark as forwarded
    const post = posts.find(p => p.id === itemId);
    if (post) post.forwardedToDecameron = true;
    const report = reports.find(r => r.id === itemId);
    if (report) report.forwardedToDecameron = true;
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Email failed: ' + err.message });
  }
});

function buildTransporter() {
  if (!emailConfig.user || !emailConfig.pass) return null;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailConfig.user, pass: emailConfig.pass }
  });
}

// GET HOA contacts
app.get('/api/admin/hoa-contacts', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  res.json(hoaContacts);
});

// ADD HOA contact
app.post('/api/admin/hoa-contacts', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const { name, email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Valid email required' });
  if (hoaContacts.find(c => c.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ error: 'Email already in list' });
  const contact = { id: 'hoa' + Date.now(), name: name || email, email, addedAt: new Date().toISOString() };
  hoaContacts.push(contact);
  res.json({ ok: true, contact });
});

// REMOVE HOA contact
app.delete('/api/admin/hoa-contacts/:id', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const idx = hoaContacts.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  hoaContacts.splice(idx, 1);
  res.json({ ok: true });
});

// SAVE email credentials (for sending alerts)
app.post('/api/admin/email-config', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!users[user.username]?.isOwner) return res.status(403).json({ error: 'Owner only' });
  const { gmailUser, gmailAppPassword } = req.body;
  if (!gmailUser || !gmailAppPassword) return res.status(400).json({ error: 'Gmail address and App Password required' });
  emailConfig = { user: gmailUser, pass: gmailAppPassword, configured: true };
  emailTransporter = buildTransporter();
  res.json({ ok: true, configured: true });
});

app.get('/api/admin/email-config', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!users[user.username]?.isOwner) return res.status(403).json({ error: 'Owner only' });
  res.json({ configured: emailConfig.configured, user: emailConfig.user });
});

// GET security alerts
app.get('/api/admin/security-alerts', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  res.json([...securityAlerts].reverse());
});

// CREATE & SEND security alert
app.post('/api/admin/security-alerts', async (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  const { alertType, severity, title, message, postToFeed, emailHOA } = req.body;
  if (!title || !message) return res.status(400).json({ error: 'Title and message required' });

  const alert = {
    id: 'alert' + Date.now(),
    alertType: alertType || 'general',
    severity: severity || 'medium',
    title, message,
    postToFeed: !!postToFeed,
    emailHOA: !!emailHOA,
    sentTo: emailHOA ? hoaContacts.map(c => c.email) : [],
    emailStatus: 'not_sent',
    createdAt: new Date().toISOString(),
    createdBy: user.username
  };

  // Post to community feed if requested
  if (postToFeed) {
    const authorData = allUsers.find(u => u.username === user.username) || allUsers[0];
    posts.push({
      id: 'post' + Date.now(),
      type: 'safety',
      section: 'feed',
      content: `**${title}**\n\n${message}`,
      author: authorData,
      isOfficial: true,
      severity: alert.severity,
      alertType: alert.alertType,
      createdAt: new Date().toISOString(),
      likes: 0, likedBy: [], comments: []
    });
  }

  // Send email to HOA contacts if requested
  if (emailHOA && hoaContacts.length > 0) {
    if (!emailTransporter) {
      alert.emailStatus = 'not_configured';
    } else {
      const severityLabels = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'URGENT' };
      const typeLabels = { security: 'Security Alert', noise: 'Noise Complaint', vandalism: 'Vandalism', emergency: 'Emergency', general: 'Community Notice' };
      const emailAddresses = hoaContacts.map(c => c.email).join(', ');
      try {
        await emailTransporter.sendMail({
          from: `"Costa Blanca Villas Admin" <${emailConfig.user}>`,
          to: emailAddresses,
          subject: `[${severityLabels[alert.severity] || 'Alert'}] ${title} — Costa Blanca Villas`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#1a3a5c;color:white;padding:20px;border-radius:8px 8px 0 0;">
                <h2 style="margin:0;">🏘️ Costa Blanca Villas</h2>
                <p style="margin:4px 0 0;opacity:0.8;">Community Alert — ${typeLabels[alert.alertType] || 'Notice'}</p>
              </div>
              <div style="background:#fff3cd;border-left:4px solid #ffc107;padding:16px 20px;">
                <strong>Severity:</strong> ${severityLabels[alert.severity] || alert.severity}
              </div>
              <div style="padding:20px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 8px 8px;">
                <h3 style="color:#1a3a5c;margin-top:0;">${title}</h3>
                <p style="color:#333;line-height:1.6;">${message.replace(/\n/g, '<br>')}</p>
                <hr style="border:none;border-top:1px solid #eee;margin:20px 0;">
                <p style="color:#888;font-size:12px;">Sent by Costa Blanca Villas community admin · Farallón, Coclé, Panamá<br>
                Do not reply to this email. Log in to Panamá Connect to respond.</p>
              </div>
            </div>
          `
        });
        alert.emailStatus = 'sent';
      } catch (err) {
        alert.emailStatus = 'failed';
        alert.emailError = err.message;
      }
    }
  }

  securityAlerts.push(alert);
  res.json({ ok: true, alert });
});

// ─── Admin: Create Managed Account (HOA / partner) ──────────────────────────
app.post('/api/admin/create-account', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!users[user.username]?.isOwner) return res.status(403).json({ error: 'Owner only' });

  const { displayName, username, password, role, address, bio } = req.body;
  if (!displayName || !username || !password || !role) return res.status(400).json({ error: 'Missing required fields' });
  if (users[username] || pendingUsers.find(p => p.username === username)) return res.status(409).json({ error: 'Username already taken' });

  const validRoles = ['hoa', 'business', 'realtor', 'neighbor'];
  if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const initials = displayName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const AVATAR_COLORS_MC = ['#0077B6','#2A9D8F','#E76F51','#6D6875','#264653','#457B9D','#C0392B','#1D3557'];
  const avatar = AVATAR_COLORS_MC[Math.floor(Math.random() * AVATAR_COLORS_MC.length)];

  const newUser = {
    id: 'u' + Date.now(), username, password, role,
    name: displayName, avatar, initials,
    address: address || 'Costa Blanca Villas, Farallón',
    verified: true,
    bio: bio || `Official ${role} account.`,
    posts: 0, neighbors: 0, points: 0,
    yearsInNeighborhood: 0,
    managedAccount: true
  };

  users[username] = newUser;
  allUsers.push({ id: newUser.id, name: newUser.name, avatar: newUser.avatar, initials: newUser.initials, verified: true, yearsInNeighborhood: 0, address: newUser.address, username });

  res.json({ ok: true, user: { username, displayName, role, password } });
});

// Admin: list managed accounts
app.get('/api/admin/managed-accounts', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (!users[user.username]?.isOwner) return res.status(403).json({ error: 'Owner only' });
  const managed = Object.values(users).filter(u => u.managedAccount || u.role === 'hoa');
  res.json(managed.map(u => ({ username: u.username, name: u.name, role: u.role, avatar: u.avatar, initials: u.initials })));
});

// ─── Pending Registrations ───────────────────────────────────────────────────
const pendingUsers = [];

const AVATAR_COLORS = ['#0077B6','#F4A261','#E76F51','#2A9D8F','#E9C46A','#264653','#A8DADC','#457B9D','#E63946','#6D6875','#1D3557','#48CAE4'];

app.post('/api/auth/register', (req, res) => {
  const { fullName, username, password, role, address, businessName, businessCategory, bio } = req.body;

  if (!fullName || !username || !password || !role || !address)
    return res.status(400).json({ error: 'Missing required fields.' });

  if (!/^[a-z0-9_]{3,20}$/.test(username))
    return res.status(400).json({ error: 'Username must be 3–20 lowercase letters, numbers, or underscores.' });

  if (users[username] || pendingUsers.find(p => p.username === username))
    return res.status(409).json({ error: 'That username is already taken.' });

  // Check if banned by username or address
  const existingBan = bannedMembers.find(b =>
    b.status !== 'lifted' && (
      b.username === username ||
      (address && b.address && b.address.toLowerCase() === address.trim().toLowerCase())
    )
  );
  if (existingBan) return res.status(403).json({ error: 'This account is not eligible to register on Panamá Connect.' });

  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const validRoles = ['neighbor', 'business'];
  if (!validRoles.includes(role))
    return res.status(400).json({ error: 'Invalid account type.' });

  const initials = fullName.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const avatar = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

  const pending = {
    id: 'p' + Date.now(),
    username, password, role,
    name: role === 'business' ? (businessName || fullName) : fullName,
    fullName, address,
    businessName: businessName || null,
    businessCategory: businessCategory || null,
    bio: bio || '',
    avatar, initials,
    verified: false,
    submittedAt: new Date().toISOString(),
    status: 'pending'
  };

  pendingUsers.push(pending);
  res.json({ ok: true, message: 'Application submitted! The HOA team will review and approve your account within 24 hours.' });
});

// Admin: get pending registrations
app.get('/api/admin/pending', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (u.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  res.json(pendingUsers.filter(p => p.status === 'pending'));
});

// Admin: approve registration
app.post('/api/admin/pending/:id/approve', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (u.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  const idx = pendingUsers.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const p = pendingUsers[idx];
  p.status = 'approved';

  const newUser = {
    id: 'u' + Date.now(),
    username: p.username, password: p.password, role: p.role,
    name: p.name, avatar: p.avatar, initials: p.initials,
    address: p.address, verified: true,
    bio: p.bio || '',
    posts: 0, neighbors: 0, points: 0,
    yearsInNeighborhood: 0
  };
  if (p.role === 'business' && p.businessCategory) newUser.businessCategory = p.businessCategory;

  users[p.username] = newUser;
  allUsers.push({ id: newUser.id, name: newUser.name, avatar: newUser.avatar, initials: newUser.initials, verified: true, yearsInNeighborhood: 0, address: p.address, username: p.username });

  res.json({ ok: true, user: newUser });
});

// Admin: reject registration
app.post('/api/admin/pending/:id/reject', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (u.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  const idx = pendingUsers.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  pendingUsers[idx].status = 'rejected';
  res.json({ ok: true });
});

// Auth
app.get('/api/auth/me', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { password, ...safeUser } = users[user.username];
  res.json(safeUser);
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  // Allow login by username OR email
  const user = users[username] || Object.values(users).find(u => u.email && u.email.toLowerCase() === username.toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  // Check if banned
  const ban = bannedMembers.find(b => b.username === user.username && b.status !== 'lifted');
  if (ban) {
    return res.status(403).json({ error: 'banned', reason: ban.reason });
  }
  res.cookie('user', user.username, { httpOnly: true, signed: true, maxAge: 7 * 24 * 3600 * 1000, sameSite: 'lax' });
  const { password: _, ...safeUser } = user;
  res.json(safeUser);
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('user');
  res.json({ ok: true });
});

// ─── Sponsored Posts ─────────────────────────────────────────────────────────
const sponsoredPosts = [];

app.get('/api/admin/sponsored-posts', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  res.json([...sponsoredPosts].reverse());
});

app.post('/api/admin/sponsored-posts', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });

  const { businessName, businessUsername, content, linkUrl, linkLabel, image } = req.body;
  if (!businessName || !content) return res.status(400).json({ error: 'Business name and content required' });

  // Pull avatar/initials from existing user if businessUsername provided
  const biz = businessUsername ? users[businessUsername] : null;
  const sp = {
    id: 'sp' + Date.now(),
    type: 'sponsored',
    businessName,
    businessUsername: businessUsername || null,
    avatar: biz?.avatar || '#0077B6',
    initials: biz?.initials || businessName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2),
    content,
    linkUrl: linkUrl || null,
    linkLabel: linkLabel || 'Learn More',
    image: image || null,
    active: true,
    createdAt: new Date().toISOString(),
    createdBy: user.username
  };
  sponsoredPosts.push(sp);
  res.json({ ok: true, post: sp });
});

app.patch('/api/admin/sponsored-posts/:id/toggle', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const sp = sponsoredPosts.find(s => s.id === req.params.id);
  if (!sp) return res.status(404).json({ error: 'Not found' });
  sp.active = !sp.active;
  res.json({ ok: true, active: sp.active });
});

app.delete('/api/admin/sponsored-posts/:id', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const idx = sponsoredPosts.findIndex(s => s.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  sponsoredPosts.splice(idx, 1);
  res.json({ ok: true });
});

// Posts
app.get('/api/posts', (req, res) => {
  const { section = 'feed' } = req.query;
  let filtered;
  if (section === 'feed') {
    filtered = posts.filter(p => p.section === 'feed' || !p.section);
    const sorted = filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    // Inject active sponsored posts at position 2 (after first 2 regular posts)
    const active = sponsoredPosts.filter(s => s.active);
    if (active.length) {
      const insert = Math.min(2, sorted.length);
      sorted.splice(insert, 0, ...active.map(s => ({ ...s, section: 'feed' })));
    }
    return res.json(sorted);
  } else {
    filtered = posts.filter(p => p.section === section || p.type === section);
  }
  res.json(filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/posts', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { type, content, price, condition, category, pollOptions, image, location, alertType, severity } = req.body;
  const authorData = allUsers.find(u => u.username === user.username) || allUsers[0];
  const u = users[user.username];
  const role = u ? u.role : 'neighbor';

  // Safety severity/official logic
  let resolvedSeverity = severity || 'medium';
  let isOfficial = false;
  if (type === 'safety') {
    if (role === 'hoa' || role === 'admin') {
      isOfficial = true;
      resolvedSeverity = severity || 'high';
    } else {
      isOfficial = false;
      if (resolvedSeverity === 'high') resolvedSeverity = 'medium';
    }
  }

  const newPost = {
    id: 'p' + Date.now(),
    type: type || 'general',
    section: ['safety'].includes(type) ? type : 'feed',
    author: authorData,
    content,
    createdAt: new Date().toISOString(),
    reactions: { like: 0, insightful: 0, agree: 0, haha: 0, wow: 0, sad: 0 },
    commentCount: 0,
    userReaction: null,
    ...(price !== undefined && { price: Number(price) }),
    ...(condition && { condition }),
    ...(category && { category }),
    ...(pollOptions && { pollOptions: pollOptions.map((text, i) => ({ id: `po${i}`, text, votes: 0 })), userVote: null }),
    ...(image && { image }),
    ...(location && { location }),
    ...(type === 'safety' && alertType && { alertType }),
    ...(type === 'safety' && { severity: resolvedSeverity, isOfficial })
  };
  posts.unshift(newPost);

  // Auto-cross-post to Safety & Security Watch (g6) if severity is 'high'
  if (type === 'safety' && resolvedSeverity === 'high') {
    const g6Group = groups.find(g => g.id === 'g6');
    if (g6Group) {
      const crossPost = {
        id: 'gp' + Date.now(),
        author: authorData,
        content: `[Safety Alert] ${content}`,
        createdAt: new Date().toISOString()
      };
      if (!dynamicGroupPosts['g6']) dynamicGroupPosts['g6'] = [];
      dynamicGroupPosts['g6'].unshift(crossPost);
      g6Group.lastActivity = 'just now';
    }
  }

  res.json(newPost);
});

app.delete('/api/posts/:id', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (u?.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const idx = posts.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Post not found' });
  posts.splice(idx, 1);
  res.json({ ok: true });
});

app.post('/api/posts/:id/resolve', (req, res) => {
  const user = getUser(req);
  const u = user ? users[user.username] : null;
  if (!u || (u.role !== 'admin' && u.role !== 'hoa')) return res.status(403).json({ error: 'Admin/HOA only' });
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Not found' });
  post.severity = 'resolved';
  post.resolvedBy = u.name;
  post.resolvedAt = new Date().toISOString();
  res.json(post);
});

app.post('/api/posts/:id/react', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { reaction } = req.body;
  const post = posts.find(p => p.id === req.params.id);
  if (!post) return res.status(404).json({ error: 'Post not found' });
  const validReactions = ['like', 'insightful', 'agree', 'haha', 'wow', 'sad'];
  if (!validReactions.includes(reaction)) return res.status(400).json({ error: 'Invalid reaction' });
  if (post.userReaction === reaction) {
    post.reactions[reaction] = Math.max(0, post.reactions[reaction] - 1);
    post.userReaction = null;
  } else {
    if (post.userReaction) {
      post.reactions[post.userReaction] = Math.max(0, post.reactions[post.userReaction] - 1);
    }
    post.reactions[reaction]++;
    post.userReaction = reaction;
  }
  res.json({ reactions: post.reactions, userReaction: post.userReaction });
});

app.get('/api/posts/:id/comments', (req, res) => {
  res.json(comments[req.params.id] || []);
});

app.post('/api/posts/:id/comments', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { content } = req.body;
  const authorData = allUsers.find(u => u.username === user.username) || allUsers[0];
  const comment = {
    id: 'c' + Date.now(),
    author: authorData,
    content,
    createdAt: new Date().toISOString()
  };
  if (!comments[req.params.id]) comments[req.params.id] = [];
  comments[req.params.id].push(comment);
  const post = posts.find(p => p.id === req.params.id);
  if (post) post.commentCount++;
  res.json(comment);
});

// Events
app.get('/api/events', (req, res) => res.json(events));

app.post('/api/events/:id/rsvp', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { status } = req.body; // 'going' | 'maybe' | 'cantGo' | null
  const event = events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  const prev = event.userRsvp;
  if (prev && event.rsvp[prev] > 0) event.rsvp[prev]--;
  if (status && status !== prev) {
    event.rsvp[status]++;
    event.userRsvp = status;
  } else {
    event.userRsvp = null;
  }
  res.json({ rsvp: event.rsvp, userRsvp: event.userRsvp });
});

// Business reviews — keyed by business id
const businessReviews = {
  b1: [
    { author: 'Terry Smith',   avatar: '#2A9D8F', initials: 'TS', rating: 5, text: 'Best ceviche I have had outside of Peru. The leche de tigre is incredible. We have been here six times this month alone. Do not miss the grilled pargo when it is available.', date: '2 weeks ago' },
    { author: 'Sarah Bailey',  avatar: '#0077B6', initials: 'SB', rating: 5, text: 'Absolutely stunning views and the food matches. Their cocktails are creative and the staff is wonderful. Perfect for a special evening out with friends.', date: '3 weeks ago' },
    { author: 'Kerry Maurer',  avatar: '#457B9D', initials: 'KM', rating: 4, text: 'Very good food but expect a wait on weekends. Totally worth it though. The octopus starter is not to be missed.', date: '1 month ago' },
    { author: 'Daniel Giroux', avatar: '#A8DADC', initials: 'DG', rating: 5, text: 'This is our go-to for special occasions. The maracuya sour cocktail is incredible. Highly recommend a reservation.', date: '1 month ago' }
  ],
  b2: [
    { author: 'Mike Hart',    avatar: '#F4A261', initials: 'MH', rating: 5, text: 'The coconut shrimp is out of this world. Live music on Fridays really sets the mood. Great for big groups.', date: '1 week ago' },
    { author: 'Daniel Giroux', avatar: '#A8DADC', initials: 'DG', rating: 4, text: 'Authentic flavors and generous portions. The ropa vieja is excellent. Service can be slow but the food is worth it.', date: '3 weeks ago' },
    { author: 'Brad Taylor',  avatar: '#E76F51', initials: 'BT', rating: 4, text: 'Great Caribbean vibes and atmosphere. The grilled octopus and coconut rice are a must.', date: '1 month ago' }
  ],
  b3: [
    { author: 'Cody Wilson',  avatar: '#E9C46A', initials: 'CW', rating: 5, text: 'Incredibly fresh fish — you can tell it came straight off the boat. The whole grilled pargo is massive and priced so fairly.', date: '5 days ago' },
    { author: 'Don Darling',  avatar: '#264653', initials: 'DD', rating: 4, text: 'Best kept secret near Farallón. Very casual and local. The sancocho is outstanding.', date: '2 weeks ago' },
    { author: 'Dennis Moore', avatar: '#E63946', initials: 'DM', rating: 5, text: 'My favorite lunch spot on the coast. Cheap, fresh, and the owners are so friendly. Been coming weekly for years.', date: '1 month ago' }
  ],
  b4: [
    { author: 'Brad Taylor',  avatar: '#E76F51', initials: 'BT', rating: 4, text: 'Great spot for sunset beers. Simple menu but quality bar food. Gets packed on weekends — arrive early.', date: '1 week ago' },
    { author: 'Kerry Maurer', avatar: '#457B9D', initials: 'KM', rating: 4, text: 'Love the vibe here. Cold beers, warm breeze, and a great crowd. The nachos are surprisingly good.', date: '3 weeks ago' },
    { author: 'Mike Hart',    avatar: '#F4A261', initials: 'MH', rating: 3, text: 'Fun atmosphere but service gets overwhelmed on weekends. Go on a weeknight for a better experience.', date: '1 month ago' }
  ],
  b5: [
    { author: 'Sarah Bailey',  avatar: '#0077B6', initials: 'SB', rating: 4, text: 'Great post-swim lunch. The mixed ceviche platter is perfect for sharing and very fresh.', date: '4 days ago' },
    { author: 'Terry Smith',   avatar: '#2A9D8F', initials: 'TS', rating: 4, text: 'Friendly staff and right on the beach. Nothing fancy but exactly what you want after a morning swim.', date: '2 weeks ago' },
    { author: 'Cody Wilson',   avatar: '#E9C46A', initials: 'CW', rating: 5, text: 'Perfect beach lunch spot. The calamari was crispy and fresh. Great value.', date: '3 weeks ago' }
  ],
  b6: [
    { author: 'Don Darling',   avatar: '#264653', initials: 'DD', rating: 4, text: 'Nice upscale option near Farallón. Good wine list and the seafood is well prepared. Great for date night.', date: '2 weeks ago' },
    { author: 'Kerry Maurer',  avatar: '#457B9D', initials: 'KM', rating: 4, text: 'Terrace view is gorgeous at sunset. Service is professional. The lobster pasta is outstanding.', date: '1 month ago' }
  ],
  b7: [
    { author: 'Mike Hart',     avatar: '#F4A261', initials: 'MH', rating: 4, text: 'Super convenient. Good selection of vehicles and fair prices. Staff speaks English well.', date: '3 weeks ago' },
    { author: 'Brad Taylor',   avatar: '#E76F51', initials: 'BT', rating: 5, text: 'Used these guys for a trip to El Valle — smooth process, clean car, great price. Will use again.', date: '2 months ago' }
  ],
  b8: [
    { author: 'Dennis Moore',  avatar: '#E63946', initials: 'DM', rating: 5, text: 'Nothing beats a tamale here on Saturday morning. The González family has been running this for 20 years and it shows.', date: '3 days ago' },
    { author: 'Daniel Giroux', avatar: '#A8DADC', initials: 'DG', rating: 5, text: 'Best sancocho in Coclé province. Huge portions, tiny prices. A true institution.', date: '1 week ago' },
    { author: 'Sarah Bailey',  avatar: '#0077B6', initials: 'SB', rating: 4, text: 'So authentic and friendly. The arroz con pollo is comfort food at its best. They close at 3 PM so go early!', date: '2 weeks ago' }
  ]
};

// Group posts — simulated recent activity per group
const groupPosts = {
  g1: [
    { id: 'gp1a', author: allUsers[3], content: 'Reminder: HOA dues for Q2 are due April 1st. Pay via the admin office or bank transfer. Details in the pinned document.', time: '2 hours ago' },
    { id: 'gp1b', author: allUsers[5], content: 'The north gate camera was upgraded this week. New model covers a wider angle. Security team says response time is now under 3 minutes.', time: '1 day ago' },
    { id: 'gp1c', author: allUsers[0], content: 'Pool maintenance is scheduled for Thursday 8-11 AM. The main community pool will be closed during that window.', time: '2 days ago' },
    { id: 'gp1d', author: allUsers[8], content: 'Does anyone know who handles the palm tree trimming schedule? The ones near Villa 300 are getting very tall.', time: '3 days ago' }
  ],
  g2: [
    { id: 'gp2a', author: allUsers[1], content: 'Quick tip: Banco General in Penonomé now has a dedicated expat assistance window on Tuesday afternoons. No more hour-long waits!', time: '4 hours ago' },
    { id: 'gp2b', author: allUsers[6], content: 'Anyone know a good English-speaking dentist near Farallón? My usual one in Panama City is getting too far for regular visits.', time: '6 hours ago' },
    { id: 'gp2c', author: allUsers[0], content: 'New Spanish classes starting April 7th in Penonomé — small group (6 max), conversational focus, $40/month. DM me for details!', time: '1 day ago' }
  ],
  g3: [
    { id: 'gp3a', author: allUsers[7], content: '🐢 Turtle nesting season is almost here! Volunteers needed for night patrols in April-May. Amazing experience. Sign up at the community board.', time: '1 hour ago' },
    { id: 'gp3b', author: allUsers[4], content: 'Surf report: shoulder-high sets this morning on the south end of Playa Farallón. Good shape for another 2 hours.', time: '3 hours ago' },
    { id: 'gp3c', author: allUsers[2], content: 'Stunning sunrise this morning from the beach. Anyone else catch it? The pelicans were flying in formation — just magical.', time: '8 hours ago' }
  ],
  g4: [
    { id: 'gp4a', author: allUsers[0], content: '🐾 FOUND: Small orange tabby near Villa 47. Very friendly, no collar. Holding at Villa 270 — please share!', time: '30 minutes ago' },
    { id: 'gp4b', author: allUsers[9], content: 'MISSING: Golden retriever "Mango" from Villa 135 area. Last seen yesterday afternoon near the golf course. Please contact Steve if found.', time: '1 day ago' }
  ],
  g5: [
    { id: 'gp5a', author: allUsers[3], content: '⭐ New discovery: There\'s a small market in Farallón village on Sunday mornings with incredible fresh produce and homemade cheese. Absolute gem.', time: '2 hours ago' },
    { id: 'gp5b', author: allUsers[0], content: 'Tried the new fish tacos at Pipa\'s Beach yesterday — highly recommend! Light, fresh, and only $4 each.', time: '5 hours ago' },
    { id: 'gp5c', author: allUsers[1], content: 'Anyone up for a group dinner at Amar By La Playa this Friday? Thinking 7 PM. DM me if interested — need at least 6 for the big table.', time: '1 day ago' }
  ],
  g6: [
    { id: 'gp6a', author: allUsers[5], content: '⚠️ Suspicious silver pickup seen near the north entrance around 10 PM last night. Plates: ABC-1234. Please report anything unusual to security at ext. 100.', time: '3 hours ago' },
    { id: 'gp6b', author: allUsers[3], content: 'Reminder: always lock villa doors even when at home. There have been 2 opportunistic entry attempts reported this month. Stay vigilant.', time: '1 day ago' }
  ]
};

// ─── Dynamic Group Posts ──────────────────────────────────────────────────────
let dynamicGroupPosts = {
  g1: [
    { id: 'gp1a', author: allUsers[3], content: 'Reminder: HOA dues for Q2 are due April 1st. Pay via the admin office or bank transfer. Details in the pinned document.', createdAt: new Date(Date.now() - 2 * 3600000).toISOString() },
    { id: 'gp1b', author: allUsers[5], content: 'The north gate camera was upgraded this week. New model covers a wider angle. Security team says response time is now under 3 minutes.', createdAt: new Date(Date.now() - 86400000).toISOString() }
  ],
  g2: [
    { id: 'gp2a', author: allUsers[1], content: 'Quick tip: Banco General in Penonomé now has a dedicated expat assistance window on Tuesday afternoons. No more hour-long waits!', createdAt: new Date(Date.now() - 4 * 3600000).toISOString() },
    { id: 'gp2b', author: allUsers[6], content: 'Anyone know a good English-speaking dentist near Farallón? My usual one in Panama City is getting too far for regular visits.', createdAt: new Date(Date.now() - 6 * 3600000).toISOString() }
  ],
  g3: [
    { id: 'gp3a', author: allUsers[7], content: '🐢 Turtle nesting season is almost here! Volunteers needed for night patrols in April-May. Amazing experience. Sign up at the community board.', createdAt: new Date(Date.now() - 3600000).toISOString() }
  ],
  g5: [
    { id: 'gp5a', author: allUsers[3], content: '⭐ New discovery: There\'s a small market in Farallón village on Sunday mornings with incredible fresh produce and homemade cheese.', createdAt: new Date(Date.now() - 2 * 3600000).toISOString() }
  ]
};

// ─── Neighborhood Fave System ────────────────────────────────────────────────
const FAVE_THRESHOLD = 30; // faves in a calendar year to earn the award

// Seed historical faveYears into businesses
const faveYearsMap = {
  b1: [2022, 2023, 2024, 2025],
  b2: [2022, 2023, 2024, 2025],
  b3: [2023, 2024, 2025],
  b4: [2024, 2025],
  b5: [2024, 2025],
  b6: [2025],
  b7: [2025],
  b8: [2023, 2024, 2025],
};
businesses.forEach(b => { b.faveYears = faveYearsMap[b.id] || []; });

// bizFaves[bizId][year] = Set of usernames
// Pre-seed 2026 progress so the progress bar shows realistic numbers
const bizFaves = {
  b1: { 2026: new Set(['n1','n2','n3','n4','n5','n6','n7','n8','n9','n10','n11','n12','n13','n14','n15','n16','n17','n18','n19','n20','n21','n22']) },
  b2: { 2026: new Set(['n1','n2','n3','n4','n5','n6','n7','n8','n9','n10','n11','n12','n13','n14','n15','n16','n17','n18','n19','n20','n21','n22','n23','n24','n25','n26','n27','n28']) },
  b3: { 2026: new Set(['n1','n2','n3','n4','n5','n6','n7','n8','n9','n10','n11','n12','n13','n14','n15']) },
  b4: { 2026: new Set(['n1','n2','n3','n4','n5','n6','n7','n8']) },
  b5: { 2026: new Set(['n1','n2','n3','n4','n5','n6','n7','n8','n9','n10','n11','n12']) },
  b6: { 2026: new Set(['n1','n2','n3','n4','n5']) },
  b7: { 2026: new Set(['n1','n2','n3']) },
  b8: { 2026: new Set(['n1','n2','n3','n4','n5','n6','n7','n8','n9','n10','n11','n12','n13','n14','n15','n16','n17','n18']) },
};

function getBizFaveData(bizId, username) {
  const year = new Date().getFullYear();
  if (!bizFaves[bizId]) bizFaves[bizId] = {};
  if (!bizFaves[bizId][year]) bizFaves[bizId][year] = new Set();
  const yearSet = bizFaves[bizId][year];
  return {
    currentYearFaves: yearSet.size,
    faveThreshold: FAVE_THRESHOLD,
    userHasFaved: username ? yearSet.has(username) : false,
  };
}

// Businesses
app.get('/api/businesses', (req, res) => {
  const user = getUser(req);
  res.json(businesses.map(b => {
    const fd = getBizFaveData(b.id, user?.username);
    return { ...b, ...fd };
  }));
});

app.get('/api/businesses/:id', (req, res) => {
  const user = getUser(req);
  const biz = businesses.find(b => b.id === req.params.id);
  if (!biz) return res.status(404).json({ error: 'Not found' });
  const reviews = businessReviews[req.params.id] || [];
  const fd = getBizFaveData(req.params.id, user?.username);
  res.json({ ...biz, reviews, ...fd });
});

app.post('/api/businesses/:id/fave', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const bizId = req.params.id;
  const biz = businesses.find(b => b.id === bizId);
  if (!biz) return res.status(404).json({ error: 'Not found' });
  const year = new Date().getFullYear();
  if (!bizFaves[bizId]) bizFaves[bizId] = {};
  if (!bizFaves[bizId][year]) bizFaves[bizId][year] = new Set();
  const yearSet = bizFaves[bizId][year];
  let faved;
  if (yearSet.has(user.username)) {
    yearSet.delete(user.username);
    faved = false;
  } else {
    yearSet.add(user.username);
    faved = true;
    // Auto-award if threshold crossed for the first time this year
    if (yearSet.size >= FAVE_THRESHOLD && !biz.faveYears.includes(year)) {
      biz.faveYears = [...biz.faveYears, year].sort();
    }
  }
  res.json({ faved, currentYearFaves: yearSet.size, faveThreshold: FAVE_THRESHOLD, faveYears: biz.faveYears });
});

app.post('/api/businesses/:id/recommend', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const bizId = req.params.id;
  const biz = businesses.find(b => b.id === bizId);
  if (!biz) return res.status(404).json({ error: 'Not found' });
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Text required' });
  const userData = users[user.username];
  if (!businessReviews[bizId]) businessReviews[bizId] = [];
  const newReview = {
    author: userData ? userData.name : user.username,
    avatar: userData ? userData.avatar : '#0077B6',
    initials: userData ? userData.initials : user.username.slice(0, 2).toUpperCase(),
    rating: 5,
    text: text.trim(),
    date: 'just now'
  };
  businessReviews[bizId].unshift(newReview);
  res.json({ ok: true });
});

app.get('/api/groups/:id', (req, res) => {
  const user = getUser(req);
  const group = groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Not found' });
  const posts = (dynamicGroupPosts[req.params.id] || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const isAdmin = user && users[user.username]?.role === 'admin';
  const isCreator = user && group.createdBy === user.username;
  const joined = user ? group.membersList.includes(user.username) : false;
  const pendingRequest = user ? !!(group.joinRequests || []).find(r => r.username === user.username) : false;
  const joinRequests = (isCreator || isAdmin) ? (group.joinRequests || []) : undefined;
  res.json({ ...group, posts, isAdmin, isCreator, joined, pendingRequest, joinRequests });
});

// Neighbors
app.get('/api/neighbors', (req, res) => res.json(allUsers));

// Groups
app.get('/api/groups', (req, res) => {
  const user = getUser(req);
  const isAdmin = user && users[user.username]?.role === 'admin';
  res.json(groups.map(g => ({
    ...g,
    joined: user ? g.membersList.includes(user.username) : false,
    pendingRequest: user ? !!(g.joinRequests || []).find(r => r.username === user.username) : false,
    isCreator: user && g.createdBy === user.username,
    isAdmin,
    joinRequests: (user && (g.createdBy === user.username || isAdmin)) ? (g.joinRequests || []) : undefined
  })));
});

// Create group
app.post('/api/groups', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const { name, description, icon, category, privacy, coverPhoto } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const newGroup = {
    id: 'g' + Date.now(),
    name, description: description || '',
    icon: icon || '👥',
    category: category || 'Community',
    privacy: privacy || 'public',
    coverPhoto: coverPhoto || '',
    members: 1,
    joined: true,
    lastActivity: 'just now',
    createdBy: user.username,
    membersList: [user.username]
  };
  groups.push(newGroup);
  dynamicGroupPosts[newGroup.id] = [];
  res.json(newGroup);
});

// Report a group
app.post('/api/groups/:id/report', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const group = groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Not found' });
  const { reason, note } = req.body;
  groupReports.push({ groupId: req.params.id, groupName: group.name, reporter: user.username, reason: reason || 'Other', note: note || '', createdAt: new Date().toISOString() });
  res.json({ ok: true });
});

// Delete group — admin only
app.delete('/api/groups/:id', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const idx = groups.findIndex(g => g.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  groups.splice(idx, 1);
  delete dynamicGroupPosts[req.params.id];
  res.json({ ok: true });
});

app.post('/api/groups/:id/join', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const group = groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const alreadyMember = group.membersList.includes(user.username);

  // Leave (always allowed)
  if (alreadyMember) {
    group.membersList = group.membersList.filter(u => u !== user.username);
    group.members = Math.max(0, group.members - 1);
    group.joined = false;
    return res.json({ joined: false, members: group.members });
  }

  // Private group — send join request instead
  if (group.privacy === 'private') {
    if (!group.joinRequests) group.joinRequests = [];
    if (group.joinRequests.find(r => r.username === user.username)) {
      return res.json({ requested: true });
    }
    const u = allUsers.find(a => a.username === user.username) || {};
    group.joinRequests.push({ username: user.username, name: u.name || user.username, initials: u.initials || '??', avatar: u.avatar || '#0077B6', requestedAt: new Date().toISOString() });
    return res.json({ requested: true });
  }

  // Public group — join immediately
  group.membersList.push(user.username);
  group.members += 1;
  group.joined = true;
  res.json({ joined: true, members: group.members });
});

app.post('/api/groups/:id/join-requests/:username/approve', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const group = groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Not found' });
  if (group.createdBy !== user.username && users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  const reqUsername = req.params.username;
  if (!group.joinRequests) group.joinRequests = [];
  group.joinRequests = group.joinRequests.filter(r => r.username !== reqUsername);
  if (!group.membersList.includes(reqUsername)) {
    group.membersList.push(reqUsername);
    group.members += 1;
  }
  res.json({ ok: true });
});

app.post('/api/groups/:id/join-requests/:username/deny', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const group = groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Not found' });
  if (group.createdBy !== user.username && users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Not authorized' });
  if (!group.joinRequests) group.joinRequests = [];
  group.joinRequests = group.joinRequests.filter(r => r.username !== req.params.username);
  res.json({ ok: true });
});

// Post inside a group
app.post('/api/groups/:id/posts', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const group = groups.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const { content } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const authorData = allUsers.find(u => u.username === user.username) || allUsers[0];
  const post = { id: 'gp' + Date.now(), author: authorData, content, createdAt: new Date().toISOString() };
  if (!dynamicGroupPosts[req.params.id]) dynamicGroupPosts[req.params.id] = [];
  dynamicGroupPosts[req.params.id].unshift(post);
  group.lastActivity = 'just now';
  res.json(post);
});

// Delete a group post — admin only
app.delete('/api/groups/:id/posts/:postId', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  if (users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const gPosts = dynamicGroupPosts[req.params.id];
  if (!gPosts) return res.status(404).json({ error: 'Not found' });
  const idx = gPosts.findIndex(p => p.id === req.params.postId);
  if (idx === -1) return res.status(404).json({ error: 'Post not found' });
  gPosts.splice(idx, 1);
  res.json({ ok: true });
});

// Notifications
app.get('/api/notifications', (req, res) => res.json(notifications));

app.post('/api/notifications/read', (req, res) => {
  notifications.forEach(n => n.read = true);
  res.json({ ok: true });
});

// Profile
app.get('/api/profile/:username', (req, res) => {
  const u = users[req.params.username];
  if (!u) return res.status(404).json({ error: 'Not found' });
  const { password, ...safe } = u;
  res.json(safe);
});

// Marketplace
app.get('/api/marketplace', (req, res) => res.json(marketplaceItems));

// Tides — simulated semi-diurnal tides for Playa Farallón, Panama
app.get('/api/tides', (req, res) => {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  // Offset tide cycle by day so it shifts realistically each day
  const base = (dayOfYear * 50) % 1440; // minutes offset
  const cycle = 745; // ~12h 25min tidal cycle in minutes
  const range = 4.6; const mid = 2.5;
  const tides = [];
  for (let i = 0; i < 4; i++) {
    const highMin = (base + i * cycle) % 1440;
    const lowMin  = (base + i * cycle + cycle / 2) % 1440;
    const fmt = m => { const h = Math.floor(m / 60) % 24; const mn = m % 60; const ap = h >= 12 ? 'PM' : 'AM'; return `${h % 12 || 12}:${String(mn).padStart(2,'0')} ${ap}`; };
    tides.push({ type: 'High', time: fmt(Math.round(highMin)), height: (mid + range / 2 + (Math.random() * 0.3 - 0.15)).toFixed(1) + 'm' });
    tides.push({ type: 'Low',  time: fmt(Math.round(lowMin)),  height: (mid - range / 2 + (Math.random() * 0.2 - 0.1)).toFixed(1) + 'm'  });
  }
  tides.sort((a, b) => {
    const toMins = t => { const [time, ap] = t.split(' '); const [h, m] = time.split(':').map(Number); return ((h % 12) + (ap === 'PM' ? 12 : 0)) * 60 + m; };
    return toMins(a.time) - toMins(b.time);
  });
  res.json(tides.slice(0, 4));
});

// Banner upload
app.post('/api/profile/banner', uploadBanner.single('banner'), (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: 'Not logged in' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const bannerUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  u.bannerUrl = bannerUrl;
  res.json({ bannerUrl });
});

// Avatar upload
app.post('/api/profile/avatar', upload.single('avatar'), (req, res) => {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: 'Not logged in' });
  if (!req.file) return res.status(400).json({ error: 'No file' });
  const avatarUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  u.avatarUrl = avatarUrl;
  // Update allUsers too
  const au = allUsers.find(x => x.id === u.id);
  if (au) au.avatarUrl = avatarUrl;
  res.json({ avatarUrl });
});

// ─── Real Estate Listings ────────────────────────────────────────────────────
let realEstateListings = [
  {
    id: 'rs1', type: 'for_sale',
    title: 'Villa with Private Pool & Jacuzzi — Costa Blanca',
    price: 285000,
    bedrooms: 3, bathrooms: 3, sqft: 2100,
    description: 'Stunning 3-bedroom villa with private pool, jacuzzi, and covered terrace surrounded by lush tropical gardens. Fully furnished, gated community with 24/7 security. Walking distance to the beach and Del Mar Beach Club.',
    location: 'Costa Blanca Villas, Farallón, Coclé',
    image: '/images/re-prop-1.jpg',
    features: ['Private Pool & Jacuzzi', 'Fully Furnished', 'Covered Terrace', 'Tropical Gardens', 'Gated Community'],
    listedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    agentName: 'Iris Vanessa Arcia de Marleau', agentPhone: '+507-6754-4842', agentEmail: 'info@uncoverpanamarealestate.com'
  },
  {
    id: 'rs2', type: 'for_sale',
    title: 'Golf-Front Villa — Bijao Beach & Golf',
    price: 195000,
    bedrooms: 2, bathrooms: 2, sqft: 1450,
    description: 'Rare golf-front villa with sweeping views over the Bijao course and the Pacific Ocean beyond. Resort amenities include beach club, pools, and restaurants. Turnkey ready — a perfect primary residence or investment property.',
    location: 'Bijao Beach & Golf, Coclé',
    image: '/images/re-prop-2.jpg',
    features: ['Golf & Ocean Views', 'Resort Amenities', 'Turnkey', 'Beach Club Access', 'Investment Ready'],
    listedAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    agentName: 'Pierre Marleau', agentPhone: '+507-6487-4686', agentEmail: 'info@uncoverpanamarealestate.com'
  },
  {
    id: 'rs3', type: 'for_sale',
    title: 'Two-Story Villa with Pool — Costa Blanca',
    price: 265000,
    bedrooms: 3, bathrooms: 3, sqft: 2300,
    description: 'Beautiful two-story villa featuring a private pool, large covered patio, and spacious balcony. Modern open-plan layout with high ceilings, fully equipped kitchen, and seamless indoor-outdoor living. Gated community.',
    location: 'Costa Blanca Villas, Farallón, Coclé',
    image: '/images/re-prop-3.jpg',
    features: ['Private Pool', 'Two-Story', 'Covered Patio', 'Large Balcony', 'Modern Finishes'],
    listedAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    agentName: 'Iris Vanessa Arcia de Marleau', agentPhone: '+507-6754-4842', agentEmail: 'info@uncoverpanamarealestate.com'
  },
  {
    id: 'rs4', type: 'for_sale',
    title: 'Hacienda Estate with Pool & Spa — Bijao',
    price: 420000,
    bedrooms: 4, bathrooms: 4, sqft: 3200,
    description: 'Exceptional hacienda-style estate set among mature palms with a large pool, hot tub, covered lounge area, and manicured grounds. 4 bedrooms, 4 bathrooms, home theater, and chef\'s kitchen. A rare flagship property.',
    location: 'Bijao Beach & Golf, Coclé',
    image: '/images/re-prop-7.jpg',
    features: ['Pool & Hot Tub', 'Hacienda Style', 'Mature Palms', "Chef's Kitchen", '4 Full Baths'],
    listedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
    agentName: 'Pierre Marleau', agentPhone: '+507-6487-4686', agentEmail: 'info@uncoverpanamarealestate.com'
  },
  {
    id: 'rr1', type: 'for_rent',
    title: 'Villa with Flower Garden & Large Pool — Costa Blanca',
    price: 3500, priceUnit: 'week',
    bedrooms: 3, bathrooms: 3, sqft: 2200,
    description: 'Gorgeous villa surrounded by flowering tropical gardens with a large private pool and covered terrace. Fully furnished, daily housekeeping, and golf cart included. Steps from the beach and Del Mar Beach Club.',
    location: 'Costa Blanca Villas, Farallón, Coclé',
    image: '/images/re-prop-5.jpg',
    features: ['Large Private Pool', 'Tropical Garden', 'Golf Cart Included', 'Daily Housekeeping', 'Beach Access'],
    listedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
    agentName: 'Iris Vanessa Arcia de Marleau', agentPhone: '+507-6754-4842', agentEmail: 'info@uncoverpanamarealestate.com'
  },
  {
    id: 'rr2', type: 'for_rent',
    title: 'Retreat with Pool & Palapa — Bijao',
    price: 1900, priceUnit: 'week',
    bedrooms: 2, bathrooms: 2, sqft: 1400,
    description: 'Serene 2-bedroom retreat with a stunning kidney-shaped pool, thatched palapa bar, and lush tropical surroundings. Fully furnished, full kitchen, golf course views, and beach club access. Minimum 3-night stay.',
    location: 'Bijao Beach & Golf, Coclé',
    image: '/images/re-prop-4.jpg',
    features: ['Pool & Palapa', 'Golf Course Views', 'Beach Club Access', 'Full Kitchen', '3-Night Minimum'],
    listedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    agentName: 'Pierre Marleau', agentPhone: '+507-6487-4686', agentEmail: 'info@uncoverpanamarealestate.com'
  },
  {
    id: 'rr3', type: 'for_rent',
    title: 'Evening Pool Villa — Playa Farallón',
    price: 5200, priceUnit: 'week',
    bedrooms: 4, bathrooms: 3, sqft: 2800,
    description: 'Stunning 4-bedroom villa with a resort-style pool and spa, outdoor lounge, and beautifully lit evening ambiance. Fully staffed with caretaker and housekeeper. Sleeps 10. Direct access to Playa Farallón.',
    location: 'Playa Farallón, Coclé',
    image: '/images/re-prop-8.jpg',
    features: ['Resort Pool & Spa', 'Evening Ambiance', 'Sleeps 10', 'Full Staff', 'Beach Access'],
    listedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
    agentName: 'Iris Vanessa Arcia de Marleau', agentPhone: '+507-6754-4842', agentEmail: 'info@uncoverpanamarealestate.com'
  },
  {
    id: 'rr4', type: 'for_rent',
    title: 'Furnished Villa with Covered Patio — Costa Blanca',
    price: 2400, priceUnit: 'week',
    bedrooms: 3, bathrooms: 2, sqft: 1900,
    description: 'Spacious 3-bedroom villa with a large covered outdoor living area, flat-screen TV, and comfortable indoor-outdoor flow. Fully air-conditioned, high-speed WiFi, full kitchen. Ideal for remote workers and longer stays.',
    location: 'Costa Blanca Villas, Farallón, Coclé',
    image: '/images/re-prop-6.jpg',
    features: ['Covered Outdoor Living', 'Full A/C', 'High-Speed WiFi', 'Full Kitchen', 'Remote Work Ready'],
    listedAt: new Date(Date.now() - 9 * 86400000).toISOString(),
    agentName: 'Pierre Marleau', agentPhone: '+507-6487-4686', agentEmail: 'info@uncoverpanamarealestate.com'
  }
];

// Real Estate endpoints
app.get('/api/realestate', (req, res) => {
  const { type } = req.query;
  let result = realEstateListings;
  if (type) result = result.filter(l => l.type === type);
  res.json(result.sort((a, b) => new Date(b.listedAt) - new Date(a.listedAt)));
});

app.post('/api/realestate', (req, res) => {
  const user = getUser(req);
  const u = user ? users[user.username] : null;
  if (!u || (u.role !== 'admin' && u.role !== 'realtor')) return res.status(403).json({ error: 'Realtor or admin only' });
  const { title, type, price, priceUnit, bedrooms, bathrooms, sqft, description, location, features, agentName, agentPhone } = req.body;
  if (!title || !type || !price) return res.status(400).json({ error: 'Required fields missing' });
  const seed = 're' + Date.now();
  const newListing = {
    id: seed, type, title,
    price: Number(price), priceUnit: priceUnit || (type === 'for_rent' ? 'week' : null),
    bedrooms: Number(bedrooms) || 0, bathrooms: Number(bathrooms) || 0, sqft: Number(sqft) || 0,
    description: description || '', location: location || 'Costa Blanca Villas, Farallón',
    features: Array.isArray(features) ? features : (features ? String(features).split(',').map(f => f.trim()).filter(Boolean) : []),
    agentName: agentName || 'Iris Vanessa Arcia de Marleau', agentPhone: agentPhone || '+507-6754-4842', agentEmail: 'info@uncoverpanamarealestate.com',
    image: `https://picsum.photos/seed/${seed}/600/380`,
    listedAt: new Date().toISOString()
  };
  realEstateListings.unshift(newListing);
  res.json(newListing);
});

app.delete('/api/realestate/:id', (req, res) => {
  const user = getUser(req);
  const u = user ? users[user.username] : null;
  if (!u || (u.role !== 'admin' && u.role !== 'realtor')) return res.status(403).json({ error: 'Realtor or admin only' });
  const idx = realEstateListings.findIndex(l => l.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  realEstateListings.splice(idx, 1);
  res.json({ ok: true });
});

// ─── Business API ─────────────────────────────────────────────────────────────

// ─── Business Claim Flow ─────────────────────────────────────────────────────

app.post('/api/business/claim', (req, res) => {
  const { businessId, name, email, phone, role, message } = req.body;
  if (!businessId || !name || !email) return res.status(400).json({ error: 'Name and email are required' });
  const biz = businesses.find(b => b.id === businessId);
  if (!biz) return res.status(404).json({ error: 'Business not found' });
  if (biz.claimed) return res.status(409).json({ error: 'This business has already been claimed' });
  if (pendingClaims.find(c => c.businessId === businessId && c.status === 'pending')) {
    return res.status(409).json({ error: 'A claim for this business is already under review' });
  }
  pendingClaims.push({
    id: 'cl' + Date.now(),
    businessId, businessName: biz.name, businessCategory: biz.category,
    name, email, phone: phone || '', role: role || 'Owner',
    message: message || '',
    status: 'pending',
    submittedAt: new Date().toISOString()
  });
  res.json({ ok: true });
});

app.get('/api/admin/claims', (req, res) => {
  const user = getUser(req);
  if (!user || users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json(pendingClaims);
});

app.post('/api/admin/claims/:id/approve', (req, res) => {
  const user = getUser(req);
  if (!user || users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const claim = pendingClaims.find(c => c.id === req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  const biz = businesses.find(b => b.id === claim.businessId);
  if (!biz) return res.status(404).json({ error: 'Business not found' });

  // Generate username + temp password
  const slug = claim.businessName.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 16) || 'biz';
  let username = slug;
  let counter = 1;
  while (users[username]) { username = slug + counter++; }
  const password = Math.random().toString(36).slice(2, 7) + Math.random().toString(36).slice(2, 5);
  const initials = claim.name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const COLORS = ['#0077B6','#2A9D8F','#E76F51','#264653','#457B9D','#C0392B','#1D3557'];
  const avatar = COLORS[Math.floor(Math.random() * COLORS.length)];

  const newUser = {
    id: 'u' + Date.now(), username, password,
    role: 'business', businessId: claim.businessId,
    name: claim.businessName, avatar, initials,
    address: biz.address || 'Farallón, Panama',
    verified: true, bio: biz.description || '',
    posts: 0, neighbors: 0, points: 0, yearsInNeighborhood: 0,
    contactEmail: claim.email, contactPhone: claim.phone
  };
  users[username] = newUser;
  allUsers.push({ id: newUser.id, name: newUser.name, avatar, initials, verified: true, yearsInNeighborhood: 0, address: newUser.address, username });

  biz.claimed = true;
  biz.claimedBy = username;
  claim.status = 'approved';
  claim.approvedAt = new Date().toISOString();
  claim.generatedUsername = username;

  res.json({ ok: true, credentials: { username, password, businessName: biz.name } });
});

app.post('/api/admin/claims/:id/deny', (req, res) => {
  const user = getUser(req);
  if (!user || users[user.username]?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const claim = pendingClaims.find(c => c.id === req.params.id);
  if (!claim) return res.status(404).json({ error: 'Claim not found' });
  claim.status = 'denied';
  claim.deniedAt = new Date().toISOString();
  res.json({ ok: true });
});

// Get business profile + stats for logged-in business user
app.get('/api/business/me', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (u.role !== 'business') return res.status(403).json({ error: 'Not a business account' });
  const biz = businesses.find(b => b.id === u.businessId);
  if (!biz) return res.status(404).json({ error: 'Business not found' });
  const reviews = businessReviews[u.businessId] || [];
  const bizPosts = posts.filter(p => p.businessId === u.businessId);
  const totalReach = bizPosts.reduce((sum, p) => sum + Object.values(p.reactions).reduce((a, b) => a + b, 0) + p.commentCount, 0);
  const fd = getBizFaveData(u.businessId, user.username);
  res.json({ ...biz, reviews, postsCount: bizPosts.length, totalReach, neighborhoodSize: allUsers.length, ...fd });
});

// Business post — announcement or promotion — goes into neighbor feed badged
app.post('/api/business/post', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (u.role !== 'business') return res.status(403).json({ error: 'Not a business account' });
  const biz = businesses.find(b => b.id === u.businessId);
  if (!biz) return res.status(404).json({ error: 'Business not found' });
  const { postType, content, offerTitle, offerExpiry, image } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const newPost = {
    id: 'bp' + Date.now(),
    type: postType === 'promotion' ? 'promotion' : 'announcement',
    section: 'feed',
    isBusinessPost: true,
    businessId: u.businessId,
    author: {
      id: u.id, name: biz.name, avatar: u.avatar, initials: u.initials,
      verified: true, address: biz.address, username: user.username, isBusiness: true
    },
    content,
    ...(offerTitle && { offerTitle }),
    ...(offerExpiry && { offerExpiry }),
    ...(image && { image }),
    createdAt: new Date().toISOString(),
    reactions: { like: 0, insightful: 0, agree: 0, haha: 0, wow: 0, sad: 0 },
    commentCount: 0,
    userReaction: null
  };
  posts.unshift(newPost);
  res.json(newPost);
});

// Update business profile
app.put('/api/business/profile', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (u.role !== 'business') return res.status(403).json({ error: 'Not a business account' });
  const biz = businesses.find(b => b.id === u.businessId);
  if (!biz) return res.status(404).json({ error: 'Business not found' });
  const { name, description, hours, phone, address, tags } = req.body;
  if (name) biz.name = name;
  if (description) biz.description = description;
  if (hours) biz.hours = hours;
  if (phone) biz.phone = phone;
  if (address) biz.address = address;
  if (tags) biz.tags = Array.isArray(tags) ? tags : tags.split(',').map(t => t.trim()).filter(Boolean);
  // Keep user display name in sync
  if (name) u.name = name;
  res.json(biz);
});

// Reply to a review
app.post('/api/business/reviews/:idx/reply', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (u.role !== 'business') return res.status(403).json({ error: 'Not a business account' });
  const reviews = businessReviews[u.businessId];
  if (!reviews) return res.status(404).json({ error: 'No reviews found' });
  const idx = parseInt(req.params.idx);
  if (isNaN(idx) || !reviews[idx]) return res.status(404).json({ error: 'Review not found' });
  const { reply } = req.body;
  if (!reply) return res.status(400).json({ error: 'Reply text required' });
  reviews[idx].ownerReply = { text: reply, date: 'Just now' };
  res.json(reviews[idx]);
});

// Get all posts sent by this business
app.get('/api/business/posts', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (u.role !== 'business') return res.status(403).json({ error: 'Not a business account' });
  const bizPosts = posts.filter(p => p.businessId === u.businessId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(bizPosts);
});

// ─── Serve HTML ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'landing.html')));
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/app', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
app.get('/app.html', (req, res) => res.sendFile(path.join(__dirname, 'public', 'app.html')));
app.get('/business', (req, res) => res.sendFile(path.join(__dirname, 'public', 'business.html')));
app.get('/hoa', (req, res) => res.sendFile(path.join(__dirname, 'public', 'hoa.html')));

// ─── HOA API ──────────────────────────────────────────────────────────────────

app.get('/api/hoa/me', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (u.role !== 'hoa') return res.status(403).json({ error: 'Not an HOA account' });
  const { password, ...safe } = u;
  const hoaPosts = posts.filter(p => p.isHoaPost);
  const upcomingEvents = events.filter(e => new Date(e.date) >= new Date()).length;
  res.json({ ...safe, hoaPostsCount: hoaPosts.length, upcomingEvents, totalResidents: allUsers.length, totalGroups: groups.length });
});

// HOA official post — goes to feed with HOA badge
app.post('/api/hoa/post', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (u.role !== 'hoa') return res.status(403).json({ error: 'Not an HOA account' });
  const { postType, content, image } = req.body;
  if (!content) return res.status(400).json({ error: 'Content required' });
  const hoaAuthor = { id: u.id, name: u.name, avatar: u.avatar, initials: u.initials, verified: true, address: u.address, username: 'hoa', isHoa: true };
  const newPost = {
    id: 'hp' + Date.now(),
    type: postType || 'general',
    section: 'feed',
    isHoaPost: true,
    author: hoaAuthor,
    content,
    ...(image && { image }),
    createdAt: new Date().toISOString(),
    reactions: { like: 0, insightful: 0, agree: 0, haha: 0, wow: 0, sad: 0 },
    commentCount: 0,
    userReaction: null
  };
  posts.unshift(newPost);
  res.json(newPost);
});

app.get('/api/hoa/posts', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (u.role !== 'hoa') return res.status(403).json({ error: 'Not an HOA account' });
  res.json(posts.filter(p => p.isHoaPost).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// HOA create event
app.post('/api/hoa/events', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const u = users[user.username];
  if (u.role !== 'hoa') return res.status(403).json({ error: 'Not an HOA account' });
  const { title, description, location, date, time, endTime, category } = req.body;
  if (!title || !date) return res.status(400).json({ error: 'Title and date required' });
  const hoaHost = { id: u.id, name: u.name, avatar: u.avatar, initials: u.initials, verified: true, address: u.address, username: 'hoa' };
  const newEvent = {
    id: 'he' + Date.now(), title, description: description || '', host: hoaHost,
    location: location || 'Costa Blanca Villas', date, time: time || 'TBD',
    endTime: endTime || '', category: category || 'Community',
    rsvp: { going: 0, maybe: 0, cantGo: 0 }, userRsvp: null, goingAvatars: [], isHoaEvent: true
  };
  events.unshift(newEvent);
  res.json(newEvent);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Panamá Connect running on http://localhost:${PORT}`));

module.exports = app;
