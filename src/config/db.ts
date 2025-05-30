import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const {
  PGHOST,
  PGUSER,
  PGDATABASE,
  PGPASSWORD,
  PGPORT,
  NODE_ENV, // To potentially use a different DB for testing
} = process.env;

if (!PGHOST || !PGUSER || !PGDATABASE || !PGPASSWORD || !PGPORT) {
  if (NODE_ENV !== 'test') { // Don't throw error in test environment if db is mocked
    console.error('Missing PostgreSQL environment variables. Please check your .env file.');
    // process.exit(1); // Optionally exit if not all vars are set
  }
}

const pool = new Pool({
  host: PGHOST,
  user: PGUSER,
  database: PGDATABASE,
  password: PGPASSWORD,
  port: parseInt(PGPORT || '5432', 10),
  ssl: NODE_ENV === 'production' ? { rejectUnauthorized: false } : false, // Basic SSL for production
});

pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

export const query = (text: string, params?: any[]) => pool.query(text, params);

// Example of how to test the connection (optional, can be called from index.ts or a test script)
export const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('Successfully connected to PostgreSQL and acquired client.');
    const res = await client.query('SELECT NOW()');
    console.log('Test query result:', res.rows[0]);
    client.release();
    return true;
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error);
    return false;
  }
};

export default pool;
