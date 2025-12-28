// decoder.js - Core SD-IDC Decoding Logic
class SDIDCDecoder {
    constructor() {
        this.decodingProgress = 0;
    }

    // 1. READ RAW PIXELS FROM IMAGE
    async loadCodeImage(imageElement) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = imageElement.naturalWidth;
        canvas.height = imageElement.naturalHeight;
        
        ctx.drawImage(imageElement, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Convert to grayscale and threshold to binary grid
        return this.imageToBinaryGrid(imageData);
    }

    // 2. EXTRACT SELF-DESCRIBING HEADER
    extractHeader(binaryGrid) {
        // Read first N blocks as header based on fixed header size
        const headerSizeBlocks = 9; // Our header is 36 bits = 9 blocks at 4-bit
        let headerBinary = '';
        
        for (let i = 0; i < headerSizeBlocks; i++) {
            // Use majority voting for each block to resist minor corruption
            const blockValue = this.readBlockWithMajority(binaryGrid, i);
            headerBinary += blockValue;
        }
        
        // Parse binary header
        const version = parseInt(headerBinary.substr(0, 4), 2);
        const width = parseInt(headerBinary.substr(4, 12), 2);
        const height = parseInt(headerBinary.substr(16, 12), 2);
        const blockSize = parseInt(headerBinary.substr(28, 4), 2);
        const bitDepth = parseInt(headerBinary.substr(32, 4), 2);
        
        return { version, width, height, blockSize, bitDepth };
    }

    // 3. RECONSTRUCT IMAGE FROM PAYLOAD
    reconstructImage(binaryGrid, headerInfo) {
        const { width, height, bitDepth, blockSize } = headerInfo;
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(width, height);
        
        // Skip header blocks and read payload
        const headerBlocks = 9;
        let payloadIndex = headerBlocks;
        
        // Decode each pixel block
        for (let y = 0; y < height; y += blockSize) {
            for (let x = 0; x < width; x += blockSize) {
                if (payloadIndex >= binaryGrid.length) break;
                
                // Read value for this block
                const blockValue = this.readBlockValue(binaryGrid, payloadIndex, bitDepth);
                payloadIndex += bitDepth; // Move forward based on bit depth
                
                // Apply to all pixels in this block
                for (let by = 0; by < blockSize && (y + by) < height; by++) {
                    for (let bx = 0; bx < blockSize && (x + bx) < width; bx++) {
                        const pixelIndex = ((y + by) * width + (x + bx)) * 4;
                        const colorValue = this.mapValueToColor(blockValue, bitDepth);
                        
                        imageData.data[pixelIndex] = colorValue;     // R
                        imageData.data[pixelIndex + 1] = colorValue; // G
                        imageData.data[pixelIndex + 2] = colorValue; // B
                        imageData.data[pixelIndex + 3] = 255;        // A
                    }
                }
                
                // Update progress for UI
                this.decodingProgress = Math.floor((payloadIndex / binaryGrid.length) * 100);
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }

    // 4. MAJORITY VOTING FOR ERROR TOLERANCE
    readBlockWithMajority(grid, blockIndex, samplePoints = 5) {
        // Sample multiple points within a logical block
        const values = [];
        const blockSize = 2; // Visual block size in pixels
        
        // Sample center and corners
        const offsets = [
            {x: 0, y: 0}, {x: blockSize-1, y: 0}, 
            {x: 0, y: blockSize-1}, {x: blockSize-1, y: blockSize-1},
            {x: Math.floor(blockSize/2), y: Math.floor(blockSize/2)}
        ];
        
        offsets.forEach(offset => {
            // Calculate position in grid
            const gridX = (blockIndex % grid.size) * blockSize + offset.x;
            const gridY = Math.floor(blockIndex / grid.size) * blockSize + offset.y;
            
            if (gridX < grid.size * blockSize && gridY < grid.size * blockSize) {
                const idx = (gridY * (grid.size * blockSize) + gridX);
                values.push(grid.data[idx] > 128 ? '0' : '1'); // Threshold to binary
            }
        });
        
        // Return majority
        const ones = values.filter(v => v === '1').length;
        return ones > values.length / 2 ? '1' : '0';
    }
}
