// Test setup and teardown
const { pool } = require('../src/db');

// Close database pool after all tests
afterAll(async () => {
  await pool.end();
});

// Global test timeout
jest.setTimeout(30000);
