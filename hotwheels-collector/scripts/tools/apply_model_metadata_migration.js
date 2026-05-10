/**
 * Script to apply Model metadata migration directly to SQLite database
 * This ensures the new fields exist in the database before Prisma Client generation
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../../prisma/dev.db');

console.log('Connecting to database:', dbPath);

const db = new Database(dbPath);

try {
  // Check if columns already exist
  const columns = db.prepare('PRAGMA table_info(Model)').all();
  const columnNames = columns.map(col => col.name);
  
  console.log('Current Model table columns:', columnNames);
  
  const newColumns = [
    { name: 'debutSeries', type: 'TEXT' },
    { name: 'produced', type: 'TEXT' },
    { name: 'designer', type: 'TEXT' },
    { name: 'castingNumber', type: 'TEXT' }
  ];
  
  for (const col of newColumns) {
    if (columnNames.includes(col.name)) {
      console.log(`Column ${col.name} already exists, skipping...`);
    } else {
      const sql = `ALTER TABLE Model ADD COLUMN ${col.name} ${col.type};`;
      console.log(`Adding column: ${sql}`);
      db.exec(sql);
      console.log(`✓ Column ${col.name} added successfully`);
    }
  }
  
  // Verify
  const finalColumns = db.prepare('PRAGMA table_info(Model)').all();
  console.log('\nFinal Model table columns:');
  finalColumns.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });
  
  console.log('\n✓ Migration completed successfully!');
  
} catch (error) {
  console.error('Error applying migration:', error.message);
  process.exit(1);
} finally {
  db.close();
}





