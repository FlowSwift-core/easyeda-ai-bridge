/**
 * EasyEDA Bridge Server - SQLite Database Module
 */

import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'bridge.db');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;

export function initDatabase() {
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_id TEXT PRIMARY KEY,
      pair_code TEXT,
      status TEXT DEFAULT 'pending',
      verified_at INTEGER,
      created_at INTEGER,
      last_active INTEGER
    );

    CREATE TABLE IF NOT EXISTS commands (
      request_id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      code TEXT,
      result TEXT,
      error TEXT,
      status TEXT DEFAULT 'pending',
      created_at INTEGER,
      updated_at INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_commands_session ON commands(session_id, status);
    CREATE INDEX IF NOT EXISTS idx_commands_request ON commands(request_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_pair_code ON sessions(pair_code);
  `);

  console.log(`[DB] SQLite initialized at ${DB_PATH}`);
  return db;
}

export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Database closed');
  }
}
