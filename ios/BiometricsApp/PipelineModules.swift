import Foundation

/**
 FaceMeshProcessor — Extracts 468 facial landmarks on iOS.
 Mirrors Android FaceMeshProcessor.kt.
 */
class FaceMeshProcessor {
  
  private let modelManager: ModelManager
  
  init(modelManager: ModelManager) {
    self.modelManager = modelManager
  }
  
  func extract(alignedFace: [Float]) -> [[Float]] {
    return modelManager.runFaceMesh(input: alignedFace)
  }
}

/**
 FaceEmbedder — Generates 512-dim face embeddings on iOS.
 Mirrors Android FaceEmbedder.kt.
 */
class FaceEmbedder {
  
  private let modelManager: ModelManager
  
  init(modelManager: ModelManager) {
    self.modelManager = modelManager
  }
  
  func embed(alignedFace: [Float]) -> [Float] {
    var embedding = modelManager.runFaceLiVT(input: alignedFace)
    l2Normalize(&embedding)
    return embedding
  }
  
  private func l2Normalize(_ v: inout [Float]) {
    var norm: Float = 0
    for x in v { norm += x * x }
    norm = sqrt(norm)
    if norm > 0 {
      for i in 0..<v.count { v[i] /= norm }
    }
  }
}

/**
 LivenessPassive — Passive liveness detection on iOS.
 Mirrors Android LivenessPassive.kt.
 */
class LivenessPassive {
  
  private let modelManager: ModelManager
  private var rppgBuffer = [Float](repeating: 0, count: 60)
  private var rppgIndex = 0
  private var rppgFilled = false
  
  init(modelManager: ModelManager) {
    self.modelManager = modelManager
  }
  
  func evaluate(alignedFace: [Float]) -> Float {
    let silentFasScore = modelManager.runSilentFas(input: alignedFace)
    accumulateGreenChannel(face: alignedFace)
    
    if rppgFilled {
      let rppgScore = modelManager.runRppg(input: rppgBuffer)
      return 0.6 * silentFasScore + 0.4 * rppgScore
    }
    return silentFasScore
  }
  
  private func accumulateGreenChannel(face: [Float]) {
    var greenSum: Float = 0
    var count = 0
    for i in stride(from: 1, to: face.count, by: 3) {
      greenSum += face[i]
      count += 1
    }
    let meanGreen = count > 0 ? greenSum / Float(count) : 0
    rppgBuffer[rppgIndex] = meanGreen
    rppgIndex = (rppgIndex + 1) % 60
    if rppgIndex == 0 { rppgFilled = true }
  }
}

/**
 LivenessActive — Active liveness challenges on iOS.
 Mirrors Android LivenessActive.kt.
 */
class LivenessActive {
  
  struct ChallengeInfo {
    let action: String
    let timeoutMs: Int
    let instruction: String
    let emoji: String
  }
  
  private let allChallenges = ["blink", "smile", "turn_left", "turn_right"]
  private var selectedChallenges: [String] = []
  private var completedChallenges: [String] = []
  private var allCompleted = false
  
  private let challengeMetadata: [String: ChallengeInfo] = [
    "blink": ChallengeInfo(action: "blink", timeoutMs: 5000, instruction: "Please blink your eyes", emoji: "👁️"),
    "smile": ChallengeInfo(action: "smile", timeoutMs: 5000, instruction: "Please give a natural smile", emoji: "😊"),
    "turn_left": ChallengeInfo(action: "turn_left", timeoutMs: 5000, instruction: "Turn your head to the left", emoji: "⬅️"),
    "turn_right": ChallengeInfo(action: "turn_right", timeoutMs: 5000, instruction: "Turn your head to the right", emoji: "➡️"),
  ]
  
  func selectRandomChallenge() -> ChallengeInfo? {
    if selectedChallenges.isEmpty {
      selectedChallenges = Array(allChallenges.shuffled().prefix(2))
    }
    let next = selectedChallenges.first { !completedChallenges.contains($0) } ?? selectedChallenges[0]
    return challengeMetadata[next]
  }
  
  func evaluateChallenge(action: String, landmarks: [[Float]]) -> Bool {
    let landmarks2D = landmarks.map { ($0[0], $0[1]) }
    var completed = false
    
    switch action {
    case "blink":
      let ear = computeEAR(landmarks: landmarks2D, indices: [33, 160, 158, 133, 153, 144])
      completed = ear < 0.20
    case "smile":
      let width = dist(landmarks2D[61], landmarks2D[291])
      let height = dist(landmarks2D[13], landmarks2D[14])
      completed = height > 0 ? (width / height) > 2.8 : false
    case "turn_left":
      let yaw = computeYaw(landmarks: landmarks2D)
      completed = yaw < -20
    case "turn_right":
      let yaw = computeYaw(landmarks: landmarks2D)
      completed = yaw > 20
    default: break
    }
    
    if completed && !completedChallenges.contains(action) {
      completedChallenges.append(action)
      allCompleted = completedChallenges.count >= selectedChallenges.count
    }
    return completed
  }
  
  func getCachedChallengeScore() -> Float {
    return allCompleted ? 1.0 : 0.0
  }
  
  func getCompletedChallenges() -> [String] {
    return completedChallenges
  }
  
  private func computeEAR(landmarks: [(Float, Float)], indices: [Int]) -> Float {
    guard indices.count == 6, indices.allSatisfy({ $0 < landmarks.count }) else { return 0.3 }
    let v1 = dist(landmarks[indices[1]], landmarks[indices[5]])
    let v2 = dist(landmarks[indices[2]], landmarks[indices[4]])
    let h = dist(landmarks[indices[0]], landmarks[indices[3]])
    return h > 0 ? (v1 + v2) / (2 * h) : 0
  }
  
  private func computeYaw(landmarks: [(Float, Float)]) -> Float {
    guard landmarks.count > 454 else { return 0 }
    let nose = landmarks[1]
    let leftEar = landmarks[234]
    let rightEar = landmarks[454]
    let faceWidth = dist(leftEar, rightEar)
    guard faceWidth > 0 else { return 0 }
    let noseOffset = nose.0 - ((leftEar.0 + rightEar.0) / 2)
    return (noseOffset / faceWidth) * 90
  }
  
  private func dist(_ a: (Float, Float), _ b: (Float, Float)) -> Float {
    return sqrt((a.0 - b.0) * (a.0 - b.0) + (a.1 - b.1) * (a.1 - b.1))
  }
}

/**
 IrisQualityAssessor — Iris quality assessment on iOS.
 Mirrors Android IrisQualityAssessor.kt.
 */
class IrisQualityAssessor {
  
  private let modelManager: ModelManager
  
  init(modelManager: ModelManager) {
    self.modelManager = modelManager
  }
  
  func assess(frame: [UInt8], landmarks: [[Float]]) -> Float {
    let leftPatch = extractIrisPatch(frame: frame, landmarks: landmarks, indices: [468, 469, 470, 471, 472])
    let rightPatch = extractIrisPatch(frame: frame, landmarks: landmarks, indices: [473, 474, 475, 476, 477])
    
    let leftScore = scorePatch(leftPatch)
    let rightScore = scorePatch(rightPatch)
    return (leftScore + rightScore) / 2
  }
  
  private func scorePatch(_ patch: [Float]) -> Float {
    let sharpness = min(computeLaplacianVariance(patch: patch) / 500, 1)
    let entropy = min(computeLBPEntropy(patch: patch) / 5, 1)
    let neural = modelManager.runIrisNet(input: patch)
    return 0.3 * sharpness + 0.3 * entropy + 0.4 * neural
  }
  
  private func computeLaplacianVariance(patch: [Float]) -> Float {
    let size = 64
    guard patch.count >= size * size else { return 0 }
    var sum: Float = 0
    var count = 0
    for y in 1..<(size - 1) {
      for x in 1..<(size - 1) {
        let center = patch[y * size + x]
        let lap = patch[(y-1)*size+x] + patch[(y+1)*size+x] + patch[y*size+(x-1)] + patch[y*size+(x+1)] - 4 * center
        sum += lap * lap
        count += 1
      }
    }
    return count > 0 ? sum / Float(count) : 0
  }
  
  private func computeLBPEntropy(patch: [Float]) -> Float {
    let size = 64
    guard patch.count >= size * size else { return 0 }
    var hist = [Float](repeating: 0, count: 10)
    var total = 0
    
    for y in 1..<(size - 1) {
      for x in 1..<(size - 1) {
        let center = patch[y * size + x]
        var code = 0
        let neighbors = [
          (y-1)*size+(x-1), (y-1)*size+x, (y-1)*size+(x+1),
          y*size+(x+1),
          (y+1)*size+(x+1), (y+1)*size+x, (y+1)*size+(x-1),
          y*size+(x-1)
        ]
        for (bit, idx) in neighbors.enumerated() {
          if patch[idx] >= center { code |= (1 << bit) }
        }
        let bin = min((code * 10) / 256, 9)
        hist[bin] += 1
        total += 1
      }
    }
    
    if total > 0 { for i in 0..<10 { hist[i] /= Float(total) } }
    var entropy: Float = 0
    for p in hist {
      if p > 0 { entropy -= p * log(p) }
    }
    return entropy
  }
  
  private func extractIrisPatch(frame: [UInt8], landmarks: [[Float]], indices: [Int]) -> [Float] {
    return [Float](repeating: 0.5, count: 64 * 64)
  }
}
