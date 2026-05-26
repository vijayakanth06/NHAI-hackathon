/**
 * Hackathon 7.0 — Mathematical Utility Functions
 *
 * Geometric computations for active liveness detection using
 * MediaPipe Face Mesh 468-point landmarks.
 *
 * Thresholds:
 *   - EAR < 0.20 → blink detected
 *   - Smile ratio > 2.8 → smile detected
 *   - Cosine similarity ≥ 0.70 → same person
 */

/**
 * Compute Eye Aspect Ratio (EAR) for blink detection.
 *
 * EAR measures the ratio of vertical eye distances to horizontal,
 * dropping significantly when the eye closes.
 *
 * @param landmarks - Array of {x, y} coordinates from Face Mesh
 * @param eyeIndices - 6 landmark indices: [p1, p2, p3, p4, p5, p6]
 *   Left eye:  [33, 160, 158, 133, 153, 144]
 *   Right eye: [362, 385, 387, 263, 373, 380]
 * @returns EAR value — < 0.20 indicates a blink
 */
export function computeEAR(
  landmarks: Array<{ x: number; y: number }>,
  eyeIndices: number[],
): number {
  const [p1, p2, p3, p4, p5, p6] = eyeIndices.map((i) => landmarks[i]);
  const vertical1 = dist(p2, p6);
  const vertical2 = dist(p3, p5);
  const horizontal = dist(p1, p4);
  if (horizontal === 0) return 0;
  return (vertical1 + vertical2) / (2 * horizontal);
}

/**
 * Compute Smile Ratio for smile detection.
 *
 * Measures mouth width relative to height — a smile widens
 * the mouth more than it opens it vertically.
 *
 * @param landmarks - Array of {x, y} coordinates from Face Mesh
 * @param mouthIndices - Landmark indices for mouth corners and lips
 * @returns Ratio — > 2.8 indicates a smile
 */
export function computeSmileRatio(
  landmarks: Array<{ x: number; y: number }>,
  mouthIndices: {
    leftCorner: number;
    rightCorner: number;
    upperLip: number;
    lowerLip: number;
  },
): number {
  const width = dist(
    landmarks[mouthIndices.leftCorner],
    landmarks[mouthIndices.rightCorner],
  );
  const height = dist(
    landmarks[mouthIndices.upperLip],
    landmarks[mouthIndices.lowerLip],
  );
  return height > 0 ? width / height : 0;
}

/**
 * Compute approximate yaw angle from face landmarks.
 *
 * Uses the horizontal offset of the nose tip relative to the
 * midpoint of both ear tragion landmarks, normalized by face width.
 *
 * @param landmarks - Array of {x, y} coordinates from Face Mesh
 * @returns Approximate yaw angle in degrees (negative = left, positive = right)
 *   |yaw| > 20° → head turn detected
 */
export function computeYaw(
  landmarks: Array<{ x: number; y: number }>,
): number {
  // MediaPipe Face Mesh landmark indices
  const noseTip = landmarks[1];
  const leftEar = landmarks[234];
  const rightEar = landmarks[454];

  const faceWidth = dist(leftEar, rightEar);
  if (faceWidth === 0) return 0;

  const noseOffset = noseTip.x - (leftEar.x + rightEar.x) / 2;
  return (noseOffset / faceWidth) * 90; // approximate degrees
}

/**
 * Cosine similarity between two L2-normalized embedding vectors.
 *
 * Since both vectors are already L2-normalized by the FaceLiVT output layer,
 * cosine similarity simplifies to the dot product.
 *
 * @param a - First 512-dim embedding (L2-normalized)
 * @param b - Second 512-dim embedding (L2-normalized)
 * @returns Similarity in range [-1, 1]; threshold ≥ 0.70 → same person
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error(
      `Embedding dimension mismatch: ${a.length} vs ${b.length}`,
    );
  }
  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }
  return dot; // assumes inputs are already L2-normalized
}

/**
 * L2-normalize a vector in-place.
 * Used to normalize embeddings before cosine similarity computation.
 *
 * @param v - Vector to normalize
 * @returns The same array, modified in-place
 */
export function l2Normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) {
    norm += v[i] * v[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < v.length; i++) {
      v[i] /= norm;
    }
  }
  return v;
}

/**
 * Average multiple embeddings element-wise.
 * Used during enrollment to create a stable reference embedding from 3 frames.
 *
 * @param embeddings - Array of 512-dim embeddings
 * @returns Averaged and L2-normalized embedding
 */
export function averageEmbeddings(embeddings: Float32Array[]): Float32Array {
  if (embeddings.length === 0) {
    throw new Error('Cannot average zero embeddings');
  }
  const dim = embeddings[0].length;
  const avg = new Float32Array(dim);

  for (const emb of embeddings) {
    for (let i = 0; i < dim; i++) {
      avg[i] += emb[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    avg[i] /= embeddings.length;
  }

  return l2Normalize(avg);
}

/**
 * Euclidean distance between two 2D points.
 */
function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

// MediaPipe Face Mesh landmark index constants
export const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144];
export const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380];
export const MOUTH_INDICES = {
  leftCorner: 61,
  rightCorner: 291,
  upperLip: 13,
  lowerLip: 14,
};
