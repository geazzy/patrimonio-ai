import { Router, Request, Response } from 'express';
import { getDatabase } from '../services/dbService.js';
import { ConferenceRecord, Asset, ScannedItem } from '../models/types.js';

const router = Router();
const db = getDatabase(process.env.DATABASE_PATH || './database/patrimonio.db');

// GET /api/conferences - List all conferences
router.get('/', (req: Request, res: Response) => {
  try {
    const conferences = db.getAllConferences();
    res.json(conferences);
  } catch (error) {
    console.error('Error fetching conferences:', error);
    res.status(500).json({ error: 'Failed to fetch conferences' });
  }
});

// GET /api/conferences/:id - Get conference by ID
router.get('/:id', (req: Request, res: Response) => {
  try {
    const conference = db.getConferenceById(req.params.id);
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }
    res.json(conference);
  } catch (error) {
    console.error('Error fetching conference:', error);
    res.status(500).json({ error: 'Failed to fetch conference' });
  }
});

// POST /api/conferences - Create new conference record
router.post('/', (req: Request, res: Response) => {
  try {
    const conference: ConferenceRecord = req.body;
    db.createConference(conference);
    res.status(201).json(conference);
  } catch (error) {
    console.error('Error creating conference:', error);
    res.status(500).json({ error: 'Failed to create conference' });
  }
});

// PUT /api/conferences/:id - Update existing conference (stats/snapshot/location/date)
router.put('/:id', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const existing = db.getConferenceById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Conference not found' });
    }

    const payload: ConferenceRecord = req.body;
    if (payload.id !== id) {
      return res.status(400).json({ error: 'ID mismatch between URL and payload' });
    }

    db.updateConference(payload);
    const updated = db.getConferenceById(id);
    res.json(updated);
  } catch (error) {
    console.error('Error updating conference:', error);
    res.status(500).json({ error: 'Failed to update conference' });
  }
});

// POST /api/conferences/:id/commit - Commit conference changes
router.post('/:id/commit', (req: Request, res: Response) => {
  try {
    const { newAssets, updates, summary, scannedItemsSnapshot } = req.body;
    
    // Process new assets
    if (newAssets && Array.isArray(newAssets) && newAssets.length > 0) {
      db.bulkUpsertAssets(newAssets);
    }

    // Process location updates (moves)
    if (updates && Array.isArray(updates)) {
      for (const update of updates) {
        const asset = db.getAssetById(update.id);
        if (asset && asset.location !== update.newLocation) {
          // Add movement history
          db.addMovementHistory(update.id, [{
            date: new Date().toLocaleDateString('pt-BR'),
            fromLocation: asset.location,
            toLocation: update.newLocation,
            authorizedBy: 'Conferência'
          }]);

          // Update asset location
          const updatedAsset = {
            ...asset,
            location: update.newLocation,
            history: [
              ...asset.history,
              {
                date: new Date().toLocaleDateString('pt-BR'),
                fromLocation: asset.location,
                toLocation: update.newLocation,
                authorizedBy: 'Conferência'
              }
            ]
          };
          db.updateAsset(updatedAsset);
        }
      }
    }

    // Update conference record with summary
    // Update conference record with new summary and snapshot (if provided)
    const conference = db.getConferenceById(req.params.id);
    if (conference && summary) {
      db.updateConferenceSummaryAndSnapshot(
        req.params.id,
        summary,
        scannedItemsSnapshot || conference.scannedItemsSnapshot
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error committing conference:', error);
    res.status(500).json({ error: 'Failed to commit conference' });
  }
});

export default router;

