/**
 * Hackathon 7.0 — DatabaseService
 *
 * JS-side helper for local SQLite operations.
 * Wraps react-native-sqlite-storage for any JS-level DB queries
 * that don't go through the native BiometricsModule.
 *
 * Note: The primary database operations (enrollment, attendance records)
 * are handled by the native DatabaseManager (Kotlin/Swift) for performance.
 * This service is for auxiliary JS-level queries and status checks.
 */

import SQLite from 'react-native-sqlite-storage';

// Enable promise-based API
SQLite.enablePromise(true);

/**
 * DatabaseService — Auxiliary JS-side database operations.
 */
class DatabaseService {
  private db: SQLite.SQLiteDatabase | null = null;

  /**
   * Open or create the database.
   * Note: The actual encrypted DB is managed by native code.
   * This connects to a separate unencrypted metadata DB for JS-level use.
   */
  async initialize(): Promise<void> {
    if (this.db) return;

    this.db = await SQLite.openDatabase({
      name: 'biometrics_meta.db',
      location: 'default',
    });

    // Create metadata tables if they don't exist
    await this.db.executeSql(`
      CREATE TABLE IF NOT EXISTS app_metadata (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
  }

  /**
   * Store a key-value metadata pair.
   */
  async setMetadata(key: string, value: string): Promise<void> {
    this.assertOpen();
    await this.db!.executeSql(
      'INSERT OR REPLACE INTO app_metadata (key, value) VALUES (?, ?)',
      [key, value],
    );
  }

  /**
   * Retrieve a metadata value by key.
   */
  async getMetadata(key: string): Promise<string | null> {
    this.assertOpen();
    const [results] = await this.db!.executeSql(
      'SELECT value FROM app_metadata WHERE key = ?',
      [key],
    );
    if (results.rows.length > 0) {
      return results.rows.item(0).value;
    }
    return null;
  }

  /**
   * Check if a user is enrolled (by checking metadata flag).
   */
  async isUserEnrolled(): Promise<boolean> {
    const enrolled = await this.getMetadata('user_enrolled');
    return enrolled === 'true';
  }

  /**
   * Mark that a user has been enrolled.
   */
  async markUserEnrolled(): Promise<void> {
    await this.setMetadata('user_enrolled', 'true');
    await this.setMetadata('enrollment_date', new Date().toISOString());
  }

  /**
   * Close the database connection.
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
    }
  }

  private assertOpen(): void {
    if (!this.db) {
      throw new Error('DatabaseService: call initialize() first');
    }
  }
}

export default new DatabaseService();
