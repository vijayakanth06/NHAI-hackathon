import urllib.request
import numpy as np
import tensorflow as tf
from PIL import Image
import os

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                          "android", "app", "src", "main", "assets", "models")
model_path = os.path.join(MODELS_DIR, "silent_fas_int8.tflite")

# Download a sample face image
img_url = "https://raw.githubusercontent.com/minivision-ai/Silent-Face-Anti-Spoofing/master/images/sample/image_F1.jpg"
img_path = "test_face.jpg"
if not os.path.exists(img_path):
    urllib.request.urlretrieve(img_url, img_path)

img = Image.open(img_path).convert("RGB")
img_resized = img.resize((80, 80))

# Get numpy arrays
img_np_rgb = np.array(img_resized, dtype=np.float32)
img_np_bgr = img_np_rgb[:, :, ::-1]

interpreter = tf.lite.Interpreter(model_path=model_path)
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()[0]
output_details = interpreter.get_output_details()[0]

def test_inference(name, data):
    # Shape it correctly: [1, 80, 80, 3]
    test_data = np.expand_dims(data, axis=0)
    interpreter.set_tensor(input_details['index'], test_data)
    interpreter.invoke()
    result = interpreter.get_tensor(output_details['index'])[0]
    
    # Softmax
    exps = np.exp(result - np.max(result))
    probs = exps / np.sum(exps)
    
    print(f"{name:30s} -> logits={[f'{x:.4f}' for x in result]} softmax={[f'{x:.4f}' for x in probs]}")

print("Testing Silent-FAS preprocessing on a real face:")
test_inference("RGB [0, 255]", img_np_rgb)
test_inference("BGR [0, 255]", img_np_bgr)
test_inference("RGB [0, 1]", img_np_rgb / 255.0)
test_inference("BGR [0, 1]", img_np_bgr / 255.0)
test_inference("RGB [-1, 1]", (img_np_rgb / 255.0) * 2.0 - 1.0)
test_inference("BGR [-1, 1]", (img_np_bgr / 255.0) * 2.0 - 1.0)
