const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Applying price fields migration...');
    
    // Check if columns exist
    const tableInfo = await prisma.$queryRaw`PRAGMA table_info(Model);`;
    const columnNames = tableInfo.map(col => col.name);
    
    if (!columnNames.includes('packedPurchasePrice')) {
      await prisma.$executeRaw`ALTER TABLE Model ADD COLUMN packedPurchasePrice REAL;`;
      console.log('Added packedPurchasePrice column');
    } else {
      console.log('packedPurchasePrice column already exists');
    }
    
    if (!columnNames.includes('packedMarketPrice')) {
      await prisma.$executeRaw`ALTER TABLE Model ADD COLUMN packedMarketPrice REAL;`;
      console.log('Added packedMarketPrice column');
    } else {
      console.log('packedMarketPrice column already exists');
    }
    
    if (!columnNames.includes('loosePurchasePrice')) {
      await prisma.$executeRaw`ALTER TABLE Model ADD COLUMN loosePurchasePrice REAL;`;
      console.log('Added loosePurchasePrice column');
    } else {
      console.log('loosePurchasePrice column already exists');
    }
    
    if (!columnNames.includes('looseMarketPrice')) {
      await prisma.$executeRaw`ALTER TABLE Model ADD COLUMN looseMarketPrice REAL;`;
      console.log('Added looseMarketPrice column');
    } else {
      console.log('looseMarketPrice column already exists');
    }
    
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();



