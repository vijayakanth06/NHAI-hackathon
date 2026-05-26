import urllib.request
import numpy as np
import tensorflow as tf
from PIL import Image
import os

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                          "android", "app", "src", "main", "assets", "models")
model_path = os.path.join(MODELS_DIR, "silent_fas_int8.tflite")

# Download a spoof image (e.g. from a phone screen) if available, or just test various images
images = [
    ("Real Face", "https://raw.githubusercontent.com/minivision-ai/Silent-Face-Anti-Spoofing/master/images/sample/image_F1.jpg"),
    ("Spoof Print", "https://raw.githubusercontent.com/minivision-ai/Silent-Face-Anti-Spoofing/master/images/sample/image_T1.jpg"),
    ("Spoof Replay", "https://raw.githubusercontent.com/minivision-ai/Silent-Face-Anti-Spoofing/master/images/sample/image_T2.jpg")
]

interpreter = tf.lite.Interpreter(model_path=model_path)
interpreter.allocate_tensors()
input_details = interpreter.get_input_details()[0]
output_details = interpreter.get_output_details()[0]

def test_inference(name, data):
    test_data = np.expand_dims(data, axis=0)
    interpreter.set_tensor(input_details['index'], test_data)
    interpreter.invoke()
    result = interpreter.get_tensor(output_details['index'])[0]
    
    exps = np.exp(result - np.max(result))
    probs = exps / np.sum(exps)
    return probs

print("Testing Silent-FAS model classes...")
for label, url in images:
    img_path = label.replace(" ", "_") + ".jpg"
    if not os.path.exists(img_path):
        try:
            urllib.request.urlretrieve(url, img_path)
        except Exception as e:
            print(f"Failed to download {label}: {e}")
            continue
            
    img = Image.open(img_path).convert("RGB").resize((80, 80))
    img_np_rgb = np.array(img, dtype=np.float32)
    
    # Try different normalizations to see which makes sense
    print(f"\nImage: {label}")
    # The original minivision code uses:
    # BGR, but we need to check their preprocessing.
    # Usually it's (x/255.0) or (x) but sometimes they subtract mean etc.
    # Minivision code actually doesn't normalize! It just resizes and transposes to (C,H,W) and gives [0, 255] float
    # But wait, TFLite models often have different preprocessing baked in.
    
    probs_0_255 = test_inference("RGB [0,255]", img_np_rgb)
    probs_0_1 = test_inference("RGB [0,1]", img_np_rgb / 255.0)
    probs_neg1_1 = test_inference("RGB [-1,1]", (img_np_rgb / 255.0) * 2.0 - 1.0)
    
    # Let's also try BGR
    img_np_bgr = img_np_rgb[:, :, ::-1]
    probs_bgr_0_255 = test_inference("BGR [0,255]", img_np_bgr)
    
    print(f"  RGB [0,255] : {probs_0_255}")
    print(f"  RGB [0,1]   : {probs_0_1}")
    print(f"  RGB [-1,1]  : {probs_neg1_1}")
    print(f"  BGR [0,255] : {probs_bgr_0_255}")

