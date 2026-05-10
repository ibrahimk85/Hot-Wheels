const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkKey() {
  try {
    const setting = await prisma.settings.findUnique({
      where: { key: 'openai_api_key' },
    });

    if (setting) {
      console.log('✅ OpenAI API Key found in database');
      console.log('Key length:', setting.value.length);
      console.log('First 10 chars:', setting.value.substring(0, 10) + '...');
      console.log('Last 10 chars:', '...' + setting.value.substring(setting.value.length - 10));
    } else {
      console.log('❌ OpenAI API Key NOT found in database');
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkKey();

