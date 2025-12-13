import { Router, Request, Response } from 'express';
import { getDatabase } from '../services/dbService.js';
import { Asset, ImportConflict } from '../models/types.js';
import { parseOCRData } from '../services/parser.js';

const router = Router();
const db = getDatabase(process.env.DATABASE_PATH || './database/patrimonio.db');

// GET /api/assets - List all assets
router.get('/', (req: Request, res: Response) => {
  try {
    const assets = db.getAllAssets();
    res.json(assets);
  } catch (error) {
    console.error('Error fetching assets:', error);
    res.status(500).json({ error: 'Failed to fetch assets' });
  }
});

// GET /api/assets/:id - Get asset by ID
router.get('/:id', (req: Request, res: Response) => {
  try {
    const asset = db.getAssetById(req.params.id);
    if (!asset) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    res.json(asset);
  } catch (error) {
    console.error('Error fetching asset:', error);
    res.status(500).json({ error: 'Failed to fetch asset' });
  }
});

// POST /api/assets - Create new asset
router.post('/', (req: Request, res: Response) => {
  try {
    const asset: Asset = req.body;
    db.createAsset(asset);
    res.status(201).json(asset);
  } catch (error) {
    console.error('Error creating asset:', error);
    res.status(500).json({ error: 'Failed to create asset' });
  }
});

// PUT /api/assets/:id - Update asset
router.put('/:id', (req: Request, res: Response) => {
  try {
    const asset: Asset = { ...req.body, id: req.params.id };
    const existing = db.getAssetById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    db.updateAsset(asset);
    res.json(asset);
  } catch (error) {
    console.error('Error updating asset:', error);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

// DELETE /api/assets/:id - Delete asset
router.delete('/:id', (req: Request, res: Response) => {
  try {
    const existing = db.getAssetById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Asset not found' });
    }
    db.deleteAsset(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting asset:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

// POST /api/assets/import - Import assets from PDF text
router.post('/import', (req: Request, res: Response) => {
  try {
    const { pdfText } = req.body;
    
    if (!pdfText || typeof pdfText !== 'string') {
      return res.status(400).json({ error: 'pdfText is required' });
    }

    const incomingAssets = parseOCRData(pdfText);
    
    if (incomingAssets.length === 0) {
      return res.status(400).json({ error: 'No assets found in PDF text' });
    }

    // Get existing assets
    const currentAssets = db.getAllAssets();
    const currentAssetMap = new Map(currentAssets.map(a => [a.id, a]));

    const newRecords: Asset[] = [];
    const conflictRecords: ImportConflict[] = [];

    incomingAssets.forEach(incoming => {
      const existing = currentAssetMap.get(incoming.id);

      if (!existing) {
        newRecords.push(incoming);
      } else {
        const isLocationDifferent = existing.location !== incoming.location;
        const isValueDifferent = existing.value !== incoming.value;
        const isDescDifferent = existing.description !== incoming.description;

        if (isLocationDifferent || isValueDifferent || isDescDifferent) {
          conflictRecords.push({
            assetId: incoming.id,
            currentAsset: existing,
            incomingAsset: incoming,
            isResolved: false
          });
        }
      }
    });

    res.json({
      newAssets: newRecords,
      conflicts: conflictRecords
    });
  } catch (error) {
    console.error('Error importing assets:', error);
    res.status(500).json({ error: 'Failed to import assets' });
  }
});

// POST /api/assets/bulk-upsert - Bulk upsert assets (after conflict resolution)
router.post('/bulk-upsert', (req: Request, res: Response) => {
  try {
    const { assets } = req.body;
    
    if (!Array.isArray(assets)) {
      return res.status(400).json({ error: 'assets array is required' });
    }

    db.bulkUpsertAssets(assets);
    res.json({ success: true, count: assets.length });
  } catch (error) {
    console.error('Error bulk upserting assets:', error);
    res.status(500).json({ error: 'Failed to bulk upsert assets' });
  }
});

export default router;

