import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import * as schema from '@shared/schema';

// Support both DATABASE_URL and individual DB_* environment variables
let poolConfig: mysql.PoolOptions;

console.log('🔌 Initializing database connection...');

if (process.env.DATABASE_URL) {
  // Use DATABASE_URL if provided
  const db_url = process.env.DATABASE_URL;
  console.log('📝 Using DATABASE_URL for connection');
  
  if (db_url.startsWith('mysql://') || db_url.startsWith('mysql2://')) {
    // Parse connection string
    const url = new URL(db_url);
    poolConfig = {
      host: url.hostname,
      port: parseInt(url.port || '3306', 10),
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1), // Remove leading '/'
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };
    console.log(`✅ Parsed connection string: ${url.hostname}:${url.port}/${url.pathname.slice(1)}`);
  } else {
    // Assume it's a JSON string or use as-is (for other formats)
    try {
      poolConfig = JSON.parse(db_url);
      console.log('✅ Parsed JSON connection config');
    } catch {
      // If not JSON, try to extract from connection string format
      poolConfig = {
        uri: db_url,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      };
      console.log('⚠️ Using URI connection format');
    }
  }
} else {
  // Use individual environment variables
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT;
  const database = process.env.DB_NAME;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  if (!host || !database || !user || !password) {
    console.error('❌ Database configuration missing!');
    throw new Error(
      'Database configuration missing. Please set either DATABASE_URL or DB_HOST, DB_NAME, DB_USER, DB_PASSWORD environment variables.',
    );
  }

  poolConfig = {
    host,
    port: port ? parseInt(port, 10) : 3306,
    user,
    password,
    database,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };
  
  console.log(`✅ Using individual environment variables:`);
  console.log(`   Host: ${host}`);
  console.log(`   Port: ${port || 3306}`);
  console.log(`   Database: ${database}`);
  console.log(`   User: ${user}`);
}

// Create MySQL connection pool
export const pool = mysql.createPool(poolConfig);

// Test connection and log status
pool.getConnection()
  .then((connection) => {
    console.log('✅ Database connection pool created successfully');
    console.log(`📊 Connection pool configured:`);
    console.log(`   - Host: ${poolConfig.host}`);
    console.log(`   - Port: ${poolConfig.port || 3306}`);
    console.log(`   - Database: ${poolConfig.database}`);
    console.log(`   - Connection Limit: ${poolConfig.connectionLimit || 10}`);
    
    // Test the connection
    return connection.query('SELECT 1 as test')
      .then(([rows]) => {
        console.log('✅ Database connection test successful');
        connection.release();
      })
      .catch((error) => {
        console.error('❌ Database connection test failed:', error.message);
        connection.release();
      });
  })
  .catch((error) => {
    console.error('❌ Database connection failed:', error.message);
    console.error('   Please check your database credentials and network connectivity');
  });

// Add event listeners for connection pool
pool.on('connection', (connection) => {
  console.log(`🔗 New database connection established (ID: ${connection.threadId})`);
});

pool.on('error', (error) => {
  console.error('❌ Database pool error:', error.message);
});

export const db = drizzle(pool, { schema, mode: 'default' });
console.log('✅ Drizzle ORM initialized with MySQL schema');
