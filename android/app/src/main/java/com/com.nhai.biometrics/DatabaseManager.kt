package com.nhai.biometrics

import android.content.Context
import android.provider.Settings
import net.sqlcipher.database.SQLiteDatabase
import java.nio.ByteBuffer
import java.security.MessageDigest
import java.util.UUID

/**
 * DatabaseManager — AES-256 encrypted SQLite via SQLCipher.
 * Key is stored in Android Keystore; NEVER hardcoded.
 * Raw biometrics are NEVER written here — only metadata.
 *
 * Tables:
 *   attendance_records — authentication event metadata
 *   enrolled_users — 512-dim averaged embeddings (encrypted at rest)
 */
class DatabaseManager(private val context: Context, private val dbKey: ByteArray) {

    private lateinit var db: SQLiteDatabase

    fun initialize() {
        SQLiteDatabase.loadLibs(context)
        db = SQLiteDatabase.openOrCreateDatabase(
            context.getDatabasePath("biometrics.db").absolutePath,
            String(dbKey),
            null
        )
        db.execSQL(CREATE_ATTENDANCE_TABLE)
        db.execSQL(CREATE_ENROLLED_USERS_TABLE)
        db.execSQL(CREATE_SYNC_IDX)
        db.execSQL(CREATE_TS_IDX)
    }

    /**
     * Enroll a user by storing their averaged 512-dim embedding along with their identity.
     * The embedding is stored as a BLOB (512 × 4 bytes = 2048 bytes).
     */
    fun enrollUser(userHash: String, username: String, additionalData: String, embedding: FloatArray) {
        // Convert FloatArray to ByteArray for BLOB storage
        val buffer = ByteBuffer.allocate(embedding.size * 4)
        for (v in embedding) buffer.putFloat(v)
        val embeddingBlob = buffer.array()

        db.execSQL(
            "INSERT OR REPLACE INTO enrolled_users (user_hash, username, additional_data, embedding_blob, enrolled_at) VALUES (?, ?, ?, ?, ?)",
            arrayOf(userHash, username, additionalData, embeddingBlob, System.currentTimeMillis())
        )
    }

    /**
     * Check if a username already exists in the database.
     */
    fun checkUsernameExists(username: String): Boolean {
        val cursor = db.rawQuery(
            "SELECT COUNT(*) FROM enrolled_users WHERE username=?",
            arrayOf(username)
        )
        cursor.moveToFirst()
        val count = cursor.getInt(0)
        cursor.close()
        return count > 0
    }

    /**
     * Delete an enrolled user from the database.
     */
    fun deleteUser(userHash: String) {
        db.execSQL(
            "DELETE FROM enrolled_users WHERE user_hash=?",
            arrayOf(userHash)
        )
    }

    /**
     * Check if a face embedding is already enrolled by comparing against ALL
     * stored embeddings. Returns the username of the matching user, or null.
     */
    fun findMatchingFace(newEmbedding: FloatArray, threshold: Float = 0.55f): String? {
        val cursor = db.rawQuery(
            "SELECT username, embedding_blob FROM enrolled_users",
            null
        )
        var matchedUsername: String? = null
        while (cursor.moveToNext()) {
            val storedUsername = cursor.getString(0)
            val blob = cursor.getBlob(1)
            val buffer = java.nio.ByteBuffer.wrap(blob)
            val storedEmbedding = FloatArray(blob.size / 4)
            for (i in storedEmbedding.indices) {
                storedEmbedding[i] = buffer.getFloat()
            }
            // Cosine similarity (both are L2-normalized)
            var dot = 0f
            for (i in newEmbedding.indices) {
                dot += newEmbedding[i] * storedEmbedding[i]
            }
            if (dot > threshold) {
                matchedUsername = storedUsername
                break
            }
        }
        cursor.close()
        return matchedUsername
    }

    /**
     * Retrieve the enrolled embedding for comparison.
     * Returns a 512-dim FloatArray.
     */
    fun getEnrolledEmbedding(): FloatArray {
        val cursor = db.rawQuery("SELECT embedding_blob FROM enrolled_users LIMIT 1", null)
        if (!cursor.moveToFirst()) {
            cursor.close()
            throw Exception("No enrolled user found")
        }
        val blob = cursor.getBlob(0)
        cursor.close()

        val buffer = ByteBuffer.wrap(blob)
        val embedding = FloatArray(blob.size / 4)
        for (i in embedding.indices) {
            embedding[i] = buffer.getFloat()
        }
        return embedding
    }

    /**
     * Data class to hold an enrolled user's identity and embedding.
     */
    data class EnrolledUser(
        val userHash: String,
        val username: String,
        val additionalData: String,
        val embedding: FloatArray
    )

    /**
     * Get ALL enrolled users with their embeddings for multi-user authentication.
     */
    fun getAllEnrolledUsers(): List<EnrolledUser> {
        val cursor = db.rawQuery(
            "SELECT user_hash, username, additional_data, embedding_blob FROM enrolled_users",
            null
        )
        val users = mutableListOf<EnrolledUser>()
        while (cursor.moveToNext()) {
            val userHash = cursor.getString(0)
            val uname = cursor.getString(1)
            val additionalData = cursor.getString(2)
            val blob = cursor.getBlob(3)
            val buffer = ByteBuffer.wrap(blob)
            val embedding = FloatArray(blob.size / 4)
            for (i in embedding.indices) {
                embedding[i] = buffer.getFloat()
            }
            users.add(EnrolledUser(userHash, uname, additionalData, embedding))
        }
        cursor.close()
        return users
    }

    /**
     * Get the enrolled user's hashed ID.
     */
    fun getEnrolledUserId(): String? {
        val cursor = db.rawQuery("SELECT user_hash FROM enrolled_users LIMIT 1", null)
        val userId = if (cursor.moveToFirst()) cursor.getString(0) else null
        cursor.close()
        return userId
    }

    /**
     * Retrieve the user's metadata (username, additionalData) by their ID.
     */
    fun getUserMetadata(userHash: String): Map<String, String>? {
        val cursor = db.rawQuery(
            "SELECT username, additional_data FROM enrolled_users WHERE user_hash=? LIMIT 1",
            arrayOf(userHash)
        )
        var result: Map<String, String>? = null
        if (cursor.moveToFirst()) {
            result = mapOf(
                "username" to cursor.getString(0),
                "additionalData" to cursor.getString(1)
            )
        }
        cursor.close()
        return result
    }

    /**
     * Insert an attendance record.
     * Only metadata is stored — NEVER raw biometric data.
     */
    fun insertAttendanceRecord(
        userHash: String,
        confidence: Float,
        livenessScore: Float,
        latitude: Double?,
        longitude: Double?
    ) {
        val id = UUID.randomUUID().toString()
        val deviceId = getDeviceIdHash()

        db.execSQL(
            """INSERT INTO attendance_records 
               (id, user_hash, timestamp, latitude, longitude, confidence, 
                liveness_score, device_id, sync_status, created_at) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)""",
            arrayOf(
                id, userHash, System.currentTimeMillis(),
                latitude, longitude, confidence, livenessScore,
                deviceId, System.currentTimeMillis()
            )
        )
    }

    /**
     * Get count of records pending sync.
     */
    fun getPendingCount(): Int {
        val cursor = db.rawQuery(
            "SELECT COUNT(*) FROM attendance_records WHERE sync_status='pending'",
            null
        )
        cursor.moveToFirst()
        val count = cursor.getInt(0)
        cursor.close()
        return count
    }

    /**
     * Sync pending records and purge confirmed ones.
     */
    data class SyncOutcome(val synced: Int, val failed: Int, val purged: Int)

    suspend fun syncAndPurge(): SyncOutcome {
        var synced = 0
        var failed = 0

        val cursor = db.rawQuery(
            "SELECT id FROM attendance_records WHERE sync_status='pending'",
            null
        )

        while (cursor.moveToNext()) {
            val recordId = cursor.getString(0)
            try {
                // TODO: Call AWS Amplify DataStore to upload record
                // For now, mark as synced
                db.execSQL(
                    "UPDATE attendance_records SET sync_status='synced' WHERE id=?",
                    arrayOf(recordId)
                )
                synced++
            } catch (e: Exception) {
                db.execSQL(
                    "UPDATE attendance_records SET sync_status='failed' WHERE id=?",
                    arrayOf(recordId)
                )
                failed++
            }
        }
        cursor.close()

        // Purge synced records
        val purged = db.delete("attendance_records", "sync_status='synced'", null)

        return SyncOutcome(synced, failed, purged)
    }

    /**
     * Check if any user is enrolled.
     */
    fun hasEnrolledUser(): Boolean {
        val cursor = db.rawQuery("SELECT COUNT(*) FROM enrolled_users", null)
        cursor.moveToFirst()
        val count = cursor.getInt(0)
        cursor.close()
        return count > 0
    }

    /**
     * Close the database connection.
     */
    fun close() {
        if (::db.isInitialized && db.isOpen) {
            db.close()
        }
    }

    /**
     * Get a SHA-256 hash of the device identifier.
     * Never stores the raw ANDROID_ID.
     */
    private fun getDeviceIdHash(): String {
        val androidId = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID
        )
        val digest = MessageDigest.getInstance("SHA-256")
        val hash = digest.digest(androidId.toByteArray())
        return hash.joinToString("") { "%02x".format(it) }
    }

    companion object {
        private const val CREATE_ATTENDANCE_TABLE = """
            CREATE TABLE IF NOT EXISTS attendance_records (
              id             TEXT PRIMARY KEY,
              user_hash      TEXT NOT NULL,
              timestamp      INTEGER NOT NULL,
              latitude       REAL,
              longitude      REAL,
              confidence     REAL NOT NULL,
              liveness_score REAL NOT NULL,
              device_id      TEXT NOT NULL,
              sync_status    TEXT NOT NULL DEFAULT 'pending',
              created_at     INTEGER NOT NULL
            )
        """

        private const val CREATE_ENROLLED_USERS_TABLE = """
            CREATE TABLE IF NOT EXISTS enrolled_users (
              user_hash      TEXT PRIMARY KEY,
              username       TEXT NOT NULL UNIQUE,
              additional_data TEXT NOT NULL,
              embedding_blob BLOB NOT NULL,
              enrolled_at    INTEGER NOT NULL
            )
        """

        private const val CREATE_SYNC_IDX =
            "CREATE INDEX IF NOT EXISTS idx_sync ON attendance_records(sync_status)"

        private const val CREATE_TS_IDX =
            "CREATE INDEX IF NOT EXISTS idx_ts ON attendance_records(timestamp)"
    }
}
