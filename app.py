"""
SmartScan - Flask Web Application
=================================
This is the main entry point for the SmartScan application.
It sets up the web server, handles page routing, accepts file uploads,
and coordinates with scanner.py to process, crop, resize, and rotate documents.
"""

import os
from flask import Flask, render_template, request, jsonify, send_from_directory
from werkzeug.utils import secure_filename
from scanner import (
    process_document,
    reprocess_cached_document,
    crop_document,
    resize_document,
    rotate_document
)

# -----------------------------------------------------------------------------
# App Configuration & Setup
# -----------------------------------------------------------------------------

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_DIR = os.path.join(BASE_DIR, "templates")
STATIC_DIR = os.path.join(BASE_DIR, "static")

app = Flask(
    __name__,
    template_folder=TEMPLATE_DIR,
    static_folder=STATIC_DIR
)

UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
OUTPUT_FOLDER = os.path.join(STATIC_DIR, "outputs")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(OUTPUT_FOLDER, exist_ok=True)

app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["OUTPUT_FOLDER"] = OUTPUT_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg"}
ALLOWED_MODES = {"bw", "color", "gray"}
DOCUMENT_DETECTION_STATE = {}


def allowed_file(filename: str) -> bool:
    return (
        "." in filename
        and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS
    )


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/upload", methods=["POST"])
def upload_file():
    if "document" not in request.files:
        return jsonify({"success": False, "error": "No file part found in request."}), 400

    file = request.files["document"]

    if file.filename == "":
        return jsonify({"success": False, "error": "No file selected."}), 400

    if not allowed_file(file.filename):
        return jsonify({"success": False, "error": "Invalid format. Only JPG, JPEG, and PNG supported."}), 400

    mode = request.form.get("mode", "bw").lower()
    if mode not in ALLOWED_MODES:
        mode = "bw"

    safe_filename = secure_filename(file.filename)
    upload_path = os.path.join(app.config["UPLOAD_FOLDER"], safe_filename)
    file.save(upload_path)

    base_name, ext = os.path.splitext(safe_filename)
    output_filename = f"scanned_{base_name}_{mode}{ext}"
    output_path = os.path.join(app.config["OUTPUT_FOLDER"], output_filename)

    scan_result = process_document(upload_path, output_path, mode=mode)

    if not scan_result.get("success"):
        return jsonify({"success": False, "error": scan_result.get("error", "Scan failed.")}), 500

    is_detected = scan_result.get("detected_contour", False)
    DOCUMENT_DETECTION_STATE[safe_filename] = is_detected

    return jsonify({
        "success": True,
        "message": scan_result.get("message", "Document successfully scanned!"),
        "filename": safe_filename,
        "scanned_filename": output_filename,
        "original_url": f"/uploads/{safe_filename}",
        "scanned_url": f"/static/outputs/{output_filename}",
        "mode": mode,
        "detected_contour": is_detected
    }), 200


@app.route("/reprocess", methods=["POST"])
def reprocess_file():
    data = request.get_json(silent=True) or {}
    filename = data.get("filename")
    mode = data.get("mode", "bw").lower()

    if not filename:
        return jsonify({"success": False, "error": "Filename is required."}), 400

    if mode not in ALLOWED_MODES:
        mode = "bw"

    safe_filename = secure_filename(filename)
    upload_path = os.path.join(app.config["UPLOAD_FOLDER"], safe_filename)

    if not os.path.exists(upload_path):
        return jsonify({"success": False, "error": "Original file not found."}), 404

    base_name, ext = os.path.splitext(safe_filename)
    output_filename = f"scanned_{base_name}_{mode}{ext}"
    output_path = os.path.join(app.config["OUTPUT_FOLDER"], output_filename)

    is_detected = DOCUMENT_DETECTION_STATE.get(safe_filename, True)
    scan_result = reprocess_cached_document(upload_path, output_path, mode=mode, is_detected=is_detected)

    if not scan_result.get("success"):
        return jsonify({"success": False, "error": scan_result.get("error")}), 500

    return jsonify({
        "success": True,
        "message": scan_result.get("message"),
        "scanned_filename": output_filename,
        "scanned_url": f"/static/outputs/{output_filename}",
        "mode": mode,
        "detected_contour": is_detected
    }), 200


@app.route("/crop", methods=["POST"])
def crop_file():
    data = request.get_json(silent=True) or {}
    filename = data.get("filename")
    crop_data = data.get("crop_data", {})
    mode = data.get("mode", "bw").lower()

    if not filename:
        return jsonify({"success": False, "error": "Filename is required."}), 400

    safe_filename = secure_filename(filename)
    upload_path = os.path.join(app.config["UPLOAD_FOLDER"], safe_filename)

    if not os.path.exists(upload_path):
        return jsonify({"success": False, "error": "Original file not found."}), 404

    base_name, ext = os.path.splitext(safe_filename)
    output_filename = f"scanned_{base_name}_{mode}{ext}"
    output_path = os.path.join(app.config["OUTPUT_FOLDER"], output_filename)

    is_detected = DOCUMENT_DETECTION_STATE.get(safe_filename, True)
    result = crop_document(upload_path, output_path, crop_data, mode=mode, is_detected=is_detected)

    if not result.get("success"):
        return jsonify({"success": False, "error": result.get("error", "Crop failed.")}), 500

    return jsonify({
        "success": True,
        "message": result.get("message"),
        "scanned_filename": output_filename,
        "scanned_url": f"/static/outputs/{output_filename}",
        "width": result.get("width"),
        "height": result.get("height")
    }), 200


@app.route("/resize", methods=["POST"])
def resize_file():
    data = request.get_json(silent=True) or {}
    filename = data.get("filename")
    target_width = data.get("width")
    target_height = data.get("height")
    mode = data.get("mode", "bw").lower()

    if not filename or not target_width or not target_height:
        return jsonify({"success": False, "error": "Filename, width, and height are required."}), 400

    safe_filename = secure_filename(filename)
    upload_path = os.path.join(app.config["UPLOAD_FOLDER"], safe_filename)

    if not os.path.exists(upload_path):
        return jsonify({"success": False, "error": "Original file not found."}), 404

    base_name, ext = os.path.splitext(safe_filename)
    output_filename = f"scanned_{base_name}_{mode}{ext}"
    output_path = os.path.join(app.config["OUTPUT_FOLDER"], output_filename)

    is_detected = DOCUMENT_DETECTION_STATE.get(safe_filename, True)
    result = resize_document(upload_path, output_path, target_width, target_height, mode=mode, is_detected=is_detected)

    if not result.get("success"):
        return jsonify({"success": False, "error": result.get("error", "Resize failed.")}), 500

    return jsonify({
        "success": True,
        "message": result.get("message"),
        "scanned_filename": output_filename,
        "scanned_url": f"/static/outputs/{output_filename}",
        "width": result.get("width"),
        "height": result.get("height")
    }), 200


@app.route("/rotate", methods=["POST"])
def rotate_file():
    data = request.get_json(silent=True) or {}
    filename = data.get("filename")
    direction = data.get("direction", "cw")
    mode = data.get("mode", "bw").lower()

    if not filename:
        return jsonify({"success": False, "error": "Filename is required."}), 400

    safe_filename = secure_filename(filename)
    upload_path = os.path.join(app.config["UPLOAD_FOLDER"], safe_filename)

    if not os.path.exists(upload_path):
        return jsonify({"success": False, "error": "Original file not found."}), 404

    base_name, ext = os.path.splitext(safe_filename)
    output_filename = f"scanned_{base_name}_{mode}{ext}"
    output_path = os.path.join(app.config["OUTPUT_FOLDER"], output_filename)

    is_detected = DOCUMENT_DETECTION_STATE.get(safe_filename, True)
    result = rotate_document(upload_path, output_path, direction=direction, mode=mode, is_detected=is_detected)

    if not result.get("success"):
        return jsonify({"success": False, "error": result.get("error", "Rotate failed.")}), 500

    return jsonify({
        "success": True,
        "message": result.get("message"),
        "scanned_filename": output_filename,
        "scanned_url": f"/static/outputs/{output_filename}",
        "width": result.get("width"),
        "height": result.get("height")
    }), 200


@app.route("/uploads/<path:filename>")
def serve_upload(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


@app.route("/download/<path:filename>")
def download_scanned(filename):
    return send_from_directory(
        app.config["OUTPUT_FOLDER"],
        filename,
        as_attachment=True
    )


# -----------------------------------------------------------------------------
# Error Handlers
# -----------------------------------------------------------------------------

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({
        "success": False,
        "error": "File size exceeds 10 MB maximum limit."
    }), 413


@app.errorhandler(404)
def page_not_found(error):
    return jsonify({
        "success": False,
        "error": "Resource not found."
    }), 404


if __name__ == "__main__":
    print(" * Starting SmartScan on http://127.0.0.1:5000")
    app.run(host="127.0.0.1", port=5000, debug=True)
