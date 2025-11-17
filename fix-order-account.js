/**
 * Fix Order Account data for existing orders
 * This script adds the missing Order Account email data to existing orders
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

// Support both DATABASE_URL and individual DB_* environment variables
let poolConfig;

if (process.env.DATABASE_URL) {
  const db_url = process.env.DATABASE_URL;
  
  if (db_url.startsWith('mysql://') || db_url.startsWith('mysql2://')) {
    const url = new URL(db_url);
    poolConfig = {
      host: url.hostname,
      port: parseInt(url.port || '3306', 10),
      user: url.username,
      password: url.password,
      database: url.pathname.slice(1),
    };
  } else {
    try {
      poolConfig = JSON.parse(db_url);
    } catch {
      poolConfig = { uri: db_url };
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
  };
}

const pool = mysql.createPool(poolConfig);

async function fixOrderAccountData() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('🔗 Connected to database');

    // Get files with data
    const [filesResult] = await connection.execute(`
      SELECT id, original_name, data, column_mapping 
      FROM uploaded_files 
      WHERE data IS NOT NULL 
      ORDER BY uploaded_at DESC
    `);

    console.log(`📁 Found ${filesResult.length} files with data`);

    for (const file of filesResult) {
      console.log(`\n📋 Processing file: ${file.original_name}`);
      
      const data = typeof file.data === 'string' ? JSON.parse(file.data) : file.data;
      
      if (!data || !data.data || !Array.isArray(data.data)) {
        console.log('❌ No valid data array found');
        continue;
      }

      // Look for Order Account column in the data
      const sampleRow = data.data[0];
      if (!sampleRow) {
        console.log('❌ No sample row found');
        continue;
      }

      // Find Order Account column - it's usually the first column 'Order Account'
      const orderAccountColumn = Object.keys(sampleRow).find(key => 
        key.toLowerCase().includes('order') && key.toLowerCase().includes('account')
      ) || 'Order Account';

      console.log(`🔍 Looking for Order Account in column: "${orderAccountColumn}"`);

      if (!sampleRow[orderAccountColumn]) {
        console.log('❌ Order Account column not found in data');
        continue;
      }

      // Update orders for this file
      let updatedCount = 0;
      
      for (const row of data.data) {
        const orderAccount = row[orderAccountColumn];
        const awbNo = row['WayBill Number'] || row['AWB No'] || row['awb_no'];
        
        if (orderAccount && awbNo) {
          try {
            const [updateResult] = await connection.execute(`
              UPDATE orders 
              SET order_account = ? 
              WHERE awb_no = ? AND file_id = ?
            `, [orderAccount, awbNo, file.id]);
            
            if (updateResult.affectedRows > 0) {
              updatedCount++;
            }
          } catch (error) {
            console.log(`❌ Failed to update AWB ${awbNo}:`, error.message);
          }
        }
      }

      console.log(`✅ Updated ${updatedCount} orders with Order Account data`);
    }

    // Final verification
    const [verificationResult] = await connection.execute(`
      SELECT COUNT(*) as total_orders, COUNT(order_account) as orders_with_account 
      FROM orders
    `);
    
    console.log('\n📊 Final Results:');
    console.log(`Total Orders: ${verificationResult[0].total_orders}`);
    console.log(`Orders with Account: ${verificationResult[0].orders_with_account}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
    console.log('🔐 Database connection closed');
  }
}

fixOrderAccountData();