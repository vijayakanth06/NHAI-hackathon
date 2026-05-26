package com.nhai.biometrics

import android.util.Log
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * FaceEmbedder — Generates 128-dimensional face embeddings using MobileFaceNet.
 *
 * Input:  112×112×3 aligned face image, pixel values normalized to [-1, 1]
 * Output: 128-dim L2-normalized embedding vector
 * Target: < 100ms per frame
 *
 * The output embedding is L2-normalized by the model's final layer,
 * so cosine similarity can be computed as a simple dot product.
 * Threshold for same person: cosine similarity > 0.65
 */
class FaceEmbedder(private val modelManager: ModelManager) {

    companion object {
        private const val TAG = "FaceEmbedder"
        const val INPUT_SIZE = 112
        const val EMBEDDING_DIM = 128
    }

    /**
     * Generate a 128-dim face embedding from an aligned face image.
     *
     * @param alignedFace 112×112×3 aligned face as FloatArray (37632 elements)
     * @return 128-dim L2-normalized embedding vector
     */
    fun embed(alignedFace: FloatArray): FloatArray {
        val inputBuffer = prepareInput(alignedFace)

        // Output: [1, 128]
        val output = Array(1) { FloatArray(EMBEDDING_DIM) }

        try {
            modelManager.faceLiVT.run(inputBuffer, output)
        } catch (e: Exception) {
            Log.e(TAG, "FaceLiVT inference error: ${e.message}")
            // Return zero embedding on error
            return FloatArray(EMBEDDING_DIM)
        }

        val embedding = output[0]
        Log.d(TAG, "Raw embedding[0..3]: ${embedding.take(4)}")

        // Ensure L2 normalization (belt-and-suspenders — model should already do this)
        l2Normalize(embedding)

        return embedding
    }

    /**
     * Compute cosine similarity between two L2-normalized embeddings.
     * Since both are L2-normalized, this is just the dot product.
     *
     * @return Similarity score in [-1, 1]; threshold ≥ 0.70 → same person
     */
    fun computeSimilarity(a: FloatArray, b: FloatArray): Float {
        if (a.size != b.size) return 0f
        var dot = 0f
        for (i in a.indices) dot += a[i] * b[i]
        return dot
    }

    private fun prepareInput(face: FloatArray): ByteBuffer {
        val buffer = ByteBuffer.allocateDirect(INPUT_SIZE * INPUT_SIZE * 3 * 4)
        buffer.order(ByteOrder.nativeOrder())

        val expectedSize = INPUT_SIZE * INPUT_SIZE * 3
        for (i in 0 until expectedSize) {
            val raw = if (i < face.size) face[i] else 0f
            // MobileFaceNet was trained with pixel values in [-1, 1].
            // Input face values are in [0, 1] from the crop step, so map:
            //   normalized = raw * 2.0 - 1.0
            buffer.putFloat(raw * 2f - 1f)
        }
        buffer.rewind()
        return buffer
    }

    private fun l2Normalize(v: FloatArray) {
        var norm = 0f
        for (x in v) norm += x * x
        norm = kotlin.math.sqrt(norm)
        if (norm > 0) {
            for (i in v.indices) v[i] /= norm
        }
    }
}
