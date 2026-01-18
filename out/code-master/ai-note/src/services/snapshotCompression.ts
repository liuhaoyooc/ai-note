import pako from 'pako';

/**
 * 快照压缩服务
 * 使用 pako (zlib) 压缩笔记内容以节省存储空间
 */
export class SnapshotCompressionService {
    /**
     * 压缩文本内容
     * @param content 原始文本内容
     * @returns Base64 编码的压缩数据
     */
    compress(content: string): string {
        try {
            // 将字符串转换为 Uint8Array
            const textEncoder = new TextEncoder();
            const data = textEncoder.encode(content);

            // 使用 deflate 压缩
            const compressed = pako.deflate(data);

            // 转换为 Base64 存储
            const base64 = this.arrayBufferToBase64(compressed);

            console.log(`[SnapshotCompression] Compressed: ${content.length} -> ${compressed.length} bytes (${((1 - compressed.length / content.length) * 100).toFixed(1)}% reduction)`);

            return base64;
        } catch (error) {
            console.error('[SnapshotCompression] Compression failed:', error);
            throw error;
        }
    }

    /**
     * 解压缩文本内容
     * @param base64 Base64 编码的压缩数据
     * @returns 原始文本内容
     */
    decompress(base64: string): string {
        try {
            // 从 Base64 转换回 Uint8Array
            const compressed = this.base64ToArrayBuffer(base64);

            // 使用 inflate 解压缩
            const decompressed = pako.inflate(compressed);

            // 将 Uint8Array 转换回字符串
            const textDecoder = new TextDecoder();
            const content = textDecoder.decode(decompressed);

            console.log(`[SnapshotCompression] Decompressed: ${base64.length} -> ${content.length} chars`);

            return content;
        } catch (error) {
            console.error('[SnapshotCompression] Decompression failed:', error);
            throw error;
        }
    }

    /**
     * 将 ArrayBuffer 转换为 Base64
     */
    private arrayBufferToBase64(buffer: Uint8Array): string {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * 将 Base64 转换为 ArrayBuffer
     */
    private base64ToArrayBuffer(base64: string): Uint8Array {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * 检查数据是否为压缩格式
     * 简单的启发式检查：压缩后的 Base64 通常包含特定字符模式
     */
    isCompressed(data: string): boolean {
        try {
            // 尝试解压，如果成功则认为是压缩格式
            this.decompress(data);
            return true;
        } catch {
            return false;
        }
    }
}
