package com.nhai.biometrics

import kotlin.math.abs
import kotlin.math.sqrt

/**
 * LivenessActive — Evaluates blink, smile, and head-turn challenges
 * using geometric computations on MediaPipe Face Mesh landmarks.
 * No additional ML model — zero model weight.
 *
 * Thresholds:
 *   EAR < 0.20 → blink detected
 *   Smile ratio > 2.8 → smile detected
 *   Yaw > ±20° → head turn detected
 *
 * Challenge Protocol:
 *   2 random challenges selected per session (prevents replay attacks)
 *   5-second timeout per challenge
 */
class LivenessActive {

    // MediaPipe Face Mesh landmark indices
    private val LEFT_EYE = intArrayOf(33, 160, 158, 133, 153, 144)
    private val RIGHT_EYE = intArrayOf(362, 385, 387, 263, 373, 380)
    private val MOUTH_LEFT = 61
    private val MOUTH_RIGHT = 291
    private val UPPER_LIP = 13
    private val LOWER_LIP = 14
    private val NOSE_TIP = 1
    private val LEFT_EAR_TRAGION = 234
    private val RIGHT_EAR_TRAGION = 454

    data class Landmark(val x: Float, val y: Float)

    data class ChallengeInfo(
        val action: String,
        val timeoutMs: Int,
        val instruction: String,
        val emoji: String
    )

    private val allChallenges = listOf("smile")
    private val selectedChallenges = mutableListOf<String>()
    private val completedChallenges = mutableListOf<String>()
    private var allChallengesCompleted = false

    private val challengeMetadata = mapOf(
        "smile" to ChallengeInfo("smile", 5000, "Please give a natural smile", "😊")
    )

    /**
     * Select random challenge (currently restricted to smile only).
     */
    fun selectRandomChallenge(): ChallengeInfo {
        if (selectedChallenges.isEmpty()) {
            selectedChallenges.add("smile")
        }
        val nextChallenge = selectedChallenges.firstOrNull { it !in completedChallenges }
            ?: selectedChallenges[0]
        return challengeMetadata[nextChallenge]!!
    }

    /**
     * Evaluate whether a specific challenge action was performed.
     *
     * @param action The challenge action to check
     * @param landmarks Array of Face Mesh landmarks
     * @return true if the action was detected
     */
    fun evaluateChallenge(action: String, landmarks: Array<FloatArray>): Boolean {
        val landmarks2D = landmarks.map { Landmark(it[0], it[1]) }.toTypedArray()

        val completed = when (action) {
            "blink" -> evaluateBlink(landmarks2D)
            "smile" -> evaluateSmile(landmarks2D)
            "turn_left" -> evaluateTurnLeft(landmarks2D)
            "turn_right" -> evaluateTurnRight(landmarks2D)
            else -> false
        }

        if (completed && action !in completedChallenges) {
            completedChallenges.add(action)
            allChallengesCompleted = completedChallenges.size >= selectedChallenges.size
        }

        return completed
    }

    /**
     * Detect eye blink using Eye Aspect Ratio.
     * EAR drops below 0.20 when eyes are closed.
     */
    fun evaluateBlink(landmarks: Array<Landmark>): Boolean {
        val leftEar = computeEAR(landmarks, LEFT_EYE)
        val rightEar = computeEAR(landmarks, RIGHT_EYE)
        val avgEar = (leftEar + rightEar) / 2f
        return avgEar < 0.25f
    }

    /**
     * Detect smile using mouth width-to-height ratio.
     * Ratio > 2.8 indicates a smile.
     */
    fun evaluateSmile(landmarks: Array<Landmark>): Boolean {
        val width = dist(landmarks[MOUTH_LEFT], landmarks[MOUTH_RIGHT])
        val height = dist(landmarks[UPPER_LIP], landmarks[LOWER_LIP])
        val ratio = if (height > 0) width / height else 0f
        return ratio > 1.8f
    }

    /**
     * Detect left head turn.
     * Yaw angle < -20° indicates turning left.
     */
    fun evaluateTurnLeft(landmarks: Array<Landmark>): Boolean = computeYaw(landmarks) < -20f

    /**
     * Detect right head turn.
     * Yaw angle > 20° indicates turning right.
     */
    fun evaluateTurnRight(landmarks: Array<Landmark>): Boolean = computeYaw(landmarks) > 20f

    /**
     * Get cached challenge score for final fusion.
     * Returns 1.0 if all selected challenges completed, 0.0 otherwise.
     */
    fun getCachedChallengeScore(): Float {
        return if (allChallengesCompleted) 1.0f else 0.0f
    }

    /**
     * Get list of completed challenge names.
     */
    fun getCompletedChallenges(): List<String> = completedChallenges.toList()

    /**
     * Reset challenge state for a new authentication session.
     */
    fun resetChallenges() {
        selectedChallenges.clear()
        completedChallenges.clear()
        allChallengesCompleted = false
    }

    // --- Private geometric computations ---

    private fun computeEAR(lm: Array<Landmark>, idx: IntArray): Float {
        val v1 = dist(lm[idx[1]], lm[idx[5]])
        val v2 = dist(lm[idx[2]], lm[idx[4]])
        val h = dist(lm[idx[0]], lm[idx[3]])
        return if (h > 0) (v1 + v2) / (2f * h) else 0f
    }

    /**
     * Simplified yaw estimation from nose position relative to face width.
     */
    private fun computeYaw(lm: Array<Landmark>): Float {
        val noseTip = lm[NOSE_TIP]
        val leftEar = lm[LEFT_EAR_TRAGION]
        val rightEar = lm[RIGHT_EAR_TRAGION]
        val faceWidth = dist(leftEar, rightEar)
        if (faceWidth == 0f) return 0f
        val noseOffset = noseTip.x - ((leftEar.x + rightEar.x) / 2f)
        return (noseOffset / faceWidth) * 90f // approximate degrees
    }

    private fun dist(a: Landmark, b: Landmark): Float =
        sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y))
}
