import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import { Asset, MovementHistory, ConferenceRecord } from '../models/types.js';

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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
      )
    `);

    // Create conference_records table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS conference_records (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        location TEXT NOT NULL,
        stats_matches INTEGER DEFAULT 0,
        stats_aliens INTEGER DEFAULT 0,
        stats_new_items INTEGER DEFAULT 0,
        stats_missing INTEGER DEFAULT 0,
        scanned_items_snapshot TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_assets_location ON assets(location);
      CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
      CREATE INDEX IF NOT EXISTS idx_movement_asset_id ON movement_history(asset_id);
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
      history: this.getAssetHistory(row.id)
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
      history: this.getAssetHistory(row.id)
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

  // Conference operations
  getAllConferences(): ConferenceRecord[] {
    const stmt = this.db.prepare('SELECT * FROM conference_records ORDER BY created_at DESC');
    const records = stmt.all() as any[];

    return records.map(record => ({
      id: record.id,
      date: record.date,
      location: record.location,
      stats: {
        matches: record.stats_matches,
        aliens: record.stats_aliens,
        newItems: record.stats_new_items,
        missing: record.stats_missing
      },
      scannedItemsSnapshot: record.scanned_items_snapshot 
        ? JSON.parse(record.scanned_items_snapshot) 
        : []
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
      stats: {
        matches: record.stats_matches,
        aliens: record.stats_aliens,
        newItems: record.stats_new_items,
        missing: record.stats_missing
      },
      scannedItemsSnapshot: record.scanned_items_snapshot 
        ? JSON.parse(record.scanned_items_snapshot) 
        : []
    };
  }

  createConference(conference: ConferenceRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO conference_records (id, date, location, stats_matches, stats_aliens, stats_new_items, stats_missing, scanned_items_snapshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      conference.id,
      conference.date,
      conference.location,
      conference.stats.matches,
      conference.stats.aliens,
      conference.stats.newItems,
      conference.stats.missing,
      JSON.stringify(conference.scannedItemsSnapshot)
    );
  }

  close(): void {
    this.db.close();
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

