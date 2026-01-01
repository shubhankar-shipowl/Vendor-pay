import 'dotenv/config';
import { DrizzleStorage } from './drizzle-storage';
import { hashPassword } from './auth';

async function createUser() {
  const storage = new DrizzleStorage();
  
  const username = 'finance@shipowl.io';
  const password = 'Shipowl@6';
  
  // Check if user already exists
  const existingUser = await storage.getUserByUsername(username);
  
  if (existingUser) {
    console.log(`⚠️ User "${username}" already exists. Skipping creation.`);
    process.exit(0);
  }
  
  try {
    // Hash the password
    const hashedPassword = await hashPassword(password);
    
    // Create the user
    const user = await storage.createUser({
      username,
      password: hashedPassword,
    });
    
    console.log(`✅ User created successfully!`);
    console.log(`   Username: ${user.username}`);
    console.log(`   ID: ${user.id}`);
    process.exit(0);
  } catch (error: any) {
    console.error(`❌ Failed to create user:`, error.message);
    process.exit(1);
  }
}

createUser();

