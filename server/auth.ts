import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import { DrizzleStorage } from './drizzle-storage';
import bcrypt from 'bcryptjs';

const storage = new DrizzleStorage();

// Configure passport local strategy
passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return done(null, false, { message: 'Incorrect username or password' });
      }

      // For now, we'll support both plain text (for existing users) and hashed passwords
      // In production, you should hash all passwords
      const isPasswordValid = 
        user.password === password || // Plain text fallback (for migration)
        await bcrypt.compare(password, user.password); // Hashed password

      if (!isPasswordValid) {
        return done(null, false, { message: 'Incorrect username or password' });
      }

      return done(null, user);
    } catch (error) {
      return done(error);
    }
  })
);

// Serialize user for session
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await storage.getUser(id);
    done(null, user || false);
  } catch (error) {
    done(error);
  }
});

// Helper function to hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Helper function to create a default admin user if none exists
export async function createDefaultUser(): Promise<void> {
  const storage = new DrizzleStorage();
  const existingUser = await storage.getUserByUsername('admin');
  
  if (!existingUser) {
    const hashedPassword = await hashPassword('admin');
    await storage.createUser({
      username: 'admin',
      password: hashedPassword,
    });
    console.log('✅ Default admin user created (username: admin, password: admin)');
  }
}

