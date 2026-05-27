# NHAI Offline Facial Recognition & Liveness Detection System (Hackathon 7.0)

A high-performance, **completely offline-first** biometric identity management and attendance synchronization system developed for **NHAI Hackathon 7.0**. 

This system integrates a **7-step active and passive security pipeline** running wholly on-device in **under 1000ms**, paired with a secure local SQLite database container and a network-resilient cloud sync queue for integration with **NHAI Datalake 3.0**.

---

## ⚡ Architecture & Processing Overview

The system decouples high-fps camera frame captures on the JavaScript UI Thread from intensive mathematical matrix execution running on serial native OS threads (GCD on iOS, Dispatchers.Default Coroutines on Android).

### 🔄 The 7-Step Pipeline:
1.  **Low-Light Enhancement**: Zero-DCE (Deep Curve Estimation) restores clarity under <15 lux environments.
2.  **Face Bounding Box Detection**: FeatherFace detects and crops structural face regions in <40ms.
3.  **Facial Mesh Extraction**: MediaPipe Face Mesh maps 468 landmarks for facial geometry.
4.  **Liveness Verification**: Dual-engine active/passive anti-spoof checks (Silent-FAS texture check + active `smile`/`blink` detection).
5.  **High-Entropy Vector Embedding**: MobileFaceNet outputs a normalized 512-dimensional floating-point key representing the identity.
6.  **Secure Local Vector Match**: Cosine similarity evaluates the vector against local encrypted enrolled vectors in the database.
7.  **Iris Integrity Certification**: Laplacian Convolution & Local Binary Patterns (LBP) screen iris focus and edge gradients to reject high-resolution flat printed spoofs.

---

## 📂 Repository Directory Map

### 📦 Production SDK Container
*   [`/sdk/`](file:///c:/Users/vikym/Documents/GitHub/NHAI/sdk/): Plug-and-play facade package for quick onboarding by Datalake 3.0 developers.
    *   [`/sdk/src/BiometricsSDK.ts`](file:///c:/Users/vikym/Documents/GitHub/NHAI/sdk/src/BiometricsSDK.ts): Single facade control module.
    *   [`/sdk/README.md`](file:///c:/Users/vikym/Documents/GitHub/NHAI/sdk/README.md): 3-step rapid package setup guide.

### 📚 Technical Specifications
All design documentation and system requirements are located inside [`/docs/`](file:///c:/Users/vikym/Documents/GitHub/NHAI/docs/):
*   📄 [**Architecture Diagram Specification**](file:///c:/Users/vikym/Documents/GitHub/NHAI/docs/architecture.md): Sequence diagrams detailing asynchronous worker queues.
*   📄 [**AI Models Pipeline Catalog**](file:///c:/Users/vikym/Documents/GitHub/NHAI/docs/model_details.md): Detailed shape signatures and quantization parameters of the 7 engines.
*   📄 [**Security & Sovereignty Specs**](file:///c:/Users/vikym/Documents/GitHub/NHAI/docs/security_design.md): SQLCipher AES-256 DB encryption, Keystore master keys, and memory zeroing logic.
*   📄 [**AWS Amplify Sync Integration**](file:///c:/Users/vikym/Documents/GitHub/NHAI/docs/aws_setup.md): GraphQL schema endpoints mapping Dynamodb structures.
*   📄 [**Developer Integration Guide**](file:///c:/Users/vikym/Documents/GitHub/NHAI/docs/integration_guide.md): Onboarding guide, permissions, and compile troubleshooting.

---

## 🚀 Running the App Locally

### Step 1: Start Dev Server
Start Metro in your root workspace folder:
```bash
npm start
```

### Step 2: Build & Run Platform App
Launch Metro to compile on your physical target device:
```bash
# Android target
npm run android

# iOS target
npm run ios
```

---

## ⚖️ Open Source Licenses
Refer to [`LICENSES.md`](file:///c:/Users/vikym/Documents/GitHub/NHAI/LICENSES.md) for full Apache-2.0, MIT, and BSD licensing agreements for YuNet, BlazeFace, MobileFaceNet, and Silent-Face-Anti-Spoofing.
