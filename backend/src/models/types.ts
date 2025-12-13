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

export type ScanStatus = 'MATCH' | 'ALIEN' | 'NEW';

export interface ScannedItem {
  id: string;
  status: ScanStatus;
  description: string;
  expectedLocation?: string;
  timestamp: string; // ISO string for serialization
  isResolved?: boolean;
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

