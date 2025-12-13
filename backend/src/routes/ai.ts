import { Router, Request, Response } from 'express';
import { getDatabase } from '../services/dbService.js';
import { askGeminiAboutAssets } from '../services/geminiService.js';

const router = Router();
const db = getDatabase(process.env.DATABASE_PATH || './database/patrimonio.db');

// POST /api/ai/query - Query Gemini AI with asset context
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, assetIds } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'query is required' });
    }

    // Get assets - either specific ones by ID or all assets
    let assets;
    if (assetIds && Array.isArray(assetIds) && assetIds.length > 0) {
      assets = assetIds
        .map((id: string) => db.getAssetById(id))
        .filter((asset: any) => asset !== null);
    } else {
      assets = db.getAllAssets();
    }

    if (assets.length === 0) {
      return res.status(404).json({ error: 'No assets found' });
    }

    const response = await askGeminiAboutAssets(query, assets);
    res.json({ response });
  } catch (error) {
    console.error('Error querying AI:', error);
    res.status(500).json({ error: 'Failed to query AI' });
  }
});

export default router;

