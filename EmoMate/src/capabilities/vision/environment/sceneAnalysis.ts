/**
 * Scene Analysis Core Module
 * Handles scene similarity calculation and comparison logic
 */

import { SceneData, SceneConfig } from '../../../types/scene';
import { compareImages } from '../imageComparison';

/**
 * Calculate string similarity using Jaccard index (Step 4.2)
 * Tokenizes strings by characters and computes set similarity
 *
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity score (0-1)
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;

  // Convert to character sets
  const set1 = new Set(str1.split(''));
  const set2 = new Set(str2.split(''));

  // Calculate Jaccard similarity
  const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
  const union = new Set([...Array.from(set1), ...Array.from(set2)]);

  return intersection.size / union.size;
}

/**
 * Calculate array similarity using Jaccard index (Step 4.2)
 * Computes set similarity between two arrays
 *
 * @param arr1 - First array
 * @param arr2 - Second array
 * @returns Similarity score (0-1)
 */
export function calculateArraySimilarity(arr1: string[], arr2: string[]): number {
  if (!arr1 || !arr2) return 0;
  if (arr1.length === 0 && arr2.length === 0) return 1;
  if (arr1.length === 0 || arr2.length === 0) return 0;

  const set1 = new Set(arr1);
  const set2 = new Set(arr2);

  const intersection = new Set(Array.from(set1).filter(x => set2.has(x)));
  const union = new Set([...Array.from(set1), ...Array.from(set2)]);

  return intersection.size / union.size;
}

/**
 * Compare semantic similarity between two scenes (Step 4.2)
 * Uses weighted comparison of scene attributes
 *
 * Weights:
 * - location: 30% (most important)
 * - objects: 30% (important)
 * - atmosphere: 20%
 * - lighting: 10%
 * - details: 10%
 *
 * @param scene1 - First scene
 * @param scene2 - Second scene
 * @returns Similarity score (0-1)
 */
export function compareSceneSimilarity(scene1: SceneData, scene2: SceneData): number {
  // Location similarity (30% weight)
  const locationSimilarity = calculateStringSimilarity(
    scene1.location,
    scene2.location
  );

  // Objects similarity (30% weight)
  const objectsSimilarity = calculateArraySimilarity(
    scene1.objects,
    scene2.objects
  );

  // Atmosphere similarity (20% weight)
  const atmosphereSimilarity = calculateStringSimilarity(
    scene1.atmosphere,
    scene2.atmosphere
  );

  // Lighting similarity (10% weight)
  const lightingSimilarity = calculateStringSimilarity(
    scene1.lighting,
    scene2.lighting
  );

  // Details similarity (10% weight) - compare key detail fields
  let detailsSimilarity = 0;
  const detailFields = ['indoorOutdoor', 'timeOfDay', 'weatherCondition'];
  let validFields = 0;

  for (const field of detailFields) {
    const val1 = scene1.details[field];
    const val2 = scene2.details[field];

    if (val1 && val2) {
      validFields++;
      if (val1 === val2) {
        detailsSimilarity += 1;
      }
    }
  }

  detailsSimilarity = validFields > 0 ? detailsSimilarity / validFields : 0.5;

  // Weighted average
  const totalSimilarity =
    locationSimilarity * 0.3 +
    objectsSimilarity * 0.3 +
    atmosphereSimilarity * 0.2 +
    lightingSimilarity * 0.1 +
    detailsSimilarity * 0.1;

  console.log('[SceneAnalysis] Scene similarity breakdown:', {
    location: locationSimilarity.toFixed(3),
    objects: objectsSimilarity.toFixed(3),
    atmosphere: atmosphereSimilarity.toFixed(3),
    lighting: lightingSimilarity.toFixed(3),
    details: detailsSimilarity.toFixed(3),
    total: totalSimilarity.toFixed(3),
  });

  return totalSimilarity;
}

/**
 * Check if scene has changed from previous image
 *
 * @param imageBase64 - Current image
 * @param lastImageBase64 - Previous image (null if first image)
 * @param sceneChangeThreshold - Threshold for scene change detection
 * @returns Whether scene has changed
 */
export async function checkSceneChange(
  imageBase64: string,
  lastImageBase64: string | null,
  sceneChangeThreshold: number
): Promise<boolean> {
  if (!lastImageBase64) {
    console.log('[SceneAnalysis] checkSceneChange: First image, treating as scene change');
    return true; // First image, consider it a change
  }

  try {
    const comparison = await compareImages(
      imageBase64,
      lastImageBase64,
      sceneChangeThreshold
    );

    const hasChanged = !comparison.isSameScene;

    console.log('[SceneAnalysis] checkSceneChange:', {
      similarity: comparison.similarity.toFixed(3),
      threshold: sceneChangeThreshold,
      isSameScene: comparison.isSameScene,
      hasChanged,
      interpretation: hasChanged ? '❌ SCENE CHANGED' : '✅ SCENE UNCHANGED',
    });

    return hasChanged;
  } catch (error) {
    console.error('[SceneAnalysis] Scene change check failed:', error);
    return false;
  }
}

/**
 * Check if semantic deduplication should be applied
 * Uses image similarity as a proxy for semantic similarity
 *
 * @param imageBase64 - Current image
 * @param lastImageBase64 - Previous image
 * @param deduplicationThreshold - Threshold for deduplication
 * @returns Object with deduplication decision and similarity score
 */
export async function checkSemanticDeduplication(
  imageBase64: string,
  lastImageBase64: string,
  deduplicationThreshold: number
): Promise<{
  shouldDeduplicate: boolean;
  similarity: number;
}> {
  try {
    // Calculate image similarity with last analyzed image
    const imageComparison = await compareImages(
      imageBase64,
      lastImageBase64,
      deduplicationThreshold
    );

    const imageSimilarity = imageComparison.similarity;
    const shouldDeduplicate = imageSimilarity >= deduplicationThreshold;

    console.log('[SceneAnalysis] 📊 Semantic deduplication check:', {
      similarity: imageSimilarity.toFixed(3),
      threshold: deduplicationThreshold.toFixed(3),
      shouldDeduplicate,
    });

    return { shouldDeduplicate, similarity: imageSimilarity };
  } catch (error) {
    console.error('[SceneAnalysis] Semantic deduplication check failed:', error);
    return { shouldDeduplicate: false, similarity: 0 };
  }
}
