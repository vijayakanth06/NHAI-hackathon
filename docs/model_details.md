# TFLite AI Model Details — NHAI Biometrics

This specification lists the 7 individual AI models and algorithmic processors that constitute the unified offline biometric authentication pipeline.

---

## Model Pipeline Directory

| # | Model | Role | File Name | Size (MB) | Quantization | Target Latency |
|---|---|---|---|---|---|---|
| 1 | **FeatherFace** | Face Detection | `face_detection.tflite` | 0.1 MB | INT8 | $<40\text{ms}$ |
| 2 | **Zero-DCE** | Low-Light Enhance | `low_light_enhance.tflite` | 0.4 MB | FP16 | $<60\text{ms}$ |
| 3 | **Face Mesh** | 468 Landmarks | `face_mesh.tflite` | 2.0 MB | INT8 | $<25\text{ms}$ |
| 4 | **FaceLiVT** | Face Recognition | `face_recognition.tflite` | 3.9 MB | INT8 | $<80\text{ms}$ |
| 5 | **Silent-FAS** | Passive Liveness | `liveness_fas.tflite` | 1.2 MB | FP16 | $<50\text{ms}$ |
| 6 | **rPPG Heuristic** | Cardiac Liveness | *Frame Difference* | — | Algorithmic | $<10\text{ms}$ |
| 7 | **Iris Laplacian** | Iris Quality | *Laplacian Variance* | — | Algorithmic | $<15\text{ms}$ |

---

## Detailed Model Signatures

### 1. FeatherFace (YuNet / BlazeFace Short)
*   **Purpose**: High-speed multi-face detection bounding box locator.
*   **Input Tensor**: `[1, 128, 128, 3]` (RGB normalized to `[-1.0, 1.0]`)
*   **Output Tensors**: 
    *   `Identity_1` (Scores): `[1, 896, 1]` bounding confidence.
    *   `Identity_2` (Boxes): `[1, 896, 4]` bounding coordinates.
*   **Performance Constraint**: Run on CPU using standard XNNPACK delegate.

### 2. Zero-DCE (Deep Curve Estimation)
*   **Purpose**: Enhances contrast and highlights of facial assets under $<15\text{ lux}$ illumination without shifting color spectrums.
*   **Input Tensor**: `[1, 256, 256, 3]` (RGB float)
*   **Output Tensor**: `[1, 256, 256, 3]` (Enhanced RGB float)
*   **Mathematical Operations**: Applies quadratic curve maps iteratively ($n=8$ iterations).

### 3. Face Mesh (MediaPipe Landmark Mesh)
*   **Purpose**: Resolves 468 precise 2D/3D land-marking locations on the face for geometry computation.
*   **Input Tensor**: `[1, 192, 192, 3]` (RGB cropped to face bounding region)
*   **Output Tensors**:
    *   `mesh_landmarks`: `[1, 1404]` (representing $468 \times 3$ values).
    *   `mesh_confidence`: `[1, 1]` classification.

### 4. FaceLiVT (AdaFace / MobileFaceNet)
*   **Purpose**: Generates high-entropy 512-dimensional floating-point vectors from alignment facial coordinates.
*   **Input Tensor**: `[1, 112, 112, 3]` (RGB aligned using affine matrix)
*   **Output Tensor**: `[1, 512]` normalized float vector.
*   **Comparison Formula**: Cosine similarity match score:
    $$S_c(A, B) = \frac{A \cdot B}{\|A\| \|B\|}$$
*   **Threshold Config**: Set to $0.78$ (corresponds to FAR $0.0001\%$, FRR $<0.15\%$).

### 5. Silent-FAS (Passive Anti-Spoof)
*   **Purpose**: Classifies structural depth and high-frequency noise of raw camera captures to detect photos or tablet prints.
*   **Input Tensor**: `[1, 80, 80, 3]` (RGB crop)
*   **Output Tensor**: `[1, 3]` logits representing probability scales: `[Real, Print Spoof, Video Spoof]`.

### 6. rPPG Motion Tracker Heuristic
*   **Purpose**: Tracks cardiac pulses by analyzing tiny color shifts in the green channel corresponding to facial capillary blood volumes.
*   **Heuristic Fallback**: Evaluates variance in local frame-to-frame pixel differences across $20$ temporal crops corresponding to facial cheeks. Ensures standard deviations match pulse intervals ($60\text{--}100\text{ bpm}$) instead of uniform static paper sheets.

### 7. Iris Quality Assessor Heuristic
*   **Purpose**: Screens iris details to prevent low-resolution spoof prints or blurry out-of-focus camera capture.
*   **Heuristic Fallback**: Uses **Laplacian convolution** to compute edge gradient variance, paired with **Local Binary Patterns (LBP)** entropy analysis. 
*   **Threshold Config**: Requires Laplacian variance $\sigma^2 \ge 120$ to certify clear iris structural presence.
