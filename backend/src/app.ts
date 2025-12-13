import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import assetsRouter from './routes/assets.js';
import conferencesRouter from './routes/conferences.js';
import aiRouter from './routes/ai.js';

dotenv.config();

const app: Express = express();

// CORS configuration
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
app.use(cors({
  origin: frontendUrl,
  credentials: true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create main router for /patrimonio prefix
const patrimonioRouter = express.Router();

// Health check endpoint
patrimonioRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
patrimonioRouter.use('/api/assets', assetsRouter);
patrimonioRouter.use('/api/conferences', conferencesRouter);
patrimonioRouter.use('/api/ai', aiRouter);

// Mount all routes under /patrimonio prefix
app.use('/patrimonio', patrimonioRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;

