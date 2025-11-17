// // Script to fix AWB numbers in scientific notation format
// const { drizzle } = require('drizzle-orm/neon-http');
// const { neon } = require('@neondatabase/serverless');
// const { orders } = require('./shared/schema.ts');
// const { eq, like, or } = require('drizzle-orm');

// // Function to convert scientific notation to proper number
// function convertScientificToNumber(scientificStr) {
//   if (!scientificStr || typeof scientificStr !== 'string') return scientificStr;

//   // Check if it's in scientific notation
//   if (!scientificStr.includes('E+') && !scientificStr.includes('e+')) {
//     return scientificStr;
//   }

//   try {
//     const num = parseFloat(scientificStr);
//     if (isNaN(num)) return scientificStr;

//     // Convert to proper format
//     return Math.floor(num).toString();
//   } catch (error) {
//     console.error('Error converting:', scientificStr, error);
//     return scientificStr;
//   }
// }

// async function fixAwbNumbers() {
//   const sql = neon(process.env.DATABASE_URL);
//   const db = drizzle(sql);

//   console.log('🔍 Finding orders with scientific notation AWB numbers...');

//   // Get all orders with scientific notation AWB numbers
//   const problematicOrders = await db
//     .select({ id: orders.id, awbNo: orders.awbNo })
//     .from(orders)
//     .where(or(
//       like(orders.awbNo, '%E+%'),
//       like(orders.awbNo, '%e+%')
//     ));

//   console.log(`📊 Found ${problematicOrders.length} orders with scientific notation AWB numbers`);

//   if (problematicOrders.length === 0) {
//     console.log('✅ No AWB numbers need fixing!');
//     return;
//   }

//   // Process in batches
//   const BATCH_SIZE = 100;
//   let fixedCount = 0;

//   for (let i = 0; i < problematicOrders.length; i += BATCH_SIZE) {
//     const batch = problematicOrders.slice(i, i + BATCH_SIZE);

//     console.log(`🔧 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(problematicOrders.length/BATCH_SIZE)}`);

//     for (const order of batch) {
//       const originalAwb = order.awbNo;
//       const fixedAwb = convertScientificToNumber(originalAwb);

//       if (originalAwb !== fixedAwb) {
//         try {
//           await db
//             .update(orders)
//             .set({ awbNo: fixedAwb })
//             .where(eq(orders.id, order.id));

//           console.log(`✅ Fixed: ${originalAwb} -> ${fixedAwb}`);
//           fixedCount++;
//         } catch (error) {
//           console.error(`❌ Error fixing order ${order.id}:`, error);
//         }
//       }
//     }
//   }

//   console.log(`🎉 Successfully fixed ${fixedCount} AWB numbers!`);
// }

// // Test the conversion function
// console.log('=== Testing AWB Number Conversion ===');
// const testCases = [
//   '1.53664E+14',
//   '3.62929E+11',
//   '3.45727E+13',
//   '34572714087543',
//   'ABC123'
// ];

// testCases.forEach(test => {
//   console.log(`${test} -> ${convertScientificToNumber(test)}`);
// });

// // Run the fix
// fixAwbNumbers().catch(console.error);

// Script to fix AWB numbers in scientific notation format
const { drizzle } = require('drizzle-orm/mysql2');
const mysql = require('mysql2/promise');
const { orders } = require('./shared/schema.ts');
const { eq, like, or } = require('drizzle-orm');

// Function to convert scientific notation to proper number
function convertScientificToNumber(scientificStr) {
  if (!scientificStr || typeof scientificStr !== 'string') return scientificStr;

  if (!scientificStr.includes('E+') && !scientificStr.includes('e+')) {
    return scientificStr;
  }

  try {
    const num = parseFloat(scientificStr);
    if (isNaN(num)) return scientificStr;

    return Math.floor(num).toString();
  } catch (error) {
    console.error('Error converting:', scientificStr, error);
    return scientificStr;
  }
}

async function fixAwbNumbers() {
  // Support both DATABASE_URL and individual DB_* environment variables
  let poolConfig;
  
  if (process.env.DATABASE_URL) {
    const db_url = process.env.DATABASE_URL;
    
    // Parse MySQL connection string
    if (db_url.startsWith('mysql://') || db_url.startsWith('mysql2://')) {
      const url = new URL(db_url);
      poolConfig = {
        host: url.hostname,
        port: parseInt(url.port || '3306', 10),
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1),
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
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
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    };
  }
  
  const pool = mysql.createPool(poolConfig);
  const db = drizzle(pool);

  console.log('🔍 Finding orders with scientific notation AWB numbers...');

  const problematicOrders = await db
    .select({ id: orders.id, awbNo: orders.awbNo })
    .from(orders)
    .where(or(like(orders.awbNo, '%E+%'), like(orders.awbNo, '%e+%')));

  console.log(
    `📊 Found ${problematicOrders.length} orders with scientific notation AWB numbers`,
  );

  if (problematicOrders.length === 0) {
    console.log('✅ No AWB numbers need fixing!');
    await pool.end();
    return;
  }

  const BATCH_SIZE = 100;
  let fixedCount = 0;

  for (let i = 0; i < problematicOrders.length; i += BATCH_SIZE) {
    const batch = problematicOrders.slice(i, i + BATCH_SIZE);

    console.log(
      `🔧 Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(
        problematicOrders.length / BATCH_SIZE,
      )}`,
    );

    for (const order of batch) {
      const originalAwb = order.awbNo;
      const fixedAwb = convertScientificToNumber(originalAwb);

      if (originalAwb !== fixedAwb) {
        try {
          await db
            .update(orders)
            .set({ awbNo: fixedAwb })
            .where(eq(orders.id, order.id));

          console.log(`✅ Fixed: ${originalAwb} -> ${fixedAwb}`);
          fixedCount++;
        } catch (error) {
          console.error(`❌ Error fixing order ${order.id}:`, error);
        }
      }
    }
  }

  console.log(`🎉 Successfully fixed ${fixedCount} AWB numbers!`);
  await pool.end();
}

// Test the conversion function
console.log('=== Testing AWB Number Conversion ===');
const testCases = [
  '1.53664E+14',
  '3.62929E+11',
  '3.45727E+13',
  '34572714087543',
  'ABC123',
];

testCases.forEach((test) => {
  console.log(`${test} -> ${convertScientificToNumber(test)}`);
});

// Run the fix
fixAwbNumbers().catch(console.error);
