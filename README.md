# SmartScan – Document Scanner

A clean, modern full-stack web application that transforms everyday photographs of paper documents, receipts, and notes into perspective-corrected, high-contrast digital scans using **Python, Flask, OpenCV (cv2), and NumPy**.

---

## Features

- **Drag-and-Drop Upload**: Seamless drag-and-drop file upload with client-side validation for JPG, JPEG, and PNG images (up to 10 MB).
- **Instant Client-Side Preview**: Displays image thumbnail, file name, and formatted size before processing.
- **OpenCV Computer Vision Pipeline**:
  - **4-Corner Polygon Detection**: Finds the document contours even if angled or photographed on a desk.
  - **Perspective Transformation (Homography)**: Warps angled photos into flat, top-down rectangular scans.
  - **Intelligent Fallback**: Gracefully handles tightly framed photos without crashing.
- **Three Scan Enhancement Modes**:
  - **B&W Document**: Bilateral filter + Adaptive Gaussian Thresholding for crisp paper-white background and sharp black text.
  - **Color Enhanced**: CLAHE contrast enhancement on the LAB Lightness channel—preserves colored stamps, logos, and signatures.
  - **Grayscale**: Balanced continuous-tone contrast enhancement.
- **Side-by-Side Comparison**: Easily switch between **"Scanned Result"** and **"Original Photo"** with comparison tabs.
- **In-Place Re-Filtering**: Switch between B&W, Color, and Grayscale filters directly on the result page without re-uploading.
- **One-Click Download**: Download the scanned document directly to your device.
- **Modern, Accessible UI**: Pure Vanilla CSS and JavaScript—no heavy frameworks, fast load times, and responsive across mobile and desktop.

---

## Project Structure

```text
SmartScan/
├── app.py                  # Flask server, routing, upload & reprocess endpoints
├── scanner.py              # OpenCV computer vision pipeline (detection & transform)
├── requirements.txt        # Python package dependencies
├── .gitignore              # Ignores temp uploads, cache, and virtual envs
├── README.md               # Project documentation
├── templates/
│   └── index.html          # Semantic HTML5 user interface & About modal
├── static/
│   ├── style.css           # Modern design system (navy headings, blue accents)
│   ├── script.js           # Client-side validation, drag-and-drop, and AJAX
│   └── outputs/            # Generated scanned images
└── uploads/                # Stored raw uploaded documents
```

---

## How the OpenCV Pipeline Works

```text
[ Raw Photo ]
      │
      ▼
1. Grayscale & Gaussian Blur ───► Reduces noise and texture artifacts
      │
      ▼
2. Canny Edge Detection & Dilation ───► Traces sharp boundaries & connects gaps
      │
      ▼
3. Contour Detection (approxPolyDP) ───► Isolates 4-corner document polygon
      │
      ▼
4. Four-Point Perspective Warp ───► Warps angled quad into a flat rectangle
      │
      ▼
5. Enhancement Filter ───► Adaptive Thresholding / CLAHE (B&W, Color, Grayscale)
      │
      ▼
[ Clean Scanned Document ]
```

---

## Getting Started

### Prerequisites
- Python 3.8 or higher
- `pip` package manager

### 1. Installation
Clone or navigate to the project directory:
```bash
cd SmartScan
```

Install dependencies:
```bash
pip install -r requirements.txt
```

### 2. Run the Application
Start the Flask development server:
```bash
python app.py
```

### 3. Open in Browser
Visit the application in your web browser:
```
http://127.0.0.1:5000
```

---

## Technology Stack

- **Backend**: Python 3, Flask, Werkzeug
- **Computer Vision**: OpenCV (`cv2`), NumPy
- **Frontend**: HTML5, Vanilla CSS3, Vanilla JavaScript (ES6+)
- **Typography**: Google Fonts (Inter)
- **Icons**: Clean inline SVGs (no external icon dependencies or emojis)

---

## License
MIT License. Free for educational and personal use.
