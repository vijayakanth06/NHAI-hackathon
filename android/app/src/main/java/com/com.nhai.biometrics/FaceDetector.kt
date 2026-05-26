package com.nhai.biometrics

import android.util.Log
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.exp
import kotlin.math.max

class FaceDetector(private val modelManager: ModelManager) {

    companion object {
        private const val TAG = "FaceDetector"
        const val INPUT_WIDTH = 128
        const val INPUT_HEIGHT = 128
        const val INPUT_CHANNELS = 3
        // Lowered from 0.6 to 0.5 to allow detections at wider angles / distances
        const val CONFIDENCE_THRESHOLD = 0.5f
        const val NUM_ANCHORS = 896
    }

    private val anchors: Array<FloatArray> = generateAnchors()

    data class FaceResult(
        val boundingBox: FloatArray,     // [x, y, width, height] normalized 0-1
        val keypoints: FloatArray,       // 6 x 2 values
        val confidence: Float,
        val croppedFace: FloatArray,
        val meanBrightness: Float
    )

    private fun generateAnchors(): Array<FloatArray> {
        val anchors = ArrayList<FloatArray>()
        // Stride 8: 16x16 grid, 2 anchors
        for (y in 0 until 16) {
            for (x in 0 until 16) {
                val cx = (x + 0.5f) / 16f
                val cy = (y + 0.5f) / 16f
                anchors.add(floatArrayOf(cx, cy))
                anchors.add(floatArrayOf(cx, cy))
            }
        }
        // Stride 16: 8x8 grid, 6 anchors
        for (y in 0 until 8) {
            for (x in 0 until 8) {
                val cx = (x + 0.5f) / 8f
                val cy = (y + 0.5f) / 8f
                for (i in 0 until 6) {
                    anchors.add(floatArrayOf(cx, cy))
                }
            }
        }
        return anchors.toTypedArray()
    }

    fun detect(frame: ByteArray): FaceResult? {
        val inputBuffer = preprocessFrame(frame)

        val outputRegressors = Array(1) { Array(NUM_ANCHORS) { FloatArray(16) } }
        val outputClassificators = Array(1) { Array(NUM_ANCHORS) { FloatArray(1) } }

        val outputs = mapOf(
            0 to outputRegressors,
            1 to outputClassificators
        )

        try {
            modelManager.faceDetect.runForMultipleInputsOutputs(arrayOf(inputBuffer), outputs)
        } catch (e: Exception) {
            throw Exception("FeatherFace Inference Error: ${e.message}", e)
        }

        val regressors = outputRegressors[0]
        val classificators = outputClassificators[0]

        var bestScore = -1f
        var bestAnchorIdx = -1

        for (i in 0 until NUM_ANCHORS) {
            // Apply sigmoid to classification score
            val rawScore = classificators[i][0]
            val score = 1.0f / (1.0f + exp(-rawScore))
            if (score > bestScore) {
                bestScore = score
                bestAnchorIdx = i
            }
        }

        if (bestScore < CONFIDENCE_THRESHOLD || bestAnchorIdx == -1) {
            Log.d(TAG, "No face detected (best score = $bestScore, threshold = $CONFIDENCE_THRESHOLD)")
            return null
        }

        Log.d(TAG, "Face detected: score=$bestScore, anchorIdx=$bestAnchorIdx")

        // Decode bounding box
        val anchor = anchors[bestAnchorIdx]
        val reg = regressors[bestAnchorIdx]

        val cx = reg[0] / INPUT_WIDTH + anchor[0]
        val cy = reg[1] / INPUT_HEIGHT + anchor[1]
        val w = reg[2] / INPUT_WIDTH
        val h = reg[3] / INPUT_HEIGHT

        // Convert center/size to top-left x, y, width, height (normalized 0-1)
        val x = max(0f, cx - w / 2f)
        val y = max(0f, cy - h / 2f)
        val bbox = floatArrayOf(x, y, w, h)

        val keypoints = FloatArray(12)
        for (k in 0 until 6) {
            keypoints[k * 2] = reg[4 + k * 2] / INPUT_WIDTH + anchor[0]
            keypoints[k * 2 + 1] = reg[4 + k * 2 + 1] / INPUT_HEIGHT + anchor[1]
        }

        val frameWidth = 320
        val frameHeight = 240
        val cropX = (bbox[0] * frameWidth).toInt().coerceIn(0, frameWidth - 1)
        val cropY = (bbox[1] * frameHeight).toInt().coerceIn(0, frameHeight - 1)
        val cropW = (bbox[2] * frameWidth).toInt().coerceIn(1, frameWidth - cropX)
        val cropH = (bbox[3] * frameHeight).toInt().coerceIn(1, frameHeight - cropY)

        val croppedFaceRaw = cropFace(frame, bbox)
        val croppedFace = resizeBilinear(croppedFaceRaw, cropW, cropH, 112, 112)
        val brightness = computeMeanBrightness(croppedFace)

        return FaceResult(bbox, keypoints, bestScore, croppedFace, brightness)
    }

    private fun resizeBilinear(src: FloatArray, srcW: Int, srcH: Int, dstW: Int, dstH: Int): FloatArray {
        val dst = FloatArray(dstW * dstH * 3)
        if (src.isEmpty() || srcW <= 0 || srcH <= 0) return dst

        val xRatio = if (dstW > 1) (srcW - 1).toFloat() / (dstW - 1) else 0f
        val yRatio = if (dstH > 1) (srcH - 1).toFloat() / (dstH - 1) else 0f

        for (y in 0 until dstH) {
            for (x in 0 until dstW) {
                val px = (x * xRatio).toInt().coerceIn(0, maxOf(0, srcW - 2))
                val py = (y * yRatio).toInt().coerceIn(0, maxOf(0, srcH - 2))
                
                val nextX = if (px + 1 < srcW) px + 1 else px
                val nextY = if (py + 1 < srcH) py + 1 else py

                val xDiff = (x * xRatio) - px
                val yDiff = (y * yRatio) - py

                val srcIdx00 = (py * srcW + px) * 3
                val srcIdx10 = (py * srcW + nextX) * 3
                val srcIdx01 = (nextY * srcW + px) * 3
                val srcIdx11 = (nextY * srcW + nextX) * 3

                for (c in 0 until 3) {
                    val val00 = src[srcIdx00 + c]
                    val val10 = src[srcIdx10 + c]
                    val val01 = src[srcIdx01 + c]
                    val val11 = src[srcIdx11 + c]

                    dst[(y * dstW + x) * 3 + c] = (val00 * (1 - xDiff) * (1 - yDiff) +
                                                 val10 * xDiff * (1 - yDiff) +
                                                 val01 * (1 - xDiff) * yDiff +
                                                 val11 * xDiff * yDiff)
                }
            }
        }
        return dst
    }

    private fun preprocessFrame(frame: ByteArray): ByteBuffer {
        val buffer = ByteBuffer.allocateDirect(INPUT_WIDTH * INPUT_HEIGHT * INPUT_CHANNELS * 4)
        buffer.order(ByteOrder.nativeOrder())
        
        // Frame is assumed to be 320x240 RGB. We must downsample/crop to 128x128.
        // For simplicity, we just take the center 128x128 region or scale it.
        // Let's do a simple nearest-neighbor scaling from 320x240 to 128x128
        val srcW = 320
        val srcH = 240
        
        for (y in 0 until INPUT_HEIGHT) {
            for (x in 0 until INPUT_WIDTH) {
                val srcX = (x * srcW) / INPUT_WIDTH
                val srcY = (y * srcH) / INPUT_HEIGHT
                val srcIdx = (srcY * srcW + srcX) * 3
                
                if (srcIdx + 2 < frame.size) {
                    buffer.putFloat((frame[srcIdx].toInt() and 0xFF) / 255.0f)
                    buffer.putFloat((frame[srcIdx + 1].toInt() and 0xFF) / 255.0f)
                    buffer.putFloat((frame[srcIdx + 2].toInt() and 0xFF) / 255.0f)
                } else {
                    buffer.putFloat(0f).putFloat(0f).putFloat(0f)
                }
            }
        }
        buffer.rewind()
        return buffer
    }

    private fun cropFace(frame: ByteArray, bbox: FloatArray): FloatArray {
        val frameWidth = 320
        val frameHeight = 240

        val x = (bbox[0] * frameWidth).toInt().coerceIn(0, frameWidth - 1)
        val y = (bbox[1] * frameHeight).toInt().coerceIn(0, frameHeight - 1)
        val w = (bbox[2] * frameWidth).toInt().coerceIn(1, frameWidth - x)
        val h = (bbox[3] * frameHeight).toInt().coerceIn(1, frameHeight - y)

        val cropped = FloatArray(w * h * 3)
        for (dy in 0 until h) {
            for (dx in 0 until w) {
                val srcIdx = ((y + dy) * frameWidth + (x + dx)) * 3
                val dstIdx = (dy * w + dx) * 3
                if (srcIdx + 2 < frame.size && dstIdx + 2 < cropped.size) {
                    cropped[dstIdx] = (frame[srcIdx].toInt() and 0xFF) / 255.0f
                    cropped[dstIdx + 1] = (frame[srcIdx + 1].toInt() and 0xFF) / 255.0f
                    cropped[dstIdx + 2] = (frame[srcIdx + 2].toInt() and 0xFF) / 255.0f
                }
            }
        }
        return cropped
    }

    private fun computeMeanBrightness(face: FloatArray): Float {
        if (face.isEmpty()) return 0f
        var sum = 0f
        for (v in face) sum += v
        return sum / face.size
    }
}
