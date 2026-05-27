# NHAI Biometrics System Testing & Verification Guide
## Hackathon 7.0 — Complete Evaluation Protocol

This guide outlines the step-by-step testing instructions, core features catalog, and specific test face profiles (real, spoof, low-light, blurry) to completely evaluate the **NHAI Offline Facial Recognition & Liveness Detection System** built for Datalake 3.0.

---

## ⚡ 1. Rapid Setup & Local Launch

Ensure your physical device or emulator is connected via USB, then launch the project:

```bash
# 1. Start Metro bundler from the root folder
npm start

# 2. Build and run the Android binary on your device
npm run android

# 3. Build and run the iOS binary (macOS with Xcode only)
npm run ios
```

---

## 📋 2. Core Feature Matrix to Test

| Feature Category | User Actions to Perform | Visual Success Indicators | Under-the-Hood Logic Verified |
|---|---|---|---|
| **System Initialization** | Open the app for the first time $\rightarrow$ click **⚡ Initialize System** | Loading indicator triggers, then a pulsing green **● Online** status dot appears at the header. | De-allocates any stale memory, decrypts SQLCipher container, and loads the 7 TFLite models. |
| **New User Enrollment** | Go to **Enroll New User** $\rightarrow$ Enter an ID/Name $\rightarrow$ Capture 3 separate face expressions. | Overlay shows frame progression circles (Frame 1 $\rightarrow$ 2 $\rightarrow$ 3). Green success card shows after 3rd capture. | Checks land-marking EAR/Euler angles, averages the 3 512-dim embedding matrices, and encrypts details with AES-256. |
| **Identity Verification** | Go to **Verify Identity** $\rightarrow$ Read randomized active challenge $\rightarrow$ Take a snap. | Active emoji (🙂/👁️) pulses. Taking photo shows `"Running 7-step security pipeline..."` and returns full scores card. | Evaluates Zero-DCE enhance, face mesh coordinates, fuses scores (35/35/30), matches cosine similarity. |
| **Database Management** | Click **Manage Database** | A dark list showing all enrolled employees with a **Trash/Delete** icon next to them. | Decrypts standard schema, queries keys from Keystore hardware, allows CRUD deletion. |
| **Data Sync Control** | Click **Data Sync** or tap the inline **SyncStatusBar** | Displays **Pending Queue count**, **Last Sync time**, **Force Sync** button, and **Purge** action. | Monitors NetInfo state changes in the background; blocks sync actions while offline. |

---

## 🎭 3. Test Face Scenarios (The 5 Verification Profiles)

Use these 5 distinct test scenarios to verify that the 7-step pipeline rejects spoofing and remains highly resilient.

### Scenario A: The Real/Live Face (Positive Control)
*   **Method**: Select **Verify Identity**. Follow the pulsing liveness prompt:
    *   **Smile**: Give a bright, clear smile.
    *   **Blink**: Blink your eyes clearly in front of the lens.
    *   *Click the Capture button.*
*   **Expected Result**:
    *   *Screen UI*: Renders green `Authentication Successful` card.
    *   *Metrics*: Displayed **Similarity match confidence** $>80\%$, **Liveness score** $>85\%$, **Iris edge quality** $>80\%$, and total execution latency $<1000\text{ms}$.

### Scenario B: The Printed Photo Spoof (Rejection Control — Passive FAS)
*   **Method**: Hold a high-resolution color printed photo of your face (or open `Spoof_Print.jpg` on a secondary tablet screen) and present it to the scanner camera during a challenge.
*   **Expected Result**:
    *   *Screen UI*: Renders red `Authentication Failed` card.
    *   *Metrics*: Pipeline blocks verification immediately. Local logs will note high-frequency paper surface texture reflection anomalies from the **Silent-FAS** engine.

### Scenario C: The Digital Video Spoof (Rejection Control — rPPG)
*   **Method**: Record a selfie video of a user blinking/smiling, play it back on another phone screen, and present that screen close to the camera.
*   **Expected Result**:
    *   *Screen UI*: Renders red `Authentication Failed` card.
    *   *Metrics*: Blocks access. The **rPPG Heuristic** identifies pixel grid refresh rates and flat-plane light propagation instead of biological capillary pulse variance in the skin channels.

### Scenario D: The Low-Light Verification (Robustness Control — Zero-DCE)
*   **Method**: Enter a dark room or cover light sources to drop ambient brightness below $15\text{ lux}$. Scan your face.
*   **Expected Result**:
    *   *Screen UI*: Renders green `Authentication Successful` card.
    *   *Metrics*: Zero-DCE curve networks enhance luminance profiles internally. Pipeline extracts landmarks and matches face embeddings with high confidence despite poor initial lighting.

### Scenario E: Blurry / Out-of-Focus Capture (Iris Rejection Control)
*   **Method**: Rapidly wave the device during capture or shake the camera lens to create a highly motion-blurred image.
*   **Expected Result**:
    *   *Screen UI*: Renders red `Authentication Failed` card.
    *   *Metrics*: Fails quality check. The **Iris Assessor** computes Laplacian edge gradient variance. Blur reduces edge variance below the mandatory limit of $\ge 120$, rejecting the frame for verification.

---

## 📡 4. Network Offline & Sync Testing Protocol

Follow this flow to verify local queue caching and cloud synchronization:

```
[Disconnect WiFi] ──► [Verify Face Offline] ──► [Enrolls to Queue] ──► [Connect WiFi] ──► [Auto-syncs & Purges SQLite]
```

### Step 1: Disconnect Network
*   Toggle **Airplane Mode ON** on your phone (or disable WiFi/cellular data).
*   *Verification*: Verify the status bar indicator at the top changes to a red **● Offline** dot.

### Step 2: Record Offline Scans
*   Complete a successful **Verify Identity** scan while offline.
*   *Verification*: Verify that the verification succeeds, local database caches the attendance log, and the pending count under **Data Sync** increases to `1` (or more).

### Step 3: Trigger Connection Recovery
*   Toggle **Airplane Mode OFF** (or restore WiFi).
*   *Verification*: The indicator updates to a green **● Online** dot.
*   *Behind the Scenes*: The network observer automatically intercepts connection restoration, triggers the sync service, pushes buffered attendance rows to AWS AppSync, and immediately **purges** synced rows from local SQLite storage to preserve disk space and PII privacy.
*   *Final Count*: Confirm that the pending queue returns to `0` and **Last Sync Time** updates to the current clock time.
