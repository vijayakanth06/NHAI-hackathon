# Security Architecture & Design — NHAI Biometrics

This document outlines the defense-in-depth security measures implemented in the offline biometric SDK to protect employee PII (Personally Identifiable Information) and sensitive mathematical facial vectors.

---

## 🔐 Hardware Cryptographic Binding

All cryptographic operations are bound directly to hardware-backed trust anchors using **Android Keystore (Tee/StrongBox)** and **iOS Keychain/Secure Enclave**.

```
              ┌────────────────────────┐
              │   Android/iOS OS Core  │
              └───────────┬────────────┘
                          │ (Request Key)
   ┌──────────────────────▼──────────────────────┐
   │ Hardware Isolation (StrongBox/SecureEnclave)│
   │  - Master Encryption Key generated inside   │
   │  - Cryptographic operations run in-hardware │
   │  - Master Key NEVER leaves the chip         │
   ┌─────────────────────────────────────────────┘
```

*   **Key Specs**: AES-256 GCM mode keys are generated inside the Secure Enclave / Keystore and cannot be extracted or exported.
*   **Key Derivation**: High-iteration **PBKDF2** (10,000 rounds) derives temporary operational keys from the hardware master key to unlock SQLite databases.

---

## 🗄️ SQLCipher Database Encryption

Local databases are locked using **SQLCipher** at compilation:
*   **Algorithm**: AES-256 CBC with SHA-256 HMAC authentication.
*   **Zero-Plaintext Leak**: Entire SQLite block sectors (including indices, metadata, schema, and page blocks) are completely unreadable in plain format if the device is rooted or flash-dumped.

---

## 🛡️ Biometric Data Sovereignty

To strictly prevent identity harvesting or re-playing, we enforce a strict **zero-persistence protocol** for raw biological assets:

1.  **Hashed Identifiers**: Real employee IDs are never saved in plain text. They are hashed using a salted **SHA-256** checksum:
    $$\text{hashedId} = \text{SHA256}(\text{userId} + \text{salt})$$
2.  **No Image Persistence**: Biometric face frames are captured into raw RAM buffers, loaded into native JVM byte buffers, and are immediately deleted. No picture is ever saved to persistent device gallery, cache folders, or external drives.
3.  **In-Memory Clear**: Immediately after completing feature comparisons, the `float[]` vectors containing high-dimensional facial parameters are filled with zeros inside the native JVM/C++ memory layers before Garbage Collection is called.

---

## 🚫 Logging Compliance

The SDK incorporates a structured memory logging engine (`src/utils/logger.ts`) built to ensure complete corporate safety audits:
*   **No PII logs**: Log lines are structured JSON events that omit user names, raw biometric vectors, key bytes, or camera streams.
*   **In-Memory ring-buffer**: Logs reside in-memory with a max size of $200$ rows. The buffer auto-recycles old logs, preventing long-term debug footprint residue on persistent disk storage.
