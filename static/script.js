const dropZone = document.getElementById('drop-zone');
const videoInput = document.getElementById('video-input');
const selectedFileBox = document.getElementById('selected-file-box');
const fileName = document.getElementById('file-name');
const btnRemove = document.getElementById('btn-remove');

const durationSlider = document.getElementById('duration-slider');
const durationBadge = document.getElementById('duration-badge');

const btnConvert = document.getElementById('btn-convert');
const loadingBox = document.getElementById('loading-box');
const errorBox = document.getElementById('error-box');
const errorMessage = document.getElementById('error-message');

const resultBox = document.getElementById('result-box');
const gifPreview = document.getElementById('gif-preview');
const btnDownload = document.getElementById('btn-download');
const btnNew = document.getElementById('btn-new');

let selectedFile = null;

durationSlider.addEventListener('input', (e) => {
    durationBadge.textContent = `${parseFloat(e.target.value).toFixed(1)}s`;
});

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

function handleFile(file) {
    if (!file.type.includes('video') && !file.name.endsWith('.mp4')) {
        showError('Please select a valid video file (.mp4).');
        return;
    }
    selectedFile = file;
    fileName.textContent = file.name;
    dropZone.classList.add('hidden');
    selectedFileBox.classList.remove('hidden');
    btnConvert.removeAttribute('disabled');
    hideError();
}
btnRemove.addEventListener('click', () => {
    resetState();
});

btnConvert.addEventListener('click', async () => {
    if (!selectedFile) return;

    btnConvert.disabled = true;
    loadingBox.classList.remove('hidden');
    resultBox.classList.add('hidden');
    hideError();

    const formData = new FormData();
    formData.append('video', selectedFile);
    formData.append('duration', durationSlider.value);

    try {
        const response = await fetch('/convert', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (response.ok && data.sucesso) {
            // Sucesso! Exibe o GIF gerado
            gifPreview.src = data.gif_url;
            btnDownload.href = data.gif_url;
            btnDownload.setAttribute('download', `converted_${durationSlider.value}s.gif`);
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