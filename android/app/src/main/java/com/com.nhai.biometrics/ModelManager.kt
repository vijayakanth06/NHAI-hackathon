package com.nhai.biometrics

import android.content.Context
import org.tensorflow.lite.Interpreter
import java.io.FileInputStream
import java.nio.MappedByteBuffer
import java.nio.channels.FileChannel

/**
 * ModelManager — Loads and holds all TFLite interpreters from app assets.
 * Models are read-only, bundled, never downloadable at runtime.
 *
 * Total model budget: ≤ 20 MB (currently ~11.5 MB)
 *
 * Model inventory:
 * 1. FeatherFace  — face detection        — 0.5 MB
 * 2. ZeroDCE      — low-light enhancement — 0.1 MB
 * 3. Face Mesh    — 468 landmarks          — 2.0 MB
 * 4. FaceLiVT     — face recognition      — 3.9 MB
 * 5. Silent-FAS   — passive liveness      — 2.0 MB
 * 6. rPPG         — cardiac liveness      — 2.0 MB
 * 7. LightIrisNet — iris quality          — 1.0 MB
 */
class ModelManager(private val context: Context) {

    lateinit var faceDetect: Interpreter      // featherface_detect_int8.tflite
    lateinit var zeroDce: Interpreter         // zero_dce_enhance_int8.tflite
    lateinit var faceMesh: Interpreter        // face_mesh.tflite
    lateinit var faceLiVT: Interpreter        // facelive_int8.tflite
    lateinit var silentFas: Interpreter       // silent_fas_int8.tflite
    lateinit var rppg: Interpreter            // rppg_liveness_int8.tflite
    lateinit var irisNet: Interpreter         // iris_quality_int8.tflite

    private val modelSizes = mutableMapOf<String, Long>()

    /**
     * Load all 7 TFLite models from app assets.
     * Uses NNAPI delegate for optional hardware acceleration.
     * Falls back to CPU if NNAPI is not available.
     */
    fun loadAll() {
        val options = Interpreter.Options().apply {
            setNumThreads(4)
            // NNAPI delegate — optional acceleration, graceful fallback to CPU
            try {
                setUseNNAPI(true)
            } catch (e: Exception) {
                // NNAPI not available on this device — continue with CPU
            }
        }

        faceDetect = loadModel("models/featherface_detect_int8.tflite", options)
        zeroDce    = loadModel("models/zero_dce_enhance_int8.tflite", options)
        faceMesh   = loadModel("models/face_mesh.tflite", options)
        faceLiVT   = loadModel("models/facelive_int8.tflite", options)
        silentFas  = loadModel("models/silent_fas_int8.tflite", options)
        rppg       = loadModel("models/rppg_liveness_int8.tflite", options)
        irisNet    = loadModel("models/iris_quality_int8.tflite", options)
    }

    /**
     * Enhance a face image using Zero-DCE for low-light conditions.
     * Only called when mean brightness < 80/255.
     * Input and output are both float arrays in [0, 1] range.
     */
    fun enhanceWithZeroDce(face: FloatArray): FloatArray {
        val output = Array(1) { FloatArray(37632) } // 112*112*3

        val input = if (face.size == 37632) face else FloatArray(37632).apply {
            System.arraycopy(face, 0, this, 0, minOf(face.size, 37632))
        }

        try {
            // ZeroDCE takes a single input tensor and outputs a single output tensor
            zeroDce.run(input, output[0])
        } catch (e: Exception) {
            // If enhancement fails, return original face unchanged
            return face
        }
        return output[0]
    }

    /**
     * Get total size of all loaded models in MB.
     */
    fun getTotalSizeMB(): Double {
        return modelSizes.values.sum() / (1024.0 * 1024.0)
    }

    /**
     * Get names of all loaded models.
     */
    fun getLoadedModelNames(): List<String> {
        return listOf(
            "FeatherFace", "ZeroDCE", "FaceMesh",
            "FaceLiVT", "SilentFAS", "rPPG", "LightIrisNet"
        )
    }

    /**
     * Release all interpreter resources.
     */
    fun dispose() {
        listOf(faceDetect, zeroDce, faceMesh, faceLiVT, silentFas, rppg, irisNet).forEach {
            try { it.close() } catch (_: Exception) {}
        }
    }

    private fun loadModel(assetPath: String, options: Interpreter.Options): Interpreter {
        val buffer = loadModelFile(assetPath)
        modelSizes[assetPath] = buffer.capacity().toLong()
        return try {
            Interpreter(buffer, options)
        } catch (e: Exception) {
            // Fallback: If NNAPI delegate compilation fails on this device, load on CPU
            val cpuOptions = Interpreter.Options().apply {
                setNumThreads(4)
            }
            Interpreter(buffer, cpuOptions)
        }
    }

    private fun loadModelFile(assetPath: String): MappedByteBuffer {
        val afd = context.assets.openFd(assetPath)
        val fis = FileInputStream(afd.fileDescriptor)
        return fis.channel.map(
            FileChannel.MapMode.READ_ONLY,
            afd.startOffset,
            afd.declaredLength
        )
    }
}
