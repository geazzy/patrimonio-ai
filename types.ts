export interface MovementHistory {
  date: string;
  fromLocation: string;
  toLocation: string;
  authorizedBy: string;
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
  CONFERENCE = 'CONFERENCE' // New mode
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
}