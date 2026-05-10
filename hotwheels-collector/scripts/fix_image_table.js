const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Add name and isGalleryImage columns to Image table
    await prisma.$executeRaw`ALTER TABLE Image ADD COLUMN name TEXT;`;
    console.log('Added name column');
    
    await prisma.$executeRaw`ALTER TABLE Image ADD COLUMN isGalleryImage BOOLEAN NOT NULL DEFAULT 0;`;
    console.log('Added isGalleryImage column');
    
    console.log('Migration completed successfully!');
  } catch (error) {
    // Ignore if columns already exist
    if (error.message.includes('duplicate column')) {
      console.log('Columns already exist, skipping...');
    } else {
      console.error('Error:', error);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();



