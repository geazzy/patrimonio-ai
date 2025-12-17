export interface MovementHistory {
  date: string;
  fromLocation: string;
  toLocation: string;
  authorizedBy: string;
  rejected?: boolean;
  rejectionReason?: string;
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

export interface DashboardStats {
  totalAssets: number;
  totalValue: number;
  assetsByLocation: { name: string; value: number }[];
  assetsByCategory: { name: string; value: number }[];
  topAssets: Asset[];
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  LIST = 'LIST',
  AI_CHAT = 'AI_CHAT',
  CONFERENCE = 'CONFERENCE',
  ASSET_DETAIL = 'ASSET_DETAIL', // Individual asset view
  ADMIN = 'ADMIN' // Admin panel
}

// Conference Specific Types
export type ScanStatus = 'MATCH' | 'ALIEN' | 'NEW';

export interface ScannedItem {
  id: string;
  status: ScanStatus;
  description: string; // From DB or user input
  expectedLocation?: string; // If ALIEN
  timestamp: Date;
  isResolved?: boolean; // For report processing
}

export interface ConferenceSession {
  targetLocation: string;
  scannedItems: ScannedItem[];
  startTime: Date;
  stage: 'SETUP' | 'SCANNING' | 'REPORT';
  conferenceId?: string;
}

export interface ConferenceRecord {
  id: string;
  date: string;
  location: string;
  stats: {
    matches: number;
    aliens: number;
    newItems: number;
    missing: number;
  };
  scannedItemsSnapshot: ScannedItem[];
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
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

// Auth types
export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  isApproved: boolean;
}

export interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}