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
const { drizzle } = require('drizzle-orm/node-postgres');
const { Client } = require('pg');
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
  const client = new Client({
    connectionString: process.env.DATABASE_URL, // use your DB connection string
  });

  await client.connect();
  const db = drizzle(client);

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
    await client.end();
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
  await client.end();
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
