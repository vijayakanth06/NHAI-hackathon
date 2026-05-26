import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Polyline, Text as SvgText } from 'react-native-svg';
import Animated, { useAnimatedProps } from 'react-native-reanimated';
import {
  LEFT_EYE_INDICES,
  RIGHT_EYE_INDICES,
  MOUTH_INDICES,
} from '../utils/mathUtils';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPolyline = Animated.createAnimatedComponent(Polyline);

interface FaceMeshOverlayProps {
  landmarks: Animated.SharedValue<Array<{ x: number; y: number }>>;
  activeChallenge?: string;
}

export const FaceMeshOverlay: React.FC<FaceMeshOverlayProps> = ({
  landmarks,
  activeChallenge,
}) => {
  // Extract specific regions to highlight them during active challenges
  const leftEyeProps = useAnimatedProps(() => {
    if (!landmarks.value || landmarks.value.length === 0) return { points: '' };
    const points = LEFT_EYE_INDICES.map(
      (i) => `${landmarks.value[i].x},${landmarks.value[i].y}`,
    ).join(' ');
    return { points };
  });

  const rightEyeProps = useAnimatedProps(() => {
    if (!landmarks.value || landmarks.value.length === 0) return { points: '' };
    const points = RIGHT_EYE_INDICES.map(
      (i) => `${landmarks.value[i].x},${landmarks.value[i].y}`,
    ).join(' ');
    return { points };
  });

  const mouthProps = useAnimatedProps(() => {
    if (!landmarks.value || landmarks.value.length === 0) return { points: '' };
    const points = [
      landmarks.value[MOUTH_INDICES.leftCorner],
      landmarks.value[MOUTH_INDICES.upperLip],
      landmarks.value[MOUTH_INDICES.rightCorner],
      landmarks.value[MOUTH_INDICES.lowerLip],
      landmarks.value[MOUTH_INDICES.leftCorner],
    ]
      .map((p) => `${p.x},${p.y}`)
      .join(' ');
    return { points };
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg style={StyleSheet.absoluteFill}>
        {/* Draw all 468 points faintly (optional, good for debugging/demo) */}
        {Array.from({ length: 468 }).map((_, i) => {
          const props = useAnimatedProps(() => {
            if (!landmarks.value || landmarks.value.length === 0)
              return { cx: 0, cy: 0, r: 0 };
            return {
              cx: landmarks.value[i].x,
              cy: landmarks.value[i].y,
              r: 1.5,
            };
          });
          return (
            <AnimatedCircle
              key={`lm-${i}`}
              animatedProps={props}
              fill="rgba(0, 255, 0, 0.3)"
            />
          );
        })}

        {/* Highlight Eyes if challenge is blinking */}
        <AnimatedPolyline
          animatedProps={leftEyeProps}
          stroke={activeChallenge === 'blink' ? '#00FF00' : 'rgba(255,255,255,0.5)'}
          strokeWidth="2"
          fill="none"
        />
        <AnimatedPolyline
          animatedProps={rightEyeProps}
          stroke={activeChallenge === 'blink' ? '#00FF00' : 'rgba(255,255,255,0.5)'}
          strokeWidth="2"
          fill="none"
        />

        {/* Highlight Mouth if challenge is smiling */}
        <AnimatedPolyline
          animatedProps={mouthProps}
          stroke={activeChallenge === 'smile' ? '#00FF00' : 'rgba(255,255,255,0.5)'}
          strokeWidth="2"
          fill="none"
        />
      </Svg>
    </View>
  );
};
