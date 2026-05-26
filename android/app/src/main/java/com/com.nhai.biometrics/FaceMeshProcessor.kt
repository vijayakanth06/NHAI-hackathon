package com.nhai.biometrics

import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * FaceMeshProcessor — Extracts 468 facial landmarks using MediaPipe Face Mesh model.
 *
 * Input:  192×192×3 RGB face image (aligned)
 * Output: 468 landmarks, each with (x, y, z) coordinates
 * Target: < 20ms per frame
 */
class FaceMeshProcessor(private val modelManager: ModelManager) {

    companion object {
        const val INPUT_SIZE = 192
        const val NUM_LANDMARKS = 468
        const val COORDS_PER_LANDMARK = 3 // x, y, z
    }

    /**
     * Extract 468 face landmarks from an aligned face image.
     *
     * @param alignedFace Face image as FloatArray (112×112×3 or resized to 192×192×3)
     * @return Array of FloatArrays — 468 landmarks, each [x, y, z]
     */
    fun extract(alignedFace: FloatArray): Array<FloatArray> {
        // Resize input to 192×192 if needed
        val inputBuffer = prepareInput(alignedFace)

        // Output expected by model is [1, 1, 1, 1404]
        val outputFlattened = Array(1) { Array(1) { Array(1) { FloatArray(NUM_LANDMARKS * COORDS_PER_LANDMARK) } } }

        try {
            modelManager.faceMesh.run(inputBuffer, outputFlattened)
        } catch (e: Exception) {
            // Return empty landmarks on error
            return Array(NUM_LANDMARKS) { FloatArray(COORDS_PER_LANDMARK) }
        }

        val flatArray = outputFlattened[0][0][0]
        val landmarks = Array(NUM_LANDMARKS) { FloatArray(COORDS_PER_LANDMARK) }
        for (i in 0 until NUM_LANDMARKS) {
            landmarks[i][0] = flatArray[i * COORDS_PER_LANDMARK]
            landmarks[i][1] = flatArray[i * COORDS_PER_LANDMARK + 1]
            landmarks[i][2] = flatArray[i * COORDS_PER_LANDMARK + 2]
        }
        return landmarks
    }

    /**
     * Extract landmarks and convert to 2D points for geometric computations.
     *
     * @param alignedFace Face image as FloatArray
     * @return Array of (x, y) coordinate pairs
     */
    fun extractLandmarks2D(alignedFace: FloatArray): Array<LivenessActive.Landmark> {
        val landmarks3D = extract(alignedFace)
        return landmarks3D.map { LivenessActive.Landmark(it[0], it[1]) }.toTypedArray()
    }

    private fun prepareInput(face: FloatArray): ByteBuffer {
        // Resize from 112x112x3 to 192x192x3 using bilinear interpolation
        val resized = resizeBilinear(face, 112, 112, INPUT_SIZE, INPUT_SIZE)
        
        val buffer = ByteBuffer.allocateDirect(INPUT_SIZE * INPUT_SIZE * 3 * 4)
        buffer.order(ByteOrder.nativeOrder())
        for (v in resized) {
            buffer.putFloat(v)
        }
        buffer.rewind()
        return buffer
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
}
