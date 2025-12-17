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
// Submit conference for admin approval (no asset changes here)
router.post('/:id/commit', (req: Request, res: Response) => {
  try {
    const { summary, scannedItemsSnapshot, submittedBy } = req.body;
    const id = req.params.id;
    const conference = db.getConferenceById(id);
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }

    db.updateConference({
      ...conference,
      stats: summary || conference.stats,
      scannedItemsSnapshot: scannedItemsSnapshot || conference.scannedItemsSnapshot,
      status: 'PENDING_APPROVAL',
      lastModifiedBy: submittedBy || conference.lastModifiedBy || conference.createdBy,
      lastModifiedAt: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error submitting conference for approval:', error);
    res.status(500).json({ error: 'Failed to submit conference' });
  }
});

// Admin approval of conference decisions
router.post('/:id/approve', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { decisions, decidedBy } = req.body as {
      decisions: Array<{ id: string; type: 'ALIEN' | 'NEW'; decision: 'APPROVE' | 'REJECT'; newLocation?: string; reason?: string }>;
      decidedBy: string;
    };

    const conference = db.getConferenceById(id);
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }

    const targetLocation = conference.location;
    const decisionsSnapshot: any[] = [];
    const summaryLog = { approved: 0, rejected: 0, errors: [] };

    for (const d of decisions || []) {
      decisionsSnapshot.push(d);
      
      if (d.type === 'NEW') {
        if (d.decision === 'APPROVE') {
          // Create a new asset
          const newAsset = {
            id: d.id,
            description: (conference.scannedItemsSnapshot.find(i => i.id === d.id)?.description) || 'Item da Conferência',
            value: 0,
            valueFormatted: 'R$ 0,00',
            termDate: new Date().toISOString(),
            location: targetLocation,
            responsible: 'A DEFINIR',
            sector: 'A DEFINIR',
            category: 'Outros',
            tags: ['Encontrado na Conferência'],
            history: []
          } as Asset;
          db.createAsset(newAsset);
          summaryLog.approved++;
          console.log(`[APPROVE] Created NEW asset: ${d.id} at ${targetLocation}`);
        } else {
          // Rejection for NEW: no asset created, capture reason in decisions_snapshot
          summaryLog.rejected++;
          console.log(`[REJECT] Rejected NEW item: ${d.id} - Reason: ${d.reason || 'sem motivo'}`);
          continue;
        }
      } else if (d.type === 'ALIEN') {
        const asset = db.getAssetById(d.id);
        if (!asset) {
          summaryLog.errors.push(`Asset ${d.id} not found`);
          continue;
        }
        const toLocation = d.newLocation || targetLocation;

        if (d.decision === 'APPROVE') {
          // Log decision with conference reference
          db.addMovementDecision({
            assetId: d.id,
            date: new Date().toISOString(),
            fromLocation: asset.location,
            toLocation,
            authorizedBy: decidedBy,
            conferenceId: id,
            action: 'APPROVE',
            decidedBy,
            decisionDate: new Date().toISOString(),
            reason: null
          });
          // Update asset location
          db.updateAsset({
            ...asset,
            location: toLocation,
            history: [
              ...asset.history,
              {
                date: new Date().toISOString(),
                fromLocation: asset.location,
                toLocation,
                authorizedBy: decidedBy
              }
            ]
          });
          summaryLog.approved++;
          console.log(`[APPROVE] Moved ALIEN asset: ${d.id} from ${asset.location} to ${toLocation}`);
        } else {
          // Log rejection decision (no location change)
          db.addMovementDecision({
            assetId: d.id,
            date: new Date().toISOString(),
            fromLocation: asset.location,
            toLocation: asset.location, // Remains in same location
            authorizedBy: decidedBy,
            conferenceId: id,
            action: 'REJECT',
            decidedBy,
            decisionDate: new Date().toISOString(),
            reason: d.reason || 'Sem motivo informado'
          });
          // Add rejection to asset history (no location change)
          db.updateAsset({
            ...asset,
            history: [
              ...asset.history,
              {
                date: new Date().toISOString(),
                fromLocation: asset.location,
                toLocation: asset.location, // Remains in same location
                authorizedBy: decidedBy,
                rejected: true,
                rejectionReason: d.reason || 'Sem motivo informado'
              }
            ]
          });
          // Do not update asset location
          summaryLog.rejected++;
          console.log(`[REJECT] Rejected ALIEN item: ${d.id} - Reason: ${d.reason || 'sem motivo'}`);
        }
      }
    }

    // Update conference record to APPROVED and store decisions snapshot
    db.updateConference({
      ...conference,
      decisionsSnapshot,
      status: 'APPROVED',
      approvedBy: decidedBy,
      approvedAt: new Date().toISOString(),
      lastModifiedBy: decidedBy,
      lastModifiedAt: new Date().toISOString()
    });

    console.log(`[CONFERENCE] ${id} approved by ${decidedBy}:`, summaryLog);
    res.json({ success: true, summary: summaryLog });
  } catch (error) {
    console.error('Error approving conference:', error);
    res.status(500).json({ error: 'Failed to approve conference' });
  }
});

// Admin rejects the entire conference, sending back to DRAFT
router.post('/:id/reject', (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const { reason, decidedBy } = req.body as { reason: string; decidedBy: string };
    const conference = db.getConferenceById(id);
    if (!conference) {
      return res.status(404).json({ error: 'Conference not found' });
    }

    db.updateConference({
      ...conference,
      status: 'DRAFT',
      rejectedBy: decidedBy,
      rejectedAt: new Date().toISOString(),
      rejectionReason: reason,
      lastModifiedBy: decidedBy,
      lastModifiedAt: new Date().toISOString()
    });

    res.json({ success: true });
  } catch (error) {
    console.error('Error rejecting conference:', error);
    res.status(500).json({ error: 'Failed to reject conference' });
  }
});

export default router;

