/**
 * Hackathon 7.0 — Biometrics Type Definitions
 *
 * Core domain types for the offline facial recognition & liveness detection system.
 * These types define the contract between the React Native JS layer and native modules.
 */

/**
 * Result of the full 7-step authentication pipeline.
 * Returned by BiometricsModule.authenticate().
 */
export interface AuthResult {
  /** Whether authentication succeeded (liveness ≥ 0.75 AND similarity ≥ 0.70) */
  success: boolean;
  /** Hashed ID of the recognized user (if success=true) */
  userId?: string;
  /** Human readable username (if success=true) */
  username?: string;
  /** Metadata associated with the user (if success=true) */
  additionalData?: string;
  /** Face embedding cosine similarity score (0.0–1.0) */
  confidence: number;
  /** Fused liveness score from passive + active + iris (0.0–1.0) */
  livenessScore: number;
  /** Iris texture quality score (0.0–1.0) */
  irisQuality: number;
  /** Total pipeline execution time in milliseconds */
  inferenceTimeMs: number;
  /** List of active liveness challenges that were completed */
  challengesCompleted: ChallengeType[];
}

/**
 * Result of the enrollment flow (3-frame averaged embedding).
 * Returned by BiometricsModule.enroll().
 */
export interface EnrollmentResult {
  /** Whether enrollment succeeded */
  success: boolean;
  /** Human-readable status message */
  message: string;
}

/**
 * Active liveness challenge types.
 * 2 random challenges are selected per session to prevent replay attacks.
 */
export type ChallengeType = 'blink' | 'smile' | 'turn_left' | 'turn_right';

/**
 * Instruction for a single active liveness challenge.
 * Displayed to the user during the challenge phase.
 */
export interface ChallengeInstruction {
  /** The challenge action to perform */
  action: ChallengeType;
  /** Timeout in milliseconds (always 5000) */
  timeoutMs: number;
  /** Human-readable instruction text */
  instruction: string;
  /** Emoji visual indicator */
  emoji: string;
}

/**
 * Result of the sync-and-purge operation.
 * Returned by BiometricsModule.syncAndPurge().
 */
export interface SyncResult {
  /** Number of records successfully synced to AWS */
  synced: number;
  /** Number of records that failed to sync */
  failed: number;
  /** Number of synced records purged from local DB */
  purged: number;
}

/**
 * Current synchronization status.
 * Returned by BiometricsModule.getSyncStatus().
 */
export interface SyncStatus {
  /** Whether device has internet connectivity */
  isOnline: boolean;
  /** Number of records waiting to be synced */
  pendingCount: number;
  /** ISO timestamp of last successful sync, or null */
  lastSyncTimestamp: string | null;
}

/**
 * Information about loaded TFLite models.
 * Returned by BiometricsModule.getModelInfo().
 */
export interface ModelInfo {
  /** Total size of all loaded models in MB */
  totalSizeMB: number;
  /** Names of successfully loaded models */
  modelsLoaded: string[];
  /** Average inference time across all models in ms */
  inferenceTimeAvgMs: number;
}

/**
 * Performance benchmark report for each pipeline step.
 * Returned by BiometricsModule.getBenchmarkReport().
 *
 * Target device: Xiaomi Redmi 9 (Helio G85, 4 GB RAM) or equivalent.
 * All values are mean over 10 iterations, measured in milliseconds.
 */
export interface BenchmarkReport {
  /** Step 1: Face detection (target < 50ms) */
  detectionMs: number;
  /** Step 2: Zero-DCE low-light enhancement (target < 30ms) */
  enhancementMs: number;
  /** Step 3: Face Mesh 468 landmarks (target < 20ms) */
  landmarkMs: number;
  /** Step 4: FaceLiVT 512-dim embedding (target < 100ms) */
  extractionMs: number;
  /** Step 5: Passive liveness — Silent-FAS + rPPG (target < 200ms) */
  livenessMs: number;
  /** Step 6: Active challenge geometric evaluation (target < 20ms) */
  challengeMs: number;
  /** Step 7: Iris quality assessment (target < 80ms) */
  irisMs: number;
  /** End-to-end pipeline total (target < 1000ms) */
  totalMs: number;
  /** Estimated accuracy on held-out test set (target > 95%) */
  accuracyEstimate: number;
}

/**
 * A single attendance record stored in encrypted local SQLite.
 * Only metadata is stored — NEVER raw biometric data (images or embeddings).
 */
export interface AttendanceRecord {
  /** UUID generated locally */
  id: string;
  /** SHA-256 hash of userId — never plaintext */
  userHash: string;
  /** Unix timestamp in milliseconds */
  timestamp: number;
  /** GPS latitude (nullable if unavailable) */
  latitude: number | null;
  /** GPS longitude (nullable if unavailable) */
  longitude: number | null;
  /** Face similarity score (0.0–1.0) */
  confidence: number;
  /** Combined liveness score (0.0–1.0) */
  livenessScore: number;
  /** SHA-256 hash of device identifier */
  deviceId: string;
  /** Sync status: pending → synced/failed */
  syncStatus: 'pending' | 'synced' | 'failed';
}
