#!/bin/bash

# NHAI Biometrics Android Performance Benchmark Utility
# Parses real-time Android logcat streams to measure execution times for the 7-step pipeline.

echo -e "\033[1;34m========================================================\033[0m"
echo -e "\033[1;32m      NHAI Biometrics Pipeline Latency Monitor          \033[0m"
echo -e "\033[1;34m========================================================\033[0m"
echo "Listening for active USB-connected Android devices..."

# Verify ADB connectivity
ADB_DEV=$(adb devices | grep -v "List" | grep "device" | wc -l)
if [ "$ADB_DEV" -eq 0 ]; then
  echo -e "\033[1;31m[ERROR] No active Android devices detected via adb.\033[0m"
  echo "Ensure Developer Options and USB Debugging are enabled."
  exit 1
fi

echo -e "\033[1;32m[OK] Connected device found. Logging pipeline tags...\033[0m"
echo "Press Ctrl+C to terminate monitor."
echo ""

# Monitor logcat tags corresponding to model loading and authentication execution
adb logcat -v brief | grep --line-buffered -E "BiometricsModule|FaceDetector|FaceMeshProcessor|FaceEmbedder|LivenessActive|LivenessPassive|IrisQualityAssessor|DatabaseManager" | while read -r line; do
  # Add vibrant colors to different log categories
  if [[ "$line" == *"failed"* || "$line" == *"Error"* || "$line" == *"Timeout"* ]]; then
    echo -e "\033[1;31m$line\033[0m" # Red
  elif [[ "$line" == *"ms"* || "$line" == *"Inference"* || "$line" == *"completed"* ]]; then
    echo -e "\033[1;36m$line\033[0m" # Cyan (Performance stats)
  elif [[ "$line" == *"initialized"* || "$line" == *"loaded"* ]]; then
    echo -e "\033[1;32m$line\033[0m" # Green (Successful init)
  else
    echo "$line"
  fi
done
