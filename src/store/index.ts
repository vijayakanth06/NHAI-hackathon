/**
 * Hackathon 7.0 — Redux Store Root
 *
 * Configures the Redux store with all slices:
 * - biometrics: auth pipeline state & challenge tracking
 * - sync: offline queue & connectivity status
 * - enrollment: multi-frame enrollment progress
 */

import { configureStore } from '@reduxjs/toolkit';
import biometricsReducer from './biometricsSlice';
import syncReducer from './syncSlice';
import enrollmentReducer from './enrollmentSlice';

export const store = configureStore({
  reducer: {
    biometrics: biometricsReducer,
    sync: syncReducer,
    enrollment: enrollmentReducer,
  },
});

/** Root state type — use with useSelector */
export type RootState = ReturnType<typeof store.getState>;

/** Dispatch type — use with useDispatch */
export type AppDispatch = typeof store.dispatch;
