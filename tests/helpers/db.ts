import { EventEmitter } from 'node:events'
import { Database } from '@adonisjs/lucid/database'
import { BaseModel, Adapter } from '@adonisjs/lucid/orm'

/**
 * Minimal logger compatible with what Lucid's Database class expects.
 */
const logger = {
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  fatal: () => {},
  child: () => logger,
}

/**
 * Extended EventEmitter with hasListeners() method required by Lucid's QueryReporter.
 * Node's built-in EventEmitter lacks this method.
 */
class LucidEmitter extends EventEmitter {
  hasListeners(event: string): boolean {
    return this.listenerCount(event) > 0
  }
}

/**
 * A shared Database instance used by all tests.
 * Reads credentials from environment variables (or falls back to defaults).
 */
export const db = new Database(
  {
    connection: 'pg',
    connections: {
      pg: {
        client: 'pg',
        connection: {
          host: process.env['PG_HOST'] ?? 'localhost',
          port: Number(process.env['PG_PORT'] ?? 5432),
          user: process.env['PG_USER'] ?? 'artak',
          password: process.env['PG_PASSWORD'] ?? 'secret',
          database: process.env['PG_DATABASE'] ?? 'ado-poly',
        },
        debug: false,
      },
    },
  },
  logger as any,
  new LucidEmitter() as any
)

/**
 * Wire the Lucid adapter to BaseModel so that all models use this DB instance.
 */
export function setupDatabase(): void {
  BaseModel.$adapter = new Adapter(db) as any
}

/**
 * Close all DB connections. Call this in the test teardown.
 */
export async function closeDatabase(): Promise<void> {
  await db.manager.closeAll()
}

/**
 * Returns a raw knex query builder on the given table.
 * Useful for DDL operations (createTable, dropTable) in test setup.
 */
export function schema() {
  return db.connection().schema
}