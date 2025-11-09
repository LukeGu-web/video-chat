/**
 * Build scene context prompt for AI conversation
 *
 * Converts scene understanding data into natural language prompts
 * that enhance AI's contextual awareness of user's visual environment
 */

import { SceneData } from '../types/scene';

/**
 * Generate scene-aware AI prompt from SceneData
 *
 * @param sceneData - Current scene data from Claude Vision analysis
 * @param includeDetails - Whether to include detailed object information (default: true)
 * @param maxObjects - Maximum number of objects to include (default: 5)
 * @returns Formatted prompt string for AI system message
 */
export function buildScenePrompt(
  sceneData: SceneData | null,
  includeDetails: boolean = true,
  maxObjects: number = 5
): string {
  if (!sceneData) {
    return '';
  }

  const parts: string[] = [];

  // 1. Location/Scene Type
  if (sceneData.location) {
    parts.push(`\n\n【用户视觉环境】`);
    parts.push(`\n位置: ${sceneData.location}`);
  }

  // 2. Detected Objects
  if (sceneData.objects.length > 0) {
    const topObjects = sceneData.objects
      .slice(0, maxObjects)
      .join('、');
    parts.push(`\n周围物品: ${topObjects}`);
  }

  // 3. Atmosphere and Lighting
  if (sceneData.atmosphere) {
    parts.push(`\n氛围: ${sceneData.atmosphere}`);
  }

  if (sceneData.lighting) {
    parts.push(`\n光线: ${sceneData.lighting}`);
  }

  // 4. Detailed Information (if enabled)
  if (includeDetails && sceneData.details) {
    const detailParts: string[] = [];

    // Book information
    if (sceneData.details.bookTitle) {
      const bookInfo = sceneData.details.bookAuthor
        ? `《${sceneData.details.bookTitle}》(作者: ${sceneData.details.bookAuthor})`
        : `《${sceneData.details.bookTitle}》`;
      detailParts.push(`书籍: ${bookInfo}`);
    }

    // Food/Beverage
    if (sceneData.details.foodType || sceneData.details.beverageType) {
      const items = [
        sceneData.details.foodType,
        sceneData.details.beverageType,
      ].filter(Boolean);
      detailParts.push(`食物/饮品: ${items.join('、')}`);
    }

    // Technology
    if (sceneData.details.computerType) {
      detailParts.push(`设备: ${sceneData.details.computerType}`);
    }

    // Time of day
    if (sceneData.details.timeOfDay) {
      detailParts.push(`时间: ${sceneData.details.timeOfDay}`);
    }

    // Add details to prompt if any exist
    if (detailParts.length > 0) {
      parts.push(`\n详细信息: ${detailParts.join('; ')}`);
    }
  }

  // 5. Add confidence note if low
  if (sceneData.confidence < 0.7) {
    parts.push(`\n(注: 场景识别置信度较低,可能不完全准确)`);
  }

  // 6. Contextual hints for AI behavior
  const behaviorHint = getSceneBehaviorHint(sceneData);
  if (behaviorHint) {
    parts.push(`\n\n【对话建议】${behaviorHint}`);
  }

  return parts.join('');
}

/**
 * Generate behavior hints based on scene context
 * Provides guidance on how AI should respond based on detected scene
 */
function getSceneBehaviorHint(sceneData: SceneData): string {
  const { location, objects, details, atmosphere } = sceneData;
  const hints: string[] = [];

  // Study/Reading environment
  if (
    location.includes('图书馆') ||
    location.includes('书房') ||
    details.bookTitle ||
    objects.some(obj => obj.includes('书'))
  ) {
    hints.push('用户可能在学习,可以关心学习内容或提供鼓励');
  }

  // Cafe/Restaurant
  if (
    location.includes('咖啡') ||
    location.includes('餐厅') ||
    details.foodType ||
    details.beverageType
  ) {
    hints.push('用户在用餐或休闲,可以聊聊轻松的话题');
  }

  // Office/Working
  if (
    location.includes('办公') ||
    location.includes('工作室') ||
    details.computerType ||
    atmosphere.includes('专业') ||
    atmosphere.includes('工作')
  ) {
    hints.push('用户可能在工作,注意不要打扰太多,适当关心工作进展');
  }

  // Outdoor/Nature
  if (
    location.includes('户外') ||
    location.includes('公园') ||
    location.includes('自然') ||
    details.indoorOutdoor === 'outdoor'
  ) {
    hints.push('用户在户外,可以聊聊天气、风景或心情');
  }

  // Home/Relaxing
  if (
    location.includes('家') ||
    location.includes('卧室') ||
    location.includes('客厅') ||
    atmosphere.includes('放松') ||
    atmosphere.includes('舒适')
  ) {
    hints.push('用户在家中放松,保持轻松愉快的交流氛围');
  }

  return hints.join('; ');
}

/**
 * Get timestamp freshness description
 * Describes how recent the scene analysis is
 */
function getSceneFreshnessDescription(timestamp: number): string {
  const ageMinutes = Math.floor((Date.now() - timestamp) / (1000 * 60));

  if (ageMinutes < 1) {
    return '刚刚';
  } else if (ageMinutes < 5) {
    return `${ageMinutes}分钟前`;
  } else if (ageMinutes < 30) {
    return '最近';
  } else {
    return '较早前';
  }
}

/**
 * Check if scene data is too old to be relevant
 * @param sceneData - Scene data to check
 * @param maxAgeMinutes - Maximum age in minutes (default: 30)
 * @returns true if scene data is still fresh enough to use
 */
export function isSceneDataFresh(
  sceneData: SceneData | null,
  maxAgeMinutes: number = 30
): boolean {
  if (!sceneData || !sceneData.timestamp) {
    return false;
  }

  const ageMinutes = (Date.now() - sceneData.timestamp) / (1000 * 60);
  return ageMinutes <= maxAgeMinutes;
}

/**
 * Get a brief scene summary for display
 * @param sceneData - Scene data to summarize
 * @returns Brief one-line summary
 */
export function getSceneSummary(sceneData: SceneData | null): string {
  if (!sceneData) {
    return '未检测到场景';
  }

  const parts: string[] = [];

  if (sceneData.location) {
    parts.push(sceneData.location);
  }

  if (sceneData.objects.length > 0) {
    parts.push(`(${sceneData.objects.slice(0, 3).join('、')})`);
  }

  const freshness = getSceneFreshnessDescription(sceneData.timestamp);
  parts.push(`[${freshness}]`);

  return parts.join(' ');
}
