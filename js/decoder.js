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
        
        console.log('Initializing HMQC Decoder...');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initEventListeners());
        } else {
            this.initEventListeners();
        }
    }

    initEventListeners() {
        console.log('Setting up decoder event listeners...');
        
        const dropZone = document.getElementById('dropScanZone');
        const fileInput = document.getElementById('scanFileInput');
        const decodeBtn = document.getElementById('decodeBtn');

        if (!dropZone || !fileInput) {
            console.error('CRITICAL: Drop zone or file input not found in decoder!');
            return;
        }

        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

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
            console.log('Drop event on decoder:', e.dataTransfer.files);
            this.handleScanFiles(e.dataTransfer.files);
        });

        dropZone.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Drop zone clicked, opening file picker...');
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            console.log('File input changed:', e.target.files);
            this.handleScanFiles(e.target.files);
        });

        if (decodeBtn) {
            decodeBtn.addEventListener('click', () => {
                console.log('Decode button clicked');
                this.startDecoding();
            });
        }

        console.log('Decoder event listeners attached successfully!');
    }

    handleScanFiles(files) {
        if (!files || files.length === 0) {
            console.warn('No files provided to handleScanFiles');
            return;
        }
        
        this.scannedFile = files[0];
        const dropZone = document.getElementById('dropScanZone');
        const fileInfo = document.getElementById('scanFileInfo');
        
        // Validate file type
        if (!this.scannedFile.type.startsWith('image/')) {
            console.error('Invalid file type:', this.scannedFile.type);
            this.showStatus('Please drop an image file!', 'error');
            return;
        }
        
        // Update UI
        dropZone.querySelector('.drop-icon').textContent = '📸';
        dropZone.querySelector('.drop-text').textContent = this.scannedFile.name;
        dropZone.querySelector('.drop-hint').textContent = 
            `Size: ${this.formatBytes(this.scannedFile.size)} | Ready to scan`;
        
        if (fileInfo) {
            fileInfo.style.display = 'block';
            fileInfo.className = 'status success';
            fileInfo.textContent = `✓ HMQC image loaded: ${this.scannedFile.name}`;
        }
        
        console.log('Image file processed:', this.scannedFile);
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
                console.log('Preview generated');
            };
            img.onerror = () => {
                console.error('Failed to load image for preview');
                this.showStatus('Failed to load image. Please try again.', 'error');
            };
            img.src = e.target.result;
        };
        reader.onerror = () => {
            console.error('FileReader error');
        };
        reader.readAsDataURL(this.scannedFile);
    }

    async startDecoding() {
        if (!this.scannedFile) {
            this.showStatus('Please drop an HMQC code image first!', 'warning');
            return;
        }

        if (this.isProcessing) {
            this.showStatus('Already scanning...', 'warning');
            return;
        }

        this.isProcessing = true;
        const decodeBtn = document.getElementById('decodeBtn');
        decodeBtn.disabled = true;
        decodeBtn.textContent = 'Scanning & Decoding...';

        try {
            console.log('Starting decoding process...');
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
        
        console.log('Step 1: Loading image data...');
        const imageData = await this.loadImageData(this.scannedFile);
        this.showProgress(30);
        
        console.log('Step 2: Detecting markers...');
        const markers = this.core.detectMarkers(imageData, imageData.width, imageData.height);
        console.log(`Found ${markers.length} markers`);
        
        if (markers.length < 4) {
            throw new Error('Could not detect all 4 alignment markers. Please use a clear, high-quality image without glare or distortion.');
        }
        
        console.log('Step 3: Extracting modules...');
        const modules = this.extractModules(imageData, markers);
        this.showProgress(60);
        
        console.log('Step 4: Converting to bytes...');
        const byteData = this.core.colorModulesToBytes(modules);
        
        console.log('Step 5: ECC decoding...');
        const decoded = this.ecc.decode(byteData);
        
        if (decoded.uncorrectable) {
            throw new Error(`Too many errors (${decoded.errors}) in the code. Try a better quality scan or use the original digital file.`);
        }
        
        this.showProgress(80);
        
        console.log('Step 6: Parsing metadata...');
        const metadata = this.core.parseMetadata(decoded.data.slice(0, 32));
        const payload = decoded.data.slice(32);
        
        console.log('Step 7: Decompressing...');
        const decompressed = this.compressor.decompress(payload, metadata.dataType);
        
        this.showProgress(100);
        
        console.log('Step 8: Displaying results...');
        this.showDecodedContent(decompressed, metadata);
        this.showDecodingStats(metadata, decoded, byteData.length);
        
        this.showStatus(`✓ Decoding successful! Recovered ${decoded.correctedErrors} errors.`, 'success');
        console.log('Decoding completed successfully!');
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
                    console.log('Image loaded:', `${imageData.width}x${imageData.height}`);
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
        const modulePx = Math.max(1, this.core.moduleSize * scale);
        
        // Extract grid
        const gridSize = Math.floor(Math.min(width, height) / modulePx);
        console.log(`Extracting ${gridSize}x${gridSize} modules`);
        
        for (let y = 0; y < gridSize; y++) {
            for (let x = 0; x < gridSize; x++) {
                const px = Math.floor(x * modulePx);
                const py = Math.floor(y * modulePx);
                const idx = (py * width + px) * 4;
                
                if (idx < data.length - 3) {
                    modules.push({
                        r: data[idx],
                        g: data[idx + 1],
                        b: data[idx + 2],
                        a: data[idx + 3]
                    });
                }
            }
        }
        
        console.log(`Extracted ${modules.length} modules`);
        return modules;
    }

    showDecodedContent(data, metadata) {
        const contentArea = document.getElementById('decodedContent');
        const downloadBtn = document.getElementById('downloadDecodedBtn');
        
        if (!contentArea) return;
        
        contentArea.innerHTML = '';
        downloadBtn.style.display = 'inline-block';

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
            downloadBtn.onclick = () => this.downloadFile(text, 'decoded.txt', 'text/plain');
            
        } else {
            const blob = new Blob([data]);
            const url = URL.createObjectURL(blob);
            
            if (metadata.dataType === 'image') {
                const img = document.createElement('img');
                img.src = url;
                img.style.maxWidth = '100%';
                img.style.borderRadius = '10px';
                img.style.border = '3px solid #00ff88';
                img.onload = () => console.log('Decoded image displayed');
                contentArea.appendChild(img);
            } else if (metadata.dataType === 'audio') {
                const audio = document.createElement('audio');
                audio.controls = true;
                audio.src = url;
                audio.style.width = '100%';
                contentArea.appendChild(audio);
            } else {
                const info = document.createElement('div');
                info.innerHTML = `
                    <p><strong>✓ Binary Data Recovered</strong></p>
                    <p>Size: ${this.formatBytes(data.length)}</p>
                    <p>Type: ${metadata.dataType}</p>
                    <p>Click download to save the file.</p>
                `;
                contentArea.appendChild(info);
            }
            
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
        
        if (container) container.style.display = 'block';
        if (fill) {
            fill.style.width = `${percent}%`;
            fill.textContent = `${percent}%`;
        }
    }

    showStatus(message, type) {
        const status = document.getElementById('status');
        if (!status) return;
        
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

// পেজ লোড হলে অটো ইনিশিয়ালাইজ
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing decoder...');
    window.decoder = new HMQCDecoder();
});
