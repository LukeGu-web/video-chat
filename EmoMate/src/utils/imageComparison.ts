/**
 * Image Comparison Utilities
 * Provides functions for comparing images to detect scene changes
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { SceneComparisonResult } from '../types/scene';

/**
 * Thumbnail configuration for image comparison
 * Smaller thumbnails = faster comparison but less accuracy
 */
const THUMBNAIL_CONFIG = {
  width: 64,
  height: 64,
};

/**
 * Generate a thumbnail from base64 image for comparison
 * Reduces image to small size to speed up pixel comparison
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
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: THUMBNAIL_CONFIG.width, height: THUMBNAIL_CONFIG.height } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );

    console.log('[ImageComparison] Thumbnail generated successfully');
    return result.base64 || '';
  } catch (error) {
    console.error('[ImageComparison] Failed to generate thumbnail:', error);
    // Return original image on error (will be slower but still works)
    return imageBase64;
  }
}

/**
 * Calculate pixel difference between two images
 * Simple algorithm: compares base64 data after resizing to same dimensions
 *
 * @param image1Base64 - First image (base64)
 * @param image2Base64 - Second image (base64)
 * @returns Difference score (0 = identical, 1 = completely different)
 */
async function calculatePixelDifference(
  image1Base64: string,
  image2Base64: string
): Promise<number> {
  console.log('[ImageComparison] calculatePixelDifference called');

  try {
    // Quick check: if strings are identical, return 0
    if (image1Base64 === image2Base64) {
      console.log('[ImageComparison] Images are identical (exact match)');
      return 0;
    }

    // Generate thumbnails for both images (normalize size)
    const thumbnail1 = await generateThumbnail(image1Base64);
    const thumbnail2 = await generateThumbnail(image2Base64);

    // Compare thumbnails character by character
    const minLength = Math.min(thumbnail1.length, thumbnail2.length);
    const maxLength = Math.max(thumbnail1.length, thumbnail2.length);

    let diffCount = 0;

    // Compare common length
    for (let i = 0; i < minLength; i++) {
      if (thumbnail1[i] !== thumbnail2[i]) {
        diffCount++;
      }
    }

    // Add difference for length mismatch
    diffCount += maxLength - minLength;

    // Calculate difference ratio (0 = identical, 1 = completely different)
    const difference = diffCount / maxLength;

    console.log('[ImageComparison] Comparison result:', {
      thumbnail1Length: thumbnail1.length,
      thumbnail2Length: thumbnail2.length,
      diffCount,
      difference: difference.toFixed(3),
    });

    return difference;
  } catch (error) {
    console.error('[ImageComparison] Pixel comparison failed:', error);
    // Return maximum difference on error (assume images are different)
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
    // Calculate difference (0 = identical, 1 = completely different)
    const difference = await calculatePixelDifference(image1Base64, image2Base64);

    // Convert to similarity (0 = different, 1 = identical)
    const similarity = 1 - difference;

    // Determine if scenes are the same based on threshold
    const isSameScene = similarity >= threshold;

    console.log('[ImageComparison] Comparison result:', {
      similarity: similarity.toFixed(3),
      isSameScene,
      threshold,
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
