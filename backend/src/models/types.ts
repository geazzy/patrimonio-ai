export interface MovementHistory {
  date: string;
  fromLocation: string;
  toLocation: string;
  authorizedBy: string;
  rejected?: boolean;
  rejectionReason?: string;
}

export interface ConferenceAppearance {
  conferenceId: string;
  conferenceDate: string;
  conferenceLocation: string;
  conferenceStatus: ConferenceStatus;
  itemStatus: ScanStatus;
  expectedLocation?: string;
  scannedAt?: string;
}

export interface Asset {
  id: string; // Tombo
  description: string;
  value: number;
  valueFormatted: string;
  termDate: string;
  location: string;
  responsible: string;
  sector: string;
  category: string;
  tags: string[];
  history: MovementHistory[];
  conferenceHistory?: ConferenceAppearance[];
}

export interface ImportConflict {
  assetId: string;
  currentAsset: Asset;
  incomingAsset: Asset;
  isResolved: boolean;
  resolution?: 'current' | 'incoming';
}

export interface ImportSessionData {
  newAssets: Asset[];
  conflicts: ImportConflict[];
  fileName: string;
}

export type ScanStatus = 'MATCH' | 'ALIEN' | 'NEW';

export interface ScannedItem {
  id: string;
  status: ScanStatus;
  description: string;
  expectedLocation?: string;
  timestamp: string; // ISO string for serialization
  isResolved?: boolean;
}

export type ConferenceStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface ConferenceRecord {
  id: string;
  date: string;
  location: string;
  notes?: string;
  stats: {
    matches: number;
    aliens: number;
    newItems: number;
    missing: number;
  };
  scannedItemsSnapshot: ScannedItem[];
  status: ConferenceStatus;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  decisionsSnapshot?: Array<{
    id: string;
    type: 'ALIEN' | 'NEW';
    decision: 'APPROVE' | 'REJECT';
    newLocation?: string;
    reason?: string;
  }>;
}

// Authentication types
export interface User {
  id: string;
  email: string;
  name: string;
  googleId: string;
  isAdmin: boolean;
  isApproved: boolean;
  createdAt: string;
  lastLogin: string | null;
}

export interface RefreshToken {
  id: string;
  userId: string;
  tokenHash: string; // SHA-256 hash
  expiresAt: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  isApproved: boolean;
}

