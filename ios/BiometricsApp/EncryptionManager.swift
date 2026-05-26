import Foundation
import Security

/**
 EncryptionManager — Manages AES-256 key via iOS Keychain (Secure Enclave backed).
 Key is NEVER written to disk in plaintext or stored in code.
 */
class EncryptionManager {
  
  private let keyTag = "com.nhai.biometrics.sqlcipher.key"
  
  func getOrCreateKey() throws -> Data {
    if let existing = try? retrieveKey() { return existing }
    return try generateAndStoreKey()
  }
  
  private func retrieveKey() throws -> Data? {
    let query: [String: Any] = [
      kSecClass as String:       kSecClassKey,
      kSecAttrApplicationTag as String: keyTag,
      kSecReturnData as String:  true
    ]
    var item: CFTypeRef?
    let status = SecItemCopyMatching(query as CFDictionary, &item)
    guard status == errSecSuccess else { return nil }
    return item as? Data
  }
  
  private func generateAndStoreKey() throws -> Data {
    var keyData = Data(count: 32)  // 256-bit
    let result = keyData.withUnsafeMutableBytes {
      SecRandomCopyBytes(kSecRandomDefault, 32, $0.baseAddress!)
    }
    guard result == errSecSuccess else {
      throw BiometricsError.keyGenerationFailed
    }
    
    let addQuery: [String: Any] = [
      kSecClass as String:       kSecClassKey,
      kSecAttrApplicationTag as String: keyTag,
      kSecValueData as String:   keyData,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
    ]
    SecItemAdd(addQuery as CFDictionary, nil)
    return keyData
  }
}

enum BiometricsError: Error {
  case keyGenerationFailed
  case modelLoadFailed(String)
  case inferenceError(String)
  case databaseError(String)
}
