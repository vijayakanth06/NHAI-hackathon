/**
 * Hackathon 7.0 — Enrollment Redux Slice
 *
 * Tracks the multi-step enrollment flow:
 * 1. Capture 3 face frames
 * 2. Compute averaged 512-dim embedding
 * 3. Store encrypted embedding in local DB
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface EnrollmentState {
  /** Whether an enrollment is in progress */
  isEnrolling: boolean;
  /** Number of frames captured so far (0–3) */
  framesCaptured: number;
  /** Total frames required for enrollment */
  framesRequired: number;
  /** Current step description */
  currentStep: string;
  /** Whether enrollment completed successfully */
  success: boolean | null;
  /** Status message */
  message: string | null;
  /** Error message if enrollment failed */
  error: string | null;
}

const initialState: EnrollmentState = {
  isEnrolling: false,
  framesCaptured: 0,
  framesRequired: 3,
  currentStep: '',
  success: null,
  message: null,
  error: null,
};

const enrollmentSlice = createSlice({
  name: 'enrollment',
  initialState,
  reducers: {
    /** Begin a new enrollment session */
    startEnrollment: (state) => {
      state.isEnrolling = true;
      state.framesCaptured = 0;
      state.success = null;
      state.message = null;
      state.error = null;
      state.currentStep = 'Position your face in the frame';
    },
    /** Record that a frame was captured */
    captureFrame: (state) => {
      state.framesCaptured += 1;
      if (state.framesCaptured < state.framesRequired) {
        state.currentStep = `Captured ${state.framesCaptured}/${state.framesRequired} — hold steady`;
      } else {
        state.currentStep = 'Processing embeddings...';
      }
    },
    /** Enrollment processing step */
    setStep: (state, action: PayloadAction<string>) => {
      state.currentStep = action.payload;
    },
    /** Enrollment completed successfully */
    enrollSuccess: (state, action: PayloadAction<string>) => {
      state.isEnrolling = false;
      state.success = true;
      state.message = action.payload;
      state.currentStep = 'Enrollment complete';
    },
    /** Enrollment failed */
    enrollFailure: (state, action: PayloadAction<string>) => {
      state.isEnrolling = false;
      state.success = false;
      state.error = action.payload;
      state.currentStep = 'Enrollment failed';
    },
    /** Reset enrollment state */
    resetEnrollment: () => initialState,
  },
});

export const {
  startEnrollment,
  captureFrame,
  setStep,
  enrollSuccess,
  enrollFailure,
  resetEnrollment,
} = enrollmentSlice.actions;

export default enrollmentSlice.reducer;
