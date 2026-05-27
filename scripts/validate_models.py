#!/usr/bin/env python3
import os
import sys

# NHAI Biometrics TFLite Model Integrity Validator
# Checks model bundle directories to verify file presence, sizes, and FlatBuffer 'TFL3' header signatures.

COLOR_BLUE = "\033[1;34m"
COLOR_GREEN = "\033[1;32m"
COLOR_YELLOW = "\033[1;33m"
COLOR_RED = "\033[1;31m"
COLOR_RESET = "\033[0m"

EXPECTED_MODELS = [
    "face_detection.tflite",
    "low_light_enhance.tflite",
    "face_mesh.tflite",
    "face_recognition.tflite",
    "liveness_fas.tflite"
]

def print_header(title):
    print(f"{COLOR_BLUE}========================================================{COLOR_RESET}")
    print(f"{COLOR_BLUE}      {title}      {COLOR_RESET}")
    print(f"{COLOR_BLUE}========================================================{COLOR_RESET}")

def validate_tflite_binary(filepath):
    """
    Validates a TFLite file by checking its FlatBuffer binary schema.
    A valid TFLite model always contains the 4-byte magic signature 'TFL3' at byte offset 4.
    """
    if not os.path.exists(filepath):
        return False, "File does not exist"
    
    size = os.path.getsize(filepath)
    if size == 0:
        return False, "File size is 0 bytes (corrupted download)"
        
    try:
        with open(filepath, 'rb') as f:
            f.seek(4)
            magic = f.read(4)
            if magic == b'TFL3':
                return True, f"Valid TFLite Model ({(size / 1024 / 1024):.2f} MB)"
            else:
                return False, f"Invalid TFLite binary signature (Found: {magic.hex()} instead of 'TFL3')"
    except Exception as e:
        return False, f"Read error: {str(e)}"

def run_validation():
    print_header("NHAI Biometrics AI Model Integrity Validator")
    
    # Locate asset folders
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    search_paths = {
        "Android Assets": os.path.join(base_dir, "android", "app", "src", "main", "assets", "models"),
        "iOS Bundle": os.path.join(base_dir, "ios", "BiometricsApp", "models")
    }

    issues_found = False
    
    for platform, path in search_paths.items():
        print(f"\nChecking {COLOR_BLUE}{platform}{COLOR_RESET} at path: {path}")
        if not os.path.exists(path):
            print(f"  {COLOR_YELLOW}[WARNING] Directory not created yet (expected during compilation build targets){COLOR_RESET}")
            continue
            
        print("  Files:")
        for model in EXPECTED_MODELS:
            model_path = os.path.join(path, model)
            exists, desc = validate_tflite_binary(model_path)
            
            if exists:
                print(f"    {COLOR_GREEN}✓ {model:<25} : {desc}{COLOR_RESET}")
            else:
                print(f"    {COLOR_RED}✗ {model:<25} : {desc}{COLOR_RESET}")
                issues_found = True

    print("\n--------------------------------------------------------")
    if issues_found:
        print(f"{COLOR_RED}[FAIL] Integrity checks completed with validation issues.{COLOR_RESET}")
        print("Ensure TFLite model files are compiled or copied as described in /docs/integration_guide.md")
        sys.exit(1)
    else:
        print(f"{COLOR_GREEN}[SUCCESS] All found TFLite models are structurally sound & deployable!{COLOR_RESET}")
        sys.exit(0)

if __name__ == "__main__":
    run_validation()
