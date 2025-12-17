const API_URL = import.meta.env.VITE_API_URL || '';
const API_PREFIX = import.meta.env.VITE_API_URL ? '/patrimonio' : '/patrimonio';

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
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectedBy?: string;
  rejectionReason?: string;
  rejectedAt?: string;
  lastModifiedBy: string;
  lastModifiedAt: string;
  decisionsSnapshot?: Array<{ id: string; type: 'ALIEN' | 'NEW'; decision: 'APPROVE' | 'REJECT'; newLocation?: string; reason?: string }>;
}

export interface User {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  isApproved: boolean;
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
  // Auth operations
  async loginWithGoogle(credential: string): Promise<{ user: User }> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ credential })
    });
    return handleResponse<{ user: User }>(response);
  },

  async getMe(): Promise<{ user: User }> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/auth/me`, {
      credentials: 'include'
    });
    return handleResponse<{ user: User }>(response);
  },

  async refresh(): Promise<{ user: User }> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/auth/refresh`, {
      method: 'POST',
      credentials: 'include'
    });
    return handleResponse<{ user: User }>(response);
  },

  async logout(): Promise<void> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include'
    });
    await handleResponse<{ message: string }>(response);
  },

  async logoutAll(): Promise<void> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/auth/logout-all`, {
      method: 'POST',
      credentials: 'include'
    });
    await handleResponse<{ message: string }>(response);
  },

  // Admin operations
  async getPendingUsers(): Promise<{ users: User[] }> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/admin/pending-users`, {
      credentials: 'include'
    });
    return handleResponse<{ users: User[] }>(response);
  },

  async approveUser(userId: string): Promise<{ user: User }> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/admin/approve/${userId}`, {
      method: 'POST',
      credentials: 'include'
    });
    return handleResponse<{ user: User }>(response);
  },

  async revokeUser(userId: string): Promise<{ user: User }> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/admin/revoke/${userId}`, {
      method: 'POST',
      credentials: 'include'
    });
    return handleResponse<{ user: User }>(response);
  },

  async promoteUser(userId: string): Promise<{ user: User }> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/admin/promote/${userId}`, {
      method: 'POST',
      credentials: 'include'
    });
    return handleResponse<{ user: User }>(response);
  },

  // Get all assets
  async getAssets(): Promise<Asset[]> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/assets`, {
      credentials: 'include'
    });
    return handleResponse<Asset[]>(response);
  },

  // Get asset by ID
  async getAsset(id: string): Promise<Asset> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/assets/${id}`, {
      credentials: 'include'
    });
    return handleResponse<Asset>(response);
  },

  // Create new asset
  async createAsset(asset: Asset): Promise<Asset> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/assets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(asset)
    });
    return handleResponse<Asset>(response);
  },

  // Update asset
  async updateAsset(id: string, asset: Partial<Asset>): Promise<Asset> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/assets/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...asset, id })
    });
    return handleResponse<Asset>(response);
  },

  // Delete asset
  async deleteAsset(id: string): Promise<void> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/assets/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
  },

  // Import assets from PDF text
  async importAssets(pdfText: string): Promise<ImportResponse> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/assets/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ pdfText })
    });
    return handleResponse<ImportResponse>(response);
  },

  // Bulk upsert assets (after conflict resolution)
  async bulkUpsertAssets(assets: Asset[]): Promise<{ success: boolean; count: number }> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/assets/bulk-upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ assets })
    });
    return handleResponse<{ success: boolean; count: number }>(response);
  },

  // Conference operations
  async getConferences(): Promise<ConferenceRecord[]> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/conferences`, {
      credentials: 'include'
    });
    return handleResponse<ConferenceRecord[]>(response);
  },

  async getConference(id: string): Promise<ConferenceRecord> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/conferences/${id}`, {
      credentials: 'include'
    });
    return handleResponse<ConferenceRecord>(response);
  },

  async createConference(conference: ConferenceRecord): Promise<ConferenceRecord> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/conferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(conference)
    });
    return handleResponse<ConferenceRecord>(response);
  },

  async updateConference(conference: ConferenceRecord): Promise<ConferenceRecord> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/conferences/${conference.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(conference)
    });
    return handleResponse<ConferenceRecord>(response);
  },

  async submitConference(
    id: string,
    data: {
      summary: { matches: number; aliens: number; newItems: number; missing: number };
      scannedItemsSnapshot?: any[];
      submittedBy: string;
    }
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/conferences/${id}/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data)
    });
    return handleResponse<{ success: boolean }>(response);
  },

  async approveConference(
    id: string,
    payload: { decisions: Array<{ id: string; type: 'ALIEN' | 'NEW'; decision: 'APPROVE' | 'REJECT'; newLocation?: string; reason?: string }>; decidedBy: string }
  ): Promise<{ success: boolean }> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/conferences/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    return handleResponse<{ success: boolean }>(response);
  },

  async rejectConference(id: string, payload: { reason: string; decidedBy: string }): Promise<{ success: boolean }> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/conferences/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(payload)
    });
    return handleResponse<{ success: boolean }>(response);
  },

  // Locations
  async createLocation(name: string): Promise<{ success: boolean; location: string; assetId: string }> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name })
    });
    return handleResponse<{ success: boolean; location: string; assetId: string }>(response);
  },

  // AI operations
  async queryAI(query: string, assetIds?: string[]): Promise<{ response: string }> {
    const response = await fetch(`${API_URL}${API_PREFIX}/api/ai/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ query, assetIds })
    });
    return handleResponse<{ response: string }>(response);
  }
};

export default apiService;

