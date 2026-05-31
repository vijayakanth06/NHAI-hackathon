import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useDispatch } from 'react-redux';
import { setAuthResult } from '../store/biometricsSlice';
import BiometricsService from '../services/BiometricsService';
import { LivenessChallenge, LivenessAction } from '../components/LivenessChallenge';
import { AuthResultCard } from '../components/AuthResultCard';
import type { AuthResult } from '../types/biometrics.types';
import type { AppDispatch } from '../store';
import { logger } from '../utils/logger';

interface AuthenticationScreenProps {
  onBack: () => void;
}

const CHALLENGES: { action: LivenessAction; instruction: string }[] = [
  { action: 'smile', instruction: 'Please smile brightly' },
  { action: 'blink', instruction: 'Blink your eyes twice' },
];

export const AuthenticationScreen: React.FC<AuthenticationScreenProps> = ({ onBack }) => {
  const dispatch = useDispatch<AppDispatch>();

  const [phase, setPhase] = useState<'liveness' | 'processing' | 'result'>('liveness');
  const [currentChallenge, setCurrentChallenge] = useState(CHALLENGES[0]);
  const [lastAuthResult, setLastAuthResult] = useState<AuthResult | null>(null);

  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice(cameraPosition);

  // Initialize random challenge
  useEffect(() => {
    const randomChallenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    setCurrentChallenge(randomChallenge);
  }, []);

  const handleCapture = useCallback(async () => {
    if (!cameraRef.current) return;

    try {
      setPhase('processing');
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
      });

      const RNFS = require('react-native-fs');
      const base64 = await RNFS.readFile(photo.path, 'base64');
      
      // We pass the base64 and challenge action to authenticate
      const result = await BiometricsService.authenticate(base64, currentChallenge.action);

      setLastAuthResult(result);
      dispatch(setAuthResult(result));
      setPhase('result');
    } catch (error: any) {
      logger.error('AuthenticationScreen', 'Authentication failed', { error: error.message });
      Alert.alert('Error', error.message || 'Authentication failed');
      setPhase('liveness'); // go back to challenge on failure
    }
  }, [dispatch, currentChallenge]);

  // ─── RESULT PHASE ───
  if (phase === 'result' && lastAuthResult) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <AuthResultCard result={lastAuthResult} onClose={onBack} />
      </SafeAreaView>
    );
  }

  // ─── LIVENESS & PROCESSING PHASE ───
  if (device) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={onBack}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.title}>🔐 Identity Verification</Text>
            <Text style={styles.subtitle}>Complete the liveness challenge</Text>
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

          {/* Liveness Challenge Overlay */}
          {phase === 'liveness' && (
            <View style={styles.livenessOverlay}>
              <LivenessChallenge action={currentChallenge.action} instruction={currentChallenge.instruction} />
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          {phase === 'processing' ? (
            <View style={styles.processingRow}>
              <ActivityIndicator size="large" color="#00E676" />
              <Text style={styles.processingText}>Running 7-step security pipeline...</Text>
            </View>
          ) : (
            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.button, styles.captureButton]} onPress={handleCapture}>
                <Text style={styles.buttonText}>📷 Capture</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.switchButton]}
                onPress={() => setCameraPosition((p) => (p === 'front' ? 'back' : 'front'))}
              >
                <Text style={styles.buttonText}>🔄</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ActivityIndicator size="large" color="#00E676" />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#141414',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#2A2A2A',
    marginRight: 14,
  },
  backText: {
    color: '#00E676',
    fontSize: 16,
    fontWeight: '600',
  },
  headerCenter: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
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
  livenessOverlay: {
    position: 'absolute',
    top: 20,
    width: '100%',
    alignItems: 'center',
    zIndex: 10,
  },
  actions: {
    padding: 20,
    backgroundColor: '#141414',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  buttonRow: {
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
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureButton: {
    backgroundColor: '#00C853',
    flex: 0.75,
  },
  switchButton: {
    backgroundColor: '#6200EE',
    flex: 0.25,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
