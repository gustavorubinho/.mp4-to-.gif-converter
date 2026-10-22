// ===================================================
// CONTROLE DE TEMA (CLARO / ESCURO)
// ===================================================
const themeToggle = document.getElementById('theme-toggle');
const themeIconSun = document.getElementById('theme-icon-sun');
const themeIconMoon = document.getElementById('theme-icon-moon');

function applyTheme(isLight) {
    if (isLight) {
        document.body.classList.add('light-theme');
        if (themeIconSun) themeIconSun.classList.add('hidden');
        if (themeIconMoon) themeIconMoon.classList.remove('hidden');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.classList.remove('light-theme');
        if (themeIconSun) themeIconSun.classList.remove('hidden');
        if (themeIconMoon) themeIconMoon.classList.add('hidden');
        localStorage.setItem('theme', 'dark');
    }
}

const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
    applyTheme(true);
} else {
    applyTheme(false);
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const isCurrentlyLight = document.body.classList.contains('light-theme');
        applyTheme(!isCurrentlyLight);
    });
}

// ===================================================
// SELEÇÃO DOS ELEMENTOS DO HTML
// ===================================================
const dropZone = document.getElementById('drop-zone');
const videoInput = document.getElementById('video-input');
const selectedFileBox = document.getElementById('selected-file-box');
const fileName = document.getElementById('file-name');
const btnRemove = document.getElementById('btn-remove');

// Stage de Prévia e Crop Interativo
const cropStageWrapper = document.getElementById('crop-stage-wrapper');
const previewVideo = document.getElementById('preview-video');
const cropBox = document.getElementById('crop-box');
const cropBoxBadge = document.getElementById('crop-box-badge');

// Barra de Corte Estilo iPhone
const iosTrimTrack = document.getElementById('ios-trim-track');
const iosFilmstrip = document.getElementById('ios-filmstrip');
const iosTrimSelection = document.getElementById('ios-trim-selection');
const dimLeft = document.getElementById('dim-left');
const dimRight = document.getElementById('dim-right');
const handleLeft = document.getElementById('handle-left');
const handleRight = document.getElementById('handle-right');
const trimCenter = document.getElementById('trim-center');
const iosPlayhead = document.getElementById('ios-playhead');

const trimDurationBadge = document.getElementById('trim-duration-badge');
const trimStartLabel = document.getElementById('trim-start-label');
const trimEndLabel = document.getElementById('trim-end-label');
const trimSummaryLabel = document.getElementById('trim-summary-label');

const aspectPills = document.querySelectorAll('.pill');
const aspectBadge = document.getElementById('aspect-badge');

const btnConvert = document.getElementById('btn-convert');
const loadingBox = document.getElementById('loading-box');
const errorBox = document.getElementById('error-box');
const errorMessage = document.getElementById('error-message');

const resultBox = document.getElementById('result-box');
const gifPreview = document.getElementById('gif-preview');
const btnDownload = document.getElementById('btn-download');
const btnNew = document.getElementById('btn-new');

let selectedFile = null;
let selectedAspect = 'original';

// Estado do Corte no estilo iPhone
let videoDuration = 10.0;
let trimStart = 0.0;
let trimEnd = 5.0;
const MIN_DURATION = 2.0;
const MAX_DURATION = 8.0;

let trimDragMode = null; // 'left', 'right', 'center'
let dragStartX = 0;
let dragStartTrimStart = 0;
let dragStartTrimEnd = 0;

// Estado de Movimento e Redimensionamento da Caixa de Crop
let cropActionMode = null;
let startClientX = 0;
let startClientY = 0;
let initialLeft = 0;
let initialTop = 0;
let initialWidth = 0;
let initialHeight = 0;

function getTargetRatio() {
    if (selectedAspect === '1:1') return 1.0;
    if (selectedAspect === '9:16') return 9.0 / 16.0;
    if (selectedAspect === '16:9') return 16.0 / 9.0;
    return 1.0;
}

// ===================================================
// 1. BARRA DE CORTE ESTILO IPHONE (COM SCRUB AO VIVO)
// ===================================================
function renderTrimBar() {
    if (videoDuration <= 0) return;

    const leftPct = (trimStart / videoDuration) * 100;
    const widthPct = ((trimEnd - trimStart) / videoDuration) * 100;
    const rightPct = 100 - (leftPct + widthPct);

    iosTrimSelection.style.left = `${leftPct}%`;
    iosTrimSelection.style.width = `${widthPct}%`;

    dimLeft.style.width = `${leftPct}%`;
    dimRight.style.width = `${rightPct}%`;

    const dur = (trimEnd - trimStart).toFixed(1);
    trimDurationBadge.textContent = `${dur}s`;
    trimStartLabel.textContent = `${trimStart.toFixed(1)}s`;
    trimEndLabel.textContent = `${videoDuration.toFixed(1)}s`;
    trimSummaryLabel.textContent = `Selected: ${trimStart.toFixed(1)}s – ${trimEnd.toFixed(1)}s (${dur}s)`;
}

// Iniciar arrasto na barra do iPhone
function startTrimDrag(mode, clientX) {
    trimDragMode = mode;
    dragStartX = clientX;
    dragStartTrimStart = trimStart;
    dragStartTrimEnd = trimEnd;

    // Pausar o vídeo durante o corte para atualizar frame por frame
    if (previewVideo) {
        previewVideo.pause();
    }
}

handleLeft.addEventListener('mousedown', (e) => {
    startTrimDrag('left', e.clientX);
    e.stopPropagation();
    e.preventDefault();
});

handleRight.addEventListener('mousedown', (e) => {
    startTrimDrag('right', e.clientX);
    e.stopPropagation();
    e.preventDefault();
});

trimCenter.addEventListener('mousedown', (e) => {
    startTrimDrag('center', e.clientX);
    e.stopPropagation();
    e.preventDefault();
});

// Touch para celular / tablets
handleLeft.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) startTrimDrag('left', e.touches[0].clientX);
});
handleRight.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) startTrimDrag('right', e.touches[0].clientX);
});
trimCenter.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) startTrimDrag('center', e.touches[0].clientX);
});

window.addEventListener('mousemove', (e) => {
    handleTrimMove(e.clientX);
});

window.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1) handleTrimMove(e.touches[0].clientX);
});

function handleTrimMove(clientX) {
    if (!trimDragMode || videoDuration <= 0) return;

    const trackWidth = iosTrimTrack.clientWidth;
    const deltaX = clientX - dragStartX;
    const deltaSec = (deltaX / trackWidth) * videoDuration;

    if (trimDragMode === 'left') {
        let newStart = dragStartTrimStart + deltaSec;
        newStart = Math.max(0, newStart);
        newStart = Math.min(newStart, trimEnd - MIN_DURATION);
        if (trimEnd - newStart > MAX_DURATION) {
            newStart = trimEnd - MAX_DURATION;
        }

        trimStart = parseFloat(newStart.toFixed(2));
        previewVideo.currentTime = trimStart;
        iosPlayhead.style.left = `${(trimStart / videoDuration) * 100}%`;
    } 
    else if (trimDragMode === 'right') {
        let newEnd = dragStartTrimEnd + deltaSec;
        newEnd = Math.min(videoDuration, newEnd);
        newEnd = Math.max(newEnd, trimStart + MIN_DURATION);
        if (newEnd - trimStart > MAX_DURATION) {
            newEnd = trimStart + MAX_DURATION;
        }

        trimEnd = parseFloat(newEnd.toFixed(2));
        previewVideo.currentTime = trimEnd;
        iosPlayhead.style.left = `${(trimEnd / videoDuration) * 100}%`;
    } 
    else if (trimDragMode === 'center') {
        const curDur = dragStartTrimEnd - dragStartTrimStart;
        let newStart = dragStartTrimStart + deltaSec;
        let newEnd = newStart + curDur;

        if (newStart < 0) {
            newStart = 0;
            newEnd = curDur;
        }
        if (newEnd > videoDuration) {
            newEnd = videoDuration;
            newStart = videoDuration - curDur;
        }

        trimStart = parseFloat(newStart.toFixed(2));
        trimEnd = parseFloat(newEnd.toFixed(2));
        previewVideo.currentTime = trimStart;
        iosPlayhead.style.left = `${(trimStart / videoDuration) * 100}%`;
    }

    renderTrimBar();
}

function stopTrimDrag() {
    if (trimDragMode) {
        trimDragMode = null;
        if (previewVideo && !previewVideo.ended) {
            previewVideo.currentTime = trimStart;
            previewVideo.play().catch(() => {});
        }
    }
}

window.addEventListener('mouseup', stopTrimDrag);
window.addEventListener('touchend', stopTrimDrag);

// Loop de reprodução dentro do trecho cortado
previewVideo.addEventListener('timeupdate', () => {
    if (trimDragMode) return; // Não interferir enquanto o usuário estiver arrastando

    if (videoDuration > 0) {
        const pct = (previewVideo.currentTime / videoDuration) * 100;
        iosPlayhead.style.left = `${pct}%`;
    }

    if (previewVideo.currentTime >= trimEnd || previewVideo.currentTime < trimStart) {
        previewVideo.currentTime = trimStart;
    }
});

// ===================================================
// 2. ASPECT RATIO & CROP
// ===================================================
aspectPills.forEach(pill => {
    pill.addEventListener('click', () => {
        aspectPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        selectedAspect = pill.getAttribute('data-aspect');
        aspectBadge.textContent = pill.textContent.split(' ')[0];

        updateCropBox();
    });
});

function updateCropBox() {
    if (selectedAspect === 'original' || !previewVideo.videoWidth) {
        cropBox.classList.add('hidden');
        return;
    }

    cropBox.classList.remove('hidden');
    cropBoxBadge.textContent = selectedAspect;

    const vWidth = previewVideo.clientWidth;
    const vHeight = previewVideo.clientHeight;
    const ratio = getTargetRatio();

    let boxW, boxH;
    if (vWidth / vHeight > ratio) {
        boxH = Math.round(vHeight * 0.9);
        boxW = Math.round(boxH * ratio);
    } else {
        boxW = Math.round(vWidth * 0.9);
        boxH = Math.round(boxW / ratio);
    }

    const left = Math.max(0, Math.round((vWidth - boxW) / 2));
    const top = Math.max(0, Math.round((vHeight - boxH) / 2));

    cropBox.style.width = `${boxW}px`;
    cropBox.style.height = `${boxH}px`;
    cropBox.style.left = `${left}px`;
    cropBox.style.top = `${top}px`;
}

// Mover e Redimensionar Caixa de Crop
cropBox.addEventListener('mousedown', (e) => {
    const handle = e.target.getAttribute('data-handle');
    cropActionMode = handle ? `resize-${handle}` : 'move';

    startClientX = e.clientX;
    startClientY = e.clientY;
    initialLeft = cropBox.offsetLeft;
    initialTop = cropBox.offsetTop;
    initialWidth = cropBox.offsetWidth;
    initialHeight = cropBox.offsetHeight;

    e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
    if (!cropActionMode) return;

    const deltaX = e.clientX - startClientX;
    const deltaY = e.clientY - startClientY;
    const vWidth = previewVideo.clientWidth;
    const vHeight = previewVideo.clientHeight;
    const ratio = getTargetRatio();

    if (cropActionMode === 'move') {
        let newLeft = initialLeft + deltaX;
        let newTop = initialTop + deltaY;

        newLeft = Math.max(0, Math.min(newLeft, vWidth - cropBox.offsetWidth));
        newTop = Math.max(0, Math.min(newTop, vHeight - cropBox.offsetHeight));

        cropBox.style.left = `${newLeft}px`;
        cropBox.style.top = `${newTop}px`;
    } 
    else if (cropActionMode.startsWith('resize')) {
        let newW = initialWidth;
        let newH = initialHeight;
        let newL = initialLeft;
        let newT = initialTop;

        if (cropActionMode === 'resize-se') {
            newW = Math.max(40, initialWidth + deltaX);
            newH = Math.round(newW / ratio);

            if (newL + newW > vWidth) {
                newW = vWidth - newL;
                newH = Math.round(newW / ratio);
            }
            if (newT + newH > vHeight) {
                newH = vHeight - newT;
                newW = Math.round(newH * ratio);
            }
        } 
        else if (cropActionMode === 'resize-sw') {
            newW = Math.max(40, initialWidth - deltaX);
            newH = Math.round(newW / ratio);
            newL = initialLeft + (initialWidth - newW);

            if (newL < 0) {
                newL = 0;
                newW = initialLeft + initialWidth;
                newH = Math.round(newW / ratio);
            }
            if (newT + newH > vHeight) {
                newH = vHeight - newT;
                newW = Math.round(newH * ratio);
                newL = initialLeft + (initialWidth - newW);
            }
        } 
        else if (cropActionMode === 'resize-ne') {
            newW = Math.max(40, initialWidth + deltaX);
            newH = Math.round(newW / ratio);
            newT = initialTop + (initialHeight - newH);

            if (newL + newW > vWidth) {
                newW = vWidth - newL;
                newH = Math.round(newW / ratio);
                newT = initialTop + (initialHeight - newH);
            }
            if (newT < 0) {
                newT = 0;
                newH = initialTop + initialHeight;
                newW = Math.round(newH * ratio);
            }
        } 
        else if (cropActionMode === 'resize-nw') {
            newW = Math.max(40, initialWidth - deltaX);
            newH = Math.round(newW / ratio);
            newL = initialLeft + (initialWidth - newW);
            newT = initialTop + (initialHeight - newH);

            if (newL < 0) {
                newL = 0;
                newW = initialLeft + initialWidth;
                newH = Math.round(newW / ratio);
                newT = initialTop + (initialHeight - newH);
            }
            if (newT < 0) {
                newT = 0;
                newH = initialTop + initialHeight;
                newW = Math.round(newH * ratio);
                newL = initialLeft + (initialWidth - newW);
            }
        }

        cropBox.style.width = `${newW}px`;
        cropBox.style.height = `${newH}px`;
        cropBox.style.left = `${newL}px`;
        cropBox.style.top = `${newT}px`;
    }
});

window.addEventListener('mouseup', () => {
    cropActionMode = null;
});

// Scroll Zoom da Caixa
cropBox.addEventListener('wheel', (e) => {
    e.preventDefault();
    const vWidth = previewVideo.clientWidth;
    const vHeight = previewVideo.clientHeight;
    const ratio = getTargetRatio();

    const zoomStep = e.deltaY < 0 ? 1.06 : 0.94;
    let newW = Math.round(cropBox.offsetWidth * zoomStep);
    let newH = Math.round(newW / ratio);

    newW = Math.max(40, Math.min(newW, vWidth));
    newH = Math.max(40, Math.min(newH, vHeight));

    let newL = Math.round(cropBox.offsetLeft - (newW - cropBox.offsetWidth) / 2);
    let newT = Math.round(cropBox.offsetTop - (newH - cropBox.offsetHeight) / 2);

    newL = Math.max(0, Math.min(newL, vWidth - newW));
    newT = Math.max(0, Math.min(newT, vHeight - newH));

    cropBox.style.width = `${newW}px`;
    cropBox.style.height = `${newH}px`;
    cropBox.style.left = `${newL}px`;
    cropBox.style.top = `${newT}px`;
});

// ===================================================
// 3. SELEÇÃO DE ARQUIVO
// ===================================================
dropZone.addEventListener('click', () => videoInput.click());

videoInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFile(e.target.files[0]);
    }
});

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('dragover');
    });
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('dragover');
    });
});

dropZone.addEventListener('drop', (e) => {
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        handleFile(files[0]);
    }
});

async function generateFilmstrip(file) {
    if (!iosFilmstrip) return;
    iosFilmstrip.innerHTML = '';

    const tempVideo = document.createElement('video');
    tempVideo.src = URL.createObjectURL(file);
    tempVideo.muted = true;
    tempVideo.preload = 'auto';

    await new Promise(r => { tempVideo.onloadedmetadata = r; });

    const totalDur = tempVideo.duration || 10;
    const numFrames = 10;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 90;
    canvas.height = 48;

    for (let i = 0; i < numFrames; i++) {
        const targetSec = (i / (numFrames - 1 || 1)) * Math.max(0, totalDur - 0.1);
        tempVideo.currentTime = targetSec;

        await new Promise(resolve => {
            const onSeek = () => {
                tempVideo.removeEventListener('seeked', onSeek);
                ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                const img = document.createElement('img');
                img.className = 'filmstrip-frame';
                img.src = canvas.toDataURL('image/jpeg', 0.6);
                iosFilmstrip.appendChild(img);
                resolve();
            };
            tempVideo.addEventListener('seeked', onSeek);
        });
    }

    URL.revokeObjectURL(tempVideo.src);
}

function handleFile(file) {
    if (!file.type.includes('video') && !file.name.endsWith('.mp4')) {
        showError('Please select a valid video file (.mp4).');
        return;
    }

    selectedFile = file;
    fileName.textContent = file.name;

    const videoUrl = URL.createObjectURL(file);
    previewVideo.src = videoUrl;

    previewVideo.onloadedmetadata = () => {
        videoDuration = previewVideo.duration || 10.0;
        trimStart = 0.0;
        trimEnd = Math.min(videoDuration, Math.max(MIN_DURATION, 5.0));

        renderTrimBar();
        generateFilmstrip(file);

        cropStageWrapper.classList.remove('hidden');
        previewVideo.play().catch(() => {});
        updateCropBox();
    };

    dropZone.classList.add('hidden');
    selectedFileBox.classList.remove('hidden');
    btnConvert.removeAttribute('disabled');
    hideError();
}

btnRemove.addEventListener('click', () => {
    resetState();
});

// ===================================================
// 4. ENVIO E CONVERSÃO
// ===================================================
btnConvert.addEventListener('click', async () => {
    if (!selectedFile) return;

    btnConvert.disabled = true;
    loadingBox.classList.remove('hidden');
    resultBox.classList.add('hidden');
    hideError();

    const durationVal = parseFloat((trimEnd - trimStart).toFixed(2));

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('start_time', trimStart);
    formData.append('duration', durationVal);

    if (selectedAspect !== 'original' && !cropBox.classList.contains('hidden')) {
        const vW = previewVideo.clientWidth;
        const vH = previewVideo.clientHeight;

        const cropX = Math.max(0, cropBox.offsetLeft / vW);
        const cropY = Math.max(0, cropBox.offsetTop / vH);
        const cropW = Math.min(1.0, cropBox.offsetWidth / vW);
        const cropH = Math.min(1.0, cropBox.offsetHeight / vH);

        formData.append('crop_x', cropX);
        formData.append('crop_y', cropY);
        formData.append('crop_w', cropW);
        formData.append('crop_h', cropH);
    }

    try {
        const response = await fetch('/convert', {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok && data.sucesso) {
            gifPreview.src = data.gif_url;
            btnDownload.href = data.gif_url;
            btnDownload.setAttribute('download', `clip_${selectedAspect}_${trimStart}s.gif`);

            resultBox.classList.remove('hidden');
        } else {
            showError(data.erro || 'Failed to convert video to GIF.');
            btnConvert.disabled = false;
        }
    } catch (err) {
        showError('Network error or server is not running. Please check python app.py.');
        btnConvert.disabled = false;
    } finally {
        loadingBox.classList.add('hidden');
    }
});

btnNew.addEventListener('click', () => {
    resetState();
});

function resetState() {
    selectedFile = null;
    videoInput.value = '';
    previewVideo.src = '';
    if (iosFilmstrip) iosFilmstrip.innerHTML = '';

    trimStart = 0.0;
    trimEnd = 5.0;
    videoDuration = 10.0;
    renderTrimBar();

    selectedAspect = 'original';
    aspectPills.forEach(p => p.classList.toggle('active', p.getAttribute('data-aspect') === 'original'));
    aspectBadge.textContent = 'Original';

    cropBox.classList.add('hidden');
    cropStageWrapper.classList.add('hidden');
    dropZone.classList.remove('hidden');
    selectedFileBox.classList.add('hidden');
    resultBox.classList.add('hidden');
    btnConvert.setAttribute('disabled', 'true');
    hideError();
}

function showError(msg) {
    errorMessage.textContent = msg;
    errorBox.classList.remove('hidden');
}

function hideError() {
    errorBox.classList.add('hidden');
}
