/**
 * Hackathon 7.0 — BiometricsService
 *
 * Singleton wrapper around the native BiometricsModule.
 * Provides a safe, typed API for the React Native JS layer
 * with initialization guards and SHA-256 user ID hashing.
 *
 * Usage:
 *   import BiometricsService from '@/services/BiometricsService';
 *   await BiometricsService.initialize();
 *   const result = await BiometricsService.authenticate();
 */

import { NativeModules } from 'react-native';
import type { BiometricsModuleInterface } from '../types/native.types';
import type {
  AuthResult,
  EnrollmentResult,
  ChallengeInstruction,
  SyncResult,
  SyncStatus,
  ModelInfo,
  BenchmarkReport,
} from '../types/biometrics.types';

const { BiometricsModule } = NativeModules as {
  BiometricsModule: BiometricsModuleInterface;
};

/**
 * BiometricsService — JS-side facade for the native biometric pipeline.
 *
 * All methods are async because they execute on background threads
 * (Dispatchers.IO on Android, DispatchQueue on iOS).
 */
class BiometricsService {
  private initialized = false;

  /**
   * Initialize the biometrics pipeline.
   * Loads all 7 TFLite models and sets up the encrypted database.
   * Must be called once at app startup (typically in App.tsx useEffect).
   *
   * Idempotent — calling multiple times is safe.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    await BiometricsModule.initialize();
    this.initialized = true;
  }

  /**
   * Release all resources (model interpreters, DB connections).
   * Call when the biometrics module is no longer needed.
   */
  async dispose(): Promise<void> {
    if (!this.initialized) return;
    await BiometricsModule.dispose();
    this.initialized = false;
  }

  /**
   * Enroll a user by capturing 1 face frame.
   * The userId is SHA-256 hashed before passing to native (defense-in-depth).
   *
   * @param userId - Raw user identifier
   * @param username - Human readable username
   * @param additionalData - Stringified JSON or metadata
   * @returns EnrollmentResult with success status
   */
  async enroll(base64Image: string, userId: string, username: string, additionalData: string): Promise<EnrollmentResult> {
    this.assertInitialized();
    // Hash userId before passing to native (defense-in-depth)
    const hashedId = await this.hashUserId(userId);
    return BiometricsModule.enroll(base64Image, hashedId, username, additionalData);
  }

  /**
   * Execute the full 7-step authentication pipeline.
   *
   * Pipeline:
   * 1. Face Detection → 2. Enhancement → 3. Landmarks →
   * 4. Embedding → 5. Passive Liveness → 6. Active Liveness →
   * 7. Iris Quality → Fusion → Decision
   *
   * @returns AuthResult with confidence, liveness, and iris scores
   */
  async authenticate(base64Image: string): Promise<AuthResult> {
    this.assertInitialized();
    return BiometricsModule.authenticate(base64Image);
  }

  /**
   * Start a new active liveness challenge.
   *
   * @returns ChallengeInstruction with action type, timeout, text, emoji
   */
  async startLivenessChallenge(): Promise<ChallengeInstruction> {
    this.assertInitialized();
    return BiometricsModule.startLivenessChallenge();
  }

  /**
   * Check if the current challenge action was completed.
   *
   * @param action - Challenge action to verify
   * @returns true if the user performed the action
   */
  async checkChallengeCompletion(base64Image: string, action: string): Promise<boolean> {
    this.assertInitialized();
    return BiometricsModule.checkChallengeCompletion(base64Image, action);
  }

  /**
   * Get the count of records pending sync.
   *
   * @returns Number of pending attendance records
   */
  async getPendingSyncCount(): Promise<number> {
    return BiometricsModule.getPendingSyncCount();
  }

  /**
   * Sync pending records to AWS and purge confirmed ones.
   *
   * @returns SyncResult with synced/failed/purged counts
   */
  async syncAndPurge(): Promise<SyncResult> {
    return BiometricsModule.syncAndPurge();
  }

  /**
   * Get current sync status.
   */
  async getSyncStatus(): Promise<SyncStatus> {
    return BiometricsModule.getSyncStatus();
  }

  /**
   * Get information about loaded models.
   */
  async getModelInfo(): Promise<ModelInfo> {
    return BiometricsModule.getModelInfo();
  }

  /**
   * Run performance benchmarks.
   */
  async getBenchmarkReport(): Promise<BenchmarkReport> {
    return BiometricsModule.getBenchmarkReport();
  }

  /**
   * Check if the service has been initialized.
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  // --- Private helpers ---

  private assertInitialized(): void {
    if (!this.initialized) {
      throw new Error(
        'BiometricsService: call initialize() before using biometric functions',
      );
    }
  }

  private async hashUserId(userId: string): Promise<string> {
    const { securityUtils } = await import('../utils/securityUtils');
    return securityUtils.sha256(userId);
  }
}

export default new BiometricsService();
