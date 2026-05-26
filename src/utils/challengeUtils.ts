/**
 * Hackathon 7.0 — Challenge Utility Functions
 *
 * Manages active liveness challenge selection and metadata.
 * 2 random challenges are selected per session from a pool of 4,
 * preventing replay attacks with scripted sequences.
 */

import type { ChallengeType, ChallengeInstruction } from '../types/biometrics.types';

/** All available challenge types */
const ALL_CHALLENGES: ChallengeType[] = [
  'blink',
  'smile',
  'turn_left',
  'turn_right',
];

/** Human-readable metadata for each challenge type */
export const CHALLENGE_METADATA: Record<
  ChallengeType,
  { instruction: string; emoji: string }
> = {
  blink: {
    instruction: 'Please blink your eyes',
    emoji: '👁️',
  },
  smile: {
    instruction: 'Please give a natural smile',
    emoji: '😊',
  },
  turn_left: {
    instruction: 'Turn your head to the left',
    emoji: '⬅️',
  },
  turn_right: {
    instruction: 'Turn your head to the right',
    emoji: '➡️',
  },
};

/** Default timeout for each challenge in milliseconds */
export const CHALLENGE_TIMEOUT_MS = 5000;

/**
 * Select 2 random challenges in random order for the current session.
 *
 * This randomization prevents replay attacks where an attacker
 * could pre-record a video performing challenges in a known order.
 *
 * @returns Array of exactly 2 ChallengeType values in random order
 */
export function selectChallenges(): ChallengeType[] {
  const shuffled = [...ALL_CHALLENGES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 2);
}

/**
 * Build a full ChallengeInstruction from a ChallengeType.
 *
 * @param action - The challenge type
 * @returns Complete ChallengeInstruction with timeout, text, and emoji
 */
export function buildChallengeInstruction(
  action: ChallengeType,
): ChallengeInstruction {
  const meta = CHALLENGE_METADATA[action];
  return {
    action,
    timeoutMs: CHALLENGE_TIMEOUT_MS,
    instruction: meta.instruction,
    emoji: meta.emoji,
  };
}

/**
 * Get all available challenge types.
 *
 * @returns Copy of the full challenge array
 */
export function getAllChallenges(): ChallengeType[] {
  return [...ALL_CHALLENGES];
}
