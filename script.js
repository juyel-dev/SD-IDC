// script.js - Main application controller
document.addEventListener('DOMContentLoaded', function() {
    const encoder = new SDIDCEncoder();
    const decoder = new SDIDCDecoder();
    
    // DOM Elements
    const encodeBtn = document.getElementById('encodeBtn');
    const imageInput = document.getElementById('imageInput');
    const codeInput = document.getElementById('codeInput');
    
    // 1. ENCODING WORKFLOW
    encodeBtn.addEventListener('click', async () => {
        const file = imageInput.files[0];
        if (!file) return alert('Please select an image first');
        
        const img = new Image();
        img.src = URL.createObjectURL(file);
        
        img.onload = async () => {
            // Process image with selected settings
            const bitDepth = parseInt(document.getElementById('bitDepth').value);
            const targetSize = parseInt(document.getElementById('targetSize').value);
            
            encoder.bitDepth = bitDepth;
            const processed = await encoder.processImage(img, targetSize);
            
            // Create header with metadata
            const header = encoder.createHeader({
                width: processed.width,
                height: processed.height,
                blockSize: encoder.blockSize,
                bitDepth: encoder.bitDepth
            });
            
            // Encode to grid and render
            const gridOutput = encoder.encodeToGrid(processed, header);
            const codeCanvas = encoder.renderGridToCanvas(gridOutput);
            
            // Display results
            document.getElementById('codeCanvas').replaceWith(codeCanvas);
            codeCanvas.id = 'codeCanvas';
            
            // Enable download
            document.getElementById('downloadBtn').onclick = () => {
                const link = document.createElement('a');
                link.download = 'sd-idc-code.png';
                link.href = codeCanvas.toDataURL('image/png');
                link.click();
            };
        };
    });
    
    // 2. DECODING WORKFLOW
    codeInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const img = new Image();
        img.src = URL.createObjectURL(file);
        
        img.onload = async () => {
            // Display loaded code
            const displayCanvas = document.getElementById('loadedCodeCanvas');
            const ctx = displayCanvas.getContext('2d');
            displayCanvas.width = img.width;
            displayCanvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            // Decode
            const binaryGrid = await decoder.loadCodeImage(img);
            const headerInfo = decoder.extractHeader(binaryGrid);
            
            // Update progress in real-time
            const progressInterval = setInterval(() => {
                const progress = decoder.decodingProgress;
                document.getElementById('decodeProgress').style.width = `${progress}%`;
                document.getElementById('progressText').textContent = `${progress}%`;
                
                if (progress >= 100) clearInterval(progressInterval);
            }, 50);
            
            // Reconstruct and display image
            const reconstructedCanvas = decoder.reconstructImage(binaryGrid, headerInfo);
            document.getElementById('reconstructedCanvas').replaceWith(reconstructedCanvas);
            reconstructedCanvas.id = 'reconstructedCanvas';
        };
    });
    
    // 3. DRAG & DROP SUPPORT
    ['#dropArea', '#dropAreaCode'].forEach(selector => {
        const dropArea = document.querySelector(selector);
        
        dropArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropArea.classList.add('dragover');
        });
        
        dropArea.addEventListener('drop', (e) => {
            e.preventDefault();
            dropArea.classList.remove('dragover');
            
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                const input = dropArea.querySelector('input[type="file"]');
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                input.files = dataTransfer.files;
                input.dispatchEvent(new Event('change'));
            }
        });
    });
});
