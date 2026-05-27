import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, Animated } from 'react-native';

interface ChallengeTimerProps {
  durationSeconds: number;
  onTimeout: () => void;
  isActive: boolean;
}

export const ChallengeTimer: React.FC<ChallengeTimerProps> = ({
  durationSeconds,
  onTimeout,
  isActive,
}) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const progressAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isActive) return;

    setTimeLeft(durationSeconds);
    progressAnim.setValue(1);

    Animated.timing(progressAnim, {
      toValue: 0,
      duration: durationSeconds * 1000,
      useNativeDriver: false,
    }).start();

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isActive, durationSeconds, onTimeout, progressAnim]);

  const barColor = progressAnim.interpolate({
    inputRange: [0, 0.3, 1],
    outputRange: ['#FF5252', '#FFEA00', '#00E676'], // Red -> Yellow -> Green
  });

  return (
    <View style={styles.container}>
      <Text style={styles.timeText}>{Math.max(0, timeLeft)}s remaining</Text>
      <View style={styles.progressBarBg}>
        <Animated.View
          style={[
            styles.progressBarFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: barColor,
            },
          ]}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    marginVertical: 10,
  },
  timeText: {
    fontSize: 14,
    color: '#FFF',
    fontWeight: '600',
    marginBottom: 6,
  },
  progressBarBg: {
    width: '80%',
    height: 6,
    backgroundColor: '#333',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});
