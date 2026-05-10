const { PrismaClient } = require('@prisma/client');
const OpenAI = require('openai');

const prisma = new PrismaClient();

async function testConnection() {
  try {
    // Get API key from database
    const setting = await prisma.settings.findUnique({
      where: { key: 'openai_api_key' },
    });

    if (!setting || !setting.value) {
      console.log('❌ API key not found in database');
      return;
    }

    console.log('✅ API key found, testing connection...');
    console.log('Key length:', setting.value.length);

    // Create OpenAI client
    const openai = new OpenAI({
      apiKey: setting.value,
    });

    // Test with a simple request
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'user',
          content: 'Say hello in Turkish',
        },
      ],
      max_tokens: 50,
    });

    console.log('✅ OpenAI connection successful!');
    console.log('Response:', completion.choices[0]?.message?.content);
  } catch (error) {
    console.error('❌ Error testing OpenAI connection:');
    console.error('Message:', error.message);
    console.error('Status:', error.status);
    console.error('Code:', error.code);
    console.error('Type:', error.type);
    
    if (error.status === 401) {
      console.error('\n💡 API key geçersiz. Lütfen OpenAI API key\'inizi kontrol edin.');
    } else if (error.status === 429) {
      console.error('\n💡 API limiti aşıldı veya yeterli kredi yok.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();

