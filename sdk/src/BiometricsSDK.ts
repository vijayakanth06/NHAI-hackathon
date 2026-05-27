/**
 * NHAI Offline Biometric SDK Facade
 * 
 * Provides a clean, typed plug-and-play interface for other NHAI teams
 * to integrate offline facial recognition & liveness detection in less than 3 lines.
 */

import BiometricsService from '../../src/services/BiometricsService';
import type {
  AuthResult,
  EnrollmentResult,
  SyncResult,
  SyncStatus,
  ModelInfo,
} from '../../src/types/biometrics.types';

export class BiometricsSDK {
  /**
   * Initialize the biometrics pipeline.
   * Loads all 7 TFLite AI models into memory and sets up the encrypted SQLite database.
   * Call once during application startup (e.g. inside App.tsx useEffect).
   */
  static async initialize(): Promise<void> {
    await BiometricsService.initialize();
  }

  /**
   * Release all system resources, TFLite interpreters, and database sessions.
   * Call when the biometrics system is no longer needed.
   */
  static async dispose(): Promise<void> {
    await BiometricsService.dispose();
  }

  /**
   * Enroll a new user face into the secure database.
   * The user ID is SHA-256 hashed before storing in the SQLCipher database.
   * 
   * @param base64Image - Base64 encoded JPEG face frame
   * @param userId - Unique raw user identifier (e.g. Employee ID)
   * @param username - Display name of the user
   * @param challengeAction - The active liveness action captured ('smile' | 'blink')
   * @param additionalData - Custom user metadata fields (stringified JSON)
   */
  static async enroll(
    base64Image: string,
    userId: string,
    username: string,
    challengeAction: string,
    additionalData: string = ''
  ): Promise<EnrollmentResult> {
    return BiometricsService.enroll(
      base64Image,
      userId,
      username,
      challengeAction,
      additionalData
    );
  }

  /**
   * Authenticate a user face using the 7-step pipeline.
   * Runs Zero-DCE, Face Mesh extraction, active liveness verification,
   * feature embedding matching, and iris quality assurance in <1000ms.
   * 
   * @param base64Image - Base64 encoded JPEG face frame to match
   * @param challengeAction - The active liveness challenge currently assigned
   */
  static async authenticate(
    base64Image: string,
    challengeAction: string
  ): Promise<AuthResult> {
    return BiometricsService.authenticate(base64Image, challengeAction);
  }

  /**
   * Retrieve the synchronization status of the offline queue.
   */
  static async getSyncStatus(): Promise<SyncStatus> {
    return BiometricsService.getSyncStatus();
  }

  /**
   * Manually push all buffered offline records to the AWS DataStore
   * and automatically purge the successfully synced logs from SQLite.
   */
  static async syncAndPurge(): Promise<SyncResult> {
    return BiometricsService.syncAndPurge();
  }

  /**
   * Retrieve information about the loaded TFLite models, sizes, and averages.
   */
  static async getModelInfo(): Promise<ModelInfo> {
    return BiometricsService.getModelInfo();
  }
}
export default BiometricsSDK;
