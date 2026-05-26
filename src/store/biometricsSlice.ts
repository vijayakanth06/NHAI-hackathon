/**
 * Hackathon 7.0 — Biometrics Redux Slice
 *
 * Manages authentication state, active liveness challenge progression,
 * and pipeline results in the Redux store.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { AuthResult, ChallengeType } from '../types/biometrics.types';

interface BiometricsState {
  /** Whether the 7-step auth pipeline is currently executing */
  isAuthenticating: boolean;
  /** Result from the last authentication attempt */
  authResult: AuthResult | null;
  /** The currently active liveness challenge (null if none) */
  currentChallenge: ChallengeType | null;
  /** Challenges successfully completed in this session */
  completedChallenges: ChallengeType[];
  /** Error message from a failed challenge */
  challengeError: string | null;
  /** General error message */
  error: string | null;
}

const initialState: BiometricsState = {
  isAuthenticating: false,
  authResult: null,
  currentChallenge: null,
  completedChallenges: [],
  challengeError: null,
  error: null,
};

const biometricsSlice = createSlice({
  name: 'biometrics',
  initialState,
  reducers: {
    /** Begin a new authentication session — resets all state */
    startAuth: (state) => {
      state.isAuthenticating = true;
      state.authResult = null;
      state.error = null;
      state.completedChallenges = [];
      state.currentChallenge = null;
      state.challengeError = null;
    },
    /** Set the currently active challenge for the user to perform */
    setCurrentChallenge: (state, action: PayloadAction<ChallengeType>) => {
      state.currentChallenge = action.payload;
      state.challengeError = null;
    },
    /** Mark a challenge as successfully completed */
    completeChallenge: (state, action: PayloadAction<ChallengeType>) => {
      state.completedChallenges.push(action.payload);
      state.currentChallenge = null;
    },
    /** Record a challenge failure (e.g., timeout) */
    failChallenge: (state, action: PayloadAction<string>) => {
      state.challengeError = action.payload;
    },
    /** Store the final authentication result */
    setAuthResult: (state, action: PayloadAction<AuthResult>) => {
      state.authResult = action.payload;
      state.isAuthenticating = false;
    },
    /** Store an error and stop authentication */
    setError: (state, action: PayloadAction<string>) => {
      state.error = action.payload;
      state.isAuthenticating = false;
    },
    /** Reset everything to initial state */
    reset: () => initialState,
  },
});

export const {
  startAuth,
  setCurrentChallenge,
  completeChallenge,
  failChallenge,
  setAuthResult,
  setError,
  reset,
} = biometricsSlice.actions;

export default biometricsSlice.reducer;
