# @nhai/biometrics-sdk

Plug-and-play **Offline Facial Recognition & Liveness Detection SDK** packaged specifically for NHAI Datalake 3.0 attendance and identity systems.

Developed under **NHAI Hackathon 7.0**, this SDK features a unified **7-step active and passive security pipeline** that executes wholly on-device in **under 1000ms** on mid-range hardware.

---

## Key Technical Features
*   **7 AI Models Built-in**: Seamlessly loads FeatherFace, Zero-DCE, Face Mesh (468 landmarks), MobileFaceNet, Silent-FAS, rPPG motion checks, and LightIrisNet.
*   **Zero Cloud Reliance**: Executes all algorithms on background worker threads (GCD/Kotlin Coroutines) without server callbacks.
*   **Defense-in-Depth Cryptography**: Secure local SQLite database encrypted with **SQLCipher (AES-256)**. Cryptographic keys bound directly to Android Keystore / iOS Keychain.
*   **Automatic Synced Offline Queue**: Automatically buffers scans offline, pushes to AWS AppSync when online is restored, and immediately purges local cached records.

---

## ⚡ 3-Line Integration Guide

### 1. Installation
Add the SDK to your Datalake 3.0 project:
```bash
npm install @nhai/biometrics-sdk
```

Ensure peer dependencies (`react-native-vision-camera`, `react-native-fs`, and `@react-native-community/netinfo`) are installed and autolinked.

### 2. Initialization (App.tsx Startup)
Initialize once at app startup to load the models and decrypt the local cache:
```typescript
import { BiometricsSDK } from '@nhai/biometrics-sdk';

useEffect(() => {
  BiometricsSDK.initialize()
    .then(() => console.log('Biometric Pipeline Loaded'))
    .catch((err) => console.error('Model loading failed', err));
    
  return () => {
    BiometricsSDK.dispose(); // clean up resources when app closes
  };
}, []);
```

### 3. Verification Scan
Trigger the 7-step pipeline from any controller:
```typescript
import { BiometricsSDK } from '@nhai/biometrics-sdk';

const handleScan = async (base64Frame: string, challenge: string) => {
  const result = await BiometricsSDK.authenticate(base64Frame, challenge);
  
  if (result.success) {
    console.log(`Verified employee: ${result.username} (Confidence: ${result.confidence * 100}%)`);
  } else {
    console.warn(`Spoof/Mismatch detected. Reason: ${result.errorMessage}`);
  }
};
```

---

## API Reference

### `BiometricsSDK.initialize(): Promise<void>`
Initializes the database, keystore, and loads 7 TFLite models.

### `BiometricsSDK.enroll(base64Image, userId, username, challengeAction, additionalData?): Promise<EnrollmentResult>`
Enrolls a new employee's face embedding after validating landmarks and active liveness. The `userId` is SHA-256 hashed before disk write.

### `BiometricsSDK.authenticate(base64Image, challengeAction): Promise<AuthResult>`
Performs low-light enhancement, facial land-marking, vector similarity comparison, passive and active anti-spoof checks, and iris assessment.

### `BiometricsSDK.getSyncStatus(): Promise<SyncStatus>`
Retrieves the total pending offline records waiting to be synchronized.

### `BiometricsSDK.syncAndPurge(): Promise<SyncResult>`
Triggers an immediate network sync to AWS DataStore and prunes successfully written database rows.

---

## Development & Testing
To view deep specs, architecture diagrams, security keys, or run native benchmarks, refer to the root `/docs/` directory inside this repository.
