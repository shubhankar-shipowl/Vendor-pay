import { defineConfig } from 'drizzle-kit';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Support both DATABASE_URL and individual DB_* environment variables
let databaseUrl: string;

if (process.env.DATABASE_URL) {
  databaseUrl = process.env.DATABASE_URL;
} else {
  // Construct connection string from individual environment variables
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || '3306';
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!host || !database || !user || !password) {
    throw new Error(
      'Database configuration missing. Please set either DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASSWORD environment variables.',
    );
  }

  // Construct MySQL connection string
  // Format: mysql://user:password@host:port/database
  databaseUrl = `mysql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}/${database}`;
}

export default defineConfig({
  out: './migrations',
  schema: './shared/schema.ts',
  dialect: 'mysql',
  dbCredentials: {
    url: databaseUrl,
  },
});
