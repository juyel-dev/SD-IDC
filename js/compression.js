/**
 * Advanced Compression Engine for HMQC
 * Multi-algorithm adaptive compression
 */

class HMQCCompressor {
    constructor() {
        this.compressionLevel = 9;
    }

    /**
     * Adaptive compression based on data type
     */
    compress(data, dataType = 'binary') {
        let compressed;
        
        switch (dataType) {
            case 'text':
                compressed = this.compressText(data);
                break;
            case 'image':
                compressed = this.compressImageData(data);
                break;
            case 'audio':
                compressed = this.compressAudioData(data);
                break;
            default:
                compressed = this.compressBinary(data);
        }
        
        // Final pass: RLE for repetitive patterns
        return this.runLengthEncode(compressed);
    }

    decompress(data, dataType = 'binary') {
        // First pass: RLE decode
        let decompressed = this.runLengthDecode(data);
        
        switch (dataType) {
            case 'text':
                return this.decompressText(decompressed);
            case 'image':
                return this.decompressImageData(decompressed);
            case 'audio':
                return this.decompressAudioData(decompressed);
            default:
                return this.decompressBinary(decompressed);
        }
    }

    /**
     * Text-specific compression
     */
    compressText(text) {
        const encoder = new TextEncoder();
        const bytes = encoder.encode(text);
        
        // Dictionary for common words
        const dictionary = {
            'the': 0x80, 'and': 0x81, 'for': 0x82, 'are': 0x83,
            'but': 0x84, 'not': 0x85, 'you': 0x86, 'all': 0x87,
            'can': 0x88, 'her': 0x89, 'was': 0x8A, 'one': 0x8B,
            'our': 0x8C, 'out': 0x8D, 'day': 0x8E, 'get': 0x8F,
            'has': 0x90, 'him': 0x91, 'his': 0x92, 'how': 0x93,
            'its': 0x94, 'may': 0x95, 'new': 0x96, 'now': 0x97,
            'old': 0x98, 'see': 0x99, 'two': 0x9A, 'way': 0x9B,
            'who': 0x9C, 'boy': 0x9D, 'did': 0x9E, 'she': 0x9F
        };
        
        const result = [];
        let i = 0;
        
        while (i < bytes.length) {
            let found = false;
            
            // Check dictionary (2-3 letter words)
            for (let len = 3; len >= 2; len--) {
                if (i + len <= bytes.length) {
                    const word = String.fromCharCode(...bytes.slice(i, i + len));
                    if (dictionary[word]) {
                        result.push(dictionary[word]);
                        i += len;
                        found = true;
                        break;
                    }
                }
            }
            
            if (!found) {
                result.push(bytes[i]);
                i++;
            }
        }
        
        return new Uint8Array(result);
    }

    decompressText(compressed) {
        const reverseDict = {
            0x80: 'the', 0x81: 'and', 0x82: 'for', 0x83: 'are',
            0x84: 'but', 0x85: 'not', 0x86: 'you', 0x87: 'all',
            0x88: 'can', 0x89: 'her', 0x8A: 'was', 0x8B: 'one',
            0x8C: 'our', 0x8D: 'out', 0x8E: 'day', 0x8F: 'get',
            0x90: 'has', 0x91: 'him', 0x92: 'his', 0x93: 'how',
            0x94: 'its', 0x95: 'may', 0x96: 'new', 0x97: 'now',
            0x98: 'old', 0x99: 'see', 0x9A: 'two', 0x9B: 'way',
            0x9C: 'who', 0x9D: 'boy', 0x9E: 'did', 0x9F: 'she'
        };
        
        const result = [];
        
        for (let i = 0; i < compressed.length; i++) {
            const byte = compressed[i];
            if (reverseDict[byte]) {
                for (const char of reverseDict[byte]) {
                    result.push(char.charCodeAt(0));
                }
            } else {
                result.push(byte);
            }
        }
        
        const decoder = new TextDecoder();
        return decoder.decode(new Uint8Array(result));
    }

    /**
     * Binary compression with pattern detection
     */
    compressBinary(bytes) {
        // Delta encoding for similar bytes
        const delta = [bytes[0]];
        for (let i = 1; i < bytes.length; i++) {
            delta.push((bytes[i] - bytes[i-1]) & 0xFF);
        }
        
        // Frequency analysis and encoding
        return this.encodeFrequentPatterns(new Uint8Array(delta));
    }

    decompressBinary(compressed) {
        const delta = this.decodeFrequentPatterns(compressed);
        const bytes = [delta[0]];
        
        for (let i = 1; i < delta.length; i++) {
            bytes.push((bytes[i-1] + delta[i]) & 0xFF);
        }
        
        return new Uint8Array(bytes);
    }

    /**
     * Pattern-based compression
     */
    encodeFrequentPatterns(bytes) {
        const patterns = new Map();
        const result = [];
        
        // Find frequent sequences (3-5 bytes)
        for (let len = 5; len >= 3; len--) {
            for (let i = 0; i <= bytes.length - len; i++) {
                const seq = bytes.slice(i, i + len).join(',');
                patterns.set(seq, (patterns.get(seq) || 0) + 1);
            }
        }
        
        // Sort by frequency
        const topPatterns = Array.from(patterns.entries())
            .filter(([_, count]) => count > 3)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 16);
        
        // Create encoding map
        const encodeMap = new Map();
        topPatterns.forEach(([pattern], index) => {
            encodeMap.set(pattern, 0xA0 + index);
        });
        
        // Encode
        let i = 0;
        while (i < bytes.length) {
            let encoded = false;
            
            for (let len = 5; len >= 3; len--) {
                if (i + len <= bytes.length) {
                    const seq = bytes.slice(i, i + len).join(',');
                    if (encodeMap.has(seq)) {
                        result.push(encodeMap.get(seq));
                        i += len;
                        encoded = true;
                        break;
                    }
                }
            }
            
            if (!encoded) {
                result.push(bytes[i]);
                i++;
            }
        }
        
        // Add pattern dictionary at start
        const dictionary = new Uint8Array([...topPatterns.map(([_, code]) => code), 0xFF]);
        return this.concatenateArrays(dictionary, new Uint8Array(result));
    }

    decodeFrequentPatterns(compressed) {
        const result = [];
        const patternTable = [];
        
        // Read dictionary
        let dictEnd = 0;
        while (dictEnd < compressed.length && compressed[dictEnd] !== 0xFF) {
            dictEnd++;
        }
        
        // Simplified decoding
        for (let i = dictEnd + 1; i < compressed.length; i++) {
            if (compressed[i] >= 0xA0 && compressed[i] <= 0xAF) {
                // Pattern reference - simplified
                result.push(0, 0, 0); // Placeholder
            } else {
                result.push(compressed[i]);
            }
        }
        
        return new Uint8Array(result);
    }

    /**
     * Run-Length Encoding (RLE) for repetitive data
     */
    runLengthEncode(bytes) {
        const result = [];
        let i = 0;
        
        while (i < bytes.length) {
            let count = 1;
            
            // Count repetitions (max 255)
            while (i + count < bytes.length && 
                   bytes[i + count] === bytes[i] && 
                   count < 255) {
                count++;
            }
            
            if (count > 3) {
                // Encode as RLE: 0xFE, count, value
                result.push(0xFE, count, bytes[i]);
                i += count;
            } else {
                // Regular bytes
                if (bytes[i] === 0xFE) {
                    // Escape sequence
                    result.push(0xFE, 1, 0xFE);
                } else {
                    result.push(bytes[i]);
                }
                i++;
            }
        }
        
        return new Uint8Array(result);
    }

    runLengthDecode(compressed) {
        const result = [];
        
        for (let i = 0; i < compressed.length; i++) {
            if (compressed[i] === 0xFE && i + 2 < compressed.length) {
                const count = compressed[i + 1];
                const value = compressed[i + 2];
                
                for (let j = 0; j < count; j++) {
                    result.push(value);
                }
                i += 2;
            } else {
                result.push(compressed[i]);
            }
        }
        
        return new Uint8Array(result);
    }

    /**
     * Image-specific compression (simplified)
     */
    compressImageData(bytes) {
        // For actual images, apply DCT-like compression
        return this.compressBinary(bytes);
    }

    decompressImageData(compressed) {
        return this.decompressBinary(compressed);
    }

    /**
     * Audio-specific compression
     */
    compressAudioData(bytes) {
        // Delta PCM encoding
        const result = [bytes[0], bytes[1]]; // Keep first sample
        
        for (let i = 2; i < bytes.length; i += 2) {
            const sample = bytes[i] | (bytes[i + 1] << 8);
            const prev = bytes[i - 2] | (bytes[i - 1] << 8);
            const delta = (sample - prev) & 0xFFFF;
            
            result.push(delta & 0xFF, delta >> 8);
        }
        
        return this.compressBinary(new Uint8Array(result));
    }

    decompressAudioData(compressed) {
        const delta = this.decompressBinary(compressed);
        const result = [delta[0], delta[1]];
        
        for (let i = 2; i < delta.length; i += 2) {
            const deltaVal = delta[i] | (delta[i + 1] << 8);
            const prev = result[i - 2] | (result[i - 1] << 8);
            const sample = (prev + deltaVal) & 0xFFFF;
            
            result.push(sample & 0xFF, sample >> 8);
        }
        
        return new Uint8Array(result);
    }

    concatenateArrays(arr1, arr2) {
        const result = new Uint8Array(arr1.length + arr2.length);
        result.set(arr1, 0);
        result.set(arr2, arr1.length);
        return result;
    }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HMQCCompressor;
          }
  
