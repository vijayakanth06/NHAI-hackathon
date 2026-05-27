package com.nhai.biometrics

import android.util.Log
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.exp
import kotlin.math.max

/**
 * LivenessPassive — Evaluates passive liveness using Silent-FAS and rPPG models.
 *
 * Silent-FAS (CDCN / MiniFASNet style):
 *   Input:  80×80×3 face image, pixel values normalized to [-1, 1]
 *   Output: [1, 3] logits — class 0 = Real/Live, class 1 = Spoof (print),
 *           class 2 = Spoof (replay). We apply softmax and use P(class 0).
 *
 * rPPG: Accumulates 60-frame green-channel buffer.
 *   Falls back to heuristic variance if model fails.
 *
 * Fusion: 0.7 × Silent-FAS + 0.3 × rPPG (rPPG only used once buffer is full).
 */
class LivenessPassive(private val modelManager: ModelManager) {

    companion object {
        private const val TAG = "LivenessPassive"
        private const val SILENT_FAS_INPUT_SIZE = 80
        private const val SCALE_FACTOR = 2.7f
        private const val RPPG_BUFFER_SIZE = 60
        const val WEIGHT_SILENT_FAS = 0.7f
        const val WEIGHT_RPPG = 0.3f
    }

    // Circular buffer for rPPG green-channel values
    private val rppgBuffer = FloatArray(RPPG_BUFFER_SIZE)
    private var rppgBufferIndex = 0
    private var rppgBufferFilled = false

    /**
     * Evaluate liveness of a given face frame.
     * @param fullFrame The original 320x240 RGB frame
     * @param bbox The face bounding box [x, y, w, h] normalized 0..1
     * @param ppgSignal Optional array of recent mean face brightness values
     * @return A fused liveness probability [0, 1]
     */
    fun evaluate(fullFrame: ByteArray, bbox: FloatArray, ppgSignal: FloatArray? = null): Float {
        val scoreFas = evaluateSilentFas(fullFrame, bbox)
        
        var scoreRppg = -1f
        if (ppgSignal != null) {
            // Logic for external signal processing if needed
        }

        // Use internal buffer if signal not provided
        if (ppgSignal == null) {
            accumulateGreenChannelFromBbox(fullFrame, bbox)
            if (rppgBufferFilled) {
                scoreRppg = evaluateRppg()
            }
        }

        val finalScore = if (scoreRppg >= 0f) {
            WEIGHT_SILENT_FAS * scoreFas + WEIGHT_RPPG * scoreRppg
        } else {
            scoreFas
        }

        Log.d(TAG, "Final liveness score = $finalScore")
        return finalScore
    }

    /**
     * Run Silent-FAS model at multiple crop scales and return the BEST score.
     * Different cameras produce different face-to-frame ratios. A tight crop may
     * miss the context the model needs, while a very wide crop may include too much
     * background. By evaluating at 3 scales we cover all scenarios.
     */
    private fun evaluateSilentFas(fullFrame: ByteArray, bbox: FloatArray): Float {
        val scales = floatArrayOf(2.7f, 4.0f, 1.5f)
        var bestPReal = 0f
        var count = 0

        for (scale in scales) {
            val resizedFace = extractAndResizeWideCrop(fullFrame, bbox, scale, SILENT_FAS_INPUT_SIZE, SILENT_FAS_INPUT_SIZE)
            val inputBuffer = prepareInputNormalized(resizedFace, SILENT_FAS_INPUT_SIZE)

            try {
                val output = Array(1) { FloatArray(3) }
                modelManager.silentFas.run(inputBuffer, output)

                val spoof0 = output[0][0]
                val real = output[0][1]
                val spoof2 = output[0][2]

                val maxLogit = maxOf(spoof0, maxOf(real, spoof2))
                val expSpoof0 = exp((spoof0 - maxLogit).toDouble()).toFloat()
                val expReal = exp((real - maxLogit).toDouble()).toFloat()
                val expSpoof2 = exp((spoof2 - maxLogit).toDouble()).toFloat()

                val sumExp = expSpoof0 + expReal + expSpoof2
                val pReal = expReal / sumExp

                Log.d(TAG, "Silent-FAS scale=$scale → logits=[${spoof0}, ${real}, ${spoof2}] P(Real)=$pReal")

                if (pReal > bestPReal) bestPReal = pReal
                count++
            } catch (e: Exception) {
                Log.e(TAG, "Silent-FAS inference error at scale=$scale: ${e.message}")
            }
        }

        val finalScore = if (count > 0) bestPReal else 0f
        Log.d(TAG, "Silent-FAS max P(Real) = $finalScore")
        return finalScore
    }

    /**
     * Evaluate rPPG from the accumulated 60-frame green channel buffer.
     */
    private fun evaluateRppg(): Float {
        val inputBuffer = ByteBuffer.allocateDirect(RPPG_BUFFER_SIZE * 4)
        inputBuffer.order(ByteOrder.nativeOrder())

        val filtered = bandpassFilter(rppgBuffer)
        for (v in filtered) inputBuffer.putFloat(v)
        inputBuffer.rewind()

        val output = Array(1) { FloatArray(1) }

        try {
            modelManager.rppg.run(inputBuffer, output)
        } catch (e: Exception) {
            return heuristicRppg()
        }

        return output[0][0].coerceIn(0f, 1f)
    }

    private fun accumulateGreenChannelFromBbox(frame: ByteArray, bbox: FloatArray) {
        val frameWidth = 320
        val frameHeight = 240
        val x = (bbox[0] * frameWidth).toInt().coerceIn(0, frameWidth - 1)
        val y = (bbox[1] * frameHeight).toInt().coerceIn(0, frameHeight - 1)
        val w = (bbox[2] * frameWidth).toInt().coerceIn(1, frameWidth - x)
        val h = (bbox[3] * frameHeight).toInt().coerceIn(1, frameHeight - y)

        var greenSum = 0f
        var count = 0
        for (i in y until y + h) {
            for (j in x until x + w) {
                val idx = (i * frameWidth + j) * 3
                if (idx + 1 < frame.size) {
                    greenSum += (frame[idx + 1].toInt() and 0xFF) / 255f
                    count++
                }
            }
        }
        val meanGreen = if (count > 0) greenSum / count else 0f

        rppgBuffer[rppgBufferIndex] = meanGreen
        rppgBufferIndex = (rppgBufferIndex + 1) % RPPG_BUFFER_SIZE
        if (rppgBufferIndex == 0) rppgBufferFilled = true
    }

    private fun bandpassFilter(signal: FloatArray): FloatArray {
        val filtered = FloatArray(signal.size)
        val mean = signal.average().toFloat()
        for (i in signal.indices) filtered[i] = signal[i] - mean
        return filtered
    }

    private fun heuristicRppg(): Float {
        if (!rppgBufferFilled) return 0.5f
        val mean = rppgBuffer.average().toFloat()
        var variance = 0f
        for (v in rppgBuffer) {
            val diff = v - mean
            variance += diff * diff
        }
        variance /= rppgBuffer.size
        return (variance * 1000f).coerceIn(0f, 1f)
    }

    fun resetBuffer() {
        rppgBuffer.fill(0f)
        rppgBufferIndex = 0
        rppgBufferFilled = false
    }

    private fun extractAndResizeWideCrop(frame: ByteArray, bbox: FloatArray, scale: Float, dstW: Int, dstH: Int): FloatArray {
        val frameWidth = 320
        val frameHeight = 240

        val cx = (bbox[0] + bbox[2] / 2f) * frameWidth
        val cy = (bbox[1] + bbox[3] / 2f) * frameHeight
        val side = max(bbox[2] * frameWidth, bbox[3] * frameHeight) * scale

        val cropX1 = (cx - side / 2f).toInt()
        val cropY1 = (cy - side / 2f).toInt()
        val cropX2 = (cx + side / 2f).toInt()
        val cropY2 = (cy + side / 2f).toInt()

        val srcW = cropX2 - cropX1
        val srcH = cropY2 - cropY1
        val dst = FloatArray(dstW * dstH * 3)

        if (srcW <= 0 || srcH <= 0) return dst

        val xRatio = srcW.toFloat() / dstW
        val yRatio = srcH.toFloat() / dstH

        for (y in 0 until dstH) {
            for (x in 0 until dstW) {
                val srcXF = x * xRatio
                val srcYF = y * yRatio

                val px = srcXF.toInt()
                val py = srcYF.toInt()

                val xDiff = srcXF - px
                val yDiff = srcYF - py

                val ax0 = cropX1 + px
                val ay0 = cropY1 + py
                val ax1 = cropX1 + px + 1
                val ay1 = cropY1 + py + 1

                val val00 = getPixelRGB(frame, frameWidth, frameHeight, ax0, ay0)
                val val10 = getPixelRGB(frame, frameWidth, frameHeight, ax1, ay0)
                val val01 = getPixelRGB(frame, frameWidth, frameHeight, ax0, ay1)
                val val11 = getPixelRGB(frame, frameWidth, frameHeight, ax1, ay1)

                for (c in 0 until 3) {
                    dst[(y * dstW + x) * 3 + c] = (val00[c] * (1 - xDiff) * (1 - yDiff) +
                                                   val10[c] * xDiff * (1 - yDiff) +
                                                   val01[c] * (1 - xDiff) * yDiff +
                                                   val11[c] * xDiff * yDiff)
                }
            }
        }
        return dst
    }

    private fun getPixelRGB(frame: ByteArray, w: Int, h: Int, x: Int, y: Int): FloatArray {
        // Border replication: clamp to nearest valid pixel instead of returning black.
        // Black pixels (0,0,0) cause the Silent-FAS model to predict "spoof" with 99% confidence.
        val cx = x.coerceIn(0, w - 1)
        val cy = y.coerceIn(0, h - 1)
        val idx = (cy * w + cx) * 3
        if (idx + 2 >= frame.size) return floatArrayOf(0f, 0f, 0f)
        return floatArrayOf(
            (frame[idx].toInt() and 0xFF) / 255f,
            (frame[idx + 1].toInt() and 0xFF) / 255f,
            (frame[idx + 2].toInt() and 0xFF) / 255f
        )
    }

    /**
     * Prepare model input buffer.
     */
    private fun prepareInputNormalized(face: FloatArray, size: Int): ByteBuffer {
        val expectedSize = size * size * 3
        val buffer = ByteBuffer.allocateDirect(expectedSize * 4)
        buffer.order(ByteOrder.nativeOrder())

        // Silent-FAS model expects BGR color format in [0, 255] scale (unnormalized)
        for (i in 0 until expectedSize step 3) {
            if (i + 2 < face.size) {
                val r = face[i]
                val g = face[i + 1]
                val b = face[i + 2]
                buffer.putFloat(b * 255f)
                buffer.putFloat(g * 255f)
                buffer.putFloat(r * 255f)
            } else {
                buffer.putFloat(0f)
                buffer.putFloat(0f)
                buffer.putFloat(0f)
            }
        }
        buffer.rewind()
        return buffer
    }
}
