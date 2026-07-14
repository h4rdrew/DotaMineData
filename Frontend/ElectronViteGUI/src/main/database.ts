import sqlite3 from 'sqlite3'
import { appPaths } from './config'

type SqlParameter = string | number | null

function openDatabase(mode: number): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(appPaths.database, mode, (error) =>
      error ? reject(error) : resolve(database)
    )
  })
}

function closeDatabase(database: sqlite3.Database): Promise<void> {
  return new Promise((resolve, reject) =>
    database.close((error) => (error ? reject(error) : resolve()))
  )
}

export async function queryAll<T>(sql: string, params: SqlParameter[] = []): Promise<T[]> {
  const database = await openDatabase(sqlite3.OPEN_READONLY)
  try {
    return await new Promise<T[]>((resolve, reject) => {
      database.all(sql, params, (error, rows) => (error ? reject(error) : resolve(rows as T[])))
    })
  } finally {
    await closeDatabase(database)
  }
}

export async function execute(sql: string, params: SqlParameter[] = []): Promise<number> {
  const database = await openDatabase(sqlite3.OPEN_READWRITE)
  try {
    return await new Promise<number>((resolve, reject) => {
      database.run(sql, params, function (error) {
        if (error) reject(error)
        else resolve(this.changes)
      })
    })
  } finally {
    await closeDatabase(database)
  }
}
