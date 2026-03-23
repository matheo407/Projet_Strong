import { openDB } from 'idb'

const DB_NAME = 'strong-planner'
const DB_VERSION = 1

let dbPromise = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Schedule events
        if (!db.objectStoreNames.contains('events')) {
          const events = db.createObjectStore('events', { keyPath: 'id' })
          events.createIndex('date', 'date')
        }
        // Workout sessions
        if (!db.objectStoreNames.contains('workoutSessions')) {
          const ws = db.createObjectStore('workoutSessions', { keyPath: 'id' })
          ws.createIndex('date', 'date')
          ws.createIndex('type', 'type')
        }
        // Workout templates (Push/Pull/Legs)
        if (!db.objectStoreNames.contains('workoutTemplates')) {
          db.createObjectStore('workoutTemplates', { keyPath: 'id' })
        }
        // Work sessions
        if (!db.objectStoreNames.contains('workSessions')) {
          const ws2 = db.createObjectStore('workSessions', { keyPath: 'id' })
          ws2.createIndex('date', 'date')
        }
        // Notes
        if (!db.objectStoreNames.contains('notes')) {
          const notes = db.createObjectStore('notes', { keyPath: 'id' })
          notes.createIndex('updatedAt', 'updatedAt')
        }
      }
    })
  }
  return dbPromise
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

export async function getAll(store) {
  const db = await getDb()
  return db.getAll(store)
}

export async function getByIndex(store, index, value) {
  const db = await getDb()
  return db.getAllFromIndex(store, index, value)
}

export async function put(store, item) {
  const db = await getDb()
  return db.put(store, item)
}

export async function remove(store, id) {
  const db = await getDb()
  return db.delete(store, id)
}

export async function get(store, id) {
  const db = await getDb()
  return db.get(store, id)
}

// ─── ID generator ─────────────────────────────────────────────────────────────
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}
