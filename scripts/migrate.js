const fs = require('fs');
const path = require('path');
const { query } = require('../src/db');

const migrationsDir = path.join(__dirname, '..', 'migrations');

async function runMigrations(reset = false) {
  try {
    if (reset) {
      console.log('Resetting database...');
      await query(`
        DROP TABLE IF EXISTS webhook_deliveries CASCADE;
        DROP TABLE IF EXISTS webhook_subscriptions CASCADE;
        DROP TABLE IF EXISTS refresh_tokens CASCADE;
        DROP TABLE IF EXISTS audit_logs CASCADE;
        DROP TABLE IF EXISTS documents CASCADE;
        DROP TABLE IF EXISTS merchants CASCADE;
        DROP TABLE IF EXISTS operators CASCADE;
        DROP FUNCTION IF EXISTS prevent_audit_update CASCADE;
        DROP FUNCTION IF EXISTS cleanup_expired_tokens CASCADE;
      `);
      console.log('All tables dropped');
    }

    // Get all SQL files and sort them
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    console.log(`Found ${files.length} migration files`);

    for (const file of files) {
      console.log(`Running: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await query(sql);
      console.log(`Completed: ${file}`);
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  }
}

// Check for --reset flag
const reset = process.argv.includes('--reset');
runMigrations(reset);
