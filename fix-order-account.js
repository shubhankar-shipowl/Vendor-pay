/**
 * Fix Order Account data for existing orders
 * This script adds the missing Order Account email data to existing orders
 */

import pkg from 'pg';
import dotenv from 'dotenv';

const { Client } = pkg;
dotenv.config();

const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function fixOrderAccountData() {
  try {
    await client.connect();
    console.log('🔗 Connected to database');

    // Get files with data
    const filesResult = await client.query(`
      SELECT id, original_name, data, column_mapping 
      FROM uploaded_files 
      WHERE data IS NOT NULL 
      ORDER BY uploaded_at DESC
    `);

    console.log(`📁 Found ${filesResult.rows.length} files with data`);

    for (const file of filesResult.rows) {
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
            const updateResult = await client.query(`
              UPDATE orders 
              SET order_account = $1 
              WHERE awb_no = $2 AND file_id = $3
            `, [orderAccount, awbNo, file.id]);
            
            if (updateResult.rowCount > 0) {
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
    const verificationResult = await client.query(`
      SELECT COUNT(*) as total_orders, COUNT(order_account) as orders_with_account 
      FROM orders
    `);
    
    console.log('\n📊 Final Results:');
    console.log(`Total Orders: ${verificationResult.rows[0].total_orders}`);
    console.log(`Orders with Account: ${verificationResult.rows[0].orders_with_account}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.end();
    console.log('🔐 Database connection closed');
  }
}

fixOrderAccountData();