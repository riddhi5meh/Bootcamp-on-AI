"""
SmartScan - Computer Vision Document Scanner Module
===================================================
This module provides an automatic document detection, perspective correction,
image enhancement, cropping, resizing, and rotation pipeline using OpenCV (cv2) and NumPy.
"""

import os
import cv2
import numpy as np


def order_points(points: np.ndarray) -> np.ndarray:
    """
    Orders 4 arbitrary (x, y) coordinates into a consistent sequence:
      - points[0]: Top-Left (TL)
      - points[1]: Top-Right (TR)
      - points[2]: Bottom-Right (BR)
      - points[3]: Bottom-Left (BL)
    """
    rect = np.zeros((4, 2), dtype="float32")

    # Sum of coordinates: s = x + y
    s = points.sum(axis=1)
    rect[0] = points[np.argmin(s)]  # Top-left has minimum sum
    rect[2] = points[np.argmax(s)]  # Bottom-right has maximum sum

    # Difference of coordinates: diff = y - x
    diff = np.diff(points, axis=1)
    rect[1] = points[np.argmin(diff)]  # Top-right has minimum diff
    rect[3] = points[np.argmax(diff)]  # Bottom-left has maximum diff

    return rect


def find_document_contour(image: np.ndarray, min_area_ratio: float = 0.05) -> np.ndarray | None:
    """
    Detects the 4-corner boundary of a document within a preprocessed image.
    """
    height, width = image.shape[:2]
    total_area = height * width
    min_area = total_area * min_area_ratio

    # 1. Grayscale Conversion
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # 2. Gaussian Blur
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)

    # 3. Canny Edge Detection
    edged = cv2.Canny(blurred, 50, 150)

    # 4. Morphological Operations
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    dilated = cv2.dilate(edged, kernel, iterations=1)
    closed = cv2.morphologyEx(dilated, cv2.MORPH_CLOSE, kernel)

    # 5. Contour Detection
    contours, _ = cv2.findContours(closed.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if not contours:
        contours, _ = cv2.findContours(closed.copy(), cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)

    if not contours:
        return None

    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:8]

    # 6. Examine candidate contours and approximate polygonal boundaries
    for c in contours:
        area = cv2.contourArea(c)
        if area < min_area:
            continue

        perimeter = cv2.arcLength(c, True)

        for eps_factor in (0.02, 0.03, 0.015, 0.04):
            approx = cv2.approxPolyDP(c, eps_factor * perimeter, True)
            if len(approx) == 4 and cv2.isContourConvex(approx):
                return approx.reshape(4, 2)

    return None


def four_point_transform(image: np.ndarray, pts: np.ndarray) -> np.ndarray:
    """
    Transforms an arbitrary 4-point quadrilateral from a photograph into
    a flat, top-down rectangular scan using homography perspective warping.
    """
    rect = order_points(pts)
    (tl, tr, br, bl) = rect

    # Calculate width of new scanned image
    width_a = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    width_b = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    max_width = max(int(width_a), int(width_b))

    # Calculate height of new scanned image
    height_a = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    height_b = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    max_height = max(int(height_a), int(height_b))

    max_width = max(max_width, 100)
    max_height = max(max_height, 100)

    dst = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1]
    ], dtype="float32")

    matrix = cv2.getPerspectiveTransform(rect, dst)
    warped = cv2.warpPerspective(image, matrix, (max_width, max_height))

    return warped


def detect_and_warp_document(orig_image: np.ndarray, target_height: float = 700.0) -> tuple[np.ndarray, bool]:
    """
    Orchestrates document detection and perspective warping.
    """
    orig_h, orig_w = orig_image.shape[:2]
    ratio = orig_h / float(target_height)
    target_width = int(orig_w / ratio)

    resized = cv2.resize(orig_image, (target_width, int(target_height)))
    document_corners = find_document_contour(resized, min_area_ratio=0.05)

    if document_corners is not None:
        orig_pts = document_corners.astype("float32") * ratio
        warped = four_point_transform(orig_image, orig_pts)
        return warped, True

    return orig_image.copy(), False


def enhance_document(warped: np.ndarray, mode: str = "bw", is_detected: bool = True) -> np.ndarray:
    """
    Enhances the perspective-warped document using one of three scanning filters:
      - 'bw': Adaptive Gaussian thresholding for documents, or clean CLAHE for fallback photos.
      - 'color': Subtle CLAHE on LAB Lightness channel.
      - 'gray': Clean continuous grayscale with CLAHE.
    """
    if mode == "color":
        lab = cv2.cvtColor(warped, cv2.COLOR_BGR2LAB)
        l_channel, a_channel, b_channel = cv2.split(lab)

        clahe = cv2.createCLAHE(clipLimit=1.8, tileGridSize=(8, 8))
        enhanced_l = clahe.apply(l_channel)

        merged = cv2.merge([enhanced_l, a_channel, b_channel])
        color_enhanced = cv2.cvtColor(merged, cv2.COLOR_LAB2BGR)

        blurred = cv2.GaussianBlur(color_enhanced, (0, 0), 1.5)
        sharpened = cv2.addWeighted(color_enhanced, 1.15, blurred, -0.15, 0)
        return sharpened

    elif mode == "gray":
        gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        clahe = cv2.createCLAHE(clipLimit=1.8, tileGridSize=(8, 8))
        gray_enhanced = clahe.apply(gray)

        blurred = cv2.GaussianBlur(gray_enhanced, (0, 0), 1.5)
        sharpened = cv2.addWeighted(gray_enhanced, 1.15, blurred, -0.15, 0)
        return sharpened

    else:
        # B&W Document Mode
        if not is_detected:
            # Fallback Image (e.g. portrait photograph without document boundary):
            gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
            clahe = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8))
            return clahe.apply(gray)

        # Document Detected
        gray = cv2.cvtColor(warped, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (3, 3), 0)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(blurred)

        bw = cv2.adaptiveThreshold(
            enhanced,
            255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY,
            21,
            10
        )

        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (2, 2))
        cleaned = cv2.morphologyEx(bw, cv2.MORPH_CLOSE, kernel)
        return cleaned


def process_document(input_path: str, output_path: str, mode: str = "bw") -> dict:
    """
    Main processing entry point called upon upload.
    """
    if not os.path.exists(input_path):
        return {
            "success": False,
            "error": f"Input image does not exist: {input_path}"
        }

    image = cv2.imread(input_path)
    if image is None:
        return {
            "success": False,
            "error": "Failed to read image. The file may be corrupt or unreadable."
        }

    warped, detected = detect_and_warp_document(image, target_height=700.0)

    # Cache the warped source image for fast in-place filter switching
    upload_dir = os.path.dirname(input_path)
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    cached_warped_path = os.path.join(upload_dir, f"warped_{base_name}.png")
    cv2.imwrite(cached_warped_path, warped)

    scanned = enhance_document(warped, mode=mode, is_detected=detected)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    save_ok = cv2.imwrite(output_path, scanned)

    if not save_ok:
        return {
            "success": False,
            "error": "Failed to write scanned output to disk."
        }

    if detected:
        status_message = "Document detected and perspective corrected."
    else:
        status_message = "Document boundary was not clearly detected. Full image was enhanced."

    return {
        "success": True,
        "message": status_message,
        "detected_contour": detected,
        "mode": mode,
        "output_path": output_path
    }


def reprocess_cached_document(input_path: str, output_path: str, mode: str = "bw", is_detected: bool = True) -> dict:
    """
    Fast filter switching using the cached warped document image.
    """
    upload_dir = os.path.dirname(input_path)
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    cached_warped_path = os.path.join(upload_dir, f"warped_{base_name}.png")

    if os.path.exists(cached_warped_path):
        source_image = cv2.imread(cached_warped_path)
    else:
        source_image = cv2.imread(input_path)

    if source_image is None:
        return {
            "success": False,
            "error": "Failed to read source image for reprocessing."
        }

    scanned = enhance_document(source_image, mode=mode, is_detected=is_detected)

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    save_ok = cv2.imwrite(output_path, scanned)

    if not save_ok:
        return {
            "success": False,
            "error": "Failed to save reprocessed image."
        }

    return {
        "success": True,
        "message": f"Applied {mode.upper()} style.",
        "detected_contour": is_detected,
        "mode": mode,
        "output_path": output_path
    }


def crop_document(input_path: str, output_path: str, crop_data: dict, mode: str = "bw", is_detected: bool = True) -> dict:
    """
    Crops the document based on pixel or percentage bounding box and re-enhances.

    crop_data contains:
      - x, y, width, height (either in pixels or normalized 0.0 to 1.0)
      - is_normalized (bool): True if coordinates are ratios [0, 1]
    """
    upload_dir = os.path.dirname(input_path)
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    cached_warped_path = os.path.join(upload_dir, f"warped_{base_name}.png")

    if os.path.exists(cached_warped_path):
        source = cv2.imread(cached_warped_path)
    else:
        source = cv2.imread(input_path)

    if source is None:
        return {"success": False, "error": "Source image not found for cropping."}

    h, w = source.shape[:2]
    is_norm = crop_data.get("is_normalized", False)

    if is_norm:
        x1 = max(0, min(int(crop_data.get("x", 0) * w), w - 1))
        y1 = max(0, min(int(crop_data.get("y", 0) * h), h - 1))
        box_w = max(10, int(crop_data.get("width", 1) * w))
        box_h = max(10, int(crop_data.get("height", 1) * h))
    else:
        x1 = max(0, min(int(crop_data.get("x", 0)), w - 1))
        y1 = max(0, min(int(crop_data.get("y", 0)), h - 1))
        box_w = max(10, int(crop_data.get("width", w)))
        box_h = max(10, int(crop_data.get("height", h)))

    x2 = min(w, x1 + box_w)
    y2 = min(h, y1 + box_h)

    cropped = source[y1:y2, x1:x2]
    if cropped.size == 0:
        return {"success": False, "error": "Crop selection has 0 area."}

    # Update the cached warped file with the new cropped version
    cv2.imwrite(cached_warped_path, cropped)

    # Re-enhance with current mode
    scanned = enhance_document(cropped, mode=mode, is_detected=is_detected)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    cv2.imwrite(output_path, scanned)

    return {
        "success": True,
        "message": "Document cropped successfully.",
        "width": x2 - x1,
        "height": y2 - y1,
        "output_path": output_path
    }


def resize_document(input_path: str, output_path: str, target_width: int, target_height: int, mode: str = "bw", is_detected: bool = True) -> dict:
    """
    Resizes the processed document to new dimensions and re-enhances.
    """
    upload_dir = os.path.dirname(input_path)
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    cached_warped_path = os.path.join(upload_dir, f"warped_{base_name}.png")

    if os.path.exists(cached_warped_path):
        source = cv2.imread(cached_warped_path)
    else:
        source = cv2.imread(input_path)

    if source is None:
        return {"success": False, "error": "Source image not found for resizing."}

    target_w = max(50, min(5000, int(target_width)))
    target_h = max(50, min(5000, int(target_height)))

    # Use INTER_AREA for downsampling and INTER_CUBIC for upsampling
    interp = cv2.INTER_AREA if (target_w < source.shape[1]) else cv2.INTER_CUBIC
    resized = cv2.resize(source, (target_w, target_h), interpolation=interp)

    # Update the cached warped file with the resized version
    cv2.imwrite(cached_warped_path, resized)

    scanned = enhance_document(resized, mode=mode, is_detected=is_detected)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    cv2.imwrite(output_path, scanned)

    return {
        "success": True,
        "message": f"Document resized to {target_w} × {target_h} px.",
        "width": target_w,
        "height": target_h,
        "output_path": output_path
    }


def rotate_document(input_path: str, output_path: str, direction: str = "cw", mode: str = "bw", is_detected: bool = True) -> dict:
    """
    Rotates the processed document 90 degrees clockwise ('cw') or counter-clockwise ('ccw').
    """
    upload_dir = os.path.dirname(input_path)
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    cached_warped_path = os.path.join(upload_dir, f"warped_{base_name}.png")

    if os.path.exists(cached_warped_path):
        source = cv2.imread(cached_warped_path)
    else:
        source = cv2.imread(input_path)

    if source is None:
        return {"success": False, "error": "Source image not found for rotation."}

    if direction == "ccw":
        rotated = cv2.rotate(source, cv2.ROTATE_90_COUNTERCLOCKWISE)
    else:
        rotated = cv2.rotate(source, cv2.ROTATE_90_CLOCKWISE)

    cv2.imwrite(cached_warped_path, rotated)

    scanned = enhance_document(rotated, mode=mode, is_detected=is_detected)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    cv2.imwrite(output_path, scanned)

    return {
        "success": True,
        "message": "Document rotated.",
        "width": rotated.shape[1],
        "height": rotated.shape[0],
        "output_path": output_path
    }
