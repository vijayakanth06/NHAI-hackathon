/**
 * Hackathon 7.0 — EnrollmentScreen
 *
 * Multi-step enrollment flow:
 * 1. User enters name + metadata
 * 2. Camera opens with face guide overlay
 * 3. 3 frames are captured with animated progress ring
 * 4. Native module averages embeddings & stores encrypted
 * 5. Success/failure feedback with animated result card
 *
 * Integrates with:
 *   - Redux enrollmentSlice for state management
 *   - BiometricsService for native pipeline calls
 *   - CameraView component for frame capture
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Animated,
  Dimensions,
  Platform,
  PermissionsAndroid,
  KeyboardAvoidingView,
  ScrollView,
  Alert,
} from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import { useDispatch, useSelector } from 'react-redux';
import type { RootState, AppDispatch } from '../store';
import {
  startEnrollment,
  captureFrame,
  setStep,
  enrollSuccess,
  enrollFailure,
  resetEnrollment,
} from '../store/enrollmentSlice';
import BiometricsService from '../services/BiometricsService';
import { logger } from '../utils/logger';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GUIDE_SIZE = SCREEN_WIDTH * 0.65;

interface EnrollmentScreenProps {
  onBack: () => void;
  onComplete: () => void;
}

export const EnrollmentScreen: React.FC<EnrollmentScreenProps> = ({
  onBack,
  onComplete,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const enrollment = useSelector((state: RootState) => state.enrollment);

  // Form state
  const [username, setUsername] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [phase, setPhase] = useState<'form' | 'capture' | 'result'>('form');
  const [challenge, setChallenge] = useState<{action: string; instruction: string; emoji: string} | null>(null);

  // Camera
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice('front');
  const [hasCameraPermission, setHasCameraPermission] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const resultAnim = useRef(new Animated.Value(0)).current;

  // Pulse animation for face guide
  useEffect(() => {
    if (phase === 'capture') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [phase, pulseAnim]);

  // Entry animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  const requestCameraPermission = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message:
              'Camera access is required to capture your face for enrollment.',
            buttonPositive: 'Allow',
            buttonNegative: 'Deny',
          },
        );
        setHasCameraPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        const status = await Camera.requestCameraPermission();
        setHasCameraPermission(status === 'granted');
        return status === 'granted';
      }
    } catch (err) {
      logger.error('EnrollmentScreen', 'Camera permission error', {
        error: String(err),
      });
      return false;
    }
  }, []);

  const handleStartCapture = useCallback(async () => {
    if (!username.trim() || !employeeId.trim()) return;

    const hasPermission = hasCameraPermission || (await requestCameraPermission());
    if (!hasPermission) {
      Alert.alert('Error', 'Camera permission is required for enrollment.');
      return;
    }

    // Generate challenge token
    try {
      const activeChallenge = await BiometricsService.startLivenessChallenge();
      setChallenge(activeChallenge);
    } catch (err) {
      Alert.alert('Error', 'Failed to generate active liveness challenge.');
      return;
    }

    dispatch(startEnrollment());
    setPhase('capture');
    progressAnim.setValue(0);
  }, [
    username,
    employeeId,
    hasCameraPermission,
    requestCameraPermission,
    dispatch,
    progressAnim,
  ]);

  const handleCaptureFrame = useCallback(async () => {
    if (!cameraRef.current || !challenge) return;

    try {
      dispatch(captureFrame());

      // Animate progress
      Animated.timing(progressAnim, {
        toValue: 1, // Only 1 frame needed now
        duration: 300,
        useNativeDriver: false,
      }).start();

      // Single-Shot: Photo 1
      const photo = await cameraRef.current.takePhoto({
        flash: device?.hasFlash ? 'on' : 'off',
      });

      logger.info('EnrollmentScreen', 'Single-Shot Active Liveness frame captured');

      dispatch(setStep('Running 7-step verification...'));

      const RNFS = require('react-native-fs');
      const base64 = await RNFS.readFile(photo.path, 'base64');
      const userId = `user_${Date.now()}`;

      const result = await BiometricsService.enroll(
        base64,
        userId,
        username,
        challenge.action,
        employeeId
      );

      if (result.success) {
        dispatch(enrollSuccess(result.message));
        logger.info('EnrollmentScreen', 'Enrollment successful', {
          username,
        });
        
        // Animate result card in on success
        setPhase('result');
        setChallenge(null);
        Animated.spring(resultAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }).start();
      } else {
        dispatch(enrollFailure(result.message));
        logger.warn('EnrollmentScreen', 'Enrollment failed', {
          message: result.message,
        });
        Alert.alert('Enrollment Failed', result.message || 'Please try again.');
        
        // Reset progress and generate new challenge so they can retry immediately
        progressAnim.setValue(0);
        dispatch({ type: 'enrollment/resetProgress' }); // Adjust if you have a reset action, or just rely on state
        try {
          const newChallenge = await BiometricsService.startLivenessChallenge();
          setChallenge(newChallenge);
        } catch (err) {
          setChallenge(null);
        }
      }
    } catch (error: any) {
      dispatch(enrollFailure(error.message || 'Capture failed'));
      Alert.alert('Error', error.message || 'Capture failed');
      
      // Reset progress and generate new challenge
      progressAnim.setValue(0);
      try {
        const newChallenge = await BiometricsService.startLivenessChallenge();
        setChallenge(newChallenge);
      } catch (err) {
        setChallenge(null);
      }
    }
  }, [
    enrollment.framesCaptured,
    enrollment.framesRequired,
    username,
    employeeId,
    challenge,
    device,
    dispatch,
    progressAnim,
    resultAnim,
  ]);

  const handleRetry = useCallback(() => {
    dispatch(resetEnrollment());
    setPhase('form');
    resultAnim.setValue(0);
    progressAnim.setValue(0);
    setUsername('');
    setEmployeeId('');
  }, [dispatch, resultAnim, progressAnim]);

  const handleDone = useCallback(() => {
    dispatch(resetEnrollment());
    onComplete();
  }, [dispatch, onComplete]);

  // ─── RESULT PHASE ───
  if (phase === 'result') {
    const isSuccess = enrollment.success === true;
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <Animated.View
          style={[
            styles.resultContainer,
            {
              opacity: resultAnim,
              transform: [
                {
                  scale: resultAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.85, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Result Icon */}
          <View
            style={[
              styles.resultIconCircle,
              { backgroundColor: isSuccess ? '#00E67620' : '#FF525220' },
            ]}
          >
            <Text style={styles.resultIcon}>{isSuccess ? '✅' : '❌'}</Text>
          </View>

          <Text style={styles.resultTitle}>
            {isSuccess ? 'Enrollment Successful' : 'Enrollment Failed'}
          </Text>

          <Text style={styles.resultMessage}>
            {isSuccess
              ? `${username} has been registered in the biometric database. The encrypted face embedding is stored securely on-device.`
              : enrollment.error || 'An unexpected error occurred.'}
          </Text>

          {isSuccess && (
            <View style={styles.resultDetailsCard}>
              <View style={styles.resultDetailRow}>
                <Text style={styles.resultDetailLabel}>Name</Text>
                <Text style={styles.resultDetailValue}>{username}</Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultDetailRow}>
                <Text style={styles.resultDetailLabel}>Employee ID</Text>
                <Text style={styles.resultDetailValue}>{employeeId}</Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultDetailRow}>
                <Text style={styles.resultDetailLabel}>Frames</Text>
                <Text style={styles.resultDetailValue}>
                  {enrollment.framesRequired} captured & averaged
                </Text>
              </View>
              <View style={styles.resultDivider} />
              <View style={styles.resultDetailRow}>
                <Text style={styles.resultDetailLabel}>Security</Text>
                <Text style={[styles.resultDetailValue, { color: '#00E676' }]}>
                  AES-256 encrypted
                </Text>
              </View>
            </View>
          )}

          <View style={styles.resultActions}>
            {isSuccess ? (
              <TouchableOpacity
                style={[styles.button, styles.successButton]}
                onPress={handleDone}
              >
                <Text style={styles.buttonText}>Back to Dashboard</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.button, styles.retryButton]}
                  onPress={handleRetry}
                >
                  <Text style={styles.buttonText}>🔄 Retry</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButtonStyle]}
                  onPress={onBack}
                >
                  <Text style={styles.buttonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
      </SafeAreaView>
    );
  }

  // ─── CAPTURE PHASE ───
  if (phase === 'capture' && device) {
    const capturedRatio =
      enrollment.framesCaptured / enrollment.framesRequired;

    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {/* Header */}
        <View style={styles.captureHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              dispatch(resetEnrollment());
              setPhase('form');
            }}
          >
            <Text style={styles.backText}>✕</Text>
          </TouchableOpacity>
          <View style={styles.captureHeaderCenter}>
            <Text style={styles.captureTitle}>Enrolling: {username}</Text>
            {challenge ? (
              <View style={styles.challengeBadge}>
                <Text style={styles.challengeEmoji}>{challenge.emoji}</Text>
                <Text style={styles.challengeText}>{challenge.instruction}</Text>
              </View>
            ) : (
              <Text style={styles.captureSubtitle}>{enrollment.currentStep}</Text>
            )}
          </View>
        </View>

        {/* Camera */}
        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={true}
          />

          {/* Face Guide Overlay */}
          <View style={styles.cameraOverlay}>
            <Animated.View
              style={[
                styles.faceGuideRing,
                {
                  transform: [{ scale: pulseAnim }],
                  borderColor: capturedRatio >= 1 ? '#00E676' : '#00E67680',
                },
              ]}
            />

            {/* Progress indicators */}
            <View style={styles.frameDotsRow}>
              {Array.from({ length: enrollment.framesRequired }).map(
                (_, i) => (
                  <View
                    key={`dot-${i}`}
                    style={[
                      styles.frameDot,
                      i < enrollment.framesCaptured && styles.frameDotFilled,
                    ]}
                  />
                ),
              )}
            </View>
          </View>
        </View>

        {/* Capture Actions */}
        <View style={styles.captureActions}>
          {enrollment.isEnrolling &&
          enrollment.framesCaptured >= enrollment.framesRequired ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator size="large" color="#00E676" />
              <Text style={styles.processingText}>
                Processing embeddings...
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.captureHint}>
                Frame {enrollment.framesCaptured + 1} of{' '}
                {enrollment.framesRequired}
              </Text>
              <TouchableOpacity
                style={[styles.captureRingButton]}
                onPress={handleCaptureFrame}
                disabled={
                  enrollment.framesCaptured >= enrollment.framesRequired
                }
              >
                <View style={styles.captureInnerCircle} />
              </TouchableOpacity>
              <Text style={styles.captureInstruction}>
                Hold steady and tap to capture
              </Text>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // ─── FORM PHASE (Default) ───
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.formScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View
            style={[
              styles.formContainer,
              {
                opacity: fadeAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            {/* Header */}
            <TouchableOpacity style={styles.formBackButton} onPress={onBack}>
              <Text style={styles.formBackText}>← Back</Text>
            </TouchableOpacity>

            <View style={styles.formHeader}>
              <View style={styles.formIconCircle}>
                <Text style={styles.formIcon}>👤</Text>
              </View>
              <Text style={styles.formTitle}>New User Enrollment</Text>
              <Text style={styles.formSubtitle}>
                Register a new face identity in the encrypted on-device
                database. 3 face frames will be captured and averaged into a
                512-dim embedding.
              </Text>
            </View>

            {/* Form Fields */}
            <View style={styles.formCard}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Vijay Kumar"
                placeholderTextColor="#555"
                value={username}
                onChangeText={setUsername}
                autoCapitalize="words"
                returnKeyType="next"
              />

              <Text style={[styles.inputLabel, { marginTop: 18 }]}>
                Employee ID / Metadata
              </Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. NHAI-EMP-0042"
                placeholderTextColor="#555"
                value={employeeId}
                onChangeText={setEmployeeId}
                autoCapitalize="characters"
                returnKeyType="done"
              />
            </View>

            {/* Security Info */}
            <View style={styles.securityBadge}>
              <Text style={styles.securityIcon}>🔒</Text>
              <Text style={styles.securityText}>
                All biometric data is encrypted with AES-256 and stored
                exclusively on-device. Raw images are never saved.
              </Text>
            </View>

            {/* Start Button */}
            <TouchableOpacity
              style={[
                styles.button,
                styles.startButton,
                (!username.trim() || !employeeId.trim()) &&
                  styles.disabledButton,
              ]}
              onPress={handleStartCapture}
              disabled={!username.trim() || !employeeId.trim()}
            >
              <Text style={styles.buttonText}>📸 Begin Face Capture</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },

  // ─── Form Phase ───
  formScrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  formContainer: {
    flex: 1,
  },
  formBackButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 10,
  },
  formBackText: {
    color: '#00E676',
    fontSize: 16,
    fontWeight: '600',
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 28,
  },
  formIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#2962FF40',
  },
  formIcon: {
    fontSize: 32,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 10,
  },
  formCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 18,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#AAA',
    marginBottom: 8,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: '#111',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 10,
    padding: 14,
    color: '#FFF',
    fontSize: 16,
  },
  securityBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#0D2818',
    borderRadius: 10,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#00E67630',
  },
  securityIcon: {
    fontSize: 18,
    marginRight: 10,
    marginTop: 1,
  },
  securityText: {
    flex: 1,
    fontSize: 12,
    color: '#7ED6A1',
    lineHeight: 17,
  },

  // ─── Buttons ───
  button: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButton: {
    backgroundColor: '#2962FF',
  },
  successButton: {
    backgroundColor: '#00C853',
    flex: 1,
  },
  retryButton: {
    backgroundColor: '#FF6D00',
    flex: 0.55,
    marginRight: 10,
  },
  cancelButtonStyle: {
    backgroundColor: '#424242',
    flex: 0.45,
  },
  disabledButton: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // ─── Capture Phase ───
  captureHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#141414',
    borderBottomWidth: 1,
    borderBottomColor: '#2A2A2A',
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  backText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
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
  captureHeaderCenter: {
    flex: 1,
  },
  captureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  captureSubtitle: {
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
  faceGuideRing: {
    width: GUIDE_SIZE,
    height: GUIDE_SIZE * 1.2,
    borderRadius: GUIDE_SIZE * 0.6,
    borderWidth: 3,
    borderStyle: 'dashed',
  },
  frameDotsRow: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  frameDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#00E676',
    backgroundColor: 'transparent',
  },
  frameDotFilled: {
    backgroundColor: '#00E676',
  },
  captureActions: {
    padding: 24,
    backgroundColor: '#141414',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#2A2A2A',
  },
  captureHint: {
    fontSize: 14,
    color: '#888',
    marginBottom: 14,
  },
  captureRingButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    borderColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  captureInnerCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
  },
  captureInstruction: {
    fontSize: 12,
    color: '#666',
  },
  processingContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  processingText: {
    fontSize: 14,
    color: '#00E676',
    marginTop: 10,
    fontWeight: '600',
  },

  // ─── Result Phase ───
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
  resultIcon: {
    fontSize: 48,
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  resultMessage: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  resultDetailsCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 14,
    padding: 18,
    width: '100%',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    marginBottom: 28,
  },
  resultDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
  },
  resultDetailLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  resultDetailValue: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
    maxWidth: '60%',
    textAlign: 'right',
  },
  resultDivider: {
    height: 1,
    backgroundColor: '#2A2A2A',
  },
  resultActions: {
    flexDirection: 'row',
    width: '100%',
  },
});
