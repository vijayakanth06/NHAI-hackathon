import React, {useState, useEffect, useRef} from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  PermissionsAndroid,
  Platform,
  TextInput,
  ScrollView,
} from 'react-native';
import {Camera, useCameraDevice} from 'react-native-vision-camera';
import BiometricsService from './src/services/BiometricsService';
import type {AuthResult} from './src/types/biometrics.types';

type CameraAction = 'enroll' | 'authenticate' | null;

function App() {
  const [isInitializing, setIsInitializing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [cameraAction, setCameraAction] = useState<CameraAction>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(false);
  const [cameraPosition, setCameraPosition] = useState<'front' | 'back'>('front');
  const cameraRef = useRef<Camera>(null);
  const device = useCameraDevice(cameraPosition);

  // Enrollment Form State
  const [enrollUsername, setEnrollUsername] = useState('');
  const [enrollData, setEnrollData] = useState('');

  // Authentication Result State
  const [authResult, setAuthResult] = useState<AuthResult | null>(null);

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera Permission',
            message: 'This app needs camera access for biometric authentication.',
            buttonPositive: 'OK',
            buttonNegative: 'Cancel',
          },
        );
        setHasCameraPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
      } else {
        const status = await Camera.requestCameraPermission();
        setHasCameraPermission(status === 'granted');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleInitialize = async () => {
    try {
      setIsInitializing(true);
      await BiometricsService.initialize();
      setIsReady(true);
    } catch (error) {
      console.error(error);
      alert('Failed to initialize models.');
    } finally {
      setIsInitializing(false);
    }
  };

  const captureAndProcess = async () => {
    if (!cameraRef.current || !cameraAction) return;

    try {
      setIsLoading(true);
      const photo = await cameraRef.current.takePhoto({
        qualityPrioritization: 'speed',
        flash: 'off',
      });

      const RNFS = require('react-native-fs');
      const filePath = Platform.OS === 'android' ? `file://${photo.path}` : photo.path;
      const base64 = await RNFS.readFile(photo.path, 'base64');

      if (cameraAction === 'enroll') {
        const userId = `user_${Date.now()}`;
        const result = await BiometricsService.enroll(base64, userId, enrollUsername, enrollData);
        if (result.success) {
          alert(`Successfully enrolled ${enrollUsername}!`);
          setEnrollUsername('');
          setEnrollData('');
        } else {
          alert(`Enrollment failed: ${result.message}`);
        }
      } else if (cameraAction === 'authenticate') {
        const result = await BiometricsService.authenticate(base64);
        setAuthResult(result);
      }
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsLoading(false);
      setCameraAction(null);
    }
  };

  // --- Authentication Success View ---
  if (authResult) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.successContainer}>
          <Text style={styles.successIcon}>
            {authResult.success ? '✅' : '❌'}
          </Text>
          <Text style={styles.successTitle}>
            {authResult.success ? 'Authentication Successful' : 'Authentication Failed'}
          </Text>
          
          {authResult.success ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Welcome back, {authResult.username}!</Text>
              <Text style={styles.cardText}>Employee Data: {authResult.additionalData}</Text>
              <Text style={styles.cardText}>Match Confidence: {(authResult.confidence * 100).toFixed(1)}%</Text>
              <Text style={styles.cardText}>Liveness Score: {(authResult.livenessScore * 100).toFixed(1)}%</Text>
            </View>
          ) : (
            <Text style={styles.errorText}>Face not recognized or spoof detected.</Text>
          )}

          <TouchableOpacity
            style={[styles.button, styles.primaryButton, { marginTop: 40 }]}
            onPress={() => setAuthResult(null)}>
            <Text style={styles.buttonText}>Return to Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // --- Camera overlay view ---
  if (cameraAction && device) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.cameraHeader}>
          <Text style={styles.cameraTitle}>
            {cameraAction === 'enroll'
              ? `📸 Enrolling: ${enrollUsername}`
              : '🔐 Authenticate — Look at the camera'}
          </Text>
        </View>

        <View style={styles.cameraContainer}>
          <Camera
            ref={cameraRef}
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={true}
            photo={true}
          />
          <View style={styles.faceGuide} />
        </View>

        <View style={styles.cameraActions}>
          {isLoading ? (
            <ActivityIndicator size="large" color="#00E676" />
          ) : (
            <>
              <TouchableOpacity
                style={[styles.button, styles.captureButton]}
                onPress={captureAndProcess}>
                <Text style={styles.buttonText}>📷 Capture</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.switchButton]}
                onPress={() => setCameraPosition(prev => prev === 'front' ? 'back' : 'front')}>
                <Text style={styles.buttonText}>🔄 Switch</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={() => setCameraAction(null)}>
                <Text style={styles.buttonText}>✕ Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // --- Main Dashboard View ---
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.title}>NHAI Biometrics</Text>
        <Text style={styles.subtitle}>
          {isReady ? '● System Ready' : '○ Not Initialized'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {!isReady ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>
              The biometric pipeline must be initialized before use. This loads the AI models and encrypted database.
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, { marginTop: 20 }]}
              onPress={handleInitialize}
              disabled={isInitializing}>
              {isInitializing ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text style={styles.buttonText}>Initialize System</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🔐 Attendance</Text>
              <Text style={styles.cardText}>Verify your identity to log attendance.</Text>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton, { marginTop: 15 }]}
                onPress={() => {
                  if (!hasCameraPermission) requestCameraPermission();
                  else setCameraAction('authenticate');
                }}>
                <Text style={styles.buttonText}>Verify Identity</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>📸 New User Enrollment</Text>
              
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#888"
                value={enrollUsername}
                onChangeText={setEnrollUsername}
              />
              <TextInput
                style={styles.input}
                placeholder="Employee ID / Metadata"
                placeholderTextColor="#888"
                value={enrollData}
                onChangeText={setEnrollData}
              />

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.secondaryButton,
                  { marginTop: 15 },
                  (!enrollUsername || !enrollData) && styles.disabledButton,
                ]}
                onPress={() => {
                  if (!hasCameraPermission) requestCameraPermission();
                  else setCameraAction('enroll');
                }}
                disabled={!enrollUsername || !enrollData}>
                <Text style={styles.buttonText}>Start Enrollment</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  header: {
    padding: 20,
    backgroundColor: '#141414',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#00E676',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 6,
    fontWeight: '500',
  },
  scrollContent: {
    padding: 20,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
  },
  cardText: {
    fontSize: 14,
    color: '#BBB',
    lineHeight: 20,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#121212',
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
    padding: 12,
    color: '#FFF',
    fontSize: 16,
    marginTop: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#2962FF',
  },
  secondaryButton: {
    backgroundColor: '#00C853',
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  successIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 30,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#FF5252',
    textAlign: 'center',
    marginTop: 20,
  },
  // Camera styles
  cameraHeader: {
    padding: 20,
    backgroundColor: '#1E1E1E',
    alignItems: 'center',
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  faceGuide: {
    position: 'absolute',
    top: '20%',
    left: '20%',
    width: '60%',
    height: '50%',
    borderRadius: 120,
    borderWidth: 2,
    borderColor: '#00E676',
    borderStyle: 'dashed',
  },
  cameraActions: {
    padding: 20,
    backgroundColor: '#1E1E1E',
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  captureButton: {
    backgroundColor: '#00C853',
    flex: 0.4,
    marginRight: 8,
  },
  switchButton: {
    backgroundColor: '#6200EE',
    flex: 0.3,
    marginRight: 8,
  },
  cancelButton: {
    backgroundColor: '#D50000',
    flex: 0.3,
  },
});

export default App;
