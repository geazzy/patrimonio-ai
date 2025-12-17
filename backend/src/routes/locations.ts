import { Router, Request, Response } from 'express';
import { getDatabase } from '../services/dbService.js';
import { Asset } from '../models/types.js';

const router = Router();
const db = getDatabase(process.env.DATABASE_PATH || './database/patrimonio.db');

// POST /api/locations - Create a new location (dummy asset)
router.post('/', (req: Request, res: Response) => {
  try {
    const { name } = req.body as { name: string };
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Location name is required' });
    }

    const trimmedName = name.trim().toUpperCase();
    
    // Validate format
    const pattern = /^[A-Z0-9]{2,10}(-[A-Z0-9]{2,10})?$/;
    if (!pattern.test(trimmedName) || trimmedName.length < 3 || trimmedName.length > 10) {
      return res.status(400).json({ error: 'Invalid location format. Use format like "E-101" (uppercase, 3-10 characters)' });
    }

    // Check if location already exists (check if any asset has this location)
    const existingAssets = db.getAllAssets();
    if (existingAssets.some(a => a.location === trimmedName)) {
      return res.status(400).json({ error: 'This location already exists in the system' });
    }

    // Create a dummy asset to register the location
    const dummyAsset: Asset = {
      id: `LOC-${trimmedName}-${Date.now()}`,
      description: `Marcador de Local: ${trimmedName}`,
      value: 0,
      valueFormatted: 'R$ 0,00',
      termDate: new Date().toISOString(),
      location: trimmedName,
      responsible: 'SISTEMA',
      sector: 'ADMINISTRATIVA',
      category: 'Sistema',
      tags: ['Locação', 'Marcador do Sistema'],
      history: []
    };

    db.createAsset(dummyAsset);
    
    console.log(`[LOCATION] Created new location: ${trimmedName}`);
    res.status(201).json({ 
      success: true, 
      location: trimmedName,
      assetId: dummyAsset.id
    });
  } catch (error) {
    console.error('Error creating location:', error);
    res.status(500).json({ error: 'Failed to create location' });
  }
});

export default router;
