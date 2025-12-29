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
        
        // ডিবাগ: চেক করুন DOM এলিমেন্ট আসে কিনা
        console.log('Initializing HMQC Encoder...');
        
        // অপেক্ষা করুন DOM পুরোপুরি লোড হতে
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initEventListeners());
        } else {
            this.initEventListeners();
        }
    }

    initEventListeners() {
        console.log('Setting up event listeners...');
        
        const dropZone = document.getElementById('dropZone');
        const fileInput = document.getElementById('fileInput');
        const encodeBtn = document.getElementById('encodeBtn');
        const matrixSizeInput = document.getElementById('matrixSize');

        if (!dropZone || !fileInput) {
            console.error('CRITICAL: Drop zone or file input not found!');
            alert('Error: Page elements not loaded. Please refresh.');
            return;
        }

        console.log('Elements found:', { dropZone, fileInput, encodeBtn });

        // Drag & Drop ইভেন্ট
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            }, false);
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
            console.log('Drag over detected');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
            console.log('Drag leave detected');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            console.log('Drop event:', e.dataTransfer.files);
            this.handleFiles(e.dataTransfer.files);
        });

        // ক্লিক ইভেন্ট - সরাসরি file input ট্রিগার করুন
        dropZone.addEventListener('click', (e) => {
            e.preventDefault();
            console.log('Drop zone clicked, triggering file input...');
            fileInput.click();
        });

        // ফাইল ইনপুট চেঞ্জ ইভেন্ট
        fileInput.addEventListener('change', (e) => {
            console.log('File input changed:', e.target.files);
            this.handleFiles(e.target.files);
        });

        // এনকোড বাটন
        if (encodeBtn) {
            encodeBtn.addEventListener('click', () => {
                console.log('Encode button clicked');
                this.startEncoding();
            });
        }

        // ম্যাট্রিক্স সাইজ স্লাইডার
        if (matrixSizeInput) {
            matrixSizeInput.addEventListener('input', (e) => {
                document.getElementById('matrixSizeValue').textContent = e.target.value;
            });
        }

        console.log('All event listeners attached successfully!');
    }

    handleFiles(files) {
        if (!files || files.length === 0) {
            console.warn('No files provided to handleFiles');
            return;
        }
        
        console.log('Handling files:', files);
        
        this.selectedFile = files[0];
        const dropZone = document.getElementById('dropZone');
        const fileInfo = document.getElementById('fileInfo');
        
        // ইউআই আপডেট
        dropZone.querySelector('.drop-icon').textContent = '📄';
        dropZone.querySelector('.drop-text').textContent = this.selectedFile.name;
        dropZone.querySelector('.drop-hint').textContent = 
            `Size: ${this.formatBytes(this.selectedFile.size)} | Type: ${this.selectedFile.type || 'Unknown'}`;
        
        // ফাইল ইনফো দেখান
        if (fileInfo) {
            fileInfo.style.display = 'block';
            fileInfo.className = 'status success';
            fileInfo.textContent = `✓ File loaded: ${this.selectedFile.name}`;
        }
        
        // ডাটা টাইপ ডিটেক্ট করুন
        this.detectDataType(this.selectedFile);
        
        console.log('File processed successfully:', this.selectedFile);
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
        
        console.log(`Detected data type: ${this.dataType} (extension: ${extension}, mime: ${mime})`);
    }

    async startEncoding() {
        if (!this.selectedFile) {
            this.showStatus('Please select a file first!', 'warning');
            return;
        }

        if (this.isProcessing) {
            this.showStatus('Already processing...', 'warning');
            return;
        }

        this.isProcessing = true;
        const encodeBtn = document.getElementById('encodeBtn');
        encodeBtn.disabled = true;
        encodeBtn.textContent = 'Processing...';

        try {
            console.log('Starting encoding process...');
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
        
        // Step 1: ফাইল রিড করুন
        console.log('Step 1: Reading file...');
        const fileData = await this.readFile(this.selectedFile);
        this.showProgress(10);
        
        // Step 2: কম্প্রেস করুন
        console.log('Step 2: Compressing data...');
        const compressed = this.compressor.compress(fileData, this.dataType);
        console.log(`Compressed ${fileData.length} → ${compressed.length} bytes`);
        this.showProgress(40);
        
        // Step 3: মেটাডাটা যোগ করুন
        const metadata = this.core.generateMetadata(
            this.dataType,
            fileData.length,
            compressed.length
        );
        const dataWithMeta = this.concatenateArrays(metadata, compressed);
        
        // Step 4: ECC এপ্লাই করুন
        console.log('Step 3: Applying ECC...');
        const encoded = this.ecc.encode(dataWithMeta);
        this.showProgress(70);
        
        // Step 5: ম্যাট্রিক্স তৈরি করুন
        console.log('Step 4: Generating matrix...');
        const matrixSize = parseInt(document.getElementById('matrixSize').value);
        const modules = this.core.bytesToColorModules(encoded, matrixSize, matrixSize);
        
        // Step 6: ক্যানভাসে রেন্ডার করুন
        const canvas = document.getElementById('codeCanvas');
        this.core.renderToCanvas(canvas, modules, matrixSize);
        
        this.showProgress(100);
        
        // Step 7: প্রিভিউ এবং স্ট্যাটস দেখান
        this.showPreview();
        this.updateStats(fileData.length, compressed.length, encoded.length, matrixSize);
        
        this.showStatus('✓ Encoding successful! Download your HMQC code.', 'success');
        console.log('Encoding completed successfully!');
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                console.log('File read complete');
                const result = e.target.result;
                if (typeof result === 'string') {
                    const encoder = new TextEncoder();
                    resolve(encoder.encode(result));
                } else {
                    resolve(new Uint8Array(result));
                }
            };
            
            reader.onerror = () => {
                console.error('File read error:', reader.error);
                reject(reader.error);
            };
            
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
        
        if (container) container.style.display = 'block';
        if (fill) {
            fill.style.width = `${percent}%`;
            fill.textContent = `${percent}%`;
        }
    }

    showPreview() {
        document.querySelector('.preview-area').style.display = 'block';
        
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
        if (!status) return;
        
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

// পেজ লোড হলে অটো ইনিশিয়ালাইজ
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing encoder...');
    window.encoder = new HMQCEncoder();
});
            
