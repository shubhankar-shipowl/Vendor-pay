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
      connectTimeout: 60000, // 60 seconds connection timeout
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
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
    connectTimeout: 60000, // 60 seconds connection timeout
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  };
  
  console.log(`✅ Using individual environment variables:`);
  console.log(`   Host: ${host}`);
  console.log(`   Port: ${port || 3306}`);
  console.log(`   Database: ${database}`);
  console.log(`   User: ${user}`);
}

// Create MySQL connection pool
export const pool = mysql.createPool(poolConfig);

// Test connection with retry logic
async function testConnectionWithRetry(retries = 3, delay = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      const connection = await pool.getConnection();
      console.log('✅ Database connection pool created successfully');
      console.log(`📊 Connection pool configured:`);
      console.log(`   - Host: ${poolConfig.host}`);
      console.log(`   - Port: ${poolConfig.port || 3306}`);
      console.log(`   - Database: ${poolConfig.database}`);
      console.log(`   - Connection Limit: ${poolConfig.connectionLimit || 10}`);
      
      // Test the connection
      await connection.query('SELECT 1 as test');
      console.log('✅ Database connection test successful');
      connection.release();
      return;
    } catch (error: any) {
      console.error(`❌ Database connection attempt ${i + 1}/${retries} failed:`, error.message);
      if (error.code === 'EADDRNOTAVAIL' || error.code === 'ECONNREFUSED') {
        console.error('   ⚠️  Network connectivity issue detected');
        if (i < retries - 1) {
          console.log(`   🔄 Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          console.error('   ❌ All connection attempts failed');
          console.error('   Please check:');
          console.error('   1. Database server is running and accessible');
          console.error('   2. Network connectivity to database host');
          console.error('   3. Firewall rules allow connection on port', poolConfig.port || 3306);
          console.error('   4. Database credentials are correct');
        }
      } else {
        // For other errors, don't retry
        console.error('   Please check your database credentials and network connectivity');
        break;
      }
    }
  }
}

// Test connection asynchronously (don't block startup)
testConnectionWithRetry().catch((error) => {
  console.error('❌ Database connection test failed:', error.message);
});

// Add event listeners for connection pool
pool.on('connection', (connection) => {
  console.log(`🔗 New database connection established (ID: ${connection.threadId})`);
});

// Note: Pool errors are handled by retryDbOperation helper function
// Connection errors will be automatically retried with exponential backoff

// Graceful shutdown function to close the pool
export async function closeDatabasePool(): Promise<void> {
  try {
    console.log('🔄 Closing database connection pool...');
    await pool.end();
    console.log('✅ Database connection pool closed successfully');
  } catch (error: any) {
    console.error('❌ Error closing database pool:', error.message);
  }
}

export const db = drizzle(pool, { schema, mode: 'default' });
console.log('✅ Drizzle ORM initialized with MySQL schema');

// Helper function to retry database operations on connection errors
export async function retryDbOperation<T>(
  operation: () => Promise<T>,
  retries = 3,
  delay = 1000
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      const isConnectionError = 
        error.code === 'EADDRNOTAVAIL' ||
        error.code === 'ECONNREFUSED' ||
        error.code === 'PROTOCOL_CONNECTION_LOST' ||
        error.code === 'ECONNRESET' ||
        error.message?.includes('Connection lost');
      
      if (isConnectionError && i < retries - 1) {
        console.warn(`⚠️  Database connection error (attempt ${i + 1}/${retries}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
  throw new Error('All retry attempts failed');
}
