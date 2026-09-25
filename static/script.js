/**
 * SmartScan – Document Scanner Controller
 * =========================================
 * - Robust state machine: idle / scanning / applyingFilter / complete / error
 * - Image onload-synchronized overlay (no stuck "Applying style...")
 * - AbortController to prevent race conditions on rapid filter clicks
 * - Interactive drag-to-crop tool (canvas-based)
 * - Aspect ratio presets & aspect-locked resize
 * - Rotate 90° CW / CCW
 */

document.addEventListener("DOMContentLoaded", () => {

    // -------------------------------------------------------------------------
    // DOM References
    // -------------------------------------------------------------------------
    const fileInput         = document.getElementById("file-input");
    const dropzone          = document.getElementById("dropzone");
    const dropzoneText      = document.getElementById("dropzone-text");
    const browseBtn         = document.getElementById("browse-btn");

    const uploadCard        = document.getElementById("upload-card");
    const fileSelectedBar   = document.getElementById("file-selected-bar");
    const uploadThumbnail   = document.getElementById("upload-thumbnail");
    const selectedFileName  = document.getElementById("selected-file-name");
    const selectedFileSize  = document.getElementById("selected-file-size");
    const changeFileBtn     = document.getElementById("change-file-btn");
    const removeFileBtn     = document.getElementById("remove-file-btn");
    const uploadActionRow   = document.getElementById("upload-action-row");
    const scanBtn           = document.getElementById("scan-btn");
    const scanningProgressCard = document.getElementById("scanning-progress-card");
    const progressStepText  = document.getElementById("progress-step-text");

    const workspaceCard     = document.getElementById("workspace-card");
    const detectionStatusBanner = document.getElementById("detection-status-banner");
    const statusBannerText  = document.getElementById("status-banner-text");

    const tabSideBySide     = document.getElementById("tab-side-by-side");
    const tabSliderCompare  = document.getElementById("tab-slider-compare");
    const dualWorkspace     = document.getElementById("dual-workspace");
    const sliderWorkspace   = document.getElementById("slider-workspace");
    const imgOriginal       = document.getElementById("img-original");
    const imgScanned        = document.getElementById("img-scanned");
    const reprocessOverlay  = document.getElementById("reprocess-overlay");
    const reprocessOverlayText = document.getElementById("reprocess-overlay-text");

    const sliderImgOriginal = document.getElementById("slider-img-original");
    const sliderImgScanned  = document.getElementById("slider-img-scanned");
    const sliderImageOverlay = document.getElementById("slider-image-overlay");
    const sliderDivider     = document.getElementById("slider-divider");
    const compareRangeInput = document.getElementById("compare-range-input");

    const styleCards        = document.querySelectorAll(".style-card");

    const metaOrigDim       = document.getElementById("meta-orig-dim");
    const metaProcDim       = document.getElementById("meta-proc-dim");
    const metaOrigSize      = document.getElementById("meta-orig-size");
    const metaScanStyle     = document.getElementById("meta-scan-style");

    const btnDownload       = document.getElementById("btn-download");
    const btnScanAnother    = document.getElementById("btn-scan-another");
    const btnReset          = document.getElementById("btn-reset");

    const statusToast       = document.getElementById("status-toast");
    const toastMessage      = document.getElementById("toast-message");
    const toastClose        = document.getElementById("toast-close");

    // Tool buttons
    const toolCropBtn       = document.getElementById("tool-crop-btn");
    const toolResizeBtn     = document.getElementById("tool-resize-btn");
    const toolRotLeftBtn    = document.getElementById("tool-rot-left-btn");
    const toolRotRightBtn   = document.getElementById("tool-rot-right-btn");

    // Crop modal
    const cropModal         = document.getElementById("crop-modal");
    const closeCropBtn      = document.getElementById("close-crop-btn");
    const cancelCropBtn     = document.getElementById("cancel-crop-btn");
    const applyCropBtn      = document.getElementById("apply-crop-btn");
    const cropCanvas        = document.getElementById("crop-canvas");
    const cropCanvasContainer = document.getElementById("crop-canvas-container");
    const cropPresetPills   = document.querySelectorAll(".crop-presets-row .preset-pill");

    // Resize modal
    const resizeModal       = document.getElementById("resize-modal");
    const closeResizeBtn    = document.getElementById("close-resize-btn");
    const cancelResizeBtn   = document.getElementById("cancel-resize-btn");
    const applyResizeBtn    = document.getElementById("apply-resize-btn");
    const resizeWidthInput  = document.getElementById("resize-width-input");
    const resizeHeightInput = document.getElementById("resize-height-input");
    const resizeAspectLock  = document.getElementById("resize-aspect-lock");
    const resizePresetPills = document.querySelectorAll(".resize-presets-row .preset-pill");

    // -------------------------------------------------------------------------
    // Application State
    // -------------------------------------------------------------------------
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png"];

    const styleLabels = { bw: "B&W Document", color: "Color Enhanced", gray: "Grayscale" };

    let currentFile         = null;
    let uploadedFilename    = null;
    let currentStyle        = "bw";
    let processingState     = "idle";
    let currentReqId        = 0;
    let filterAbortCtrl     = null;
    let progressTimer       = null;

    // Crop state
    let cropAspectRatio     = null;  // null = free
    let cropStart           = null;
    let cropRect            = null;
    let isDragging          = false;
    let cropCtx             = null;
    let cropSourceImg       = new Image();
    let canvasScale         = 1;

    // Resize state
    let origScannedW        = 0;
    let origScannedH        = 0;

    // -------------------------------------------------------------------------
    // State Machine
    // -------------------------------------------------------------------------
    function setProcessingState(state) {
        processingState = state;
        const busy = state === "scanning" || state === "applyingFilter";

        if (scanBtn) scanBtn.disabled = busy;
        styleCards.forEach(c => {
            c.disabled = busy;
            c.style.pointerEvents = busy ? "none" : "auto";
            c.style.opacity = busy ? "0.65" : "1";
        });
        [btnScanAnother, btnReset, toolCropBtn, toolResizeBtn, toolRotLeftBtn, toolRotRightBtn].forEach(b => {
            if (b) b.disabled = busy;
        });

        if (state !== "applyingFilter") {
            hideProcessingOverlay();
        }
    }

    function showProcessingOverlay(msg = "Processing...") {
        if (!reprocessOverlay) return;
        if (reprocessOverlayText) reprocessOverlayText.textContent = msg;
        reprocessOverlay.hidden = false;
    }

    function hideProcessingOverlay() {
        if (reprocessOverlay) reprocessOverlay.hidden = true;
    }

    // -------------------------------------------------------------------------
    // Workflow Step Indicator
    // -------------------------------------------------------------------------
    function setWorkflowStep(n) {
        for (let i = 1; i <= 4; i++) {
            const s = document.getElementById(`step-${i}`);
            const c = document.getElementById(`conn-${i}`);
            if (!s) continue;
            s.classList.remove("step-active", "step-completed");
            if (c) c.classList.remove("completed");
            if (i < n) { s.classList.add("step-completed"); if (c) c.classList.add("completed"); }
            else if (i === n) { s.classList.add("step-active"); }
        }
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------
    function formatBytes(bytes) {
        if (!bytes) return "0 Bytes";
        const k = 1024, s = ["Bytes","KB","MB","GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + s[i];
    }

    function showToast(msg, type = "info") {
        statusToast.className = `status-toast status-${type}`;
        toastMessage.textContent = msg;
        statusToast.hidden = false;
    }

    function hideToast() {
        statusToast.hidden = true;
    }

    function cacheBust(url) {
        return url + (url.includes("?") ? "&" : "?") + "t=" + Date.now();
    }

    // -------------------------------------------------------------------------
    // Load Processed Image – hides overlay ONLY when image actually renders
    // -------------------------------------------------------------------------
    function loadProcessedImage(rawUrl, reqId, onDone) {
        const url = cacheBust(rawUrl);

        // Register handlers BEFORE setting src
        imgScanned.onload = () => {
            if (reqId !== currentReqId) return;          // stale response – ignore
            if (sliderImgScanned) sliderImgScanned.src = url;
            metaProcDim.textContent =
                `${imgScanned.naturalWidth} × ${imgScanned.naturalHeight} px`;
            setProcessingState("complete");
            if (typeof onDone === "function") onDone();
        };

        imgScanned.onerror = () => {
            if (reqId !== currentReqId) return;
            setProcessingState("error");
            showToast("Unable to load processed image.", "error");
        };

        imgScanned.src = url;                            // trigger fetch only after handlers bound
    }

    // -------------------------------------------------------------------------
    // Reset to Upload State
    // -------------------------------------------------------------------------
    function resetToUpload() {
        if (filterAbortCtrl) { filterAbortCtrl.abort(); filterAbortCtrl = null; }
        clearInterval(progressTimer);

        currentFile = null; uploadedFilename = null; currentStyle = "bw";
        fileInput.value = "";
        [imgOriginal, imgScanned, sliderImgOriginal, sliderImgScanned].forEach(i => { if (i) i.src = ""; });

        fileSelectedBar.hidden     = true;
        uploadActionRow.hidden     = true;
        scanningProgressCard.hidden = true;
        dropzone.hidden            = false;
        workspaceCard.hidden       = true;
        uploadCard.hidden          = false;

        styleCards.forEach(c => {
            const active = c.getAttribute("data-style") === "bw";
            c.classList.toggle("active", active);
            c.setAttribute("aria-checked", active ? "true" : "false");
        });
        tabSideBySide.click();
        setProcessingState("idle");
        setWorkflowStep(1);
        hideToast();
    }

    // -------------------------------------------------------------------------
    // File Handling
    // -------------------------------------------------------------------------
    function handleFile(file) {
        hideToast();
        if (!file) return;

        const ext = file.name.split(".").pop().toLowerCase();
        if (!["jpg","jpeg","png"].includes(ext) && !ALLOWED_TYPES.includes(file.type)) {
            showToast("Invalid format. Please upload JPG, JPEG or PNG.", "error");
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            showToast("File exceeds 10 MB limit.", "error");
            return;
        }

        currentFile = file;
        const reader = new FileReader();
        reader.onload = e => {
            uploadThumbnail.src   = e.target.result;
            selectedFileName.textContent = file.name;
            selectedFileSize.textContent = formatBytes(file.size);
            metaOrigSize.textContent     = formatBytes(file.size);

            dropzone.hidden        = true;
            fileSelectedBar.hidden = false;
            uploadActionRow.hidden = false;
            scanBtn.disabled       = false;
            setProcessingState("idle");
            setWorkflowStep(2);
        };
        reader.readAsDataURL(file);
    }

    // Dropzone events
    browseBtn.addEventListener("click",  e => { e.stopPropagation(); fileInput.click(); });
    changeFileBtn.addEventListener("click", () => fileInput.click());
    dropzone.addEventListener("click",   () => fileInput.click());
    dropzone.addEventListener("keydown", e => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
    });
    fileInput.addEventListener("change", e => {
        if (e.target.files?.[0]) handleFile(e.target.files[0]);
    });

    ["dragenter","dragover"].forEach(evt => dropzone.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation();
        dropzone.classList.add("drag-active");
        dropzoneText.textContent = "Release to upload";
    }));
    ["dragleave","drop"].forEach(evt => dropzone.addEventListener(evt, e => {
        e.preventDefault(); e.stopPropagation();
        dropzone.classList.remove("drag-active");
        dropzoneText.textContent = "Drop your document here";
    }));
    dropzone.addEventListener("drop", e => {
        if (e.dataTransfer?.files?.[0]) handleFile(e.dataTransfer.files[0]);
    });

    removeFileBtn.addEventListener("click", resetToUpload);

    // -------------------------------------------------------------------------
    // Scan
    // -------------------------------------------------------------------------
    scanBtn.addEventListener("click", async () => {
        if (!currentFile || processingState === "scanning") return;

        setProcessingState("scanning");
        const reqId = ++currentReqId;

        uploadActionRow.hidden      = true;
        fileSelectedBar.hidden      = true;
        scanningProgressCard.hidden = false;

        const steps = [
            "Detecting document boundaries...",
            "Correcting perspective distortion...",
            "Enhancing text readability..."
        ];
        let si = 0;
        progressStepText.textContent = steps[0];
        progressTimer = setInterval(() => {
            si = (si + 1) % steps.length;
            progressStepText.textContent = steps[si];
        }, 500);

        const formData = new FormData();
        formData.append("document", currentFile);
        formData.append("mode",     currentStyle);

        try {
            const res    = await fetch("/upload", { method: "POST", body: formData });
            clearInterval(progressTimer);
            const result = await res.json();

            if (res.ok && result.success) {
                uploadedFilename = result.filename;
                imgOriginal.src  = result.original_url;
                if (sliderImgOriginal) sliderImgOriginal.src = result.original_url;
                imgOriginal.onload = () => {
                    metaOrigDim.textContent =
                        `${imgOriginal.naturalWidth} × ${imgOriginal.naturalHeight} px`;
                };

                btnDownload.href = `/download/${result.scanned_filename}`;
                btnDownload.setAttribute("download", result.scanned_filename);

                if (result.detected_contour) {
                    detectionStatusBanner.className = "detection-status-banner";
                    statusBannerText.textContent    = "Document detected and perspective corrected";
                    showToast("Document detected and perspective corrected.", "success");
                } else {
                    detectionStatusBanner.className = "detection-status-banner fallback-mode";
                    statusBannerText.textContent    = "Document boundary was not clearly detected. Full image was enhanced.";
                    showToast("Document boundary not clearly detected. Full image was enhanced.", "info");
                }

                metaScanStyle.textContent = styleLabels[currentStyle];

                uploadCard.hidden    = true;
                workspaceCard.hidden = false;
                setWorkflowStep(3);

                // Show overlay until image actually loads
                setProcessingState("applyingFilter");
                showProcessingOverlay("Loading scanned document...");
                loadProcessedImage(result.scanned_url, reqId);
            } else {
                uploadActionRow.hidden      = false;
                fileSelectedBar.hidden      = false;
                scanningProgressCard.hidden = true;
                setProcessingState("error");
                showToast(result.error || "Scan failed.", "error");
            }
        } catch (err) {
            clearInterval(progressTimer);
            uploadActionRow.hidden      = false;
            fileSelectedBar.hidden      = false;
            scanningProgressCard.hidden = true;
            setProcessingState("error");
            showToast("Server connection failed.", "error");
        }
    });

    // -------------------------------------------------------------------------
    // View Mode Toggle
    // -------------------------------------------------------------------------
    tabSideBySide.addEventListener("click", () => {
        tabSideBySide.classList.add("active"); tabSideBySide.setAttribute("aria-selected","true");
        tabSliderCompare.classList.remove("active"); tabSliderCompare.setAttribute("aria-selected","false");
        dualWorkspace.hidden  = false;
        sliderWorkspace.hidden = true;
    });

    tabSliderCompare.addEventListener("click", () => {
        tabSliderCompare.classList.add("active"); tabSliderCompare.setAttribute("aria-selected","true");
        tabSideBySide.classList.remove("active"); tabSideBySide.setAttribute("aria-selected","false");
        dualWorkspace.hidden   = true;
        sliderWorkspace.hidden = false;
    });

    compareRangeInput.addEventListener("input", e => {
        const v = e.target.value;
        if (sliderImageOverlay) sliderImageOverlay.style.width = `${v}%`;
        if (sliderDivider)      sliderDivider.style.left       = `${v}%`;
    });

    // -------------------------------------------------------------------------
    // Scan Style Filter (with AbortController race-condition protection)
    // -------------------------------------------------------------------------
    styleCards.forEach(card => {
        card.addEventListener("click", async () => {
            const newStyle = card.getAttribute("data-style");
            if (!uploadedFilename) return;
            if (newStyle === currentStyle && processingState === "complete") return;

            // Optimistic UI update
            styleCards.forEach(c => { c.classList.remove("active"); c.setAttribute("aria-checked","false"); });
            card.classList.add("active"); card.setAttribute("aria-checked","true");
            currentStyle = newStyle;
            metaScanStyle.textContent = styleLabels[currentStyle];

            // Cancel previous request
            if (filterAbortCtrl) filterAbortCtrl.abort();
            filterAbortCtrl = new AbortController();
            const reqId = ++currentReqId;

            setProcessingState("applyingFilter");
            showProcessingOverlay("Applying style...");

            try {
                const res    = await fetch("/reprocess", {
                    method:  "POST",
                    headers: { "Content-Type": "application/json" },
                    body:    JSON.stringify({ filename: uploadedFilename, mode: currentStyle }),
                    signal:  filterAbortCtrl.signal
                });

                if (reqId !== currentReqId) return;   // superseded by newer click

                const result = await res.json();
                if (res.ok && result.success) {
                    btnDownload.href = `/download/${result.scanned_filename}`;
                    btnDownload.setAttribute("download", result.scanned_filename);

                    loadProcessedImage(result.scanned_url, reqId, () => {
                        showToast(`${styleLabels[currentStyle]} applied.`, "success");
                    });
                } else {
                    setProcessingState("error");
                    showToast(result.error || "Failed to change style.", "error");
                }
            } catch (err) {
                if (err.name === "AbortError") return;
                if (reqId === currentReqId) {
                    setProcessingState("error");
                    showToast("Connection error while applying style.", "error");
                }
            }
        });
    });

    // -------------------------------------------------------------------------
    // ROTATE
    // -------------------------------------------------------------------------
    async function applyRotate(direction) {
        if (!uploadedFilename || processingState === "applyingFilter") return;
        const reqId = ++currentReqId;
        setProcessingState("applyingFilter");
        showProcessingOverlay(direction === "ccw" ? "Rotating left..." : "Rotating right...");

        try {
            const res    = await fetch("/rotate", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ filename: uploadedFilename, direction, mode: currentStyle })
            });
            const result = await res.json();
            if (res.ok && result.success) {
                btnDownload.href = `/download/${result.scanned_filename}`;
                btnDownload.setAttribute("download", result.scanned_filename);
                loadProcessedImage(result.scanned_url, reqId, () =>
                    showToast("Document rotated.", "success")
                );
            } else {
                setProcessingState("error");
                showToast(result.error || "Rotation failed.", "error");
            }
        } catch {
            setProcessingState("error");
            showToast("Connection error.", "error");
        }
    }

    toolRotLeftBtn.addEventListener("click",  () => applyRotate("ccw"));
    toolRotRightBtn.addEventListener("click", () => applyRotate("cw"));

    // -------------------------------------------------------------------------
    // CROP MODAL
    // -------------------------------------------------------------------------
    let cropSelection = null;  // { x, y, w, h } in canvas coords

    function openCropModal() {
        if (!uploadedFilename || !imgScanned.src) return;
        cropSelection = null;
        cropAspectRatio = null;

        // Reset active preset pill
        cropPresetPills.forEach(p => p.classList.toggle("active", p.getAttribute("data-ratio") === "free"));

        cropSourceImg = new Image();
        cropSourceImg.crossOrigin = "anonymous";
        cropSourceImg.onload = () => drawCropCanvas();
        cropSourceImg.src = cacheBust(imgScanned.src);

        cropModal.hidden = false;
    }

    function drawCropCanvas() {
        const container = cropCanvasContainer;
        const maxW = container.clientWidth  || 680;
        const maxH = container.clientHeight || 380;

        const sw = cropSourceImg.naturalWidth;
        const sh = cropSourceImg.naturalHeight;
        canvasScale = Math.min(maxW / sw, maxH / sh, 1);

        cropCanvas.width  = Math.round(sw * canvasScale);
        cropCanvas.height = Math.round(sh * canvasScale);
        cropCtx = cropCanvas.getContext("2d");
        cropCtx.drawImage(cropSourceImg, 0, 0, cropCanvas.width, cropCanvas.height);

        if (cropSelection) drawCropOverlay();
    }

    function drawCropOverlay() {
        if (!cropCtx || !cropSelection) return;
        drawCropCanvas();  // redraw clean image first
        const { x, y, w, h } = cropSelection;
        cropCtx.fillStyle = "rgba(0,0,0,0.45)";
        // darken outside
        cropCtx.fillRect(0, 0, cropCanvas.width, y);
        cropCtx.fillRect(0, y + h, cropCanvas.width, cropCanvas.height - y - h);
        cropCtx.fillRect(0, y, x, h);
        cropCtx.fillRect(x + w, y, cropCanvas.width - x - w, h);
        // bright border
        cropCtx.strokeStyle = "#3b82f6";
        cropCtx.lineWidth   = 2;
        cropCtx.strokeRect(x, y, w, h);
        // corner handles
        const hs = 8;
        cropCtx.fillStyle = "#3b82f6";
        [[x,y],[x+w,y],[x,y+h],[x+w,y+h]].forEach(([cx,cy]) =>
            cropCtx.fillRect(cx - hs/2, cy - hs/2, hs, hs)
        );
    }

    function getAspectRatio(key) {
        if (key === "a4")    return 1 / 1.4142;   // A4 portrait
        if (key === "card")  return 3 / 2;
        if (key === "1:1")   return 1;
        return null;  // free
    }

    cropPresetPills.forEach(pill => {
        pill.addEventListener("click", () => {
            cropPresetPills.forEach(p => p.classList.remove("active"));
            pill.classList.add("active");
            cropAspectRatio = getAspectRatio(pill.getAttribute("data-ratio"));
            if (cropSelection) drawCropOverlay();
        });
    });

    // Mouse events on canvas
    cropCanvas.addEventListener("mousedown", e => {
        const r = cropCanvas.getBoundingClientRect();
        cropStart  = { x: e.clientX - r.left, y: e.clientY - r.top };
        isDragging = true;
        cropSelection = null;
    });

    cropCanvas.addEventListener("mousemove", e => {
        if (!isDragging || !cropStart) return;
        const r  = cropCanvas.getBoundingClientRect();
        const cx = Math.max(0, Math.min(e.clientX - r.left, cropCanvas.width));
        const cy = Math.max(0, Math.min(e.clientY - r.top,  cropCanvas.height));
        let w = cx - cropStart.x;
        let h = cy - cropStart.y;

        if (cropAspectRatio) {
            const side = Math.max(Math.abs(w), Math.abs(h));
            w = Math.sign(w || 1) * side;
            h = Math.sign(h || 1) * side / cropAspectRatio;
        }

        cropSelection = {
            x: w >= 0 ? cropStart.x : cropStart.x + w,
            y: h >= 0 ? cropStart.y : cropStart.y + h,
            w: Math.abs(w),
            h: Math.abs(h)
        };
        drawCropOverlay();
    });

    cropCanvas.addEventListener("mouseup",    () => { isDragging = false; });
    cropCanvas.addEventListener("mouseleave", () => { isDragging = false; });

    // Touch support for crop
    cropCanvas.addEventListener("touchstart", e => {
        e.preventDefault();
        const t = e.touches[0];
        const r = cropCanvas.getBoundingClientRect();
        cropStart  = { x: t.clientX - r.left, y: t.clientY - r.top };
        isDragging = true; cropSelection = null;
    }, { passive: false });

    cropCanvas.addEventListener("touchmove", e => {
        e.preventDefault();
        if (!isDragging || !cropStart) return;
        const t  = e.touches[0];
        const r  = cropCanvas.getBoundingClientRect();
        const cx = Math.max(0, Math.min(t.clientX - r.left, cropCanvas.width));
        const cy = Math.max(0, Math.min(t.clientY - r.top,  cropCanvas.height));
        let w = cx - cropStart.x;
        let h = cy - cropStart.y;
        if (cropAspectRatio) {
            const side = Math.max(Math.abs(w), Math.abs(h));
            w = Math.sign(w || 1) * side;
            h = Math.sign(h || 1) * side / cropAspectRatio;
        }
        cropSelection = {
            x: w >= 0 ? cropStart.x : cropStart.x + w,
            y: h >= 0 ? cropStart.y : cropStart.y + h,
            w: Math.abs(w), h: Math.abs(h)
        };
        drawCropOverlay();
    }, { passive: false });

    cropCanvas.addEventListener("touchend", () => { isDragging = false; });

    async function applyCrop() {
        if (!cropSelection || cropSelection.w < 5 || cropSelection.h < 5) {
            showToast("Please draw a crop region first.", "info");
            return;
        }

        // Convert canvas coords → original image coords (is_normalized = false for pixel coords)
        const cropData = {
            x:             Math.round(cropSelection.x / canvasScale),
            y:             Math.round(cropSelection.y / canvasScale),
            width:         Math.round(cropSelection.w / canvasScale),
            height:        Math.round(cropSelection.h / canvasScale),
            is_normalized: false
        };

        cropModal.hidden = true;
        const reqId = ++currentReqId;
        setProcessingState("applyingFilter");
        showProcessingOverlay("Cropping document...");

        try {
            const res    = await fetch("/crop", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ filename: uploadedFilename, crop_data: cropData, mode: currentStyle })
            });
            const result = await res.json();
            if (res.ok && result.success) {
                btnDownload.href = `/download/${result.scanned_filename}`;
                btnDownload.setAttribute("download", result.scanned_filename);
                loadProcessedImage(result.scanned_url, reqId, () =>
                    showToast("Document cropped successfully.", "success")
                );
            } else {
                setProcessingState("error");
                showToast(result.error || "Crop failed.", "error");
            }
        } catch {
            setProcessingState("error");
            showToast("Connection error during crop.", "error");
        }
    }

    toolCropBtn.addEventListener("click", openCropModal);
    applyCropBtn.addEventListener("click", applyCrop);
    cancelCropBtn.addEventListener("click", () => { cropModal.hidden = true; });
    closeCropBtn.addEventListener("click",  () => { cropModal.hidden = true; });
    cropModal.addEventListener("click", e => { if (e.target === cropModal) cropModal.hidden = true; });

    // -------------------------------------------------------------------------
    // RESIZE MODAL
    // -------------------------------------------------------------------------
    function openResizeModal() {
        if (!uploadedFilename || !imgScanned.src) return;
        origScannedW = imgScanned.naturalWidth  || 0;
        origScannedH = imgScanned.naturalHeight || 0;
        resizeWidthInput.value  = origScannedW;
        resizeHeightInput.value = origScannedH;
        resizeModal.hidden = false;
    }

    // Aspect-ratio lock
    resizeWidthInput.addEventListener("input", () => {
        if (!resizeAspectLock.checked || !origScannedH || !origScannedW) return;
        const ratio = origScannedH / origScannedW;
        resizeHeightInput.value = Math.round(resizeWidthInput.value * ratio);
    });

    resizeHeightInput.addEventListener("input", () => {
        if (!resizeAspectLock.checked || !origScannedW || !origScannedH) return;
        const ratio = origScannedW / origScannedH;
        resizeWidthInput.value = Math.round(resizeHeightInput.value * ratio);
    });

    // Scale presets
    resizePresetPills.forEach(pill => {
        pill.addEventListener("click", () => {
            const scale = parseFloat(pill.getAttribute("data-scale"));
            if (!scale || !origScannedW) return;
            resizeWidthInput.value  = Math.round(origScannedW * scale);
            resizeHeightInput.value = Math.round(origScannedH * scale);
        });
    });

    async function applyResize() {
        const w = parseInt(resizeWidthInput.value,  10);
        const h = parseInt(resizeHeightInput.value, 10);
        if (!w || !h || w < 50 || h < 50) {
            showToast("Enter valid dimensions (min 50×50).", "info");
            return;
        }

        resizeModal.hidden = true;
        const reqId = ++currentReqId;
        setProcessingState("applyingFilter");
        showProcessingOverlay("Resizing document...");

        try {
            const res    = await fetch("/resize", {
                method:  "POST",
                headers: { "Content-Type": "application/json" },
                body:    JSON.stringify({ filename: uploadedFilename, width: w, height: h, mode: currentStyle })
            });
            const result = await res.json();
            if (res.ok && result.success) {
                origScannedW = result.width;
                origScannedH = result.height;
                btnDownload.href = `/download/${result.scanned_filename}`;
                btnDownload.setAttribute("download", result.scanned_filename);
                loadProcessedImage(result.scanned_url, reqId, () =>
                    showToast(result.message || "Resized successfully.", "success")
                );
            } else {
                setProcessingState("error");
                showToast(result.error || "Resize failed.", "error");
            }
        } catch {
            setProcessingState("error");
            showToast("Connection error during resize.", "error");
        }
    }

    toolResizeBtn.addEventListener("click", openResizeModal);
    applyResizeBtn.addEventListener("click", applyResize);
    cancelResizeBtn.addEventListener("click", () => { resizeModal.hidden = true; });
    closeResizeBtn.addEventListener("click",  () => { resizeModal.hidden = true; });
    resizeModal.addEventListener("click", e => { if (e.target === resizeModal) resizeModal.hidden = true; });
    window.addEventListener("keydown", e => {
        if (e.key === "Escape") { cropModal.hidden = true; resizeModal.hidden = true; }
    });

    // -------------------------------------------------------------------------
    // Action Bar
    // -------------------------------------------------------------------------
    btnDownload.addEventListener("click", () => setWorkflowStep(4));
    btnScanAnother.addEventListener("click", resetToUpload);
    btnReset.addEventListener("click",       resetToUpload);
    toastClose.addEventListener("click",     hideToast);

    // Init
    setProcessingState("idle");
    setWorkflowStep(1);
});
