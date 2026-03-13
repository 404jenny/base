import Database from 'better-sqlite3'
import path from 'path'
import os from 'os'

const db = new Database(path.join(os.homedir(), '.base', 'base.db'))
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
console.log('Tables:', JSON.stringify(tables, null, 2))
const agents = db.prepare('SELECT * FROM agents').all()
console.log('Agents:', agents.length)