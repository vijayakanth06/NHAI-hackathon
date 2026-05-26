import Foundation
import React

/**
 BiometricsModule — RCTBridgeModule exposing biometric pipeline to React Native.
 All inference dispatched to background queue; never blocks main thread.
 
 Pipeline Steps:
 1. Face Detection (FeatherFace)
 2. Preprocessing + Zero-DCE Enhancement (conditional)
 3. 468-point Landmark Extraction (Face Mesh)
 4. Feature Embedding (FaceLiVT 512-dim)
 5. Passive Liveness (Silent-FAS + rPPG)
 6. Active Liveness (geometric on landmarks)
 7. Iris Quality Assessment
 → Score Fusion → Decision
 */
@objc(BiometricsModule)
class BiometricsModule: NSObject, RCTBridgeModule {
  
  static func moduleName() -> String! { "BiometricsModule" }
  static func requiresMainQueueSetup() -> Bool { false }
  
  private var modelManager: ModelManager?
  private var dbManager: DatabaseManager?
  private var faceDetector: FaceDetector?
  private var faceMesh: FaceMeshProcessor?
  private var faceEmbedder: FaceEmbedder?
  private var livenessPassive: LivenessPassive?
  private var livenessActive: LivenessActive?
  private var irisQuality: IrisQualityAssessor?
  private let inferenceQueue = DispatchQueue(label: "com.nhai.biometrics.inference", qos: .userInitiated)
  
  @objc func initialize(_ resolve: @escaping RCTPromiseResolveBlock,
                         rejecter reject: @escaping RCTPromiseRejectBlock) {
    inferenceQueue.async {
      do {
        let encMgr = EncryptionManager()
        let key = try encMgr.getOrCreateKey()
        
        self.modelManager = ModelManager()
        try self.modelManager?.loadAll()
        
        self.faceDetector = FaceDetector(modelManager: self.modelManager!)
        self.faceMesh = FaceMeshProcessor(modelManager: self.modelManager!)
        self.faceEmbedder = FaceEmbedder(modelManager: self.modelManager!)
        self.livenessPassive = LivenessPassive(modelManager: self.modelManager!)
        self.livenessActive = LivenessActive()
        self.irisQuality = IrisQualityAssessor(modelManager: self.modelManager!)
        
        self.dbManager = try DatabaseManager(encryptionKey: key)
        
        resolve(nil)
      } catch {
        reject("INIT_ERROR", error.localizedDescription, error)
      }
    }
  }
  
  @objc func dispose(_ resolve: @escaping RCTPromiseResolveBlock,
                      rejecter reject: @escaping RCTPromiseRejectBlock) {
    inferenceQueue.async {
      self.modelManager?.dispose()
      self.dbManager?.close()
      self.modelManager = nil
      self.dbManager = nil
      resolve(nil)
    }
  }
  
  @objc func enroll(_ userId: String,
                     resolver resolve: @escaping RCTPromiseResolveBlock,
                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    inferenceQueue.async {
      do {
        var embeddings: [[Float]] = []
        
        for i in 0..<3 {
          let frame = self.getCurrentFrame()
          guard let faceResult = self.faceDetector?.detect(frame: frame) else {
            throw BiometricsError.inferenceError("No face detected in frame \(i + 1)")
          }
          
          let alignedFace = self.preprocessFace(frame: frame, faceResult: faceResult)
          let embedding = self.faceEmbedder?.embed(alignedFace: alignedFace) ?? []
          embeddings.append(embedding)
        }
        
        let avgEmbedding = self.averageEmbeddings(embeddings)
        try self.dbManager?.enrollUser(userHash: userId, embedding: avgEmbedding)
        
        let result: [String: Any] = [
          "success": true,
          "message": "Enrollment successful"
        ]
        resolve(result)
      } catch {
        reject("ENROLL_ERROR", error.localizedDescription, error)
      }
    }
  }
  
  @objc func authenticate(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    inferenceQueue.async {
      let startTime = Date()
      do {
        // STEP 1 — Face Detection
        let frame = self.getCurrentFrame()
        guard let faceResult = self.faceDetector?.detect(frame: frame) else {
          reject("NO_FACE", "No face detected", nil)
          return
        }
        
        // STEP 2 — Preprocessing + Zero-DCE
        let alignedFace = self.preprocessFace(frame: frame, faceResult: faceResult)
        
        // STEP 3 — 468-point Landmarks
        let landmarks = self.faceMesh?.extract(alignedFace: alignedFace) ?? []
        
        // STEP 4 — Feature Embedding (FaceLiVT)
        let embedding = self.faceEmbedder?.embed(alignedFace: alignedFace) ?? [Float](repeating: 0, count: 512)
        
        // STEP 5 — Passive Liveness
        let passiveScore = self.livenessPassive?.evaluate(alignedFace: alignedFace) ?? 0
        
        // STEP 6 — Active Liveness
        let activeScore = self.livenessActive?.getCachedChallengeScore() ?? 0
        
        // STEP 7 — Iris Quality
        let irisScore = self.irisQuality?.assess(frame: frame, landmarks: landmarks) ?? 0
        
        // FINAL FUSION
        let livenessScore = 0.35 * passiveScore + 0.35 * activeScore + 0.30 * irisScore
        let storedEmbedding = try self.dbManager?.getEnrolledEmbedding() ?? []
        let similarity = self.cosineSimilarity(a: embedding, b: storedEmbedding)
        let success = livenessScore >= 0.75 && similarity >= 0.70
        let userId = success ? self.dbManager?.getEnrolledUserId() : nil
        
        let elapsed = Date().timeIntervalSince(startTime) * 1000
        
        if success, let uid = userId {
          try self.dbManager?.insertAttendanceRecord(
            userHash: uid,
            confidence: similarity,
            livenessScore: Float(livenessScore)
          )
        }
        
        let result: [String: Any] = [
          "success": success,
          "userId": userId ?? NSNull(),
          "confidence": similarity,
          "livenessScore": livenessScore,
          "irisQuality": irisScore,
          "inferenceTimeMs": elapsed,
          "challengesCompleted": self.livenessActive?.getCompletedChallenges() ?? []
        ]
        resolve(result)
        
      } catch {
        reject("AUTH_ERROR", error.localizedDescription, error)
      }
    }
  }
  
  @objc func startLivenessChallenge(_ resolve: @escaping RCTPromiseResolveBlock,
                                     rejecter reject: @escaping RCTPromiseRejectBlock) {
    inferenceQueue.async {
      guard let challenge = self.livenessActive?.selectRandomChallenge() else {
        reject("CHALLENGE_ERROR", "Failed to select challenge", nil)
        return
      }
      let result: [String: Any] = [
        "action": challenge.action,
        "timeoutMs": challenge.timeoutMs,
        "instruction": challenge.instruction,
        "emoji": challenge.emoji
      ]
      resolve(result)
    }
  }
  
  @objc func checkChallengeCompletion(_ action: String,
                                       resolver resolve: @escaping RCTPromiseResolveBlock,
                                       rejecter reject: @escaping RCTPromiseRejectBlock) {
    inferenceQueue.async {
      let frame = self.getCurrentFrame()
      guard let faceResult = self.faceDetector?.detect(frame: frame) else {
        resolve(false)
        return
      }
      let alignedFace = self.preprocessFace(frame: frame, faceResult: faceResult)
      let landmarks = self.faceMesh?.extract(alignedFace: alignedFace) ?? []
      let completed = self.livenessActive?.evaluateChallenge(action: action, landmarks: landmarks) ?? false
      resolve(completed)
    }
  }
  
  @objc func getPendingSyncCount(_ resolve: @escaping RCTPromiseResolveBlock,
                                  rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve(self.dbManager?.getPendingCount() ?? 0)
  }
  
  @objc func syncAndPurge(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    inferenceQueue.async {
      do {
        let result = try self.dbManager?.syncAndPurge() ?? (0, 0, 0)
        resolve([
          "synced": result.0,
          "failed": result.1,
          "purged": result.2
        ])
      } catch {
        reject("SYNC_ERROR", error.localizedDescription, error)
      }
    }
  }
  
  @objc func getSyncStatus(_ resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve([
      "isOnline": false,
      "pendingCount": self.dbManager?.getPendingCount() ?? 0,
      "lastSyncTimestamp": NSNull()
    ])
  }
  
  @objc func getModelInfo(_ resolve: @escaping RCTPromiseResolveBlock,
                           rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve([
      "totalSizeMB": self.modelManager?.getTotalSizeMB() ?? 0,
      "modelsLoaded": self.modelManager?.getLoadedModelNames() ?? [],
      "inferenceTimeAvgMs": 0
    ])
  }
  
  @objc func getBenchmarkReport(_ resolve: @escaping RCTPromiseResolveBlock,
                                 rejecter reject: @escaping RCTPromiseRejectBlock) {
    resolve([
      "detectionMs": 0, "enhancementMs": 0, "landmarkMs": 0,
      "extractionMs": 0, "livenessMs": 0, "challengeMs": 0,
      "irisMs": 0, "totalMs": 0, "accuracyEstimate": 0
    ])
  }
  
  // MARK: - Private Helpers
  
  private func getCurrentFrame() -> [UInt8] {
    // TODO: Integrate with react-native-vision-camera frame provider
    return [UInt8](repeating: 0, count: 320 * 240 * 3)
  }
  
  private func preprocessFace(frame: [UInt8], faceResult: FaceDetector.FaceResult) -> [Float] {
    var face = faceResult.croppedFace
    if faceResult.meanBrightness < 80.0 / 255.0 {
      face = modelManager?.enhanceWithZeroDce(face: face) ?? face
    }
    return faceResult.alignTo112(face: face)
  }
  
  private func averageEmbeddings(_ embeddings: [[Float]]) -> [Float] {
    guard let first = embeddings.first else { return [] }
    var avg = [Float](repeating: 0, count: first.count)
    for emb in embeddings {
      for i in 0..<min(avg.count, emb.count) {
        avg[i] += emb[i]
      }
    }
    let n = Float(embeddings.count)
    for i in 0..<avg.count { avg[i] /= n }
    // L2 normalize
    var norm: Float = 0
    for v in avg { norm += v * v }
    norm = sqrt(norm)
    if norm > 0 { for i in 0..<avg.count { avg[i] /= norm } }
    return avg
  }
  
  private func cosineSimilarity(a: [Float], b: [Float]) -> Float {
    guard a.count == b.count else { return 0 }
    var dot: Float = 0
    for i in 0..<a.count { dot += a[i] * b[i] }
    return dot
  }
}
