/**
 * Image Compression Utilities
 *
 * Step 5.3: Performance and Cost Optimization
 * - Compress images to < 500KB before sending to Claude Vision API
 * - Reduce resolution to optimal size (1024x768) for analysis
 * - Track image size statistics
 */

import * as ImageManipulator from 'expo-image-manipulator';

/**
 * Maximum image size in bytes (500KB)
 */
export const MAX_IMAGE_SIZE_BYTES = 500 * 1024; // 500KB

/**
 * Optimal image resolution for Claude Vision API
 * - Width: 1024px (sufficient for object recognition)
 * - Maintains aspect ratio
 */
export const OPTIMAL_WIDTH = 1024;

/**
 * Image compression configuration
 */
export interface CompressionConfig {
  maxSizeBytes?: number; // Max file size in bytes (default: 500KB)
  maxWidth?: number; // Max width in pixels (default: 1024)
  compress?: number; // JPEG compression quality 0-1 (default: 0.7)
}

/**
 * Image size statistics
 */
export interface ImageSizeStats {
  originalSize: number; // Original size in bytes
  compressedSize: number; // Compressed size in bytes
  compressionRatio: number; // Compression ratio (0-1)
  originalDimensions?: { width: number; height: number };
  compressedDimensions?: { width: number; height: number };
}

/**
 * Convert base64 string to approximate byte size
 * Base64 encoding increases size by ~33% (4/3 ratio)
 */
export function base64ToByteSize(base64: string): number {
  // Remove data URL prefix if exists
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');

  // Calculate byte size from base64 length
  // Formula: bytes = (base64Length * 3) / 4
  // Account for padding characters (=)
  const padding = (cleanBase64.match(/=/g) || []).length;
  return Math.floor((cleanBase64.length * 3) / 4) - padding;
}

/**
 * Compress base64 image to meet size and dimension constraints
 *
 * @param base64 - Input image in base64 format
 * @param config - Compression configuration
 * @returns Compressed image in base64 format and statistics
 */
export async function compressBase64Image(
  base64: string,
  config: CompressionConfig = {}
): Promise<{ base64: string; stats: ImageSizeStats }> {
  const {
    maxSizeBytes = MAX_IMAGE_SIZE_BYTES,
    maxWidth = OPTIMAL_WIDTH,
    compress = 0.7,
  } = config;

  // Convert base64 to data URI if not already
  const dataUri = base64.startsWith('data:image/')
    ? base64
    : `data:image/jpeg;base64,${base64}`;

  // Calculate original size
  const originalSize = base64ToByteSize(base64);

  console.log('[ImageCompression] 📸 Starting compression:', {
    originalSizeKB: (originalSize / 1024).toFixed(2),
    maxSizeKB: (maxSizeBytes / 1024).toFixed(2),
    maxWidth,
    compress,
  });

  try {
    // Step 1: Resize image to optimal width
    const resizeResult = await ImageManipulator.manipulateAsync(
      dataUri,
      [{ resize: { width: maxWidth } }],
      {
        compress,
        format: ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    let compressedBase64 = resizeResult.base64!;
    let compressedSize = base64ToByteSize(compressedBase64);
    let currentCompress = compress;

    console.log('[ImageCompression] 📊 After resize:', {
      sizeKB: (compressedSize / 1024).toFixed(2),
      width: resizeResult.width,
      height: resizeResult.height,
    });

    // Step 2: If still too large, reduce compression quality iteratively
    let iteration = 0;
    const maxIterations = 5;

    while (compressedSize > maxSizeBytes && iteration < maxIterations) {
      iteration++;
      // Reduce compression quality by 10% each iteration
      currentCompress = Math.max(0.3, currentCompress - 0.1);

      console.log('[ImageCompression] 🔁 Iteration', iteration, '- reducing quality to', currentCompress);

      const recompressed = await ImageManipulator.manipulateAsync(
        dataUri,
        [{ resize: { width: maxWidth } }],
        {
          compress: currentCompress,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      compressedBase64 = recompressed.base64!;
      compressedSize = base64ToByteSize(compressedBase64);

      console.log('[ImageCompression] 📊 Iteration', iteration, 'result:', {
        sizeKB: (compressedSize / 1024).toFixed(2),
        quality: currentCompress,
      });
    }

    const stats: ImageSizeStats = {
      originalSize,
      compressedSize,
      compressionRatio: 1 - compressedSize / originalSize,
      compressedDimensions: {
        width: resizeResult.width,
        height: resizeResult.height,
      },
    };

    console.log('[ImageCompression] ✅ Compression complete:', {
      originalSizeKB: (originalSize / 1024).toFixed(2),
      compressedSizeKB: (compressedSize / 1024).toFixed(2),
      compressionRatio: (stats.compressionRatio * 100).toFixed(1) + '%',
      finalQuality: currentCompress,
      iterations: iteration,
      underLimit: compressedSize <= maxSizeBytes ? '✓' : '✗',
    });

    return {
      base64: compressedBase64,
      stats,
    };
  } catch (error) {
    console.error('[ImageCompression] ❌ Compression error:', error);
    throw new Error(`Image compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Format byte size to human-readable string
 */
export function formatByteSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Calculate compression savings
 */
export function calculateSavings(stats: ImageSizeStats): {
  savedBytes: number;
  savedKB: number;
  savingsPercentage: number;
} {
  const savedBytes = stats.originalSize - stats.compressedSize;
  return {
    savedBytes,
    savedKB: savedBytes / 1024,
    savingsPercentage: stats.compressionRatio * 100,
  };
}
