import os
import time
import json
import threading
import requests
import cv2
import numpy as np
from flask import Flask, render_template, Response, request, jsonify

app = Flask(__name__)

# Config persistence path
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.json")
LOG_LIMIT = 50

# Default configuration
DEFAULT_CONFIG = {
    "rtsp_url": "rtsp://usuario:senha@192.168.1.100:554/stream1",
    "camera_name": "SmartCam Main",
    "ptz_url_template": "http://192.168.1.100/cgi-bin/ptz.cgi?action=move&direction={direction}&speed={speed}",
    "ptz_preset_template": "http://192.168.1.100/cgi-bin/ptz.cgi?action=preset&preset_id={preset_id}",
    "ptz_speed": 5,
    "simulate_ptz": True
}

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r") as f:
                data = json.load(f)
                # Merge with default keys to ensure compatibility
                config = DEFAULT_CONFIG.copy()
                config.update(data)
                return config
        except Exception:
            return DEFAULT_CONFIG.copy()
    return DEFAULT_CONFIG.copy()

def save_config(config):
    try:
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=4)
        return True
    except Exception:
        return False

# Global configuration state
config = load_config()

class CameraStreamer:
    def __init__(self):
        self.is_running = False
        self.cap = None
        self.latest_frame = None
        self.lock = threading.Lock()
        self.thread = None
        self.status = "Disconnected"
        self.fps = 0.0
        self.frame_count = 0
        self.start_time = time.time()
        self.resolution = "1280x720"
        
        # PTZ State for simulation
        self.ptz_x = 0.0
        self.ptz_y = 0.0
        self.ptz_zoom = 1.0
        
        # System Logs
        self.logs = []
        self.add_log("System", "Camera service initialized in demo fallback mode.")

    def add_log(self, source, message):
        timestamp = time.strftime("%H:%M:%S")
        self.logs.append({
            "timestamp": timestamp,
            "source": source,
            "message": message
        })
        if len(self.logs) > LOG_LIMIT:
            self.logs.pop(0)

    def start(self):
        self.is_running = True
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()
        self.add_log("System", "Background capture thread started.")

    def stop(self):
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=2.0)
        if self.cap:
            self.cap.release()
        self.add_log("System", "Background capture thread stopped.")

    def _run(self):
        last_url = ""
        while self.is_running:
            # Grab current URL from config
            url = config.get("rtsp_url", "")
            
            # Check if camera needs to be (re)opened
            if not self.cap or url != last_url:
                if self.cap:
                    self.cap.release()
                    self.cap = None
                
                last_url = url
                
                # Check for empty/default placeholder urls or explicitly requested demo mode
                is_demo = not url or "usuario:senha" in url or url.lower() in ["demo", "mock", "test"]
                
                if is_demo:
                    self.status = "Demo Mode (Simulated Stream)"
                    self.resolution = "1280x720"
                    self.add_log("Capture", "RTSP URL is placeholder or empty. Running in high-fidelity Demo Mode.")
                    self.cap = None
                else:
                    self.status = "Connecting..."
                    self.add_log("Capture", f"Attempting connection to stream source: {url}")
                    
                    try:
                        # Check if user specified a local camera index (like "0" or "1")
                        if url.strip().isdigit():
                            self.cap = cv2.VideoCapture(int(url.strip()), cv2.CAP_DSHOW)
                        else:
                            # Standard RTSP or video file url, force FFmpeg backend for network streams
                            self.cap = cv2.VideoCapture(url, cv2.CAP_FFMPEG)
                    except Exception as e:
                        self.add_log("Capture", f"Exception during Capture opening: {str(e)}")
                        self.cap = None
                    
                    if self.cap and self.cap.isOpened():
                        self.status = "Connected"
                        w = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                        h = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                        self.resolution = f"{w}x{h}"
                        self.add_log("Capture", f"Successfully connected. Resolution: {self.resolution}")
                    else:
                        self.status = "Connection Failed"
                        self.add_log("Capture", "Failed to open stream. Falling back to simulated feed.")
                        self.cap = None

            # Frame acquisition loop
            if self.cap is not None:
                try:
                    success, frame = self.cap.read()
                    if success:
                        self.frame_count += 1
                        # Calculate FPS
                        elapsed = time.time() - self.start_time
                        if elapsed >= 1.0:
                            self.fps = round(self.frame_count / elapsed, 1)
                            self.frame_count = 0
                            self.start_time = time.time()
                        
                        with self.lock:
                            # Apply real time info/watermark overlays if needed
                            self.latest_frame = frame.copy()
                        
                        # Yield CPU slightly
                        time.sleep(0.005)
                    else:
                        self.status = "Stream Interrupted"
                        self.add_log("Capture", "Read error: camera stream interrupted. Retrying...")
                        if self.cap:
                            self.cap.release()
                        self.cap = None
                        time.sleep(2.0)
                except Exception as e:
                    self.status = "Capture Error"
                    self.add_log("Capture", f"Error during read: {str(e)}")
                    if self.cap:
                        self.cap.release()
                    self.cap = None
                    time.sleep(2.0)
            else:
                # Simulated Feed Mode
                frame = self._generate_simulated_frame()
                self.frame_count += 1
                elapsed = time.time() - self.start_time
                if elapsed >= 1.0:
                    self.fps = round(self.frame_count / elapsed, 1)
                    self.frame_count = 0
                    self.start_time = time.time()
                
                with self.lock:
                    self.latest_frame = frame
                
                # Sleep to maintain ~30fps
                time.sleep(0.033)

    def _generate_simulated_frame(self):
        # Create full dark tech canvas
        width, height = 1280, 720
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Grid overlay for tactical design
        grid_spacing = 80
        for x in range(0, width, grid_spacing):
            cv2.line(frame, (x, 0), (x, height), (22, 28, 38), 1)
        for y in range(0, height, grid_spacing):
            cv2.line(frame, (0, y), (width, y), (22, 28, 38), 1)

        # Smooth simulation adjustments based on local PTZ state
        offset_x = int(self.ptz_x * 8)
        offset_y = int(self.ptz_y * 8)
        
        cx = width // 2 + offset_x
        cy = height // 2 + offset_y
        z = self.ptz_zoom
        
        # Radar scope target
        cv2.circle(frame, (cx, cy), int(120 * z), (34, 197, 94), 1)
        cv2.circle(frame, (cx, cy), int(220 * z), (34, 197, 94), 1)
        cv2.circle(frame, (cx, cy), 6, (239, 68, 68), -1) # Red center dot
        
        # Crosshair lines
        cv2.line(frame, (cx - int(280 * z), cy), (cx - int(25 * z), cy), (34, 197, 94), 1)
        cv2.line(frame, (cx + int(25 * z), cy), (cx + int(280 * z), cy), (34, 197, 94), 1)
        cv2.line(frame, (cx, cy - int(280 * z)), (cx, cy - int(25 * z)), (34, 197, 94), 1)
        cv2.line(frame, (cx, cy + int(25 * z)), (cx, cy + int(280 * z)), (34, 197, 94), 1)
        
        # Moving target simulator
        t = time.time()
        tx = int(cx + np.cos(t * 1.2) * 280 * z)
        ty = int(cy + np.sin(t * 0.7) * 160 * z)
        t_size = int(45 * z)
        
        # Target bounding box
        cv2.rectangle(frame, (tx - t_size, ty - t_size), (tx + t_size, ty + t_size), (59, 130, 246), 2)
        cv2.putText(frame, "DETECTION: AUTO_TRACK_0", (tx - t_size, ty - t_size - 8), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (59, 130, 246), 1)
        cv2.putText(frame, f"LOCK: {(95.0 + np.sin(t)*4.0):.2f}%", (tx - t_size, ty + t_size + 15), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.4, (59, 130, 246), 1)

        # Draw tech specs text overlay
        cv2.putText(frame, f"CAMERA ID: {config.get('camera_name', 'SmartCam Main').upper()}", (50, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (34, 197, 94), 2)
        cv2.putText(frame, f"REC FEED: {time.strftime('%Y-%m-%d %H:%M:%S')}", (50, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (156, 163, 175), 1)
        cv2.putText(frame, f"SYS STATUS: {self.status.upper()}", (50, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (59, 130, 246), 1)
        cv2.putText(frame, f"FPS: {self.fps} / 30.0", (50, 145), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (156, 163, 175), 1)
        cv2.putText(frame, f"SRC: {config.get('rtsp_url')[:38]}...", (50, 170), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (156, 163, 175), 1)
        
        # PTZ Coordinates
        cv2.putText(frame, f"PAN: {self.ptz_x:+.1f} deg", (width - 200, 70), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (34, 197, 94), 1)
        cv2.putText(frame, f"TILT: {self.ptz_y:+.1f} deg", (width - 200, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (34, 197, 94), 1)
        cv2.putText(frame, f"ZOOM: {self.ptz_zoom:.2f}x", (width - 200, 120), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (34, 197, 94), 1)
        
        # HUD Borders
        length = 30
        margin = 35
        # Top-Left
        cv2.line(frame, (margin, margin), (margin + length, margin), (34, 197, 94), 2)
        cv2.line(frame, (margin, margin), (margin, margin + length), (34, 197, 94), 2)
        # Top-Right
        cv2.line(frame, (width - margin, margin), (width - margin - length, margin), (34, 197, 94), 2)
        cv2.line(frame, (width - margin, margin), (width - margin, margin + length), (34, 197, 94), 2)
        # Bottom-Left
        cv2.line(frame, (margin, height - margin), (margin + length, height - margin), (34, 197, 94), 2)
        cv2.line(frame, (margin, height - margin), (margin, height - margin - length), (34, 197, 94), 2)
        # Bottom-Right
        cv2.line(frame, (width - margin, height - margin), (width - margin - length, height - margin), (34, 197, 94), 2)
        cv2.line(frame, (width - margin, height - margin), (width - margin, height - margin - length), (34, 197, 94), 2)

        # Scanning Line
        scan_y = int((t * 220) % (height - margin*2)) + margin
        cv2.line(frame, (margin, scan_y), (width - margin, scan_y), (34, 197, 94), 1)
        
        return frame

    def get_jpeg(self):
        with self.lock:
            if self.latest_frame is None:
                # Fallback blank frame if thread hasn't initialized
                frame = np.zeros((720, 1280, 3), dtype=np.uint8)
                cv2.putText(frame, "INITIALIZING SYSTEM STREAM...", (380, 360), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (156, 163, 175), 2)
                ret, jpeg = cv2.imencode('.jpg', frame)
                return jpeg.tobytes()
            
            ret, jpeg = cv2.imencode('.jpg', self.latest_frame)
            return jpeg.tobytes()

# Initialize Camera Streamer
streamer = CameraStreamer()

@app.route("/")
def index():
    return render_template("index.html")

def gen(camera):
    while True:
        frame_bytes = camera.get_jpeg()
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
        # Cap FPS of stream delivery to client
        time.sleep(0.033)

@app.route("/video_feed")
def video_feed():
    return Response(gen(streamer), mimetype='multipart/x-mixed-replace; boundary=frame')

@app.route("/api/config", methods=["GET", "POST"])
def manage_config():
    global config
    if request.method == "POST":
        data = request.json
        # Validate data
        new_config = config.copy()
        new_config.update(data)
        
        # Save to file
        if save_config(new_config):
            config = new_config
            # Streamer automatically picks up the new URL in its loop
            streamer.add_log("System", "Configuration updated and saved successfully.")
            return jsonify({"status": "success", "config": config})
        else:
            return jsonify({"status": "error", "message": "Failed to save configuration."}), 500
            
    return jsonify(config)

@app.route("/api/logs", methods=["GET"])
def get_logs():
    return jsonify(streamer.logs)

@app.route("/api/ptz", methods=["POST"])
def ptz_control():
    data = request.json or {}
    action = data.get("action", "") # "move" or "preset"
    direction = data.get("direction", "") # "up", "down", "left", "right", "zoom_in", "zoom_out", "center"
    preset_id = data.get("preset_id", "")
    speed = data.get("speed", config.get("ptz_speed", 5))

    # Update local simulated coordinates
    if direction == "up":
        streamer.ptz_y = min(90.0, streamer.ptz_y + speed)
    elif direction == "down":
        streamer.ptz_y = max(-90.0, streamer.ptz_y - speed)
    elif direction == "left":
        streamer.ptz_x = max(-180.0, streamer.ptz_x - speed)
    elif direction == "right":
        streamer.ptz_x = min(180.0, streamer.ptz_x + speed)
    elif direction == "zoom_in":
        streamer.ptz_zoom = min(8.0, streamer.ptz_zoom + 0.2)
    elif direction == "zoom_out":
        streamer.ptz_zoom = max(1.0, streamer.ptz_zoom - 0.2)
    elif direction == "center":
        streamer.ptz_x = 0.0
        streamer.ptz_y = 0.0
        streamer.ptz_zoom = 1.0
    
    if action == "preset" and preset_id:
        streamer.add_log("PTZ", f"Navigating to Preset: {preset_id}")
        # Simulate preset coordinates
        if str(preset_id) == "1":
            streamer.ptz_x, streamer.ptz_y, streamer.ptz_zoom = -45.0, 15.0, 2.0
        elif str(preset_id) == "2":
            streamer.ptz_x, streamer.ptz_y, streamer.ptz_zoom = 60.0, -10.0, 1.5
        elif str(preset_id) == "3":
            streamer.ptz_x, streamer.ptz_y, streamer.ptz_zoom = 0.0, 0.0, 3.0

    # Build target URL
    if action == "preset":
        target_url = config.get("ptz_preset_template", "").format(preset_id=preset_id)
        log_message = f"Preset command: Goto {preset_id}"
    else:
        target_url = config.get("ptz_url_template", "").format(direction=direction, speed=speed)
        log_message = f"Directional command: Move {direction} (Speed {speed})"

    # Execute HTTP call to physical camera if not in pure simulation mode
    status_code = None
    response_text = ""
    error_msg = ""
    
    should_execute = not config.get("simulate_ptz", True)
    
    # If the camera url is a dummy / demo, don't execute actual HTTP calls
    rtsp_url = config.get("rtsp_url", "")
    is_demo = not rtsp_url or "usuario:senha" in rtsp_url or rtsp_url.lower() in ["demo", "mock", "test"]
    if is_demo:
        should_execute = False

    if should_execute and target_url:
        try:
            streamer.add_log("PTZ-Network", f"Sending request to camera: {target_url}")
            # Add short timeout to prevent blocking Flask
            r = requests.get(target_url, timeout=3.0)
            status_code = r.status_code
            response_text = r.text[:100]
            streamer.add_log("PTZ-Network", f"Response: {status_code} - {response_text}")
        except Exception as e:
            error_msg = str(e)
            streamer.add_log("PTZ-Network", f"Request Failed: {error_msg}")
    else:
        # Simulation response
        time.sleep(0.05) # Simulate network lag
        status_code = 200
        response_text = '{"status":"ok", "message":"simulated response"}'
        streamer.add_log("PTZ-Simulated", f"Simulated call -> {log_message}")

    return jsonify({
        "status": "success" if error_msg == "" else "error",
        "action": action,
        "direction": direction,
        "preset_id": preset_id,
        "simulated": not should_execute,
        "target_url": target_url,
        "status_code": status_code,
        "response": response_text,
        "error": error_msg,
        "coordinates": {
            "pan": streamer.ptz_x,
            "tilt": streamer.ptz_y,
            "zoom": streamer.ptz_zoom
        }
    })

@app.route("/api/status", methods=["GET"])
def get_status():
    return jsonify({
        "status": streamer.status,
        "resolution": streamer.resolution,
        "fps": streamer.fps,
        "coordinates": {
            "pan": streamer.ptz_x,
            "tilt": streamer.ptz_y,
            "zoom": streamer.ptz_zoom
        }
    })

if __name__ == "__main__":
    streamer.start()
    try:
        app.run(host="0.0.0.0", port=5001, debug=False)
    finally:
        streamer.stop()
