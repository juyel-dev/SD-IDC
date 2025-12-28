// encoder.js - Core SD-IDC Encoding Logic
class SDIDCEncoder {
    constructor(config = {}) {
        this.blockSize = config.blockSize || 4; // Pixels per data block
        this.bitDepth = config.bitDepth || 1;   // 1, 2, or 4 bits per block
        this.version = 1;
    }

    // 1. RESIZE & QUANTIZE
    async processImage(imageData, targetWidth = 256) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Calculate proportional height
        const scale = targetWidth / imageData.width;
        const targetHeight = Math.floor(imageData.height * scale);
        
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        
        // Draw and resample
        ctx.drawImage(imageData, 0, 0, targetWidth, targetHeight);
        let processedData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        
        // Quantize color based on bit depth
        return this.quantizeImageData(processedData, this.bitDepth);
    }

    // 2. CREATE SELF-DESCRIBING HEADER
    createHeader(params) {
        // HEADER STRUCTURE (binary string):
        // [VERSION:4bits][WIDTH:12bits][HEIGHT:12bits][BLOCK:4bits][DEPTH:4bits]
        // Total: 36 bits = 9 blocks (at 4-bit depth)
        const { width, height, blockSize, bitDepth } = params;
        
        const versionBin = this.version.toString(2).padStart(4, '0');
        const widthBin = width.toString(2).padStart(12, '0');
        const heightBin = height.toString(2).padStart(12, '0');
        const blockBin = blockSize.toString(2).padStart(4, '0');
        const depthBin = bitDepth.toString(2).padStart(4, '0');
        
        const headerBinary = versionBin + widthBin + heightBin + blockBin + depthBin;
        
        // Add simple parity check for critical params
        const checksum = this.calculateSimpleChecksum(widthBin + heightBin);
        return headerBinary + checksum;
    }

    // 3. BUILD VISUAL CODE GRID
    encodeToGrid(quantizedData, headerBinary) {
        const grid = [];
        const totalBlocks = quantizedData.data.length / 4; // RGBA -> pixels
        
        // Convert pixels to binary stream based on bit depth
        let binaryStream = headerBinary;
        
        for (let i = 0; i < totalBlocks; i += this.blockSize) {
            const blockValue = this.calculateBlockValue(quantizedData, i);
            const blockBinary = this.valueToBinary(blockValue, this.bitDepth);
            binaryStream += blockBinary;
        }
        
        // Calculate grid dimensions (square for simplicity)
        const gridSide = Math.ceil(Math.sqrt(binaryStream.length));
        
        // Fill grid with visual blocks
        for (let i = 0; i < binaryStream.length; i++) {
            const bit = binaryStream[i];
            // Map '1' to black block, '0' to white block
            grid.push(bit === '1' ? 0 : 255); // Single channel value
        }
        
        return {
            gridData: grid,
            gridSize: gridSide,
            binaryStream: binaryStream
        };
    }

    // 4. RENDER TO CANVAS
    renderGridToCanvas(gridOutput) {
        const canvas = document.createElement('canvas');
        const blockPixelSize = 2; // Each block = 2x2 screen pixels for visibility
        canvas.width = gridOutput.gridSize * blockPixelSize;
        canvas.height = gridOutput.gridSize * blockPixelSize;
        
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(canvas.width, canvas.height);
        
        // Render each block
        for (let i = 0; i < gridOutput.gridData.length; i++) {
            const value = gridOutput.gridData[i];
            const x = (i % gridOutput.gridSize) * blockPixelSize;
            const y = Math.floor(i / gridOutput.gridSize) * blockPixelSize;
            
            // Fill block pixels
            for (let px = 0; px < blockPixelSize; px++) {
                for (let py = 0; py < blockPixelSize; py++) {
                    const idx = ((y + py) * canvas.width + (x + px)) * 4;
                    imageData.data[idx] = value;     // R
                    imageData.data[idx + 1] = value; // G
                    imageData.data[idx + 2] = value; // B
                    imageData.data[idx + 3] = 255;   // A
                }
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }
}
