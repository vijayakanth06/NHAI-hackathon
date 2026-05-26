import cv2
import numpy as np
import tensorflow as tf
import math
import os

MODELS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)),
                          "android", "app", "src", "main", "assets", "models")

# Helper to load TFLite models
def load_model(name):
    path = os.path.join(MODELS_DIR, name)
    if not os.path.exists(path):
        print(f"Model missing: {path}")
        return None
    interpreter = tf.lite.Interpreter(model_path=path)
    interpreter.allocate_tensors()
    return interpreter

def get_anchors():
    anchors = []
    for y in range(16):
        for x in range(16):
            cx, cy = (x + 0.5) / 16.0, (y + 0.5) / 16.0
            anchors.extend([[cx, cy], [cx, cy]])
    for y in range(8):
        for x in range(8):
            cx, cy = (x + 0.5) / 8.0, (y + 0.5) / 8.0
            for _ in range(6):
                anchors.append([cx, cy])
    return np.array(anchors, dtype=np.float32)

class BiometricPipeline:
    def __init__(self):
        print("Loading models...")
        self.detect_model = load_model("featherface_detect_int8.tflite")
        self.silent_fas = load_model("silent_fas_int8.tflite")
        self.face_mesh = load_model("face_mesh.tflite")
        self.iris_model = load_model("iris_quality_int8.tflite")
        self.facelive = load_model("facelive_int8.tflite")
        self.rppg = load_model("rppg_liveness_int8.tflite")
        self.zero_dce = load_model("zero_dce_enhance_int8.tflite")
        self.anchors = get_anchors()

    def run_featherface(self, frame_rgb):
        img = cv2.resize(frame_rgb, (128, 128))
        img = img.astype(np.float32) / 255.0
        img = np.expand_dims(img, 0)
        
        self.detect_model.set_tensor(self.detect_model.get_input_details()[0]['index'], img)
        self.detect_model.invoke()
        
        regressors = self.detect_model.get_tensor(self.detect_model.get_output_details()[0]['index'])[0]
        classificators = self.detect_model.get_tensor(self.detect_model.get_output_details()[1]['index'])[0]
        
        scores = 1.0 / (1.0 + np.exp(-classificators[:, 0]))
        best_idx = np.argmax(scores)
        best_score = scores[best_idx]
        
        if best_score < 0.5:
            return None
            
        anchor = self.anchors[best_idx]
        reg = regressors[best_idx]
        
        cx = reg[0] / 128.0 + anchor[0]
        cy = reg[1] / 128.0 + anchor[1]
        w = reg[2] / 128.0
        h = reg[3] / 128.0
        
        x = max(0.0, cx - w / 2.0)
        y = max(0.0, cy - h / 2.0)
        
        return {
            "bbox_norm": [x, y, w, h],
            "score": best_score
        }

    def run_silent_fas(self, cropped_bgr):
        img = cv2.resize(cropped_bgr, (80, 80))
        img = img.astype(np.float32) # [0, 255] BGR
        img = np.expand_dims(img, 0)
        
        self.silent_fas.set_tensor(self.silent_fas.get_input_details()[0]['index'], img)
        self.silent_fas.invoke()
        logits = self.silent_fas.get_tensor(self.silent_fas.get_output_details()[0]['index'])[0]
        
        exps = np.exp(logits - np.max(logits))
        probs = exps / np.sum(exps)
        return probs[1] # Class 1 is Real

    def run_facelive(self, cropped_rgb):
        img = cv2.resize(cropped_rgb, (112, 112))
        img = (img.astype(np.float32) / 255.0) * 2.0 - 1.0 # [-1, 1] RGB
        img = np.expand_dims(img, 0)
        
        self.facelive.set_tensor(self.facelive.get_input_details()[0]['index'], img)
        self.facelive.invoke()
        embed = self.facelive.get_tensor(self.facelive.get_output_details()[0]['index'])[0]
        return embed

def main():
    pipeline = BiometricPipeline()
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Cannot open webcam!")
        return

    print("Starting webcam... Press 'q' to quit.")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
            
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        h, w, _ = frame.shape
        
        # Center crop to 4:3 (mimic android app which is 320x240)
        if w/h > 4/3:
            new_w = int(h * 4/3)
            start_x = (w - new_w) // 2
            frame = frame[:, start_x:start_x+new_w]
            frame_rgb = frame_rgb[:, start_x:start_x+new_w]
            w = new_w
            
        detect_res = pipeline.run_featherface(frame_rgb)
        
        if detect_res:
            bx, by, bw, bh = detect_res["bbox_norm"]
            
            x1 = int(bx * w)
            y1 = int(by * h)
            x2 = int((bx + bw) * w)
            y2 = int((by + bh) * h)
            
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(w, x2), min(h, y2)
            
            cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(frame, f"Face: {detect_res['score']:.2f}", (x1, y1-10), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                        
            if x2 > x1 and y2 > y1:
                cropped_rgb = frame_rgb[y1:y2, x1:x2]
                cropped_bgr = frame[y1:y2, x1:x2]
                
                # Test Silent FAS tightly cropped (what android does)
                liveness = pipeline.run_silent_fas(cropped_bgr)
                cv2.putText(frame, f"Liveness (Tight): {liveness:.3f}", (x1, y2+20), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255) if liveness < 0.5 else (0, 255, 0), 2)
                
                # Let's test a wider crop (what Minivision original code actually does!)
                # Minivision scale is usually 2.7 or 4.0
                scale = 2.7
                cx, cy = (x1 + x2) / 2, (y1 + y2) / 2
                cw, ch = (x2 - x1), (y2 - y1)
                
                side = max(cw, ch) * scale
                wx1 = int(cx - side / 2)
                wy1 = int(cy - side / 2)
                wx2 = int(cx + side / 2)
                wy2 = int(cy + side / 2)
                
                # Pad if out of bounds
                pad_x1 = max(0, -wx1)
                pad_y1 = max(0, -wy1)
                pad_x2 = max(0, wx2 - w)
                pad_y2 = max(0, wy2 - h)
                
                wx1_c, wy1_c = max(0, wx1), max(0, wy1)
                wx2_c, wy2_c = min(w, wx2), min(h, wy2)
                
                wide_crop_bgr = frame[wy1_c:wy2_c, wx1_c:wx2_c]
                if pad_x1 > 0 or pad_y1 > 0 or pad_x2 > 0 or pad_y2 > 0:
                    wide_crop_bgr = cv2.copyMakeBorder(wide_crop_bgr, pad_y1, pad_y2, pad_x1, pad_x2, cv2.BORDER_CONSTANT, value=[0,0,0])
                
                liveness_wide = pipeline.run_silent_fas(wide_crop_bgr)
                cv2.putText(frame, f"Liveness (Wide 2.7x): {liveness_wide:.3f}", (x1, y2+40), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 100, 100), 2)
                
                cv2.rectangle(frame, (wx1_c, wy1_c), (wx2_c, wy2_c), (255, 100, 100), 1)

        cv2.imshow('NHAI Biometrics Pipeline Test', frame)
        
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
