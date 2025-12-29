/**
 * HMQC Decoder - Advanced Scanning & Decoding Engine
 * Handles drag & drop scanning, marker detection, and data reconstruction
 */

class HMQCDecoder {
    constructor() {
        this.core = new HMQCCore();
        this.compressor = new HMQCCompressor();
        this.ecc = new HMQCECC();
        this.isProcessing = false;
        
        this.initEventListeners();
    }

    initEventListeners() {
        const dropZone = document.getElementById('dropScanZone');
        const fileInput = document.getElementById('scanFileInput');
        const decodeBtn = document.getElementById('decodeBtn');

        // Drag & Drop for scanning
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
            this.handleScanFiles(e.dataTransfer.files);
        });

        dropZone.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            this.handleScanFiles(e.target.files);
        });

        // Decode button
        decodeBtn.addEventListener('click', () => {
            this.startDecoding();
        });
    }

    handleScanFiles(files) {
        if (files.length === 0) return;
        
        this.scannedFile = files[0];
        const dropZone = document.getElementById('dropScanZone');
        const fileInfo = document.getElementById('scanFileInfo');
        
        // Validate file type
        if (!this.scannedFile.type.startsWith('image/')) {
            this.showStatus('Please drop an image file!', 'error');
            return;
        }
        
        // Update UI
        dropZone.querySelector('.drop-icon').textContent = '📸';
        dropZone.querySelector('.drop-text').textContent = this.scannedFile.name;
        dropZone.querySelector('.drop-hint').textContent = 
            `Size: ${this.formatBytes(this.scannedFile.size)} | Ready to scan`;
        
        fileInfo.style.display = 'block';
        fileInfo.className = 'status success';
        fileInfo.textContent = `✓ HMQC image loaded: ${this.scannedFile.name}`;
        
        // Show preview
        this.showScanPreview();
    }

    showScanPreview() {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const preview = document.getElementById('scanPreview');
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Scale preview
                const maxWidth = 400;
                const scale = Math.min(1, maxWidth / img.width);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                preview.innerHTML = '';
                preview.appendChild(canvas);
                document.querySelector('.scan-preview-area').style.display = 'block';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(this.scannedFile);
    }

    async startDecoding() {
        if (!this.scannedFile || this.isProcessing) {
            this.showStatus('Please drop an HMQC code image first!', 'warning');
            return;
        }

        this.isProcessing = true;
        const decodeBtn = document.getElementById('decodeBtn');
        decodeBtn.disabled = true;
        decodeBtn.textContent = 'Scanning & Decoding...';

        try {
            await this.decodeFile();
        } catch (error) {
            console.error('Decoding error:', error);
            this.showStatus(`Decoding failed: ${error.message}`, 'error');
        } finally {
            this.isProcessing = false;
            decodeBtn.disabled = false;
            decodeBtn.textContent = 'Scan & Decode HMQC';
        }
    }

    async decodeFile() {
        this.showProgress(0);
        
        // Step 1: Load image and extract pixel data
        const imageData = await this.loadImageData(this.scannedFile);
        this.showProgress(30);
        
        // Step 2: Detect markers and extract matrix
        const markers = this.core.detectMarkers(imageData, imageData.width, imageData.height);
        if (markers.length < 4) {
            throw new Error('Could not detect all 4 alignment markers. Please use a clear, high-quality image.');
        }
        
        const modules = this.extractModules(imageData, markers);
        this.showProgress(60);
        
        // Step 3: Convert modules to bytes
        const byteData = this.core.colorModulesToBytes(modules);
        
        // Step 4: ECC decoding
        const decoded = this.ecc.decode(byteData);
        if (decoded.uncorrectable) {
            throw new Error('Too many errors in the code. Try a better quality scan.');
        }
        
        this.showProgress(80);
        
        // Step 5: Parse metadata and decompress
        const metadata = this.core.parseMetadata(decoded.data.slice(0, 32));
        const payload = decoded.data.slice(32);
        const decompressed = this.compressor.decompress(payload, metadata.dataType);
        
        this.showProgress(100);
        
        // Step 6: Display results
        this.showDecodedContent(decompressed, metadata);
        this.showDecodingStats(metadata, decoded, byteData.length);
        
        this.showStatus(`✓ Decoding successful! Recovered ${decoded.correctedErrors} errors.`, 'success');
    }

    async loadImageData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    resolve(imageData);
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    extractModules(imageData, markers) {
        const { width, height, data } = imageData;
        const modules = [];
        
        // Calculate module size from markers
        const expectedMarkerSize = 20 * this.core.moduleSize;
        const actualMarkerSize = Math.abs(markers[1].x - markers[0].x);
        const scale = actualMarkerSize / expectedMarkerSize;
        const modulePx = this.core.moduleSize * scale;
        
        // Extract grid
        const gridSize = Math.floor(Math.min(width, height) / modulePx);
        
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const px = Math.floor(x * modulePx);
                const py = Math.floor(y * modulePx);
                const idx = (py * width + px) * 4;
                
                modules.push({
                    r: data[idx],
                    g: data[idx + 1],
                    b: data[idx + 2],
                    a: data[idx + 3]
                });
            }
        }
        
        return modules;
    }

    showDecodedContent(data, metadata) {
        const contentArea = document.getElementById('decodedContent');
        const downloadBtn = document.getElementById('downloadDecodedBtn');
        
        // Clear previous
        contentArea.innerHTML = '';
        
        if (metadata.dataType === 'text') {
            const decoder = new TextDecoder();
            const text = decoder.decode(data);
            
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.readOnly = true;
            textarea.style.cssText = `
                width: 100%;
                height: 300px;
                background: #0a0a0a;
                color: #00ff88;
                border: 2px solid #00ff88;
                border-radius: 8px;
                padding: 15px;
                font-family: 'Courier New', monospace;
                resize: vertical;
            `;
            
            contentArea.appendChild(textarea);
            
            // Download as text file
            downloadBtn.onclick = () => this.downloadFile(text, 'decoded.txt', 'text/plain');
            
        } else {
            // Binary data
            const blob = new Blob([data]);
            const url = URL.createObjectURL(blob);
            
            if (metadata.dataType === 'image') {
                const img = document.createElement('img');
                img.src = url;
                img.style.maxWidth = '100%';
                img.style.borderRadius = '10px';
                img.style.border = '3px solid #00ff88';
                contentArea.appendChild(img);
            } else if (metadata.dataType === 'audio') {
                const audio = document.createElement('audio');
                audio.controls = true;
                audio.src = url;
                audio.style.width = '100%';
                contentArea.appendChild(audio);
            } else {
                // Show binary info
                const info = document.createElement('div');
                info.innerHTML = `
                    <p><strong>Binary Data</strong></p>
                    <p>Size: ${this.formatBytes(data.length)}</p>
                    <p>First 32 bytes: ${Array.from(data.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ')}</p>
                `;
                contentArea.appendChild(info);
            }
            
            // Auto download
            downloadBtn.onclick = () => {
                const a = document.createElement('a');
                a.href = url;
                a.download = `decoded-${metadata.dataType}-${Date.now()}.bin`;
                a.click();
            };
        }
        
        document.querySelector('.decoded-content-area').style.display = 'block';
    }

    showDecodingStats(metadata, decoded, scannedSize) {
        const stats = {
            type: metadata.dataType,
            original: this.formatBytes(metadata.originalSize),
            compressed: this.formatBytes(metadata.compressedSize),
            errors: decoded.correctedErrors,
            scanned: this.formatBytes(scannedSize),
            timestamp: metadata.timestamp.toLocaleString()
        };
        
        document.getElementById('statDecodedType').textContent = stats.type;
        document.getElementById('statOriginalSize').textContent = stats.original;
        document.getElementById('statCompressedSize').textContent = stats.compressed;
        document.getElementById('statErrorsCorrected').textContent = stats.errors;
        document.getElementById('statScannedSize').textContent = stats.scanned;
        document.getElementById('statTimestamp').textContent = stats.timestamp;
        
        document.querySelector('.decoding-stats').style.display = 'grid';
    }

    showProgress(percent) {
        const container = document.querySelector('.progress-container');
        const fill = document.getElementById('progressFill');
        
        container.style.display = 'block';
        fill.style.width = `${percent}%`;
        fill.textContent = `${percent}%`;
    }

    showStatus(message, type) {
        const status = document.getElementById('status');
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';
        
        setTimeout(() => {
            status.style.display = 'none';
        }, 8000);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.decoder = new HMQCDecoder();
});
  
