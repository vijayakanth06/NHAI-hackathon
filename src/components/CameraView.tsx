import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';

interface CameraViewProps {
  onFrameCapture?: (frameData: any) => void;
  isActive?: boolean;
}

export const CameraView: React.FC<CameraViewProps> = ({
  onFrameCapture,
  isActive = true,
}) => {
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const [permissionGranted, setPermissionGranted] = useState(hasPermission);

  useEffect(() => {
    if (!hasPermission) {
      requestPermission().then(setPermissionGranted);
    }
  }, [hasPermission, requestPermission]);

  // The worklet that runs on every frame at 60fps on a background thread.
  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    if (!onFrameCapture) return;

    // For a real implementation, you would convert the frame to an RGB byte array here,
    // or pass the frame pointer to the native side directly via a C++ JSI binding.
    // For now, we simulate passing the frame.
    runOnJS(onFrameCapture)({
      width: frame.width,
      height: frame.height,
      timestamp: Date.now(),
    });
  }, [onFrameCapture]);

  if (!permissionGranted) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>Camera permission is required.</Text>
      </View>
    );
  }

  if (device == null) {
    return (
      <View style={styles.center}>
        <Text style={styles.text}>No front camera found.</Text>
      </View>
    );
  }

  return (
    <View style={StyleSheet.absoluteFill}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive}
        frameProcessor={frameProcessor}
        // Use 30 or 60 fps depending on device capability
        fps={30}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  text: {
    color: '#fff',
    fontSize: 16,
  },
});
