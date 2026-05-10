const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkKey() {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'google_lens_api_key' },
    });

    if (setting) {
      console.log('✅ Google Lens API Key found in database');
      console.log('Key length:', setting.value.length);
      console.log('First 10 chars:', setting.value.substring(0, 10) + '...');
    } else {
      console.log('❌ Google Lens API Key NOT found in database');
      console.log('Note: The service uses GOOGLE_VISION_API_KEY, but database key is google_lens_api_key');
    }
    
    // Check environment variable fallback
    if (process.env.GOOGLE_VISION_API_KEY) {
      console.log('✅ GOOGLE_VISION_API_KEY found in environment variables');
    } else {
      console.log('❌ GOOGLE_VISION_API_KEY NOT found in environment variables');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkKey();

