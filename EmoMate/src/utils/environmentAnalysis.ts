import {
  DetectedObject,
  SceneType,
  LightingCondition,
  ActivityType,
  EnvironmentContext,
} from '../types/environment';
import { debugLog } from './debug';

/**
 * Analyze detected objects to infer activity type
 */
export function inferActivity(objects: DetectedObject[]): ActivityType {
  const labels = objects.map(obj => obj.label.toLowerCase());

  // Working activity indicators
  const workingIndicators = ['laptop', 'keyboard', 'mouse', 'book', 'desk'];
  if (labels.some(label => workingIndicators.includes(label))) {
    return 'working';
  }

  // Eating activity indicators
  const eatingIndicators = ['fork', 'knife', 'spoon', 'bowl', 'cup', 'pizza', 'sandwich', 'apple', 'banana'];
  if (labels.some(label => eatingIndicators.includes(label))) {
    return 'eating';
  }

  // Exercising activity indicators
  const exerciseIndicators = ['sports ball', 'bicycle', 'tennis racket', 'skateboard'];
  if (labels.some(label => exerciseIndicators.includes(label))) {
    return 'exercising';
  }

  // Reading activity indicators
  const readingIndicators = ['book'];
  if (labels.some(label => readingIndicators.includes(label))) {
    return 'reading';
  }

  // Socializing activity indicators (multiple people)
  const personCount = labels.filter(label => label === 'person').length;
  if (personCount >= 2) {
    return 'socializing';
  }

  // Traveling activity indicators
  const travelIndicators = ['suitcase', 'backpack', 'car', 'bus', 'train', 'airplane'];
  if (labels.some(label => travelIndicators.includes(label))) {
    return 'traveling';
  }

  // Relaxing activity indicators
  const relaxingIndicators = ['couch', 'bed', 'tv'];
  if (labels.some(label => relaxingIndicators.includes(label))) {
    return 'relaxing';
  }

  return 'unknown';
}

/**
 * Refine scene type based on detected objects
 */
export function refineSceneType(
  baseScene: SceneType,
  objects: DetectedObject[]
): SceneType {
  const labels = objects.map(obj => obj.label.toLowerCase());

  // Office indicators
  const officeIndicators = ['laptop', 'keyboard', 'mouse', 'desk', 'chair'];
  const officeScore = labels.filter(label => officeIndicators.includes(label)).length;
  if (officeScore >= 2) {
    return 'office';
  }

  // Home indicators
  const homeIndicators = ['couch', 'bed', 'tv', 'dining table', 'refrigerator'];
  const homeScore = labels.filter(label => homeIndicators.includes(label)).length;
  if (homeScore >= 2) {
    return 'home';
  }

  // Restaurant indicators
  const restaurantIndicators = ['dining table', 'chair', 'fork', 'knife', 'cup'];
  const restaurantScore = labels.filter(label => restaurantIndicators.includes(label)).length;
  if (restaurantScore >= 3) {
    return 'restaurant';
  }

  // Nature indicators
  const natureIndicators = ['bird', 'dog', 'cat', 'horse', 'tree', 'flower'];
  const natureScore = labels.filter(label => natureIndicators.includes(label)).length;
  if (natureScore >= 1 && baseScene === 'outdoor') {
    return 'nature';
  }

  // Transport indicators
  const transportIndicators = ['car', 'bus', 'train', 'airplane', 'bicycle', 'motorcycle'];
  if (labels.some(label => transportIndicators.includes(label))) {
    return 'transport';
  }

  return baseScene;
}

/**
 * Estimate lighting condition based on image brightness
 * This is a simplified version - in production you'd analyze actual pixel values
 */
export function estimateLighting(
  avgBrightness?: number
): LightingCondition {
  if (!avgBrightness) {
    return 'normal';
  }

  // Brightness scale: 0 (black) to 255 (white)
  if (avgBrightness > 200) {
    return 'bright';
  } else if (avgBrightness > 120) {
    return 'normal';
  } else if (avgBrightness > 60) {
    return 'dim';
  } else {
    return 'dark';
  }
}

/**
 * Build full environment context from detection results
 */
export function buildEnvironmentContext(
  sceneType: SceneType,
  objects: DetectedObject[],
  sceneConfidence: number,
  avgBrightness?: number
): EnvironmentContext {
  const refinedScene = refineSceneType(sceneType, objects);
  const activity = inferActivity(objects);
  const lighting = estimateLighting(avgBrightness);

  const context: EnvironmentContext = {
    scene: refinedScene,
    objects,
    lighting,
    activity,
    timestamp: Date.now(),
    confidence: sceneConfidence,
  };

  debugLog('EnvironmentAnalysis', 'Built environment context', context);

  return context;
}

/**
 * Get natural language description of environment context
 * This can be used to enhance AI conversation prompts
 */
export function getEnvironmentDescription(context: EnvironmentContext): string {
  const parts: string[] = [];

  // Scene description
  const sceneDescriptions: Record<SceneType, string> = {
    indoor: '室内',
    outdoor: '户外',
    office: '办公室',
    home: '家中',
    restaurant: '餐厅',
    transport: '交通工具上',
    nature: '自然环境',
    unknown: '未知环境',
  };
  parts.push(sceneDescriptions[context.scene] || '未知环境');

  // Activity description
  const activityDescriptions: Record<ActivityType, string> = {
    working: '正在工作',
    relaxing: '正在休息',
    eating: '正在用餐',
    exercising: '正在运动',
    reading: '正在阅读',
    socializing: '正在社交',
    traveling: '正在旅行',
    unknown: '',
  };
  if (context.activity !== 'unknown') {
    parts.push(activityDescriptions[context.activity]);
  }

  // Lighting description
  const lightingDescriptions: Record<LightingCondition, string> = {
    bright: '光线很亮',
    normal: '光线正常',
    dim: '光线较暗',
    dark: '光线很暗',
  };
  parts.push(lightingDescriptions[context.lighting]);

  // Notable objects (top 3 by confidence)
  const topObjects = context.objects
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3)
    .map(obj => obj.label);

  if (topObjects.length > 0) {
    const objectLabels = topObjects.join('、');
    parts.push(`周围有${objectLabels}`);
  }

  return parts.join('，');
}

/**
 * Filter out low-confidence detections
 */
export function filterObjectsByConfidence(
  objects: DetectedObject[],
  minConfidence: number = 0.3
): DetectedObject[] {
  return objects.filter(obj => obj.confidence >= minConfidence);
}

/**
 * Group similar objects and count them
 */
export function groupAndCountObjects(
  objects: DetectedObject[]
): Map<string, number> {
  const counts = new Map<string, number>();

  objects.forEach(obj => {
    const currentCount = counts.get(obj.label) || 0;
    counts.set(obj.label, currentCount + 1);
  });

  return counts;
}

/**
 * Check if environment has changed significantly
 * Used to determine when to update scene classification
 */
export function hasEnvironmentChanged(
  previousContext: EnvironmentContext | null,
  currentObjects: DetectedObject[],
  threshold: number = 0.5
): boolean {
  if (!previousContext) {
    return true;
  }

  const prevLabels = new Set(previousContext.objects.map(obj => obj.label));
  const currLabels = new Set(currentObjects.map(obj => obj.label));

  // Calculate Jaccard similarity
  const intersection = new Set([...prevLabels].filter(x => currLabels.has(x)));
  const union = new Set([...prevLabels, ...currLabels]);

  const similarity = intersection.size / union.size;

  return similarity < threshold;
}
