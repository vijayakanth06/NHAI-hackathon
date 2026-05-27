# Developer Integration Guide — NHAI Biometrics

This guide helps NHAI Datalake 3.0 core developers embed the `@nhai/biometrics-sdk` module into their primary codebases.

---

## 📋 Prerequisites

Ensure your React Native project satisfies:
*   **React Native**: $\ge 0.74.x$
*   **Android SDK**: `minSdkVersion 26` (Android 8.0 Oreo), `targetSdkVersion 34`
*   **iOS SDK**: `Deployment Target 12.0` (or higher), Xcode $\ge 15.0$

---

## ⚙️ Step-by-Step Setup

### Step 1: Install Package dependencies
Install the NPM module and its necessary peer interfaces:
```bash
npm install @nhai/biometrics-sdk react-native-vision-camera react-native-fs @react-native-community/netinfo
```

### Step 2: Bundle TFLite Models

AI models must be bundled directly in your native platforms' asset compilation targets:

#### Android Assets Setup
1. Create target assets folder:
   ```bash
   mkdir -p android/app/src/main/assets/models/
   ```
2. Copy the 5 loaded `.tflite` model files into this folder.

#### iOS Assets Setup
1. In Xcode, right-click your root project folder.
2. Select **Add Files to "YourAppName"...**
3. Create a folder group named `models/`, add the 5 `.tflite` files, and ensure they are ticked for the target application build target.

---

## 🛠️ Configure Permissions

### Android Settings (`AndroidManifest.xml`)
Verify you request camera and system storage capabilities:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
```

### iOS Settings (`Info.plist`)
Request camera capability and provide audit explanations:
```xml
<key>NSCameraUsageDescription</key>
<string>NHAI requires active camera authorization to run facial authentication and spoof checks.</string>
```

---

## 🧪 Integration Example

Create a beautiful camera scanner screen by integrating our React Native view components:

```typescript
import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import { BiometricsSDK } from '@nhai/biometrics-sdk';
import { Camera, useCameraDevice } from 'react-native-vision-camera';

export const CoreAttendanceScanner = () => {
  const [ready, setReady] = useState(false);
  const device = useCameraDevice('front');

  useEffect(() => {
    // Decrypt DB and allocate AI buffers
    BiometricsSDK.initialize()
      .then(() => setReady(true))
      .catch((err) => Alert.alert('Startup Error', err.message));

    return () => {
      BiometricsSDK.dispose();
    };
  }, []);

  const triggerVerification = async (photoPath: string) => {
    const RNFS = require('react-native-fs');
    const base64Str = await RNFS.readFile(photoPath, 'base64');
    
    // Evaluate facial capture against natural smile challenge
    const result = await BiometricsSDK.authenticate(base64Str, 'smile');
    
    if (result.success) {
      Alert.alert('Welcome!', `Logged employee ${result.username}`);
    } else {
      Alert.alert('Scan Refused', result.errorMessage);
    }
  };

  if (!device || !ready) {
    return <Text style={styles.loading}>Loading Biometric Pipeline...</Text>;
  }

  return (
    <View style={styles.container}>
      <Camera style={StyleSheet.absoluteFill} device={device} isActive={true} photo={true} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loading: { color: '#FFF', textAlign: 'center', marginTop: 100 },
});
```
---

## 🔍 Troubleshooting Compiles

### Android SQLCipher Conflict
If you run into native library loader conflicts, append this line to your `android/app/build.gradle` dependencies closure:
```groovy
implementation "org.zetetic:sqlcipher-android:4.5.4@aar"
```

### iOS CocoaPods Autolink
If libraries are missing compile bindings under iOS:
```bash
cd ios && pod install --repo-update
```
