/**
 * Build environment context prompt for AI conversation
 *
 * Converts environment detection data into natural language prompts
 * that enhance AI's contextual awareness
 */

import { EnvironmentContext } from '../../../types/environment';
import { getEnvironmentDescription } from './environmentAnalysis';

/**
 * Generate environment-aware AI prompt
 *
 * @param context - Current environment context from detection
 * @param includeObjects - Whether to include detected objects (default: true)
 * @param maxObjects - Maximum number of objects to include (default: 5)
 * @returns Formatted prompt string for AI system message
 */
export function buildEnvironmentPrompt(
  context: EnvironmentContext | null,
  includeObjects: boolean = true,
  maxObjects: number = 5
): string {
  if (!context) {
    return '';
  }

  const parts: string[] = [];

  // 1. Natural language description
  const description = getEnvironmentDescription(context);
  parts.push(description);

  // 2. Detailed object information
  if (includeObjects && context.objects.length > 0) {
    const topObjects = context.objects
      .slice(0, maxObjects)
      .map(obj => `${obj.label} (${(obj.confidence * 100).toFixed(0)}%)`)
      .join('、');

    parts.push(`\n检测到的物体：${topObjects}`);
  }

  // 3. Activity-based suggestions
  const activityHint = getActivityHint(context);
  if (activityHint) {
    parts.push(`\n${activityHint}`);
  }

  return parts.join('');
}

/**
 * Generate activity-based conversation hints
 *
 * Provides contextual suggestions for AI responses based on detected activity
 */
function getActivityHint(context: EnvironmentContext): string {
  const { activity, scene, lighting } = context;

  // Activity-based hints
  switch (activity) {
    case 'working':
      return '用户可能在工作中，可以关心工作进展或提醒休息。';

    case 'eating':
      return '用户正在用餐，可以关心食物味道或聊聊美食。';

    case 'exercising':
      return '用户在运动，可以鼓励坚持或关心身体状况。';

    case 'reading':
      return '用户在阅读，可以安静陪伴或聊聊书籍内容。';

    case 'socializing':
      return '用户在社交场合，注意不要打扰太多。';

    case 'traveling':
      return '用户在旅途中，可以分享旅行心情。';

    case 'relaxing':
      // Check lighting for more specific context
      if (lighting === 'dim' || lighting === 'dark') {
        return '用户在休息，保持轻松愉快的氛围。';
      }
      return '用户在放松，可以聊聊轻松的话题。';

    default:
      // No specific activity hint
      return '';
  }
}

/**
 * Generate conversation starters based on environment
 *
 * Provides proactive conversation topics related to current environment
 */
export function generateEnvironmentTopics(
  context: EnvironmentContext | null
): string[] {
  if (!context) {
    return [];
  }

  const topics: string[] = [];
  const { scene, activity, objects } = context;

  // Scene-based topics
  switch (scene) {
    case 'office':
      topics.push('今天工作怎么样呀？', '需要休息一下吗？', '工作顺利吗？');
      break;

    case 'home':
      topics.push('在家感觉怎么样？', '有什么想聊的吗？', '今天过得如何？');
      break;

    case 'restaurant':
      topics.push('吃的什么呀？', '好吃吗？', '味道怎么样？');
      break;

    case 'outdoor':
      topics.push('天气怎么样？', '外面风景好吗？', '出去散步吗？');
      break;

    case 'nature':
      topics.push('风景很美吧？', '空气好吗？', '感觉怎么样？');
      break;

    case 'transport':
      topics.push('要去哪里呀？', '路上还顺利吗？', '旅途愉快吗？');
      break;
  }

  // Activity-based topics
  if (activity === 'eating') {
    const foodItems = objects.filter(obj =>
      ['pizza', 'sandwich', 'apple', 'banana', 'cake'].includes(obj.label)
    );
    if (foodItems.length > 0) {
      topics.push(`${foodItems[0].label}好吃吗？`);
    }
  }

  // Object-based topics
  if (objects.some(obj => obj.label === 'book')) {
    topics.push('在看什么书呀？');
  }

  if (objects.some(obj => obj.label === 'laptop' || obj.label === 'computer')) {
    topics.push('在忙什么呢？');
  }

  if (objects.some(obj => obj.label === 'tv')) {
    topics.push('在看什么节目？');
  }

  return topics.slice(0, 3); // Return max 3 topics
}

/**
 * Check if environment is suitable for proactive conversation
 *
 * Some environments (e.g., meetings, reading) should avoid interruptions
 */
export function isEnvironmentSuitableForProactive(
  context: EnvironmentContext | null
): boolean {
  if (!context) {
    return true; // Default to allowing proactive if no context
  }

  const { activity, scene } = context;

  // Activities that should not be interrupted
  const noInterruptActivities: string[] = ['reading', 'working'];

  // Scenes that should not be interrupted
  const noInterruptScenes: string[] = [];

  // Check if current activity or scene is in no-interrupt list
  if (noInterruptActivities.includes(activity)) {
    return false;
  }

  if (noInterruptScenes.includes(scene)) {
    return false;
  }

  return true;
}

/**
 * Get emotion-appropriate environment response
 *
 * Combines environment context with user emotion for better responses
 */
export function getEnvironmentEmotionResponse(
  context: EnvironmentContext | null,
  userEmotion: string
): string {
  if (!context) {
    return '';
  }

  const { activity, lighting, scene } = context;

  // Happy user in relaxing environment
  if (userEmotion === 'joy' && activity === 'relaxing') {
    return '看起来心情不错呢，继续享受放松的时光吧~';
  }

  // Sad user in dim lighting
  if (userEmotion === 'sadness' && (lighting === 'dim' || lighting === 'dark')) {
    return '要不要开灯让环境亮一点？可能会感觉好一些哦~';
  }

  // Tired user working
  if (['sadness', 'neutral'].includes(userEmotion) && activity === 'working') {
    return '工作辛苦了，记得适当休息一下哦~';
  }

  // Default: no specific suggestion
  return '';
}
