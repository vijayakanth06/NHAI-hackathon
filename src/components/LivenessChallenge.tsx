import React from 'react';
import { StyleSheet, Text, View, Animated, Easing } from 'react-native';

export type LivenessAction = 'smile' | 'blink' | 'turn_left' | 'turn_right' | 'steady';

interface LivenessChallengeProps {
  action: LivenessAction;
  instruction: string;
}

const ACTION_ICONS: Record<LivenessAction, string> = {
  smile: '🙂',
  blink: '👁️',
  turn_left: '⬅️',
  turn_right: '➡️',
  steady: '😐',
};

export const LivenessChallenge: React.FC<LivenessChallengeProps> = ({
  action,
  instruction,
}) => {
  const pulseAnim = React.useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.iconContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Text style={styles.icon}>{ACTION_ICONS[action] || '📷'}</Text>
      </Animated.View>
      <Text style={styles.title}>Liveness Challenge</Text>
      <Text style={styles.instruction}>{instruction}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2962FF50',
    marginBottom: 20,
    width: '90%',
    alignSelf: 'center',
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2962FF20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2962FF',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  instruction: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
    textAlign: 'center',
  },
});
