/**
 * Hackathon 7.0 — Score Fusion Utilities
 *
 * Implements the final decision logic for the 7-step biometric pipeline.
 * Fuses passive liveness, active liveness, and iris quality scores
 * into a single liveness decision, combined with face recognition.
 *
 * Decision Thresholds:
 *   - Liveness Score ≥ 0.75 (fused from 3 components)
 *   - Face Similarity ≥ 0.70 (cosine similarity on 512-dim embeddings)
 *   - BOTH must pass for authentication success
 *
 * Score Weights:
 *   Passive liveness: 0.35 (Silent-FAS 0.6 + rPPG 0.4)
 *   Active liveness:  0.35 (geometric challenge verification)
 *   Iris quality:     0.30 (Laplacian + LBP + LightIrisNet)
 */

/** Minimum liveness score required for authentication */
export const LIVENESS_THRESHOLD = 0.75;

/** Minimum cosine similarity required for face match */
export const SIMILARITY_THRESHOLD = 0.70;

/** Weight for passive liveness in final fusion */
export const WEIGHT_PASSIVE = 0.35;

/** Weight for active liveness in final fusion */
export const WEIGHT_ACTIVE = 0.35;

/** Weight for iris quality in final fusion */
export const WEIGHT_IRIS = 0.30;

/** Weight for Silent-FAS within passive liveness */
export const WEIGHT_SILENT_FAS = 0.6;

/** Weight for rPPG within passive liveness */
export const WEIGHT_RPPG = 0.4;

/**
 * Input scores from each pipeline step.
 */
export interface PipelineScores {
  /** Silent-FAS passive liveness score (0.0–1.0) */
  silentFasScore: number;
  /** rPPG cardiac signal liveness score (0.0–1.0), or -1 if not yet ready */
  rppgScore: number;
  /** Active challenge score: 1.0 = all passed, 0.0 = any failed */
  activeChallengeScore: number;
  /** Iris texture quality score (0.0–1.0) */
  irisQualityScore: number;
  /** Face embedding cosine similarity (0.0–1.0) */
  faceSimilarity: number;
}

/**
 * Fused score output with final authentication decision.
 */
export interface FusionResult {
  /** Combined liveness score from all 3 components (0.0–1.0) */
  livenessScore: number;
  /** Passive-only liveness score (Silent-FAS + rPPG) */
  passiveScore: number;
  /** Whether authentication succeeded */
  success: boolean;
}

/**
 * Fuse all pipeline scores into a final authentication decision.
 *
 * Fusion hierarchy:
 *   1. Passive liveness = 0.6 × Silent-FAS + 0.4 × rPPG
 *      (fallback: Silent-FAS only if rPPG not ready)
 *   2. Final liveness = 0.35 × passive + 0.35 × active + 0.30 × iris
 *   3. Success = (liveness ≥ 0.75) AND (similarity ≥ 0.70)
 *
 * @param scores - Individual scores from each pipeline step
 * @returns FusionResult with final scores and decision
 */
export function fuseScores(scores: PipelineScores): FusionResult {
  // Step 5: Passive liveness fusion (Silent-FAS + rPPG)
  const passiveScore =
    scores.rppgScore >= 0
      ? WEIGHT_SILENT_FAS * scores.silentFasScore +
        WEIGHT_RPPG * scores.rppgScore
      : scores.silentFasScore; // fallback if rPPG buffer not ready

  // Final liveness fusion (Steps 5 + 6 + 7)
  const livenessScore =
    WEIGHT_PASSIVE * passiveScore +
    WEIGHT_ACTIVE * scores.activeChallengeScore +
    WEIGHT_IRIS * scores.irisQualityScore;

  // Final decision: BOTH liveness AND face recognition must pass
  const success =
    livenessScore >= LIVENESS_THRESHOLD &&
    scores.faceSimilarity >= SIMILARITY_THRESHOLD;

  return { livenessScore, passiveScore, success };
}

/**
 * Clamp a value to the [0, 1] range.
 * Used to normalize raw model outputs before fusion.
 *
 * @param value - Raw score
 * @returns Clamped value in [0.0, 1.0]
 */
export function clampScore(value: number): number {
  return Math.max(0, Math.min(1, value));
}
