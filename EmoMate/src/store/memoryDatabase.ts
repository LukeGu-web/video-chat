import * as SQLite from 'expo-sqlite';
import { Episode, Fact, FactImportance } from '../types/memory';
import { debugLog, debugWarn } from '../utils/debug';

const DB_NAME = 'memory.db';

let db: SQLite.SQLiteDatabase | null = null;

// Open database and create tables if they don't exist
export function getDatabase(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync(DB_NAME);
    initializeSchema(db);
  }
  return db;
}

function initializeSchema(database: SQLite.SQLiteDatabase): void {
  database.execSync(`
    CREATE TABLE IF NOT EXISTS episodes (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp    INTEGER NOT NULL,
      summary      TEXT NOT NULL,
      topics       TEXT NOT NULL DEFAULT '[]',
      user_emotion TEXT NOT NULL DEFAULT 'neutral',
      key_events   TEXT NOT NULL DEFAULT '[]',
      last_words   TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS facts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at  INTEGER NOT NULL,
      updated_at  INTEGER,
      category    TEXT NOT NULL,
      entity      TEXT,
      content     TEXT NOT NULL,
      tags        TEXT NOT NULL DEFAULT '[]',
      importance  TEXT NOT NULL DEFAULT 'normal',
      expires_at  INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_episodes_timestamp ON episodes(timestamp DESC);
    CREATE INDEX IF NOT EXISTS idx_facts_importance ON facts(importance);
    CREATE INDEX IF NOT EXISTS idx_facts_expires ON facts(expires_at);
  `);
  debugLog('memoryDatabase', 'Schema initialized');
}

// Episodes
export function insertEpisode(episode: Omit<Episode, 'id'>): void {
  const database = getDatabase();
  database.runSync(
    `INSERT INTO episodes (timestamp, summary, topics, user_emotion, key_events, last_words)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      episode.timestamp,
      episode.summary,
      JSON.stringify(episode.topics),
      episode.userEmotion,
      JSON.stringify(episode.keyEvents),
      episode.lastWords,
    ]
  );
}

export function getRecentEpisodes(limit: number = 5): Episode[] {
  const database = getDatabase();
  const rows = database.getAllSync<{
    id: number;
    timestamp: number;
    summary: string;
    topics: string;
    user_emotion: string;
    key_events: string;
    last_words: string;
  }>(`SELECT * FROM episodes ORDER BY timestamp DESC LIMIT ?`, [limit]);

  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    summary: row.summary,
    topics: JSON.parse(row.topics),
    userEmotion: row.user_emotion,
    keyEvents: JSON.parse(row.key_events),
    lastWords: row.last_words,
  }));
}

// Facts
export function insertFact(fact: Omit<Fact, 'id' | 'updatedAt'>): void {
  const database = getDatabase();
  database.runSync(
    `INSERT INTO facts (created_at, category, entity, content, tags, importance, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      fact.createdAt,
      fact.category,
      fact.entity ?? null,
      fact.content,
      JSON.stringify(fact.tags),
      fact.importance,
      fact.expiresAt ?? null,
    ]
  );
}

export function getActiveFacts(importanceFilter?: FactImportance): Fact[] {
  const database = getDatabase();
  const now = Date.now();

  const rows = database.getAllSync<{
    id: number;
    created_at: number;
    updated_at: number | null;
    category: string;
    entity: string | null;
    content: string;
    tags: string;
    importance: string;
    expires_at: number | null;
  }>(
    importanceFilter
      ? `SELECT * FROM facts WHERE (expires_at IS NULL OR expires_at > ?) AND importance = ? ORDER BY importance DESC, created_at DESC`
      : `SELECT * FROM facts WHERE (expires_at IS NULL OR expires_at > ?) ORDER BY importance DESC, created_at DESC`,
    importanceFilter ? [now, importanceFilter] : [now]
  );

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? undefined,
    category: row.category as Fact['category'],
    entity: row.entity ?? undefined,
    content: row.content,
    tags: JSON.parse(row.tags),
    importance: row.importance as Fact['importance'],
    expiresAt: row.expires_at ?? undefined,
  }));
}

export function closeDatabase(): void {
  if (db) {
    db.closeSync();
    db = null;
    debugWarn('memoryDatabase', 'Database closed');
  }
}
