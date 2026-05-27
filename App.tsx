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
import BiometricsService from './src/services/BiometricsService';
import type { AuthResult } from './src/types/biometrics.types';
import type { AppDispatch } from './src/store';

import { DatabaseAdminScreen } from './src/screens/DatabaseAdminScreen';

type Screen = 'home' | 'enroll' | 'auth_camera' | 'auth_result' | 'admin';

/**
 * Inner app component that has access to the Redux store via Provider.
 */
function AppInner() {
  const dispatch = useDispatch<AppDispatch>();

  // Navigation state
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');

  // Auth camera state
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice(cameraPosition);

  // Auth result
  const [lastAuthResult, setLastAuthResult] = useState<AuthResult | null>(null);

  // Challenge info for active liveness
  const [challenge, setChallenge] = useState<{action: string; instruction: string; emoji: string} | null>(null);

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
      // Generate active liveness challenge BEFORE opening camera
      try {
        const activeChallenge = await BiometricsService.startLivenessChallenge();
        setChallenge(activeChallenge);
      } catch (err) {
        Alert.alert('Error', 'Failed to generate liveness challenge.');
        return;
      }
      setCurrentScreen('auth_camera');
    } else {
      Alert.alert('Camera permission is required for authentication.');
    }
  }, [hasCameraPermission, requestCameraPermission]);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current || !challenge) return;

    try {
      setIsProcessing(true);

      // Single-Shot Active Liveness
      const photo = await cameraRef.current.takePhoto({
        flash: device?.hasFlash ? 'on' : 'off',
      });

      const RNFS = require('react-native-fs');
      const base64 = await RNFS.readFile(photo.path, 'base64');

      // Call single-shot authentication pipeline
      const result = await BiometricsService.authenticate(
        base64,
        challenge.action,
      );

      if (result.success) {
        setLastAuthResult(result);
        dispatch(setAuthResult(result));
        setCurrentScreen('auth_result');
      } else {
        // Stay on camera screen and allow retry
        Alert.alert('Authentication Failed', result.message || 'Face not recognized.');
        
        // Generate a new challenge for the next attempt
        const newChallenge = await BiometricsService.startLivenessChallenge();
        setChallenge(newChallenge);
      }
    } catch (error: any) {
      Alert.alert('Authentication Error', error.message);
      
      // On native error, also generate a new challenge for next retry
      try {
        const newChallenge = await BiometricsService.startLivenessChallenge();
        setChallenge(newChallenge);
      } catch (e) {}
    } finally {
      setIsProcessing(false);
    }
  }, [challenge, device]);

  // ─── AUTH RESULT SCREEN ───
  if (currentScreen === 'auth_result' && lastAuthResult) {
    const isSuccess = lastAuthResult.success;
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.resultContainer}>
          {/* Result Icon */}
          <View
            style={[
              styles.resultIconCircle,
              { backgroundColor: isSuccess ? '#00E67620' : '#FF525220' },
            ]}
          >
            <Text style={styles.resultIconText}>
              {isSuccess ? '✅' : '❌'}
            </Text>
          </View>

          <Text style={styles.resultTitle}>
            {isSuccess ? 'Authentication Successful' : 'Authentication Failed'}
          </Text>

          {isSuccess ? (
            <View style={styles.resultCard}>
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Identity</Text>
                <Text style={styles.resultValue}>
                  {lastAuthResult.username || 'Unknown'}
                </Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Employee Data</Text>
                <Text style={styles.resultValue}>
                  {lastAuthResult.additionalData || '—'}
                </Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Match Confidence</Text>
                <Text style={[styles.resultValue, { color: '#00E676' }]}>
                  {(lastAuthResult.confidence * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Liveness Score</Text>
                <Text style={[styles.resultValue, { color: '#00E676' }]}>
                  {(lastAuthResult.livenessScore * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Iris Quality</Text>
                <Text style={styles.resultValue}>
                  {(lastAuthResult.irisQuality * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultRow}>
                <Text style={styles.resultLabel}>Pipeline Time</Text>
                <Text style={styles.resultValue}>
                  {lastAuthResult.inferenceTimeMs}ms
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.errorText}>
              Face not recognized or spoof detected. Please try again.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, { marginTop: 30 }]}
            onPress={() => {
              setLastAuthResult(null);
              setCurrentScreen('home');
            }}
          >
            <Text style={styles.buttonText}>Return to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── AUTH CAMERA SCREEN ───
  if (currentScreen === 'auth_camera' && device) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={styles.cameraHeader}>
          <TouchableOpacity
            style={styles.cameraBackBtn}
            onPress={() => setCurrentScreen('home')}
          >
            <Text style={styles.cameraBackText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.cameraHeaderCenter}>
            <Text style={styles.cameraTitle}>🔐 Identity Verification</Text>
            {challenge && (
              <View style={styles.challengeBadge}>
                <Text style={styles.challengeEmoji}>{challenge.emoji}</Text>
                <Text style={styles.challengeText}>{challenge.instruction}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Camera Preview */}
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={true}
          />
          {/* Face guide overlay */}
          <View style={styles.cameraOverlay}>
            <View style={styles.faceGuide} />
          </View>
        </View>

        {/* Actions */}
        <View style={styles.cameraActions}>
          {isProcessing ? (
            <View style={styles.processingRow}>
              <ActivityIndicator size="large" color="#00E676" />
              <Text style={styles.processingText}>
                Running 7-step pipeline...
              </Text>
            </View>
          ) : (
            <View style={styles.cameraButtonRow}>
              <TouchableOpacity
                style={[styles.button, styles.captureButton]}
                onPress={handleCapture}
              >
                <Text style={styles.buttonText}>📷 Capture</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.switchButton]}
                onPress={() =>
                  setCameraPosition((p) => (p === 'front' ? 'back' : 'front'))
                }
              >
                <Text style={styles.buttonText}>🔄</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setCurrentScreen('home')}
              >
                <Text style={styles.buttonText}>✕</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
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

  // ─── ADMIN SCREEN ───
  if (currentScreen === 'admin') {
    return <DatabaseAdminScreen onBack={() => setCurrentScreen('home')} />;
  }

  // ─── HOME SCREEN (DEFAULT) ───
  return (
    <HomeScreen
      onNavigateEnroll={() => setCurrentScreen('enroll')}
      onNavigateAuth={handleNavigateAuth}
      onNavigateSync={() => {
        // Phase 5 placeholder — sync screen not yet implemented
        Alert.alert('Info', 'Sync screen will be implemented in Phase 5.');
      }}
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

// ─────────────────────────────────────────────
// Styles (Auth Camera + Auth Result screens)
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },

  // ─── Auth Result ───
  resultContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  resultIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  resultIconText: {
    fontSize: 48,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 20,
    textAlign: 'center',
  },
  resultCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  resultLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  resultValue: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
    maxWidth: '55%',
    textAlign: 'right',
  },
  resultDivider: {
    height: 1,
    backgroundColor: '#2A2A2A',
  },
  errorText: {
    fontSize: 15,
    color: '#FF5252',
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 22,
  },

  // ─── Auth Camera ───
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#141414',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  cameraBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  cameraBackText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  cameraHeaderCenter: {
    flex: 1,
  },
  cameraTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  cameraSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
  },
  challengeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 230, 118, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#00E676',
  },
  challengeEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  challengeText: {
    color: '#00E676',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  cameraOverlay: {
    ...(StyleSheet.absoluteFill as any),
    alignItems: 'center',
    justifyContent: 'center',
  },
  faceGuide: {
    width: '60%',
    aspectRatio: 0.78,
    borderRadius: 120,
    borderWidth: 3,
    borderColor: '#00E67680',
    borderStyle: 'dashed',
  },
  cameraActions: {
    padding: 20,
    backgroundColor: '#141414',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  cameraButtonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },
  processingRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  processingText: {
    fontSize: 14,
    color: '#00E676',
    marginTop: 10,
    fontWeight: '600',
  },

  // ─── Buttons ───
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#2962FF',
    width: '100%',
  },
  captureButton: {
    backgroundColor: '#00C853',
    flex: 0.45,
  },
  switchButton: {
    backgroundColor: '#6200EE',
    flex: 0.25,
  },
  cancelButton: {
    backgroundColor: '#D50000',
    flex: 0.25,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default App;

// Trigger TS server re-evaluation
