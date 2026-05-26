import Foundation

/**
 ModelManager — Loads and holds all TFLite interpreters from app bundle.
 Models are read-only, bundled, never downloadable at runtime.
 
 Total model budget: ≤ 20 MB (currently ~11.5 MB)
 */
class ModelManager {
  
  // TFLite interpreter references (placeholder types — actual TFLite binding via react-native-fast-tflite)
  private var models: [String: Any] = [:]
  private var modelSizes: [String: Int] = [:]
  
  private let modelFiles = [
    "featherface_detect_int8",
    "zero_dce_enhance_int8",
    "face_mesh",
    "facelive_int8",
    "silent_fas_int8",
    "rppg_liveness_int8",
    "iris_quality_int8"
  ]
  
  private let modelNames = [
    "FeatherFace", "ZeroDCE", "FaceMesh",
    "FaceLiVT", "SilentFAS", "rPPG", "LightIrisNet"
  ]
  
  func loadAll() throws {
    for filename in modelFiles {
      guard let path = Bundle.main.path(forResource: filename, ofType: "tflite") else {
        // Model file not yet bundled — skip for now
        continue
      }
      let data = try Data(contentsOf: URL(fileURLWithPath: path))
      models[filename] = data
      modelSizes[filename] = data.count
    }
  }
  
  func enhanceWithZeroDce(face: [Float]) -> [Float] {
    // TODO: Run Zero-DCE TFLite model
    return face
  }
  
  func runFaceDetection(input: [Float]) -> [Float]? {
    // TODO: Run FeatherFace TFLite model
    return nil
  }
  
  func runFaceMesh(input: [Float]) -> [[Float]] {
    // TODO: Run Face Mesh TFLite model
    return [[Float]](repeating: [Float](repeating: 0, count: 3), count: 468)
  }
  
  func runFaceLiVT(input: [Float]) -> [Float] {
    // TODO: Run FaceLiVT TFLite model
    return [Float](repeating: 0, count: 512)
  }
  
  func runSilentFas(input: [Float]) -> Float {
    // TODO: Run Silent-FAS TFLite model
    return 0.5
  }
  
  func runRppg(input: [Float]) -> Float {
    // TODO: Run rPPG TFLite model
    return 0.5
  }
  
  func runIrisNet(input: [Float]) -> Float {
    // TODO: Run LightIrisNet TFLite model
    return 0.5
  }
  
  func getTotalSizeMB() -> Double {
    let totalBytes = modelSizes.values.reduce(0, +)
    return Double(totalBytes) / (1024.0 * 1024.0)
  }
  
  func getLoadedModelNames() -> [String] {
    return modelNames
  }
  
  func dispose() {
    models.removeAll()
    modelSizes.removeAll()
  }
}
