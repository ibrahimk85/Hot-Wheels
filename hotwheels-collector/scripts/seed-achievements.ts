import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAchievements() {
  const achievements = [
    {
      name: 'İlk Model',
      description: 'İlk modelini koleksiyonuna ekle',
      icon: '🎯',
      condition: JSON.stringify({ type: 'model_count', value: 1, operator: 'gte' }),
      rarity: 'common',
    },
    {
      name: 'Koleksiyoncu',
      description: '10 model topla',
      icon: '🏆',
      condition: JSON.stringify({ type: 'model_count', value: 10, operator: 'gte' }),
      rarity: 'common',
    },
    {
      name: 'Uzman',
      description: '100 model topla',
      icon: '⭐',
      condition: JSON.stringify({ type: 'model_count', value: 100, operator: 'gte' }),
      rarity: 'rare',
    },
    {
      name: 'Efsane',
      description: '1000 model topla',
      icon: '👑',
      condition: JSON.stringify({ type: 'model_count', value: 1000, operator: 'gte' }),
      rarity: 'legendary',
    },
    {
      name: 'Varyant Avcısı',
      description: '50 varyant topla',
      icon: '🔍',
      condition: JSON.stringify({ type: 'variant_count', value: 50, operator: 'gte' }),
      rarity: 'common',
    },
    {
      name: 'Hazine Avcısı',
      description: 'İlk Treasure Hunt\'ı bul',
      icon: '💎',
      condition: JSON.stringify({ type: 'treasure_hunt', value: 1, operator: 'gte' }),
      rarity: 'rare',
    },
    {
      name: 'Altın El',
      description: 'İlk Super Treasure Hunt\'ı bul',
      icon: '✨',
      condition: JSON.stringify({ type: 'super_treasure_hunt', value: 1, operator: 'gte' }),
      rarity: 'epic',
    },
    {
      name: 'Günlük Ziyaretçi',
      description: '7 gün üst üste giriş yap',
      icon: '🔥',
      condition: JSON.stringify({ type: 'streak_days', value: 7, operator: 'gte' }),
      rarity: 'common',
    },
    {
      name: 'Ateşli',
      description: '30 gün üst üste giriş yap',
      icon: '🔥🔥',
      condition: JSON.stringify({ type: 'streak_days', value: 30, operator: 'gte' }),
      rarity: 'rare',
    },
  ];

  for (const achievement of achievements) {
    const existing = await prisma.achievement.findFirst({
      where: { name: achievement.name },
    });

    if (existing) {
      await prisma.achievement.update({
        where: { id: existing.id },
        data: achievement,
      });
    } else {
      await prisma.achievement.create({
        data: achievement,
      });
    }
  }
}

async function main() {
  console.log('🌱 Seeding achievements...');
  await seedAchievements();
  console.log('✅ Achievements seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding achievements:', e);
    process.exit(1);
  });

