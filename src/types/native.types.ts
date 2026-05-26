/**
 * Hackathon 7.0 — Native Module Interface Types
 *
 * Defines the TypeScript contract for the native BiometricsModule
 * exposed via NativeModules (JSI / TurboModule bridge).
 *
 * Both Android (Kotlin) and iOS (Swift) implementations must
 * conform to this interface exactly.
 */

import { NativeModule } from 'react-native';
import {
  AuthResult,
  EnrollmentResult,
  ChallengeInstruction,
  SyncResult,
  SyncStatus,
  ModelInfo,
  BenchmarkReport,
} from './biometrics.types';

/**
 * Native BiometricsModule interface.
 * All methods are asynchronous (return Promises) because they
 * execute on background threads (Dispatchers.IO / DispatchQueue).
 */
export interface BiometricsModuleInterface extends NativeModule {
  /**
   * Initialize the biometrics pipeline:
   * - Generate/retrieve AES-256 encryption key from Keystore/Keychain
   * - Load all 7 TFLite models into memory
   * - Initialize SQLCipher-encrypted database
   *
   * Must be called once before any other method.
   * Typically called in App.tsx useEffect.
   */
  initialize(): Promise<void>;

  /**
   * Release all model interpreters and close database connections.
   * Call when the biometrics module is no longer needed.
   */
  dispose(): Promise<void>;

  /**
   * Enroll a user by capturing 3 face frames, computing averaged
   * 512-dim embedding, and storing in encrypted local database.
   *
   * @param userId - Raw user ID (will be SHA-256 hashed internally)
   * @returns EnrollmentResult with success status and message
   */
  enroll(base64Image: string, userId: string, username: string, additionalData: string): Promise<EnrollmentResult>;

  /**
   * Execute the full 7-step authentication pipeline:
   * 1. Face Detection (FeatherFace)
   * 2. Preprocessing + Zero-DCE enhancement (conditional)
   * 3. 468-point Landmark Extraction (Face Mesh)
   * 4. Feature Embedding (FaceLiVT 512-dim)
   * 5. Passive Liveness (Silent-FAS + rPPG)
   * 6. Active Liveness (geometric on landmarks)
   * 7. Iris Quality Assessment
   * → Score Fusion → Decision
   *
   * @returns AuthResult with confidence, liveness, iris quality scores
   */
  authenticate(base64Image: string): Promise<AuthResult>;

  /**
   * Start a new active liveness challenge.
   * Randomly selects from: blink, smile, turn_left, turn_right.
   *
   * @returns ChallengeInstruction with action, timeout, text, emoji
   */
  startLivenessChallenge(): Promise<ChallengeInstruction>;

  /**
   * Check whether the current challenge action has been completed.
   * Evaluates geometric landmarks (EAR, MAR, yaw angle).
   *
   * @param action - The challenge action to verify ('blink'|'smile'|'turn_left'|'turn_right')
   * @returns true if the challenge was successfully performed
   */
  checkChallengeCompletion(base64Image: string, action: string): Promise<boolean>;

  /**
   * Get the number of attendance records pending sync.
   *
   * @returns Count of records with sync_status='pending'
   */
  getPendingSyncCount(): Promise<number>;

  /**
   * Sync pending records to AWS and purge confirmed records.
   * Flow: SELECT pending → DataStore.save() → UPDATE synced → DELETE synced
   *
   * @returns SyncResult with synced/failed/purged counts
   */
  syncAndPurge(): Promise<SyncResult>;

  /**
   * Get current synchronization status.
   *
   * @returns SyncStatus with online state, pending count, last sync time
   */
  getSyncStatus(): Promise<SyncStatus>;

  /**
   * Get information about loaded TFLite models.
   *
   * @returns ModelInfo with total size, loaded model names, avg inference time
   */
  getModelInfo(): Promise<ModelInfo>;

  /**
   * Run a 10-iteration benchmark of each pipeline step.
   * Results are mean values in milliseconds.
   *
   * @returns BenchmarkReport with per-step and total timing
   */
  getBenchmarkReport(): Promise<BenchmarkReport>;
}
