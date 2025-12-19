import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { Asset, MovementHistory, ConferenceRecord, User, RefreshToken, ConferenceAppearance } from '../models/types.js';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DatabaseService {
  private db: Database.Database;

  constructor(dbPath: string) {
    // Ensure database directory exists
    // Convert relative paths to absolute
    const absolutePath = path.isAbsolute(dbPath) 
      ? dbPath 
      : path.resolve(process.cwd(), dbPath);
    
    const dbDir = path.dirname(absolutePath);
    try {
      mkdirSync(dbDir, { recursive: true });
    } catch (error) {
      // Directory might already exist
    }

    this.db = new Database(absolutePath);
    this.db.pragma('foreign_keys = ON');
    this.initializeTables();
  }

  private initializeTables(): void {
    // Create assets table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        value REAL NOT NULL,
        value_formatted TEXT,
        term_date TEXT,
        location TEXT NOT NULL,
        responsible TEXT,
        sector TEXT,
        category TEXT,
        tags TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create movement_history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS movement_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        asset_id TEXT NOT NULL,
        date TEXT NOT NULL,
        from_location TEXT NOT NULL,
        to_location TEXT NOT NULL,
        authorized_by TEXT,
        conference_id TEXT,
        action TEXT,
        decided_by TEXT,
        decision_date DATETIME,
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
        FOREIGN KEY (conference_id) REFERENCES conference_records(id) ON DELETE SET NULL
      )
    `);

    // Create conference_records table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conference_records (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        location TEXT NOT NULL,
        notes TEXT,
        stats_matches INTEGER DEFAULT 0,
        stats_aliens INTEGER DEFAULT 0,
        stats_new_items INTEGER DEFAULT 0,
        stats_missing INTEGER DEFAULT 0,
        scanned_items_snapshot TEXT,
        decisions_snapshot TEXT,
        status TEXT DEFAULT 'DRAFT',
        created_by TEXT NOT NULL,
        approved_by TEXT,
        approved_at DATETIME,
        rejected_by TEXT,
        rejection_reason TEXT,
        rejected_at DATETIME,
        last_modified_by TEXT NOT NULL,
        last_modified_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create conference_items table (normalized snapshot per item)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conference_items (
        id TEXT PRIMARY KEY,
        conference_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        status TEXT NOT NULL,
        expected_location TEXT,
        scanned_at TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conference_id) REFERENCES conference_records(id) ON DELETE CASCADE,
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
      )
    `);

    // Ensure columns exist in older databases (simple migration)
    const pragmaInfo = (table: string) => this.db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    const hasColumn = (cols: Array<{ name: string }>, name: string) => cols.some(c => c.name === name);

    // conference_records columns
    {
      const cols = pragmaInfo('conference_records');
      const addColumn = (sql: string) => { try { this.db.exec(sql); } catch { /* noop */ } };
      if (!hasColumn(cols, 'notes')) addColumn("ALTER TABLE conference_records ADD COLUMN notes TEXT");
      if (!hasColumn(cols, 'decisions_snapshot')) addColumn("ALTER TABLE conference_records ADD COLUMN decisions_snapshot TEXT");
      if (!hasColumn(cols, 'status')) addColumn("ALTER TABLE conference_records ADD COLUMN status TEXT DEFAULT 'DRAFT'");
      if (!hasColumn(cols, 'created_by')) addColumn("ALTER TABLE conference_records ADD COLUMN created_by TEXT");
      if (!hasColumn(cols, 'approved_by')) addColumn("ALTER TABLE conference_records ADD COLUMN approved_by TEXT");
      if (!hasColumn(cols, 'approved_at')) addColumn("ALTER TABLE conference_records ADD COLUMN approved_at DATETIME");
      if (!hasColumn(cols, 'rejected_by')) addColumn("ALTER TABLE conference_records ADD COLUMN rejected_by TEXT");
      if (!hasColumn(cols, 'rejection_reason')) addColumn("ALTER TABLE conference_records ADD COLUMN rejection_reason TEXT");
      if (!hasColumn(cols, 'rejected_at')) addColumn("ALTER TABLE conference_records ADD COLUMN rejected_at DATETIME");
      if (!hasColumn(cols, 'last_modified_by')) addColumn("ALTER TABLE conference_records ADD COLUMN last_modified_by TEXT");
      if (!hasColumn(cols, 'last_modified_at')) addColumn("ALTER TABLE conference_records ADD COLUMN last_modified_at DATETIME");
    }

    // movement_history columns
    {
      const cols = pragmaInfo('movement_history');
      const addColumn = (sql: string) => { try { this.db.exec(sql); } catch { /* noop */ } };
      if (!hasColumn(cols, 'conference_id')) addColumn("ALTER TABLE movement_history ADD COLUMN conference_id TEXT");
      if (!hasColumn(cols, 'action')) addColumn("ALTER TABLE movement_history ADD COLUMN action TEXT");
      if (!hasColumn(cols, 'decided_by')) addColumn("ALTER TABLE movement_history ADD COLUMN decided_by TEXT");
      if (!hasColumn(cols, 'decision_date')) addColumn("ALTER TABLE movement_history ADD COLUMN decision_date DATETIME");
      if (!hasColumn(cols, 'reason')) addColumn("ALTER TABLE movement_history ADD COLUMN reason TEXT");
    }

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location);
      CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
      CREATE INDEX IF NOT EXISTS idx_movement_asset_id ON movement_history(asset_id);
      CREATE INDEX IF NOT EXISTS idx_conf_items_conf_id ON conference_items(conference_id);
      CREATE INDEX IF NOT EXISTS idx_conf_items_asset_id ON conference_items(asset_id);
    `);

    // Populate normalized conference_items for existing records (idempotent)
    this.migrateConferenceItemsFromSnapshots();

    // Create users table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        google_id TEXT UNIQUE NOT NULL,
        is_admin INTEGER DEFAULT 0,
        is_approved INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    // Create refresh_tokens table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_used_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Create indexes for auth tables
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
    `);
  }

  // Asset operations
  getAllAssets(): Asset[] {
    const stmt = this.db.prepare('SELECT * FROM assets');
    const assets = stmt.all() as any[];

    return assets.map(row => ({
      id: row.id,
      description: row.description,
      value: row.value,
      valueFormatted: row.value_formatted,
      termDate: row.term_date,
      location: row.location,
      responsible: row.responsible,
      sector: row.sector,
      category: row.category,
      tags: row.tags ? JSON.parse(row.tags) : [],
      history: this.getAssetHistory(row.id),
      conferenceHistory: this.getAssetConferenceHistory(row.id)
    }));
  }

  getAssetById(id: string): Asset | null {
    const stmt = this.db.prepare('SELECT * FROM assets WHERE id = ?');
    const row = stmt.get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      description: row.description,
      value: row.value,
      valueFormatted: row.value_formatted,
      termDate: row.term_date,
      location: row.location,
      responsible: row.responsible,
      sector: row.sector,
      category: row.category,
      tags: row.tags ? JSON.parse(row.tags) : [],
      history: this.getAssetHistory(row.id),
      conferenceHistory: this.getAssetConferenceHistory(row.id)
    };
  }

  createAsset(asset: Asset): void {
    const stmt = this.db.prepare(`
      INSERT INTO assets (id, description, value, value_formatted, term_date, location, responsible, sector, category, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      asset.id,
      asset.description,
      asset.value,
      asset.valueFormatted,
      asset.termDate,
      asset.location,
      asset.responsible,
      asset.sector,
      asset.category,
      JSON.stringify(asset.tags)
    );

    // Insert history entries
    if (asset.history && asset.history.length > 0) {
      this.addMovementHistory(asset.id, asset.history);
    }
  }

  updateAsset(asset: Asset): void {
    // Detect location changes to append movement history
    const existing = this.getAssetById(asset.id);

    const stmt = this.db.prepare(`
      UPDATE assets 
      SET description = ?, value = ?, value_formatted = ?, term_date = ?, 
          location = ?, responsible = ?, sector = ?, category = ?, tags = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    stmt.run(
      asset.description,
      asset.value,
      asset.valueFormatted,
      asset.termDate,
      asset.location,
      asset.responsible,
      asset.sector,
      asset.category,
      JSON.stringify(asset.tags),
      asset.id
    );

    // If location changed, insert a movement_history record
    if (existing && existing.location !== asset.location) {
      const lastAuth = asset.history && asset.history.length > 0 ? asset.history[asset.history.length - 1].authorizedBy : null;
      const authorizedBy = lastAuth || 'Não informado';
      const date = new Date().toISOString();

      const mhStmt = this.db.prepare(`
        INSERT INTO movement_history (asset_id, date, from_location, to_location, authorized_by)
        VALUES (?, ?, ?, ?, ?)
      `);
      mhStmt.run(asset.id, date, existing.location, asset.location, authorizedBy);
    }
  }

  deleteAsset(id: string): void {
    const stmt = this.db.prepare('DELETE FROM assets WHERE id = ?');
    stmt.run(id);
  }

  bulkUpsertAssets(assets: Asset[]): void {
    const insertStmt = this.db.prepare(`
      INSERT INTO assets (id, description, value, value_formatted, term_date, location, responsible, sector, category, tags)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        description = excluded.description,
        value = excluded.value,
        value_formatted = excluded.value_formatted,
        term_date = excluded.term_date,
        location = excluded.location,
        responsible = excluded.responsible,
        sector = excluded.sector,
        category = excluded.category,
        tags = excluded.tags,
        updated_at = CURRENT_TIMESTAMP
    `);

    const transaction = this.db.transaction((assets: Asset[]) => {
      for (const asset of assets) {
        insertStmt.run(
          asset.id,
          asset.description,
          asset.value,
          asset.valueFormatted,
          asset.termDate,
          asset.location,
          asset.responsible,
          asset.sector,
          asset.category,
          JSON.stringify(asset.tags)
        );

        if (asset.history && asset.history.length > 0) {
          this.addMovementHistory(asset.id, asset.history);
        }
      }
    });

    transaction(assets);
  }

  // Movement History operations
  getAssetHistory(assetId: string): MovementHistory[] {
    const stmt = this.db.prepare(`
      SELECT date, from_location as fromLocation, to_location as toLocation, authorized_by as authorizedBy
      FROM movement_history
      WHERE asset_id = ?
      ORDER BY created_at DESC
    `);
    return stmt.all(assetId) as MovementHistory[];
  }

  addMovementHistory(assetId: string, history: MovementHistory[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO movement_history (asset_id, date, from_location, to_location, authorized_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = this.db.transaction((history: MovementHistory[]) => {
      for (const entry of history) {
        stmt.run(
          assetId,
          entry.date,
          entry.fromLocation,
          entry.toLocation,
          entry.authorizedBy
        );
      }
    });

    transaction(history);
  }

  // Extended movement decision logging for admin approvals
  addMovementDecision(entry: {
    assetId: string;
    date: string;
    fromLocation: string;
    toLocation: string;
    authorizedBy: string;
    conferenceId: string;
    action: 'APPROVE' | 'REJECT';
    decidedBy: string;
    decisionDate: string;
    reason?: string;
  }): void {
    const stmt = this.db.prepare(`
      INSERT INTO movement_history (
        asset_id, date, from_location, to_location, authorized_by,
        conference_id, action, decided_by, decision_date, reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      entry.assetId,
      entry.date,
      entry.fromLocation,
      entry.toLocation,
      entry.authorizedBy,
      entry.conferenceId,
      entry.action,
      entry.decidedBy,
      entry.decisionDate,
      entry.reason || null
    );
  }

  // Conference operations
  getAllConferences(): ConferenceRecord[] {
    const stmt = this.db.prepare('SELECT * FROM conference_records ORDER BY created_at DESC');
    const records = stmt.all() as any[];

    return records.map(record => ({
      id: record.id,
      date: record.date,
      location: record.location,
      notes: record.notes || undefined,
      stats: {
        matches: record.stats_matches,
        aliens: record.stats_aliens,
        newItems: record.stats_new_items,
        missing: record.stats_missing
      },
      scannedItemsSnapshot: record.scanned_items_snapshot 
        ? JSON.parse(record.scanned_items_snapshot) 
        : [],
      decisionsSnapshot: record.decisions_snapshot
        ? JSON.parse(record.decisions_snapshot)
        : undefined,
      status: record.status || 'DRAFT',
      createdBy: record.created_by,
      approvedBy: record.approved_by,
      approvedAt: record.approved_at,
      rejectedBy: record.rejected_by,
      rejectionReason: record.rejection_reason,
      rejectedAt: record.rejected_at,
      lastModifiedBy: record.last_modified_by,
      lastModifiedAt: record.last_modified_at
    }));
  }

  getConferenceById(id: string): ConferenceRecord | null {
    const stmt = this.db.prepare('SELECT * FROM conference_records WHERE id = ?');
    const record = stmt.get(id) as any;

    if (!record) return null;

    return {
      id: record.id,
      date: record.date,
      location: record.location,
      notes: record.notes || undefined,
      stats: {
        matches: record.stats_matches,
        aliens: record.stats_aliens,
        newItems: record.stats_new_items,
        missing: record.stats_missing
      },
      scannedItemsSnapshot: record.scanned_items_snapshot 
        ? JSON.parse(record.scanned_items_snapshot) 
        : [],
      decisionsSnapshot: record.decisions_snapshot
        ? JSON.parse(record.decisions_snapshot)
        : undefined,
      status: record.status || 'DRAFT',
      createdBy: record.created_by,
      approvedBy: record.approved_by,
      approvedAt: record.approved_at,
      rejectedBy: record.rejected_by,
      rejectionReason: record.rejection_reason,
      rejectedAt: record.rejected_at,
      lastModifiedBy: record.last_modified_by,
      lastModifiedAt: record.last_modified_at
    };
  }

  createConference(conference: ConferenceRecord): void {
    const tx = this.db.transaction((payload: ConferenceRecord) => {
      const stmt = this.db.prepare(`
        INSERT INTO conference_records (id, date, location, notes, stats_matches, stats_aliens, stats_new_items, stats_missing, scanned_items_snapshot, decisions_snapshot, status, created_by, last_modified_by, last_modified_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        payload.id,
        payload.date,
        payload.location,
        payload.notes || null,
        payload.stats.matches,
        payload.stats.aliens,
        payload.stats.newItems,
        payload.stats.missing,
        JSON.stringify(payload.scannedItemsSnapshot),
        payload.decisionsSnapshot ? JSON.stringify(payload.decisionsSnapshot) : null,
        payload.status || 'DRAFT',
        payload.createdBy,
        payload.lastModifiedBy,
        new Date().toISOString()
      );

      this.syncConferenceItems(payload);
    });

    tx(conference);
  }

  updateConference(conference: ConferenceRecord): void {
    const updateTx = this.db.transaction((payload: ConferenceRecord) => {
      const stmt = this.db.prepare(`
        UPDATE conference_records
        SET 
          date = ?,
          location = ?,
          notes = ?,
          stats_matches = ?,
          stats_aliens = ?,
          stats_new_items = ?,
          stats_missing = ?,
          scanned_items_snapshot = ?,
          decisions_snapshot = ?,
          status = ?,
          approved_by = ?,
          approved_at = ?,
          rejected_by = ?,
          rejection_reason = ?,
          rejected_at = ?,
          last_modified_by = ?,
          last_modified_at = ?,
          created_at = created_at
        WHERE id = ?
      `);

      stmt.run(
        payload.date,
        payload.location,
        payload.notes || null,
        payload.stats.matches,
        payload.stats.aliens,
        payload.stats.newItems,
        payload.stats.missing,
        JSON.stringify(payload.scannedItemsSnapshot),
        payload.decisionsSnapshot ? JSON.stringify(payload.decisionsSnapshot) : null,
        payload.status || 'DRAFT',
        payload.approvedBy || null,
        payload.approvedAt || null,
        payload.rejectedBy || null,
        payload.rejectionReason || null,
        payload.rejectedAt || null,
        payload.lastModifiedBy,
        new Date().toISOString(),
        payload.id
      );

      this.syncConferenceItems(payload);
    });

    updateTx(conference);
  }

  updateConferenceSummaryAndSnapshot(
    id: string,
    summary: { matches: number; aliens: number; newItems: number; missing: number },
    scannedItemsSnapshot: any[]
  ): void {
    const tx = this.db.transaction(() => {
      const stmt = this.db.prepare(`
        UPDATE conference_records
        SET 
          stats_matches = ?,
          stats_aliens = ?,
          stats_new_items = ?,
          stats_missing = ?,
          scanned_items_snapshot = ?
        WHERE id = ?
      `);

      stmt.run(
        summary.matches,
        summary.aliens,
        summary.newItems,
        summary.missing,
        JSON.stringify(scannedItemsSnapshot || []),
        id
      );

      const existing = this.getConferenceById(id);
      if (existing) {
        this.syncConferenceItems(existing);
      }
    });

    tx();
  }

  close(): void {
    this.db.close();
  }

  deleteConference(id: string): void {
    const stmt = this.db.prepare('DELETE FROM conference_records WHERE id = ?');
    stmt.run(id);
  }

  private migrateConferenceItemsFromSnapshots(): void {
    // Idempotent population: if conference_items already has rows, skip
    const countStmt = this.db.prepare('SELECT COUNT(1) as cnt FROM conference_items');
    const { cnt } = countStmt.get() as { cnt: number };
    if (cnt > 0) return;

    const conferences = this.getAllConferences();
    const tx = this.db.transaction(() => {
      for (const conf of conferences) {
        this.syncConferenceItems(conf);
      }
    });
    tx();
  }

  private syncConferenceItems(conference: ConferenceRecord): void {
    const deleteStmt = this.db.prepare('DELETE FROM conference_items WHERE conference_id = ?');
    deleteStmt.run(conference.id);

    if (!conference.scannedItemsSnapshot || conference.scannedItemsSnapshot.length === 0) return;

    const insertStmt = this.db.prepare(`
      INSERT INTO conference_items (
        id, conference_id, asset_id, status, expected_location, scanned_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);

    const tx = this.db.transaction((items: any[]) => {
      for (const item of items) {
        // Only persist items that map to existing assets (MATCH/ALIEN)
        if (item.status === 'NEW') continue;

        insertStmt.run(
          crypto.randomUUID(),
          conference.id,
          item.id,
          item.status,
          item.expectedLocation || null,
          item.timestamp || conference.date
        );
      }
    });

    tx(conference.scannedItemsSnapshot || []);
  }

  private getAssetConferenceHistory(assetId: string): ConferenceAppearance[] {
    const stmt = this.db.prepare(`
      SELECT 
        ci.conference_id as conferenceId,
        ci.status as itemStatus,
        ci.expected_location as expectedLocation,
        ci.scanned_at as scannedAt,
        cr.date as conferenceDate,
        cr.location as conferenceLocation,
        cr.status as conferenceStatus
      FROM conference_items ci
      JOIN conference_records cr ON cr.id = ci.conference_id
      WHERE ci.asset_id = ?
      ORDER BY COALESCE(ci.scanned_at, cr.date) DESC
    `);

    return (stmt.all(assetId) as any[]).map(row => ({
      conferenceId: row.conferenceId,
      conferenceDate: row.conferenceDate,
      conferenceLocation: row.conferenceLocation,
      conferenceStatus: row.conferenceStatus,
      itemStatus: row.itemStatus,
      expectedLocation: row.expectedLocation || undefined,
      scannedAt: row.scannedAt || undefined
    }));
  }

  // User operations
  getUserByEmail(email: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE email = ?');
    const row = stmt.get(email) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      googleId: row.google_id,
      isAdmin: Boolean(row.is_admin),
      isApproved: Boolean(row.is_approved),
      createdAt: row.created_at,
      lastLogin: row.last_login
    };
  }

  getUserById(id: string): User | null {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    const row = stmt.get(id) as any;
    
    if (!row) return null;
    
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      googleId: row.google_id,
      isAdmin: Boolean(row.is_admin),
      isApproved: Boolean(row.is_approved),
      createdAt: row.created_at,
      lastLogin: row.last_login
    };
  }

  createOrUpdateUser(googleId: string, email: string, name: string): User {
    const existingUser = this.getUserByEmail(email);
    
    if (existingUser) {
      // Update last login
      const stmt = this.db.prepare(`
        UPDATE users 
        SET name = ?, google_id = ?, last_login = CURRENT_TIMESTAMP
        WHERE email = ?
      `);
      stmt.run(name, googleId, email);
      
      return this.getUserByEmail(email)!;
    } else {
      // Create new user (not approved by default)
      const id = crypto.randomUUID();
      const stmt = this.db.prepare(`
        INSERT INTO users (id, email, name, google_id, is_admin, is_approved, last_login)
        VALUES (?, ?, ?, ?, 0, 0, CURRENT_TIMESTAMP)
      `);
      stmt.run(id, email, name, googleId);
      
      return this.getUserById(id)!;
    }
  }

  listPendingUsers(): User[] {
    const stmt = this.db.prepare('SELECT * FROM users WHERE is_approved = 0 ORDER BY created_at DESC');
    const rows = stmt.all() as any[];
    
    return rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.name,
      googleId: row.google_id,
      isAdmin: Boolean(row.is_admin),
      isApproved: Boolean(row.is_approved),
      createdAt: row.created_at,
      lastLogin: row.last_login
    }));
  }

  approveUser(userId: string): void {
    const stmt = this.db.prepare('UPDATE users SET is_approved = 1 WHERE id = ?');
    stmt.run(userId);
  }

  revokeUser(userId: string): void {
    const stmt = this.db.prepare('UPDATE users SET is_approved = 0 WHERE id = ?');
    stmt.run(userId);
    // Also revoke all refresh tokens
    this.revokeAllUserTokens(userId);
  }

  promoteToAdmin(userId: string): void {
    const stmt = this.db.prepare('UPDATE users SET is_admin = 1 WHERE id = ?');
    stmt.run(userId);
  }

  // Refresh token operations
  createRefreshToken(userId: string, token: string, expiresAt: Date): RefreshToken {
    const id = crypto.randomUUID();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const stmt = this.db.prepare(`
      INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at)
      VALUES (?, ?, ?, ?)
    `);
    
    stmt.run(id, userId, tokenHash, expiresAt.toISOString());
    
    return {
      id,
      userId,
      tokenHash,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      lastUsedAt: null
    };
  }

  validateRefreshToken(token: string): RefreshToken | null {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    
    const stmt = this.db.prepare(`
      SELECT * FROM refresh_tokens 
      WHERE token_hash = ? AND expires_at > datetime('now')
    `);
    
    const row = stmt.get(tokenHash) as any;
    
    if (!row) return null;
    
    // Update last_used_at
    const updateStmt = this.db.prepare(`
      UPDATE refresh_tokens 
      SET last_used_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    updateStmt.run(row.id);
    
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      lastUsedAt: new Date().toISOString()
    };
  }

  revokeRefreshToken(token: string): void {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const stmt = this.db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?');
    stmt.run(tokenHash);
  }

  revokeAllUserTokens(userId: string): void {
    const stmt = this.db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?');
    stmt.run(userId);
  }
}

let dbInstance: DatabaseService | null = null;

export function getDatabase(dbPath: string): DatabaseService {
  if (!dbInstance) {
    dbInstance = new DatabaseService(dbPath);
  }
  return dbInstance;
}

export default DatabaseService;

