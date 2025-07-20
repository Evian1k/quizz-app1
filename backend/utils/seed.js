const bcrypt = require('bcryptjs');
const { query } = require('../config/database');

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Create sample interests
    const interests = [
      'Technology', 'Music', 'Sports', 'Travel', 'Food', 'Art', 'Movies', 
      'Books', 'Gaming', 'Photography', 'Fitness', 'Fashion', 'Nature',
      'Cooking', 'Dancing', 'Writing', 'Science', 'History', 'Languages',
      'Pets', 'Cars', 'Business', 'Health', 'Education', 'Volunteering'
    ];

    console.log('Adding interests...');
    for (const interest of interests) {
      await query(
        'INSERT INTO interests (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
        [interest]
      );
    }

    // Create sample users
    const sampleUsers = [
      {
        email: 'alice@example.com',
        username: 'alice_wonder',
        password: await bcrypt.hash('password123', 12),
        firstName: 'Alice',
        lastName: 'Wonder',
        gender: 'female',
        bio: 'Love traveling and photography! Always looking for new adventures.',
        locationCity: 'New York',
        locationCountry: 'USA',
        dateOfBirth: '1995-06-15',
        isVerified: true,
        coins: 100
      },
      {
        email: 'bob@example.com',
        username: 'bob_builder',
        password: await bcrypt.hash('password123', 12),
        firstName: 'Bob',
        lastName: 'Builder',
        gender: 'male',
        bio: 'Tech enthusiast and coffee lover. Let\'s chat about the latest gadgets!',
        locationCity: 'San Francisco',
        locationCountry: 'USA',
        dateOfBirth: '1992-03-20',
        isVerified: true,
        coins: 150
      },
      {
        email: 'carol@example.com',
        username: 'carol_music',
        password: await bcrypt.hash('password123', 12),
        firstName: 'Carol',
        lastName: 'Music',
        gender: 'female',
        bio: 'Musician and artist. Love creating and sharing beautiful things.',
        locationCity: 'London',
        locationCountry: 'UK',
        dateOfBirth: '1990-11-08',
        isVerified: true,
        coins: 200
      }
    ];

    console.log('Adding sample users...');
    const userIds = [];
    for (const user of sampleUsers) {
      const result = await query(`
        INSERT INTO users (
          email, username, password_hash, first_name, last_name, gender, bio,
          location_city, location_country, date_of_birth, is_verified, coins
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (email) DO NOTHING
        RETURNING id
      `, [
        user.email, user.username, user.password, user.firstName, user.lastName,
        user.gender, user.bio, user.locationCity, user.locationCountry,
        user.dateOfBirth, user.isVerified, user.coins
      ]);
      
      if (result.rows.length > 0) {
        userIds.push(result.rows[0].id);
      }
    }

    // Add interests to users
    if (userIds.length > 0) {
      console.log('Adding user interests...');
      const interestResult = await query('SELECT id FROM interests LIMIT 10');
      const interestIds = interestResult.rows.map(row => row.id);

      for (const userId of userIds) {
        // Add 3-5 random interests per user
        const numInterests = Math.floor(Math.random() * 3) + 3;
        const shuffled = interestIds.sort(() => 0.5 - Math.random());
        const selectedInterests = shuffled.slice(0, numInterests);

        for (const interestId of selectedInterests) {
          await query(
            'INSERT INTO user_interests (user_id, interest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [userId, interestId]
          );
        }
      }
    }

    // Create a sample conversation
    if (userIds.length >= 2) {
      console.log('Creating sample conversation...');
      const conversationResult = await query(`
        INSERT INTO conversations (participant1_id, participant2_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT DO NOTHING
        RETURNING id
      `, [userIds[0], userIds[1]]);

      if (conversationResult.rows.length > 0) {
        const conversationId = conversationResult.rows[0].id;

        // Add sample messages
        const sampleMessages = [
          { senderId: userIds[0], content: 'Hey! How are you doing?', type: 'text' },
          { senderId: userIds[1], content: 'Hi there! I\'m doing great, thanks for asking!', type: 'text' },
          { senderId: userIds[0], content: 'That\'s awesome! I love your profile, we have so much in common!', type: 'text' },
          { senderId: userIds[1], content: 'Thank you! I noticed we both love photography. Do you have any favorite spots?', type: 'text' },
        ];

        for (let i = 0; i < sampleMessages.length; i++) {
          const msg = sampleMessages[i];
          await query(`
            INSERT INTO messages (conversation_id, sender_id, content, message_type, created_at)
            VALUES ($1, $2, $3, $4, NOW() - INTERVAL '${sampleMessages.length - i} minutes')
          `, [conversationId, msg.senderId, msg.content, msg.type]);
        }
      }
    }

    console.log('✅ Database seeding completed successfully!');
    console.log(`Created ${interests.length} interests`);
    console.log(`Created ${sampleUsers.length} sample users`);
    console.log('Created sample conversations and messages');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  }
}

// Run seeding if called directly
if (require.main === module) {
  seedDatabase()
    .then(() => {
      console.log('🎉 Seeding completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Seeding failed:', error);
      process.exit(1);
    });
}

module.exports = { seedDatabase };