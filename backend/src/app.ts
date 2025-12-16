import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import assetsRouter from './routes/assets.js';
import conferencesRouter from './routes/conferences.js';
import aiRouter from './routes/ai.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import { requireAuth } from './middleware/auth.js';
import { apiLimiter } from './middleware/rateLimiter.js';

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

// Cookie parser middleware
app.use(cookieParser());

// Create main router for /patrimonio prefix
const patrimonioRouter = express.Router();

// Global rate limiter para API (considera o prefixo /patrimonio)
patrimonioRouter.use('/api', apiLimiter);

// Health check endpoint (public)
patrimonioRouter.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth routes (public)
patrimonioRouter.use('/api/auth', authRouter);

// Protected API routes (require authentication)
patrimonioRouter.use('/api/assets', requireAuth, assetsRouter);
patrimonioRouter.use('/api/conferences', requireAuth, conferencesRouter);
patrimonioRouter.use('/api/ai', requireAuth, aiRouter);

// Admin routes (require authentication + admin role)
patrimonioRouter.use('/api/admin', adminRouter);

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

