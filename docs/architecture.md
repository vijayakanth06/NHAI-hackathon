# System Architecture Specification — NHAI Biometrics

This document details the software architecture, pipeline sequence, and data flow of the offline-first facial recognition and liveness detection system designed for NHAI Datalake 3.0.

---

## 🏗️ Asynchronous Processing Model

The biometric pipeline operates with strict decoupling between the **JavaScript UI Thread** and **Background Native Worker Threads** to ensure zero frame drop on camera renderings (60fps).

*   **Android**: Kotlin Coroutines dispatching tasks to `Dispatchers.Default` (heavy CPU matching) and `Dispatchers.IO` (SQLite reads).
*   **iOS**: Grand Central Dispatch (GCD) managing high-priority serial queues (`com.nhai.biometrics.pipeline`).

---

## 🔄 7-Step Security Pipeline

When the user takes a snapshot during an active challenge (e.g. `smile` or `blink`), the captured frame is passed through the 7-step security pipeline.

```mermaid
sequenceDiagram
    autonumber
    participant UI as Camera Screen (JS)
    participant Module as BiometricsModule (Native)
    participant Enhancer as Zero-DCE Engine (TFLite)
    participant Detector as FeatherFace / YuNet (TFLite)
    participant Mesh as FaceMesh (TFLite)
    participant Liveness as Anti-Spoof (Silent-FAS + rPPG)
    participant Embedder as MobileFaceNet (TFLite)
    participant DB as SQLCipher Encrypted SQLite

    UI->>Module: authenticate(base64Image, challengeAction)
    Note over Module: Transferred to Native Thread
    
    Module->>Enhancer: 1. Enhance low-light frames
    Enhancer-->>Module: Enhanced Bitmap/CIImage
    
    Module->>Detector: 2. Detect face & bounding box
    Detector-->>Module: Bounding Box (Rect)
    
    Module->>Mesh: 3. Extract 468 landmarks
    Mesh-->>Module: 2D/3D landmark vector
    
    Module->>Liveness: 4. Check passive & active spoofing
    Note over Liveness: Active Check: Smile/Blink ratio<br/>Passive Check: Neural Texture check
    Liveness-->>Module: Liveness Score & Pass/Fail status
    
    Module->>Embedder: 5. Generate 512-dim embedding
    Embedder-->>Module: Normalized vector array
    
    Module->>DB: 6. Compare with enrolled users
    Note over DB: Compute Cosine Similarity<br/>Verify Iris quality Laplacian score
    DB-->>Module: Match user ID & credentials
    
    Module->>UI: 7. Return unified AuthResult (JSON)
    Note over UI: Zero out base64 & embeddings in memory
```

---

## 💾 Offline Sync Architecture

The sync subsystem runs an **offline-first local queue**. SQLite acts as the durable database cache.

```mermaid
graph TD
    A[User Auths Offline] -->|Create AttendanceRecord| B[Local SQLite Database]
    B -->|Offline Buffer Queue| C{Network Available?}
    C -->|No| D[Keep in SQLite Queue]
    C -->|Yes / NetInfo Active| E[SyncService.performSync]
    E -->|Upload Array| F[AWS AppSync Endpoint]
    F -->|HTTP 200 OK| G[Purge Synced local rows]
    G --> B
```

---

## 🗃️ Encrypted Local Database Schema

The database table `attendance_records` holds buffered entries:
```sql
CREATE TABLE IF NOT EXISTS attendance_records (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,         -- SHA-256 Hashed Identifier
    username TEXT NOT NULL,       -- Display name
    timestamp INTEGER NOT NULL,   -- UNIX Epoch MS
    synced INTEGER DEFAULT 0      -- Boolean Flag
);
```

The database table `enrolled_users` stores identity vectors:
```sql
CREATE TABLE IF NOT EXISTS enrolled_users (
    userId TEXT PRIMARY KEY,      -- SHA-256 Hashed Identifier
    username TEXT NOT NULL,
    embedding BLOB NOT NULL,      -- Encrypted AES-256 512-float vector
    additionalData TEXT
);
```
All columns containing PII or biometric vectors are encrypted using standard SQLCipher database keys derived through high-iteration PBKDF2.
