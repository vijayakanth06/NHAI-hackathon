/**
 * Hackathon 7.0 — NHAI Biometrics App
 *
 * Root component with:
 * - Redux Provider wrapping the entire app
 * - Simple state-based screen navigation (no react-navigation dependency)
 * - 4 screens: Home (dashboard), Enrollment, Authentication (camera), Auth Result
 *
 * Screen flow:
 *   HomeScreen ─┬─> EnrollmentScreen ─> (back to Home)
 *               ├─> Auth Camera ─> Auth Result ─> (back to Home)
 *               └─> Sync Screen (future Phase 5)
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import { Provider, useDispatch } from 'react-redux';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { store } from './src/store';
import { setAuthResult } from './src/store/biometricsSlice';
import { HomeScreen } from './src/screens/HomeScreen';
import { EnrollmentScreen } from './src/screens/EnrollmentScreen';
import { AuthenticationScreen } from './src/screens/AuthenticationScreen';
import { SyncScreen } from './src/screens/SyncScreen';
import BiometricsService from './src/services/BiometricsService';
import type { AuthResult } from './src/types/biometrics.types';
import type { AppDispatch } from './src/store';

import { DatabaseAdminScreen } from './src/screens/DatabaseAdminScreen';

type Screen = 'home' | 'enroll' | 'auth_camera' | 'sync' | 'admin';

/**
 * Inner app component that has access to the Redux store via Provider.
 */
function AppInner() {
  const dispatch = useDispatch<AppDispatch>();

  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');

  const [hasCameraPermission, setHasCameraPermission] = useState(false);

  const requestCameraPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'Camera access is required for biometric authentication.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        const ok = granted === PermissionsAndroid.RESULTS.GRANTED;
        setHasCameraPermission(ok);
        return ok;
      } else {
        const status = await Camera.requestCameraPermission();
        const ok = status === 'granted';
        setHasCameraPermission(ok);
        return ok;
      }
    } catch {
      return false;
    }
  }, []);

  const handleNavigateAuth = useCallback(async () => {
    const ok = hasCameraPermission || (await requestCameraPermission());
    if (ok) {
      setCurrentScreen('auth_camera');
    } else {
      Alert.alert('Camera permission is required for authentication.');
    }
  }, [hasCameraPermission, requestCameraPermission]);


  // ─── AUTH CAMERA SCREEN ───
  if (currentScreen === 'auth_camera') {
    return (
      <AuthenticationScreen onBack={() => setCurrentScreen('home')} />
    );
  }

  // ─── ENROLLMENT SCREEN ───
  if (currentScreen === 'enroll') {
    return (
      <EnrollmentScreen
        onBack={() => setCurrentScreen('home')}
        onComplete={() => setCurrentScreen('home')}
      />
    );
  }

  // ─── SYNC SCREEN ───
  if (currentScreen === 'sync') {
    return (
      <SyncScreen onBack={() => setCurrentScreen('home')} />
    );
  }

  // ─── ADMIN SCREEN ───
  if (currentScreen === 'admin') {
    return <DatabaseAdminScreen onBack={() => setCurrentScreen('home')} />;
  }

  // ─── HOME SCREEN (DEFAULT) ───
  return (
    <HomeScreen
      onNavigateEnroll={() => setCurrentScreen('enroll')}
      onNavigateAuth={handleNavigateAuth}
      onNavigateSync={() => setCurrentScreen('sync')}
      onNavigateAdmin={() => setCurrentScreen('admin')}
    />
  );
}

/**
 * Root App component — wraps everything in the Redux Provider.
 */
function App() {
  return (
    <Provider store={store}>
      <AppInner />
    </Provider>
  );
}

export default App;

// Trigger TS server re-evaluation

