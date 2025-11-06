/**
 * Image Comparison Utilities
 * Provides functions for comparing images to detect scene changes
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { SceneComparisonResult } from '../types/scene';

/**
 * Thumbnail configuration for image comparison
 * Balance between speed and stability:
 * - Larger size (128x128) provides more stability against camera noise
 * - JPEG format with high quality (0.9) filters noise while maintaining determinism
 */
const THUMBNAIL_CONFIG = {
  width: 128,
  height: 128,
  // Use JPEG format: lossy compression actually helps filter camera sensor noise
  // Quality 0.9 is high enough to be stable, low enough to filter noise
  format: ImageManipulator.SaveFormat.JPEG,
  compress: 0.9,
};

/**
 * Generate a thumbnail from base64 image for comparison
 * Strategy: Use JPEG format to filter camera noise
 *
 * Why JPEG over PNG:
 * - Camera sensor has random noise in every frame
 * - PNG preserves all noise → different base64 every time
 * - JPEG's lossy compression filters noise → more stable comparison
 * - Quality 0.9 balances stability and accuracy
 *
 * @param imageBase64 - Full size base64 encoded image
 * @returns Thumbnail as base64 string
 */
export async function generateThumbnail(imageBase64: string): Promise<string> {
  console.log('[ImageComparison] generateThumbnail called');
  console.log('[ImageComparison] Input image size:', imageBase64.length, 'bytes');

  try {
    // Ensure base64 string has data URI prefix
    let uri = imageBase64;
    if (!uri.startsWith('data:')) {
      uri = `data:image/jpeg;base64,${imageBase64}`;
    }

    // Resize image to thumbnail size for fast comparison
    // Use JPEG format with high quality to filter camera noise
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: THUMBNAIL_CONFIG.width, height: THUMBNAIL_CONFIG.height } }],
      {
        compress: THUMBNAIL_CONFIG.compress,
        format: THUMBNAIL_CONFIG.format,
        base64: true
      }
    );

    console.log('[ImageComparison] Thumbnail generated successfully');
    console.log('[ImageComparison] Thumbnail size:', result.base64?.length || 0, 'bytes');
    return result.base64 || '';
  } catch (error) {
    console.error('[ImageComparison] Failed to generate thumbnail:', error);
    // Return original image on error (will be slower but still works)
    return imageBase64;
  }
}

/**
 * Calculate similarity between two base64 thumbnail strings
 *
 * TEMPORARY SOLUTION for Step 1.3 MVP:
 * Uses file size comparison as primary indicator since base64 character
 * comparison doesn't work (JPEG compression is non-deterministic).
 *
 * Algorithm:
 * 1. Compare thumbnail file sizes
 * 2. File size difference < 5% → scenes are similar
 * 3. File size difference 5-15% → moderate similarity
 * 4. File size difference > 15% → different scenes
 *
 * LIMITATION:
 * This is NOT a robust image comparison algorithm. It only works for
 * detecting major scene changes. For production, use perceptual hashing
 * (pHash, dHash) or dedicated image hashing libraries.
 *
 * @param thumb1 - First thumbnail base64 string
 * @param thumb2 - Second thumbnail base64 string
 * @returns Difference score (0 = identical, 1 = completely different)
 */
async function calculatePixelDifference(
  thumb1: string,
  thumb2: string
): Promise<number> {
  console.log('[ImageComparison] calculatePixelDifference called (FILE SIZE METHOD)');

  try {
    // Quick check: if strings are identical, return 0
    if (thumb1 === thumb2) {
      console.log('[ImageComparison] Thumbnails are identical (exact match)');
      return 0;
    }

    const size1 = thumb1.length;
    const size2 = thumb2.length;
    const maxSize = Math.max(size1, size2);

    // Calculate size difference percentage
    const sizeDiff = Math.abs(size1 - size2) / maxSize;

    // Convert size difference to similarity score
    // Small size difference = high similarity
    // Large size difference = low similarity
    let similarity = 0;

    if (sizeDiff < 0.05) {
      // < 5% size difference: Very similar (same scene)
      // Map 0-5% diff to 95-100% similarity
      similarity = 1.0 - (sizeDiff / 0.05) * 0.05;
      // Boost very close sizes to near 100%
      similarity = 0.95 + (1.0 - sizeDiff / 0.05) * 0.05;
    } else if (sizeDiff < 0.15) {
      // 5-15% size difference: Moderate similarity (slight change)
      // Map 5-15% diff to 70-95% similarity
      const normalizedDiff = (sizeDiff - 0.05) / 0.10; // 0-1 range
      similarity = 0.95 - normalizedDiff * 0.25; // 95% to 70%
    } else {
      // > 15% size difference: Different scenes
      // Map 15%+ diff to 0-70% similarity
      const normalizedDiff = Math.min((sizeDiff - 0.15) / 0.35, 1.0); // Cap at 50% diff
      similarity = 0.70 - normalizedDiff * 0.70; // 70% to 0%
    }

    const difference = 1 - similarity;

    console.log('[ImageComparison] File size comparison result:', {
      size1,
      size2,
      sizeDiff: (sizeDiff * 100).toFixed(2) + '%',
      similarity: similarity.toFixed(3),
      difference: difference.toFixed(3),
      interpretation: sizeDiff < 0.05 ? 'Same scene' :
                     sizeDiff < 0.15 ? 'Slight change' :
                     'Different scene',
    });

    return difference;
  } catch (error) {
    console.error('[ImageComparison] Comparison failed:', error);
    return 1.0;
  }
}

/**
 * Calculate perceptual hash for an image
 * More robust than pixel comparison, resistant to minor changes
 * (Will be implemented in future optimization)
 *
 * @param imageBase64 - Base64 encoded image
 * @returns Perceptual hash string
 */
async function calculatePerceptualHash(imageBase64: string): Promise<string> {
  // TODO: Implement perceptual hash in future optimization (Step 6+)
  // This is a more advanced algorithm that:
  // 1. Converts image to grayscale
  // 2. Reduces to 8x8 size
  // 3. Computes DCT (Discrete Cosine Transform)
  // 4. Generates hash from DCT coefficients

  console.log('[ImageComparison] calculatePerceptualHash - Not implemented yet');
  return 'PERCEPTUAL_HASH_PLACEHOLDER';
}

/**
 * Compare two images and determine similarity
 *
 * Process:
 * 1. Generate thumbnails for both images (128x128 JPEG @ 0.9 quality)
 * 2. Compare thumbnails using sampled character comparison
 * 3. Return similarity score
 *
 * @param image1Base64 - First image (base64)
 * @param image2Base64 - Second image (base64)
 * @param threshold - Similarity threshold (0-1, default 0.7)
 * @returns Comparison result with similarity score
 */
export async function compareImages(
  image1Base64: string,
  image2Base64: string,
  threshold: number = 0.7
): Promise<SceneComparisonResult> {
  console.log('[ImageComparison] compareImages called, threshold:', threshold);

  try {
    // Quick check: if images are identical, return 1.0 immediately
    if (image1Base64 === image2Base64) {
      console.log('[ImageComparison] Images are identical (exact base64 match)');
      return {
        similarity: 1.0,
        isSameScene: true,
        threshold,
      };
    }

    // Generate thumbnails for both images
    console.log('[ImageComparison] Generating thumbnails...');
    const [thumb1, thumb2] = await Promise.all([
      generateThumbnail(image1Base64),
      generateThumbnail(image2Base64)
    ]);

    // DEBUG: Test if same image produces same thumbnail
    console.log('[ImageComparison] DEBUG - Thumbnail info:', {
      thumb1Length: thumb1.length,
      thumb2Length: thumb2.length,
      lengthDiff: Math.abs(thumb1.length - thumb2.length),
      firstCharsMatch: thumb1.substring(0, 20) === thumb2.substring(0, 20),
    });

    // Calculate difference using thumbnail comparison
    const difference = await calculatePixelDifference(thumb1, thumb2);

    // Convert to similarity (0 = different, 1 = identical)
    const similarity = 1 - difference;

    // Determine if scenes are the same based on threshold
    const isSameScene = similarity >= threshold;

    console.log('[ImageComparison] Final comparison result:', {
      difference: difference.toFixed(3),
      similarity: similarity.toFixed(3),
      isSameScene,
      threshold,
      explanation: `Difference=${difference.toFixed(3)} → Similarity=${similarity.toFixed(3)}`
    });

    return {
      similarity,
      isSameScene,
      threshold,
    };
  } catch (error) {
    console.error('[ImageComparison] Comparison failed:', error);

    // Return conservative result on error (assume scenes are different)
    return {
      similarity: 0,
      isSameScene: false,
      threshold,
    };
  }
}

/**
 * Check if a scene has changed significantly
 * Convenience function that wraps compareImages
 *
 * @param currentImage - Current image (base64)
 * @param previousImage - Previous image (base64)
 * @param changeThreshold - Threshold for detecting change (default 0.7)
 * @returns True if scene has changed significantly
 */
export async function hasSceneChanged(
  currentImage: string,
  previousImage: string,
  changeThreshold: number = 0.7
): Promise<boolean> {
  const result = await compareImages(currentImage, previousImage, changeThreshold);

  // Scene has changed if similarity is below threshold
  return !result.isSameScene;
}

/**
 * Calculate similarity between two thumbnail images
 * Faster than full image comparison
 *
 * @param thumbnail1 - First thumbnail (base64)
 * @param thumbnail2 - Second thumbnail (base64)
 * @returns Similarity score (0-1)
 */
export async function compareThumbnails(
  thumbnail1: string,
  thumbnail2: string
): Promise<number> {
  console.log('[ImageComparison] compareThumbnails called');

  // Use same pixel difference algorithm
  const difference = await calculatePixelDifference(thumbnail1, thumbnail2);
  const similarity = 1 - difference;

  console.log('[ImageComparison] Thumbnail similarity:', similarity.toFixed(3));

  return similarity;
}

/**
 * Batch compare a new image against multiple cached thumbnails
 * Useful for deduplication against scene cache
 *
 * @param newImage - New image (base64)
 * @param cachedThumbnails - Array of cached thumbnails
 * @param deduplicationThreshold - Similarity threshold (default 0.85)
 * @returns Index of matching thumbnail, or -1 if no match
 */
export async function findMatchingThumbnail(
  newImage: string,
  cachedThumbnails: string[],
  deduplicationThreshold: number = 0.85
): Promise<number> {
  console.log('[ImageComparison] findMatchingThumbnail called');
  console.log('[ImageComparison] Comparing against', cachedThumbnails.length, 'thumbnails');

  // Generate thumbnail for new image
  const newThumbnail = await generateThumbnail(newImage);

  // Compare against all cached thumbnails
  for (let i = 0; i < cachedThumbnails.length; i++) {
    const similarity = await compareThumbnails(newThumbnail, cachedThumbnails[i]);

    if (similarity >= deduplicationThreshold) {
      console.log('[ImageComparison] Match found at index', i, 'similarity:', similarity.toFixed(3));
      return i;
    }
  }

  console.log('[ImageComparison] No matching thumbnail found');
  return -1;
}

/**
 * Get image dimensions from base64 string
 * Useful for debugging and validation
 *
 * @param imageBase64 - Base64 encoded image
 * @returns Promise with width and height
 */
export async function getImageDimensions(
  imageBase64: string
): Promise<{ width: number; height: number }> {
  // TODO: Implement actual dimension extraction
  // For now, return mock dimensions

  console.log('[ImageComparison] getImageDimensions - returning mock values');

  return {
    width: 1920,
    height: 1080,
  };
}

/**
 * Estimate size of base64 image in KB
 *
 * @param imageBase64 - Base64 encoded image
 * @returns Size in kilobytes
 */
export function getImageSizeKB(imageBase64: string): number {
  // Base64 encoding increases size by ~33%
  // So actual image size is approximately 75% of base64 string length
  const sizeBytes = (imageBase64.length * 0.75);
  const sizeKB = sizeBytes / 1024;

  console.log('[ImageComparison] Image size:', sizeKB.toFixed(2), 'KB');

  return sizeKB;
}
