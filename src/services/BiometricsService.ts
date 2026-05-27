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
  async enroll(
    base64Image: string,
    userId: string,
    username: string,
    challengeAction: string,
    additionalData: string
  ): Promise<EnrollmentResult> {
    this.assertInitialized();
    // Hash userId before passing to native (defense-in-depth)
    const hashedId = await this.hashUserId(userId);
    return BiometricsModule.enroll(base64Image, hashedId, username, challengeAction, additionalData);
  }

  /**
   * Execute the Single-Shot Active Liveness authentication pipeline.
   */
  async authenticate(base64Image: string, challengeAction: string): Promise<AuthResult> {
    this.assertInitialized();
    return BiometricsModule.authenticate(base64Image, challengeAction);
  }

  /**
   * Generate a random active liveness challenge (e.g. smile, turn head)
   */
  async startLivenessChallenge(): Promise<ChallengeInstruction> {
    this.assertInitialized();
    return BiometricsModule.startLivenessChallenge();
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
   * Get all enrolled users from the local SQLite database.
   */
  async getEnrolledUsers(): Promise<Array<{userId: string; username: string; additionalData: string}>> {
    this.assertInitialized();
    return BiometricsModule.getEnrolledUsers();
  }

  /**
   * Delete an enrolled user by their unhashed ID.
   */
  async deleteUser(userId: string): Promise<{success: boolean}> {
    this.assertInitialized();
    const hashedId = await this.hashUserId(userId);
    return BiometricsModule.deleteUser(hashedId);
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
