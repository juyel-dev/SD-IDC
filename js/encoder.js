/**
 * HMQC Encoder - Main Encoding Engine
 * Handles file input, compression, ECC, and matrix generation
 */

class HMQCEncoder {
    constructor() {
        this.core = new HMQCCore();
        this.compressor = new HMQCCompressor();
        this.ecc = new HMQCECC();
        this.isProcessing = false;
        
        this.initEventListeners();
    }

    initEventListeners() {
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const encodeBtn = document.getElementById('encodeBtn');
        const matrixSizeInput = document.getElementById('matrixSize');

        // Drag & Drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            this.handleFiles(e.dataTransfer.files);
        });

        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            this.handleFiles(e.target.files);
        });

        // Encode button
        encodeBtn.addEventListener('click', () => {
            this.startEncoding();
        });

        // Matrix size slider
        matrixSizeInput.addEventListener('input', (e) => {
            document.getElementById('matrixSizeValue').textContent = e.target.value;
        });
    }

    handleFiles(files) {
        if (files.length === 0) return;
        
        this.selectedFile = files[0];
        const dropZone = document.getElementById('dropZone');
        const fileInfo = document.getElementById('fileInfo');
        
        // Update UI
        dropZone.querySelector('.drop-icon').textContent = '📄';
        dropZone.querySelector('.drop-text').textContent = this.selectedFile.name;
        dropZone.querySelector('.drop-hint').textContent = 
            `Size: ${this.formatBytes(this.selectedFile.size)} | Type: ${this.selectedFile.type || 'Unknown'}`;
        
        // Show file info
        fileInfo.style.display = 'block';
        fileInfo.className = 'status success';
        fileInfo.textContent = `✓ File loaded: ${this.selectedFile.name}`;
        
        // Detect data type
        this.detectDataType(this.selectedFile);
    }

    detectDataType(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        const mime = file.type;
        
        if (mime.startsWith('text/') || 
            ['txt', 'md', 'json', 'xml', 'csv', 'html', 'js', 'css'].includes(extension)) {
            this.dataType = 'text';
        } else if (mime.startsWith('image/')) {
            this.dataType = 'image';
        } else if (mime.startsWith('audio/')) {
            this.dataType = 'audio';
        } else {
            this.dataType = 'binary';
        }
        
        console.log(`Detected data type: ${this.dataType}`);
    }

    async startEncoding() {
        if (!this.selectedFile || this.isProcessing) {
            this.showStatus('Please select a file first!', 'warning');
            return;
        }

        this.isProcessing = true;
        const encodeBtn = document.getElementById('encodeBtn');
        encodeBtn.disabled = true;
        encodeBtn.textContent = 'Encoding...';

        try {
            await this.encodeFile();
        } catch (error) {
            console.error('Encoding error:', error);
            this.showStatus(`Error: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
            encodeBtn.disabled = false;
            encodeBtn.textContent = 'Generate HMQC Code';
        }
    }

    async encodeFile() {
        this.showProgress(0);
        
        // Step 1: Read file
        const fileData = await this.readFile(this.selectedFile);
        this.showProgress(10);
        
        // Step 2: Compress
        const compressed = this.compressor.compress(fileData, this.dataType);
        this.showProgress(40);
        
        // Step 3: Add metadata
        const metadata = this.core.generateMetadata(
            this.dataType,
            fileData.length,
            compressed.length
        );
        const dataWithMeta = this.concatenateArrays(metadata, compressed);
        
        // Step 4: Apply ECC
        const encoded = this.ecc.encode(dataWithMeta);
        this.showProgress(70);
        
        // Step 5: Generate matrix
        const matrixSize = parseInt(document.getElementById('matrixSize').value);
        const modules = this.core.bytesToColorModules(encoded, matrixSize, matrixSize);
        
        // Step 6: Render to canvas
        const canvas = document.getElementById('codeCanvas');
        this.core.renderToCanvas(canvas, modules, matrixSize);
        
        this.showProgress(100);
        
        // Step 7: Show preview and stats
        this.showPreview();
        this.updateStats(fileData.length, compressed.length, encoded.length, matrixSize);
        
        this.showStatus('✓ Encoding successful! Download your HMQC code.', 'success');
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const result = e.target.result;
                if (typeof result === 'string') {
                    const encoder = new TextEncoder();
                    resolve(encoder.encode(result));
                } else {
                    resolve(new Uint8Array(result));
                }
            };
            
            reader.onerror = () => reject(reader.error);
            
            if (this.dataType === 'text') {
                reader.readAsText(file);
            } else {
                reader.readAsArrayBuffer(file);
            }
        });
    }

    showProgress(percent) {
        const container = document.querySelector('.progress-container');
        const fill = document.getElementById('progressFill');
        
        container.style.display = 'block';
        fill.style.width = `${percent}%`;
        fill.textContent = `${percent}%`;
    }

    showPreview() {
        document.querySelector('.preview-area').style.display = 'block';
        
        // Add download button
        const canvas = document.getElementById('codeCanvas');
        const downloadBtn = document.createElement('a');
        downloadBtn.href = canvas.toDataURL('image/png');
        downloadBtn.download = `HMQC-${Date.now()}.png`;
        downloadBtn.className = 'btn';
        downloadBtn.textContent = '💾 Download HMQC Code';
        downloadBtn.style.marginTop = '20px';
        
        const existingBtn = document.getElementById('downloadBtn');
        if (existingBtn) existingBtn.remove();
        
        downloadBtn.id = 'downloadBtn';
        document.querySelector('.preview-area').appendChild(downloadBtn);
    }

    updateStats(original, compressed, encoded, matrixSize) {
        const stats = {
            original: this.formatBytes(original),
            compressed: this.formatBytes(compressed),
            ratio: ((1 - compressed / original) * 100).toFixed(1),
            ecc: this.formatBytes(encoded - compressed),
            matrix: `${matrixSize}×${matrixSize}`,
            modules: (matrixSize * matrixSize).toLocaleString()
        };
        
        document.getElementById('statOriginal').textContent = stats.original;
        document.getElementById('statCompressed').textContent = stats.compressed;
        document.getElementById('statRatio').textContent = `${stats.ratio}%`;
        document.getElementById('statECC').textContent = stats.ecc;
        document.getElementById('statMatrix').textContent = stats.matrix;
        document.getElementById('statModules').textContent = stats.modules;
        
        document.querySelector('.stats').style.display = 'grid';
    }

    showStatus(message, type) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';
        
        setTimeout(() => {
            status.style.display = 'none';
        }, 5000);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }

    concatenateArrays(...arrays) {
        const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
        const result = new Uint8Array(totalLength);
        
        let offset = 0;
        arrays.forEach(arr => {
            result.set(arr, offset);
            offset += arr.length;
        });
        
        return result;
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    window.encoder = new HMQCEncoder();
});
              
