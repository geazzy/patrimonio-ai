import app from './app.js';
import { getDatabase } from './services/dbService.js';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const PORT = process.env.PORT || 3001;
const DATABASE_PATH = process.env.DATABASE_PATH || './database/patrimonio.db';

// Initialize database
try {
  const db = getDatabase(DATABASE_PATH);
  console.log('Database initialized successfully');
  
  // Test database connection
  db.getAllAssets();
  console.log('Database connection verified');

  // Seed admin user
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    const existingAdmin = db.getUserByEmail(adminEmail);
    
    if (!existingAdmin) {
      // Create admin user with fake Google ID (will be updated on first login)
      const adminId = crypto.randomUUID();
      const fakeGoogleId = `admin-${crypto.randomUUID()}`;
      
      // We can't use createOrUpdateUser directly, so we'll use a custom query
      // Create admin manually with is_admin=1 and is_approved=1
      const adminUser = db.createOrUpdateUser(
        fakeGoogleId,
        adminEmail,
        'Admin User'
      );
      
      // Promote to admin and approve
      db.promoteToAdmin(adminUser.id);
      db.approveUser(adminUser.id);
      
      console.log(`✅ Admin user created: ${adminEmail}`);
    } else {
      // Ensure existing user is admin and approved
      if (!existingAdmin.isAdmin) {
        db.promoteToAdmin(existingAdmin.id);
        console.log(`✅ User ${adminEmail} promoted to admin`);
      }
      if (!existingAdmin.isApproved) {
        db.approveUser(existingAdmin.id);
        console.log(`✅ User ${adminEmail} approved`);
      }
      console.log(`ℹ️  Admin user already exists: ${adminEmail}`);
    }
  } else {
    console.warn('⚠️  ADMIN_EMAIL not set in environment variables. No admin user created.');
  }
} catch (error) {
  console.error('Failed to initialize database:', error);
  process.exit(1);
}

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

