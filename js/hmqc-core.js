/**
 * HyperMatrix Quantum Code - Core Engine v3.0
 * Advanced 2D Optical Code System
 */

class HMQCCore {
    constructor() {
        this.version = '3.0';
        this.moduleSize = 4; // pixels per module
        this.maxSize = 4096; // max matrix dimension
        this.colors = {
            primary: [0, 255, 136],   // #00ff88
            secondary: [0, 170, 255], // #00aaff
            marker: [255, 255, 255],  // White markers
            background: [10, 10, 10]  // Dark background
        };
    }

    /**
     * Generate alignment markers (4 corners)
     */
    generateMarkers(size) {
        const markers = [];
        const markerSize = 20;
        
        // 4 corner positions
        const positions = [
            [0, 0], [size - markerSize, 0],
            [0, size - markerSize], [size - markerSize, size - markerSize]
        ];
        
        positions.forEach(([x, y]) => {
            markers.push({
                x, y, size: markerSize,
                pattern: this.createMarkerPattern()
            });
        });
        
        return markers;
    }

    createMarkerPattern() {
        // QR-like finder pattern
        return [
            [1,1,1,1,1,1,1],
            [1,0,0,0,0,0,1],
            [1,0,1,1,1,0,1],
            [1,0,1,0,1,0,1],
            [1,0,1,1,1,0,1],
            [1,0,0,0,0,0,1],
            [1,1,1,1,1,1,1]
        ];
    }

    /**
     * Create dynamic matrix based on data size
     */
    calculateMatrixSize(dataLength) {
        const bitsPerModule = 32; // RGBA
        const modulesNeeded = Math.ceil(dataLength * 8 / bitsPerModule);
        const gridSize = Math.ceil(Math.sqrt(modulesNeeded)) + 50; // Extra space for markers
        
        return Math.min(
            Math.max(gridSize, 256), // Minimum 256x256
            this.maxSize
        );
    }

    /**
     * Convert byte data to color modules
     */
    bytesToColorModules(bytes, width, height) {
        const modules = [];
        const totalModules = width * height;
        
        for (let i = 0; i < totalModules; i++) {
            const byteIndex = i * 4;
            
            let r, g, b, a;
            
            if (byteIndex < bytes.length) {
                r = bytes[byteIndex] || 0;
                g = bytes[byteIndex + 1] || 0;
                b = bytes[byteIndex + 2] || 0;
                a = bytes[byteIndex + 3] || 255;
            } else {
                // Padding with pattern
                r = (i * 7) % 256;
                g = (i * 13) % 256;
                b = (i * 19) % 256;
                a = 255;
            }
            
            modules.push({ r, g, b, a });
        }
        
        return modules;
    }

    /**
     * Extract color modules back to bytes
     */
    colorModulesToBytes(modules) {
        const bytes = [];
        modules.forEach(module => {
            bytes.push(module.r, module.g, module.b, module.a);
        });
        return new Uint8Array(bytes);
    }

    /**
     * Render matrix to canvas
     */
    renderToCanvas(canvas, modules, matrixSize) {
        const ctx = canvas.getContext('2d');
        const modulePx = this.moduleSize;
        
        canvas.width = matrixSize * modulePx;
        canvas.height = matrixSize * modulePx;
        
        // Fill background
        ctx.fillStyle = `rgb(${this.colors.background.join(',')})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw modules
        modules.forEach((module, index) => {
            const x = (index % matrixSize) * modulePx;
            const y = Math.floor(index / matrixSize) * modulePx;
            
            ctx.fillStyle = `rgba(${module.r}, ${module.g}, ${module.b}, ${module.a / 255})`;
            ctx.fillRect(x, y, modulePx, modulePx);
        });
        
        // Draw markers
        this.drawMarkers(ctx, matrixSize);
        
        return canvas;
    }

    drawMarkers(ctx, matrixSize) {
        const markers = this.generateMarkers(matrixSize);
        const modulePx = this.moduleSize;
        
        markers.forEach(marker => {
            for (let dy = 0; dy < marker.pattern.length; dy++) {
                for (let dx = 0; dx < marker.pattern[dy].length; dx++) {
                    if (marker.pattern[dy][dx] === 1) {
                        const x = (marker.x + dx) * modulePx;
                        const y = (marker.y + dy) * modulePx;
                        ctx.fillStyle = 'white';
                        ctx.fillRect(x, y, modulePx, modulePx);
                    }
                }
            }
        });
    }

    /**
     * Detect markers in scanned image
     */
    detectMarkers(imageData, width, height) {
        const markers = [];
        const threshold = 200; // White detection
        
        // Simplified marker detection
        // In production, use more advanced corner detection
        const corners = [
            { x: 0, y: 0, searchArea: 50 },
            { x: width - 50, y: 0, searchArea: 50 },
            { x: 0, y: height - 50, searchArea: 50 },
            { x: width - 50, y: height - 50, searchArea: 50 }
        ];
        
        corners.forEach(corner => {
            const center = this.findMarkerCenter(imageData, width, height, corner);
            if (center) markers.push(center);
        });
        
        return markers;
    }

    findMarkerCenter(imageData, width, height, searchArea) {
        // Simplified marker detection logic
        // Returns center point of detected marker
        return { x: searchArea.x + 10, y: searchArea.y + 10 };
    }

    /**
     * Generate metadata header
     */
    generateMetadata(dataType, originalSize, compressedSize) {
        const meta = new ArrayBuffer(32);
        const view = new DataView(meta);
        
        view.setUint32(0, 0x484D5143); // "HMQC" magic number
        view.setUint32(4, this.version.split('.').map(v => parseInt(v)).reduce((a, b) => (a << 8) | b));
        view.setUint32(8, dataType === 'text' ? 1 : dataType === 'image' ? 2 : dataType === 'audio' ? 3 : 4);
        view.setUint32(12, originalSize);
        view.setUint32(16, compressedSize);
        view.setUint32(20, Date.now() / 1000 | 0);
        view.setUint32(24, Math.random() * 0xFFFFFFFF | 0); // Unique ID
        view.setUint32(28, 0); // Reserved
        
        return new Uint8Array(meta);
    }

    /**
     * Parse metadata from decoded data
     */
    parseMetadata(bytes) {
        const view = new DataView(bytes.buffer);
        
        return {
            magic: view.getUint32(0).toString(16).toUpperCase(),
            version: `${(view.getUint32(4) >> 16) & 0xFF}.${(view.getUint32(4) >> 8) & 0xFF}.${view.getUint32(4) & 0xFF}`,
            dataType: ['unknown', 'text', 'image', 'audio', 'binary'][view.getUint32(8)] || 'unknown',
            originalSize: view.getUint32(12),
            compressedSize: view.getUint32(16),
            timestamp: new Date(view.getUint32(20) * 1000),
            id: view.getUint32(24)
        };
    }
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HMQCCore;
          }
