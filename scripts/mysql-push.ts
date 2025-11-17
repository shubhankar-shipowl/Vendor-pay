import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import 'dotenv/config';

type JournalEntry = {
  idx: number;
  tag: string;
  appliedAt?: string;
};

type JournalFile = {
  version: string;
  dialect: string;
  entries: JournalEntry[];
};

function buildPoolConfig(): mysql.PoolOptions {
  const {
    DATABASE_URL,
    DB_HOST,
    DB_PORT,
    DB_NAME,
    DB_USER,
    DB_PASSWORD,
  } = process.env;

  if (DATABASE_URL) {
    if (DATABASE_URL.startsWith('mysql://') || DATABASE_URL.startsWith('mysql2://')) {
      const url = new URL(DATABASE_URL);
      return {
        host: url.hostname,
        port: parseInt(url.port || '3306', 10),
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1),
        multipleStatements: true,
      };
    }

    try {
      const parsed = JSON.parse(DATABASE_URL);
      return { ...parsed, multipleStatements: true };
    } catch {
      return {
        uri: DATABASE_URL,
        multipleStatements: true,
      } as mysql.PoolOptions;
    }
  }

  if (!DB_HOST || !DB_NAME || !DB_USER || !DB_PASSWORD) {
    throw new Error(
      'Database configuration missing. Please set either DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASSWORD environment variables.',
    );
  }

  return {
    host: DB_HOST,
    port: DB_PORT ? parseInt(DB_PORT, 10) : 3306,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    multipleStatements: true,
  };
}

async function run() {
  const migrationsDir = path.resolve('migrations');
  const journalPath = path.join(migrationsDir, 'meta', '_journal.json');

  if (!fs.existsSync(journalPath)) {
    console.log('No journal file found, skipping migrations.');
    return;
  }

  const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8')) as JournalFile;
  const pendingEntries = [...journal.entries]
    .sort((a, b) => a.idx - b.idx)
    .filter((entry) => !entry.appliedAt);

  if (pendingEntries.length === 0) {
    console.log('✅ No pending migrations. Database is up to date.');
    return;
  }

  const pool = mysql.createPool(buildPoolConfig());
  const connection = await pool.getConnection();

  try {
    for (const entry of pendingEntries) {
      const migrationFile = path.join(migrationsDir, `${entry.tag}.sql`);

      if (!fs.existsSync(migrationFile)) {
        throw new Error(`Migration file not found: ${migrationFile}`);
      }

      const rawSql = fs.readFileSync(migrationFile, 'utf8');
      const statements = rawSql
        .split(/-->\s*statement-breakpoint/gi)
        .map((stmt) => stmt.trim())
        .filter(Boolean);

      for (const statement of statements) {
        await connection.query(statement);
      }

      entry.appliedAt = new Date().toISOString();
      console.log(`✅ Applied migration ${entry.tag}`);
    }

    fs.writeFileSync(journalPath, `${JSON.stringify(journal, null, 2)}\n`);

    console.log('🎉 All pending migrations have been applied successfully.');
  } finally {
    connection.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error('❌ Migration push failed:', error);
  process.exitCode = 1;
});


