import {
  computeEAR,
  computeSmileRatio,
  computeYaw,
  cosineSimilarity,
  l2Normalize,
  averageEmbeddings,
  LEFT_EYE_INDICES,
  RIGHT_EYE_INDICES,
  MOUTH_INDICES,
} from '../src/utils/mathUtils';

describe('mathUtils', () => {
  describe('computeEAR (Blink Detection)', () => {
    it('returns EAR > 0.20 for open eyes', () => {
      // Mock 468-point landmarks array with open eye coordinates for left eye
      const landmarks = Array(468).fill({ x: 0, y: 0 });
      // p1 to p6
      landmarks[33] = { x: 0, y: 5 }; // Left
      landmarks[160] = { x: 2, y: 8 }; // Top 1
      landmarks[158] = { x: 4, y: 8 }; // Top 2
      landmarks[133] = { x: 6, y: 5 }; // Right
      landmarks[153] = { x: 4, y: 2 }; // Bottom 2
      landmarks[144] = { x: 2, y: 2 }; // Bottom 1
      
      const ear = computeEAR(landmarks, LEFT_EYE_INDICES);
      expect(ear).toBeGreaterThan(0.20);
    });

    it('returns EAR < 0.20 for closed eyes (blink)', () => {
      const landmarks = Array(468).fill({ x: 0, y: 0 });
      // p1 to p6, flattened vertically
      landmarks[33] = { x: 0, y: 5 };
      landmarks[160] = { x: 2, y: 5.2 };
      landmarks[158] = { x: 4, y: 5.2 };
      landmarks[133] = { x: 6, y: 5 };
      landmarks[153] = { x: 4, y: 4.8 };
      landmarks[144] = { x: 2, y: 4.8 };
      
      const ear = computeEAR(landmarks, LEFT_EYE_INDICES);
      expect(ear).toBeLessThan(0.20);
    });
  });

  describe('computeSmileRatio (Smile Detection)', () => {
    it('returns ratio < 2.8 for neutral mouth', () => {
      const landmarks = Array(468).fill({ x: 0, y: 0 });
      landmarks[MOUTH_INDICES.leftCorner] = { x: 2, y: 5 };
      landmarks[MOUTH_INDICES.rightCorner] = { x: 8, y: 5 };
      landmarks[MOUTH_INDICES.upperLip] = { x: 5, y: 7 };
      landmarks[MOUTH_INDICES.lowerLip] = { x: 5, y: 3 }; // height = 4, width = 6. Ratio = 1.5
      
      const ratio = computeSmileRatio(landmarks, MOUTH_INDICES);
      expect(ratio).toBeLessThan(2.8);
    });

    it('returns ratio > 2.8 for smiling mouth', () => {
      const landmarks = Array(468).fill({ x: 0, y: 0 });
      landmarks[MOUTH_INDICES.leftCorner] = { x: 1, y: 6 };
      landmarks[MOUTH_INDICES.rightCorner] = { x: 9, y: 6 }; // width = 8
      landmarks[MOUTH_INDICES.upperLip] = { x: 5, y: 5.5 };
      landmarks[MOUTH_INDICES.lowerLip] = { x: 5, y: 3.5 }; // height = 2. Ratio = 4.0
      
      const ratio = computeSmileRatio(landmarks, MOUTH_INDICES);
      expect(ratio).toBeGreaterThan(2.8);
    });
  });

  describe('computeYaw (Head Turn Detection)', () => {
    it('returns yaw near 0 for straight face', () => {
      const landmarks = Array(468).fill({ x: 0, y: 0 });
      landmarks[234] = { x: -50, y: 0 }; // Left ear
      landmarks[454] = { x: 50, y: 0 };  // Right ear
      landmarks[1] = { x: 0, y: 0 };     // Nose exactly in middle
      
      const yaw = computeYaw(landmarks);
      expect(yaw).toBeCloseTo(0);
    });

    it('returns negative yaw < -20 for looking left', () => {
      const landmarks = Array(468).fill({ x: 0, y: 0 });
      landmarks[234] = { x: -30, y: 0 };
      landmarks[454] = { x: 70, y: 0 };
      landmarks[1] = { x: -10, y: 0 }; // Nose shifted towards left ear. midpoint is 20. nose is -10. Offset = -30. width = 100.
      
      const yaw = computeYaw(landmarks);
      expect(yaw).toBeLessThan(-20);
    });

    it('returns positive yaw > 20 for looking right', () => {
      const landmarks = Array(468).fill({ x: 0, y: 0 });
      landmarks[234] = { x: -70, y: 0 };
      landmarks[454] = { x: 30, y: 0 };
      landmarks[1] = { x: 10, y: 0 }; // Nose shifted towards right ear.
      
      const yaw = computeYaw(landmarks);
      expect(yaw).toBeGreaterThan(20);
    });
  });

  describe('cosineSimilarity', () => {
    it('returns 1 for identical normalized embeddings', () => {
      const a = new Float32Array([0.6, 0.8]);
      const b = new Float32Array([0.6, 0.8]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(1);
    });

    it('returns 0 for orthogonal embeddings', () => {
      const a = new Float32Array([1, 0]);
      const b = new Float32Array([0, 1]);
      expect(cosineSimilarity(a, b)).toBeCloseTo(0);
    });
  });

  describe('averageEmbeddings', () => {
    it('averages and normalizes correctly', () => {
      const a = new Float32Array([1, 0]);
      const b = new Float32Array([0, 1]);
      const result = averageEmbeddings([a, b]);
      expect(result[0]).toBeCloseTo(Math.SQRT1_2);
      expect(result[1]).toBeCloseTo(Math.SQRT1_2);
    });
  });
});
