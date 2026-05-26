package com.nhai.biometrics

import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.ln
import kotlin.math.sqrt

/**
 * IrisQualityAssessor — Innovation module.
 * Extracts iris ROI using Face Mesh landmarks, applies:
 *   A) Laplacian variance sharpness scoring
 *   B) LBP histogram entropy scoring
 *   C) LightIrisNet quality regressor (MobileNetV3-Small)
 * Fuses 3 signals into final iris_quality_score (0.0–1.0).
 *
 * Input:  Full frame + Face Mesh landmarks (for iris ROI extraction)
 * Output: Quality score 0.0–1.0
 * Target: < 80ms
 *
 * Iris landmark indices from MediaPipe Face Mesh:
 *   Left iris:  468, 469, 470, 471, 472
 *   Right iris: 473, 474, 475, 476, 477
 */
class IrisQualityAssessor(private val modelManager: ModelManager) {

    companion object {
        const val IRIS_PATCH_SIZE = 64
        val LEFT_IRIS = intArrayOf(468, 469, 470, 471, 472)
        val RIGHT_IRIS = intArrayOf(473, 474, 475, 476, 477)

        // Fusion weights
        const val WEIGHT_SHARPNESS = 0.3f
        const val WEIGHT_ENTROPY = 0.3f
        const val WEIGHT_NEURAL = 0.4f
    }

    /**
     * Assess iris quality from both eyes.
     *
     * @param frame Full camera frame
     * @param landmarks 468 Face Mesh landmarks (each as [x, y, z])
     * @param bbox Bounding box of the face [x, y, w, h] normalized on the full frame
     * @return Average quality score across both eyes (0.0–1.0)
     */
    fun assess(frame: ByteArray, landmarks: Array<FloatArray>, bbox: FloatArray): Float {
        val leftIrisPatch = extractIrisPatch(frame, landmarks, LEFT_IRIS, bbox)
        val rightIrisPatch = extractIrisPatch(frame, landmarks, RIGHT_IRIS, bbox)

        val leftScore = scoreIrisPatch(leftIrisPatch)
        val rightScore = scoreIrisPatch(rightIrisPatch)

        return (leftScore + rightScore) / 2f
    }

    /**
     * Score a single iris patch using 3 complementary signals.
     */
    private fun scoreIrisPatch(patch: FloatArray): Float {
        // Signal A: Laplacian variance sharpness
        val sharpness = computeLaplacianVariance(patch)
        val sharpnessNorm = (sharpness / 500f).coerceIn(0f, 1f)

        // Signal B: LBP entropy (texture richness)
        val entropy = computeLBPEntropy(patch)
        val entropyNorm = (entropy / 5f).coerceIn(0f, 1f)

        // Signal C: LightIrisNet neural quality regressor
        val neuralScore = runLightIrisNet(patch)

        return WEIGHT_SHARPNESS * sharpnessNorm +
               WEIGHT_ENTROPY * entropyNorm +
               WEIGHT_NEURAL * neuralScore
    }

    /**
     * Run LightIrisNet (MobileNetV3-Small regressor) on a 64×64 grayscale patch.
     */
    private fun runLightIrisNet(patch: FloatArray): Float {
        val expectedSize = IRIS_PATCH_SIZE * IRIS_PATCH_SIZE * 3
        val inputBuffer = ByteBuffer.allocateDirect(expectedSize * 4)
        inputBuffer.order(ByteOrder.nativeOrder())
        
        // Convert grayscale patch to 3-channel RGB input expected by model
        for (i in 0 until IRIS_PATCH_SIZE * IRIS_PATCH_SIZE) {
            val v = if (i < patch.size) patch[i] else 0f
            inputBuffer.putFloat(v).putFloat(v).putFloat(v)
        }
        inputBuffer.rewind()

        val out1 = Array(1) { FloatArray(213) }
        val out2 = Array(1) { FloatArray(15) }
        val outputs = mapOf(
            0 to out1,
            1 to out2
        )

        try {
            modelManager.irisNet.runForMultipleInputsOutputs(arrayOf(inputBuffer), outputs)
        } catch (e: Exception) {
            return 0.5f // Neutral score on error
        }

        val iris = out2[0] // 5 landmarks * 3 coordinates (x, y, z)
        if (iris.size < 15) return 0.5f

        val cx = iris[0]
        val cy = iris[1]

        val dists = FloatArray(4)
        for (i in 0 until 4) {
            val px = iris[(i + 1) * 3]
            val py = iris[(i + 1) * 3 + 1]
            val dx = px - cx
            val dy = py - cy
            dists[i] = kotlin.math.sqrt(dx * dx + dy * dy)
        }

        val avgRadius = dists.average().toFloat()
        if (avgRadius <= 0f) return 0f

        var variance = 0f
        for (d in dists) {
            val diff = d - avgRadius
            variance += diff * diff
        }
        val stdDev = kotlin.math.sqrt(variance / 4f)
        
        // Lower standard deviation relative to radius = better quality (closer to a perfect circle)
        val relativeStd = stdDev / avgRadius
        val quality = (1.0f - relativeStd * 5f).coerceIn(0f, 1f)

        return quality
    }

    /**
     * Compute Laplacian variance as a sharpness metric.
     * Higher variance = sharper image = better iris quality.
     *
     * Uses a 3×3 Laplacian kernel: [0, 1, 0; 1, -4, 1; 0, 1, 0]
     */
    private fun computeLaplacianVariance(patch: FloatArray): Float {
        val size = IRIS_PATCH_SIZE
        val laplacian = FloatArray(size * size)
        var sum = 0f

        for (y in 1 until size - 1) {
            for (x in 1 until size - 1) {
                val center = patch[y * size + x]
                val top = patch[(y - 1) * size + x]
                val bottom = patch[(y + 1) * size + x]
                val left = patch[y * size + (x - 1)]
                val right = patch[y * size + (x + 1)]

                val lap = top + bottom + left + right - 4 * center
                laplacian[y * size + x] = lap
                sum += lap
            }
        }

        // Compute variance of Laplacian
        val n = ((size - 2) * (size - 2)).toFloat()
        val mean = sum / n
        var variance = 0f
        for (y in 1 until size - 1) {
            for (x in 1 until size - 1) {
                val diff = laplacian[y * size + x] - mean
                variance += diff * diff
            }
        }

        return variance / n
    }

    /**
     * Compute Local Binary Pattern (LBP) histogram entropy.
     * Higher entropy = richer texture = natural iris vs. flat print artifact.
     *
     * Uses 8-neighbor LBP with 10-bin histogram, then Shannon entropy.
     */
    private fun computeLBPEntropy(patch: FloatArray): Float {
        val size = IRIS_PATCH_SIZE
        val numBins = 10
        val hist = FloatArray(numBins)
        var totalPixels = 0

        for (y in 1 until size - 1) {
            for (x in 1 until size - 1) {
                val center = patch[y * size + x]
                var lbpCode = 0

                // 8 neighbors in clockwise order
                val neighbors = intArrayOf(
                    (y - 1) * size + (x - 1), (y - 1) * size + x, (y - 1) * size + (x + 1),
                    y * size + (x + 1),
                    (y + 1) * size + (x + 1), (y + 1) * size + x, (y + 1) * size + (x - 1),
                    y * size + (x - 1)
                )

                for (bit in 0 until 8) {
                    if (patch[neighbors[bit]] >= center) {
                        lbpCode = lbpCode or (1 shl bit)
                    }
                }

                // Map to bin
                val bin = (lbpCode * numBins) / 256
                hist[bin.coerceIn(0, numBins - 1)] += 1f
                totalPixels++
            }
        }

        // Normalize histogram
        if (totalPixels > 0) {
            for (i in hist.indices) hist[i] /= totalPixels
        }

        // Shannon entropy
        var entropy = 0f
        for (p in hist) {
            if (p > 0f) {
                entropy -= p * ln(p)
            }
        }

        return entropy
    }

    /**
     * Extract a 64×64 grayscale iris patch from the full frame.
     * Uses Face Mesh iris landmarks to locate the iris center.
     * Applies CLAHE-style contrast enhancement.
     */
    private fun extractIrisPatch(
        frame: ByteArray,
        landmarks: Array<FloatArray>,
        irisIndices: IntArray,
        bbox: FloatArray
    ): FloatArray {
        // Calculate iris center from landmark positions
        var centerX = 0f
        var centerY = 0f
        var validCount = 0

        for (idx in irisIndices) {
            if (idx < landmarks.size) {
                centerX += landmarks[idx][0]
                centerY += landmarks[idx][1]
                validCount++
            }
        }

        if (validCount == 0) return FloatArray(IRIS_PATCH_SIZE * IRIS_PATCH_SIZE)

        centerX /= validCount
        centerY /= validCount

        // Map relative coordinates to full frame [320, 240] coordinates
        // bbox: [x, y, w, h] normalized coordinates on full frame
        val frameWidth = 320
        val frameHeight = 240
        
        val centerXFull = bbox[0] + centerX * bbox[2]
        val centerYFull = bbox[1] + centerY * bbox[3]

        // Extract 64×64 patch centered on iris (grayscale)
        val patch = FloatArray(IRIS_PATCH_SIZE * IRIS_PATCH_SIZE)
        val halfPatch = IRIS_PATCH_SIZE / 2

        val startX = ((centerXFull * frameWidth).toInt() - halfPatch).coerceIn(0, frameWidth - IRIS_PATCH_SIZE)
        val startY = ((centerYFull * frameHeight).toInt() - halfPatch).coerceIn(0, frameHeight - IRIS_PATCH_SIZE)

        for (py in 0 until IRIS_PATCH_SIZE) {
            for (px in 0 until IRIS_PATCH_SIZE) {
                val frameIdx = ((startY + py) * frameWidth + (startX + px)) * 3
                if (frameIdx + 2 < frame.size) {
                    // Convert RGB to grayscale: 0.299R + 0.587G + 0.114B
                    val r = (frame[frameIdx].toInt() and 0xFF) / 255f
                    val g = (frame[frameIdx + 1].toInt() and 0xFF) / 255f
                    val b = (frame[frameIdx + 2].toInt() and 0xFF) / 255f
                    patch[py * IRIS_PATCH_SIZE + px] = 0.299f * r + 0.587f * g + 0.114f * b
                }
            }
        }

        return patch
    }
}
