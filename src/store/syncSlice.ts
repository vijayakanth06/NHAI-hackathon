/**
 * Hackathon 7.0 — Sync Redux Slice
 *
 * Manages offline/online state, pending record counts,
 * and sync operation progress in the Redux store.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { SyncStatus, SyncResult } from '../types/biometrics.types';

interface SyncState {
  /** Whether the device has internet connectivity */
  isOnline: boolean;
  /** Number of attendance records waiting to sync */
  pendingCount: number;
  /** ISO timestamp of last successful sync */
  lastSyncTimestamp: string | null;
  /** Whether a sync operation is currently in progress */
  isSyncing: boolean;
  /** Result of the last sync operation */
  lastSyncResult: SyncResult | null;
}

const initialState: SyncState = {
  isOnline: false,
  pendingCount: 0,
  lastSyncTimestamp: null,
  isSyncing: false,
  lastSyncResult: null,
};

const syncSlice = createSlice({
  name: 'sync',
  initialState,
  reducers: {
    /** Update sync status from native module */
    updateSyncStatus: (state, action: PayloadAction<SyncStatus>) => {
      state.isOnline = action.payload.isOnline;
      state.pendingCount = action.payload.pendingCount;
      state.lastSyncTimestamp = action.payload.lastSyncTimestamp;
    },
    /** Mark sync as in progress */
    startSync: (state) => {
      state.isSyncing = true;
    },
    /** Sync completed — update counts and store result */
    finishSync: (state, action: PayloadAction<SyncResult>) => {
      state.isSyncing = false;
      state.lastSyncResult = action.payload;
      state.pendingCount = Math.max(
        0,
        state.pendingCount - action.payload.synced,
      );
      if (action.payload.synced > 0) {
        state.lastSyncTimestamp = new Date().toISOString();
      }
    },
    /** Set online/offline status independently */
    setOnlineStatus: (state, action: PayloadAction<boolean>) => {
      state.isOnline = action.payload;
    },
  },
});

export const { updateSyncStatus, startSync, finishSync, setOnlineStatus } =
  syncSlice.actions;
export default syncSlice.reducer;
