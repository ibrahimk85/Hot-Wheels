import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function test() {
  try {
    // Try to query with wishlisted field
    const variant = await prisma.variant.findFirst({
      select: {
        id: true,
        wishlisted: true,
      },
    });
    console.log('✅ Prisma client recognizes wishlisted field!');
    console.log('Sample variant:', variant);
    
    // Try to update
    if (variant) {
      await prisma.variant.update({
        where: { id: variant.id },
        data: { wishlisted: !variant.wishlisted },
      });
      console.log('✅ Update with wishlisted works!');
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('wishlisted')) {
      console.error('The wishlisted field is not recognized by Prisma client.');
      console.error('Please run: npx prisma generate');
    }
  } finally {
    await prisma.$disconnect();
  }
}

test();












