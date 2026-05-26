/**
 * Hackathon 7.0 — SyncService
 *
 * Monitors network connectivity via NetInfo and automatically
 * triggers sync when connectivity is restored and pending records exist.
 *
 * Sync Flow:
 *   1. NetInfo detects connectivity restored
 *   2. Check pending record count
 *   3. If pending > 0: sync to AWS DataStore
 *   4. Purge synced records from local SQLite
 *   5. Update Redux state
 */

import NetInfo from '@react-native-community/netinfo';
import { store } from '../store';
import {
  startSync,
  finishSync,
  updateSyncStatus,
} from '../store/syncSlice';
import BiometricsService from './BiometricsService';

/**
 * SyncService — Manages offline-to-cloud synchronization.
 *
 * Starts monitoring network state and auto-syncs when
 * connectivity is restored and pending records exist.
 */
class SyncService {
  private unsubscribe: (() => void) | null = null;

  /**
   * Start monitoring network connectivity.
   * Auto-triggers sync when connectivity is restored.
   *
   * Call once at app startup after BiometricsService.initialize().
   */
  startMonitoring(): void {
    if (this.unsubscribe) return; // Already monitoring

    this.unsubscribe = NetInfo.addEventListener(async (state) => {
      const isOnline = !!(state.isConnected && state.isInternetReachable);

      try {
        const syncStatus = await BiometricsService.getSyncStatus();
        store.dispatch(
          updateSyncStatus({ ...syncStatus, isOnline }),
        );

        // Auto-trigger sync when connectivity is restored and records are pending
        if (isOnline && syncStatus.pendingCount > 0) {
          await this.performSync();
        }
      } catch (err) {
        // BiometricsService might not be initialized yet during app startup
        console.warn('SyncService: failed to get sync status', err);
      }
    });
  }

  /**
   * Stop monitoring network connectivity.
   * Call when the app is backgrounded or the module is disposed.
   */
  stopMonitoring(): void {
    this.unsubscribe?.();
    this.unsubscribe = null;
  }

  /**
   * Manually trigger a sync operation.
   * Can be called from the SyncScreen UI.
   */
  async performSync(): Promise<void> {
    store.dispatch(startSync());
    try {
      const result = await BiometricsService.syncAndPurge();
      store.dispatch(finishSync(result));
    } catch (err) {
      console.error('SyncService: sync failed', err);
      store.dispatch(finishSync({ synced: 0, failed: 0, purged: 0 }));
    }
  }

  /**
   * Check if the service is currently monitoring.
   */
  isMonitoring(): boolean {
    return this.unsubscribe !== null;
  }
}

export default new SyncService();
