const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Asset {
  id: string;
  description: string;
  value: number;
  valueFormatted: string;
  termDate: string;
  location: string;
  responsible: string;
  sector: string;
  category: string;
  tags: string[];
  history: Array<{
    date: string;
    fromLocation: string;
    toLocation: string;
    authorizedBy: string;
  }>;
}

export interface ImportConflict {
  assetId: string;
  currentAsset: Asset;
  incomingAsset: Asset;
  isResolved: boolean;
  resolution?: 'current' | 'incoming';
}

export interface ImportResponse {
  newAssets: Asset[];
  conflicts: ImportConflict[];
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
  scannedItemsSnapshot: any[];
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// Asset operations
export const apiService = {
  // Get all assets
  async getAssets(): Promise<Asset[]> {
    const response = await fetch(`${API_URL}/api/assets`);
    return handleResponse<Asset[]>(response);
  },

  // Get asset by ID
  async getAsset(id: string): Promise<Asset> {
    const response = await fetch(`${API_URL}/api/assets/${id}`);
    return handleResponse<Asset>(response);
  },

  // Create new asset
  async createAsset(asset: Asset): Promise<Asset> {
    const response = await fetch(`${API_URL}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(asset)
    });
    return handleResponse<Asset>(response);
  },

  // Update asset
  async updateAsset(id: string, asset: Partial<Asset>): Promise<Asset> {
    const response = await fetch(`${API_URL}/api/assets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...asset, id })
    });
    return handleResponse<Asset>(response);
  },

  // Delete asset
  async deleteAsset(id: string): Promise<void> {
    const response = await fetch(`${API_URL}/api/assets/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
  },

  // Import assets from PDF text
  async importAssets(pdfText: string): Promise<ImportResponse> {
    const response = await fetch(`${API_URL}/api/assets/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdfText })
    });
    return handleResponse<ImportResponse>(response);
  },

  // Bulk upsert assets (after conflict resolution)
  async bulkUpsertAssets(assets: Asset[]): Promise<{ success: boolean; count: number }> {
    const response = await fetch(`${API_URL}/api/assets/bulk-upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assets })
    });
    return handleResponse<{ success: boolean; count: number }>(response);
  },

  // Conference operations
  async getConferences(): Promise<ConferenceRecord[]> {
    const response = await fetch(`${API_URL}/api/conferences`);
    return handleResponse<ConferenceRecord[]>(response);
  },

  async getConference(id: string): Promise<ConferenceRecord> {
    const response = await fetch(`${API_URL}/api/conferences/${id}`);
    return handleResponse<ConferenceRecord>(response);
  },

  async createConference(conference: ConferenceRecord): Promise<ConferenceRecord> {
    const response = await fetch(`${API_URL}/api/conferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(conference)
    });
    return handleResponse<ConferenceRecord>(response);
  },

  async commitConference(
    id: string,
    data: {
      newAssets: Asset[];
      updates: Array<{ id: string; newLocation: string }>;
      summary: { matches: number; aliens: number; newItems: number; missing: number };
    }
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${API_URL}/api/conferences/${id}/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse<{ success: boolean }>(response);
  },

  // AI operations
  async queryAI(query: string, assetIds?: string[]): Promise<{ response: string }> {
    const response = await fetch(`${API_URL}/api/ai/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, assetIds })
    });
    return handleResponse<{ response: string }>(response);
  }
};

export default apiService;

