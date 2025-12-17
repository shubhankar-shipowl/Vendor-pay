import 'dotenv/config';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

// Get database configuration
function getDbConfig() {
  let host: string;
  let port: string;
  let database: string;
  let user: string;
  let password: string;

  if (process.env.DATABASE_URL) {
    const db_url = process.env.DATABASE_URL;
    if (db_url.startsWith('mysql://') || db_url.startsWith('mysql2://')) {
      const url = new URL(db_url);
      host = url.hostname;
      port = url.port || '3306';
      user = url.username;
      password = url.password;
      database = url.pathname.slice(1);
    } else {
      throw new Error('Invalid DATABASE_URL format');
    }
  } else {
    host = process.env.DB_HOST || '';
    port = process.env.DB_PORT || '3306';
    database = process.env.DB_NAME || '';
    user = process.env.DB_USER || '';
    password = process.env.DB_PASSWORD || '';
  }

  if (!host || !database || !user || !password) {
    throw new Error('Database configuration missing');
  }

  return { host, port, database, user, password };
}

// Create backups directory if it doesn't exist
async function ensureBackupDirectory(): Promise<string> {
  const backupDir = path.join(process.cwd(), 'backups');
  try {
    await fs.access(backupDir);
  } catch {
    await fs.mkdir(backupDir, { recursive: true });
    console.log(`📁 Created backups directory: ${backupDir}`);
  }
  return backupDir;
}

// Clean up old backups (keep last 30 days)
async function cleanupOldBackups(backupDir: string): Promise<void> {
  try {
    const files = await fs.readdir(backupDir);
    const backupFiles = files
      .filter(file => file.endsWith('.sql') || file.endsWith('.sql.gz'))
      .map(file => ({
        name: file,
        path: path.join(backupDir, file),
      }));

    // Get file stats and sort by modification time
    const filesWithStats = await Promise.all(
      backupFiles.map(async (file) => {
        const stats = await fs.stat(file.path);
        return {
          ...file,
          mtime: stats.mtime,
        };
      })
    );

    // Sort by modification time (newest first)
    filesWithStats.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Keep last 30 backups, delete the rest
    const filesToDelete = filesWithStats.slice(30);
    
    if (filesToDelete.length > 0) {
      console.log(`🧹 Cleaning up ${filesToDelete.length} old backup(s)...`);
      for (const file of filesToDelete) {
        await fs.unlink(file.path);
        console.log(`   ✅ Deleted: ${file.name}`);
      }
    }
  } catch (error: any) {
    console.error('⚠️ Error cleaning up old backups:', error.message);
  }
}

// Perform database backup
export async function performBackup(): Promise<void> {
  try {
    console.log('🔄 Starting database backup...');
    const { host, port, database, user, password } = getDbConfig();

    // Ensure backup directory exists
    const backupDir = await ensureBackupDirectory();

    // Generate backup filename with timestamp (IST)
    const now = new Date();
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const istTime = new Date(now.getTime() + istOffset);
    const timestamp = istTime.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFileName = `backup_${database}_${timestamp}.sql`;
    const backupPath = path.join(backupDir, backupFileName);

    // Build mysqldump command
    // Escape password for shell command
    const escapedPassword = password.replace(/'/g, "'\\''");
    const mysqldumpCmd = `mysqldump -h ${host} -P ${port} -u ${user} -p'${escapedPassword}' ${database} > ${backupPath}`;

    console.log(`📦 Creating backup: ${backupFileName}`);
    console.log(`   Database: ${database}`);
    console.log(`   Host: ${host}:${port}`);

    // Execute mysqldump
    const { stdout, stderr } = await execAsync(mysqldumpCmd);

    if (stderr && !stderr.includes('Warning: Using a password')) {
      console.error('⚠️ mysqldump warning:', stderr);
    }

    // Check if backup file was created and has content
    const stats = await fs.stat(backupPath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    if (stats.size === 0) {
      throw new Error('Backup file is empty');
    }

    console.log(`✅ Backup completed successfully!`);
    console.log(`   File: ${backupFileName}`);
    console.log(`   Size: ${fileSizeMB} MB`);
    console.log(`   Path: ${backupPath}`);

    // Clean up old backups
    await cleanupOldBackups(backupDir);

  } catch (error: any) {
    console.error('❌ Database backup failed:', error.message);
    if (error.code === 'ENOENT') {
      console.error('   ⚠️ mysqldump command not found. Please install MySQL client tools.');
      console.error('   On Ubuntu/Debian: sudo apt-get install mysql-client');
      console.error('   On macOS: brew install mysql-client');
    }
    throw error;
  }
}

