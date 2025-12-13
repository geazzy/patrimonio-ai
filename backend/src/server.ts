import app from './app.js';
import { getDatabase } from './services/dbService.js';
import dotenv from 'dotenv';

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

