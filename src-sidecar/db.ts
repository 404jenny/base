import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'
import fs from 'fs'

const DB_DIR = path.join(os.homedir(), '.base')
const DB_PATH = path.join(DB_DIR, 'base.db')

let db: Database.Database

export function getDB(): Database.Database {
  if (!db) throw new Error('Database not initialized. Call initDB() first.')
  return db
}

export async function initDB() {
  // Ensure data directory exists
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    -- Agents table
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'native',  -- native | mcp | http | openai
      status TEXT NOT NULL DEFAULT 'idle',   -- idle | running | paused | error
      model TEXT DEFAULT 'claude',           -- claude | gemini | gpt-4 | etc
      system_prompt TEXT,
      connection_config TEXT,                -- JSON: endpoint, auth, schema for third-party
      tools TEXT DEFAULT '[]',               -- JSON array of enabled tools
      color TEXT DEFAULT '#a78bfa',
      icon TEXT DEFAULT '◈',
      created_at INTEGER DEFAULT (unixepoch()),
      updated_at INTEGER DEFAULT (unixepoch()),
      last_active INTEGER,
      metadata TEXT DEFAULT '{}'             -- JSON: any extra config
    );

    -- Tasks table
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      instruction TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued', -- queued | running | paused | completed | failed | cancelled
      result TEXT,
      error TEXT,
      context TEXT DEFAULT '{}',             -- JSON: input context, parent task, etc
      tokens_used INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0,
      started_at INTEGER,
      completed_at INTEGER,
      created_at INTEGER DEFAULT (unixepoch()),
      metadata TEXT DEFAULT '{}'
    );

    -- Messages table (agent communications feed)
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,              -- agent id or 'base' or 'user'
      sender_name TEXT NOT NULL,
      sender_type TEXT NOT NULL,            -- agent | base | user
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'message',  -- message | thinking | result | error | handoff
      task_id TEXT REFERENCES tasks(id),
      parent_message_id TEXT,
      created_at INTEGER DEFAULT (unixepoch()),
      metadata TEXT DEFAULT '{}'
    );

    -- Agent connections (which agents are linked / can hand off to each other)
    CREATE TABLE IF NOT EXISTS agent_connections (
      id TEXT PRIMARY KEY,
      from_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      to_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      connection_type TEXT DEFAULT 'handoff', -- handoff | parallel | sequential
      created_at INTEGER DEFAULT (unixepoch())
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_tasks_agent_id ON tasks(agent_id);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_messages_task_id ON messages(task_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
  `)

  console.log('[db] Initialized at', DB_PATH)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function generateId(prefix = '') {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 7)
  return prefix ? `${prefix}_${ts}${rand}` : `${ts}${rand}`
}

export function now() {
  return Math.floor(Date.now() / 1000)
}