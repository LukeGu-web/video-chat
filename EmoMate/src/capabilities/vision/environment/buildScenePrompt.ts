/**
 * Build scene context prompt for AI conversation
 *
 * Converts scene understanding data into natural language prompts
 * that enhance AI's contextual awareness of user's visual environment
 */

import { SceneData } from '../../../types/scene';

/**
 * Generate scene-aware AI prompt from SceneData
 * Supports both Chinese and English output
 *
 * @param sceneData - Current scene data from Claude Vision analysis
 * @param includeDetails - Whether to include detailed object information (default: true)
 * @param maxObjects - Maximum number of objects to include (default: 5)
 * @param language - Language for the prompt ('zh' or 'en')
 * @returns Formatted prompt string for AI system message
 */
export function buildScenePrompt(
  sceneData: SceneData | null,
  includeDetails: boolean = true,
  maxObjects: number = 5,
  language: 'zh' | 'en' = 'zh'
): string {
  if (!sceneData) {
    return '';
  }

  const parts: string[] = [];

  // 1. Location/Scene Type
  if (sceneData.location) {
    parts.push(
      language === 'en'
        ? `\n\n【User's Visual Environment】`
        : `\n\n【用户视觉环境】`
    );
    parts.push(
      language === 'en'
        ? `\nLocation: ${sceneData.location}`
        : `\n位置: ${sceneData.location}`
    );
  }

  // 2. Detected Objects
  if (sceneData.objects.length > 0) {
    const separator = language === 'en' ? ', ' : '、';
    const topObjects = sceneData.objects
      .slice(0, maxObjects)
      .join(separator);
    parts.push(
      language === 'en'
        ? `\nNearby objects: ${topObjects}`
        : `\n周围物品: ${topObjects}`
    );
  }

  // 3. Atmosphere and Lighting
  if (sceneData.atmosphere) {
    parts.push(
      language === 'en'
        ? `\nAtmosphere: ${sceneData.atmosphere}`
        : `\n氛围: ${sceneData.atmosphere}`
    );
  }

  if (sceneData.lighting) {
    parts.push(
      language === 'en'
        ? `\nLighting: ${sceneData.lighting}`
        : `\n光线: ${sceneData.lighting}`
    );
  }

  // 4. Detailed Information (if enabled)
  if (includeDetails && sceneData.details) {
    const detailParts: string[] = [];

    // Book information
    if (sceneData.details.bookTitle) {
      const bookInfo = sceneData.details.bookAuthor
        ? language === 'en'
          ? `"${sceneData.details.bookTitle}" (author: ${sceneData.details.bookAuthor})`
          : `《${sceneData.details.bookTitle}》(作者: ${sceneData.details.bookAuthor})`
        : language === 'en'
        ? `"${sceneData.details.bookTitle}"`
        : `《${sceneData.details.bookTitle}》`;
      detailParts.push(
        language === 'en' ? `Book: ${bookInfo}` : `书籍: ${bookInfo}`
      );
    }

    // Food/Beverage
    if (sceneData.details.foodType || sceneData.details.beverageType) {
      const items = [
        sceneData.details.foodType,
        sceneData.details.beverageType,
      ].filter(Boolean);
      const separator = language === 'en' ? ', ' : '、';
      detailParts.push(
        language === 'en'
          ? `Food/Beverage: ${items.join(separator)}`
          : `食物/饮品: ${items.join(separator)}`
      );
    }

    // Technology
    if (sceneData.details.computerType) {
      detailParts.push(
        language === 'en'
          ? `Device: ${sceneData.details.computerType}`
          : `设备: ${sceneData.details.computerType}`
      );
    }

    // Time of day
    if (sceneData.details.timeOfDay) {
      detailParts.push(
        language === 'en'
          ? `Time: ${sceneData.details.timeOfDay}`
          : `时间: ${sceneData.details.timeOfDay}`
      );
    }

    // Add details to prompt if any exist
    if (detailParts.length > 0) {
      parts.push(
        language === 'en'
          ? `\nDetails: ${detailParts.join('; ')}`
          : `\n详细信息: ${detailParts.join('; ')}`
      );
    }
  }

  // 5. Add confidence note if low
  if (sceneData.confidence < 0.7) {
    parts.push(
      language === 'en'
        ? `\n(Note: Scene recognition confidence is low, may not be entirely accurate)`
        : `\n(注: 场景识别置信度较低,可能不完全准确)`
    );
  }

  // 6. Contextual hints for AI behavior
  const behaviorHint = getSceneBehaviorHint(sceneData, language);
  if (behaviorHint) {
    parts.push(
      language === 'en'
        ? `\n\n【Conversation Suggestions】${behaviorHint}`
        : `\n\n【对话建议】${behaviorHint}`
    );
  }

  return parts.join('');
}

/**
 * Generate behavior hints based on scene context
 * Provides guidance on how AI should respond based on detected scene
 * Supports both Chinese and English hints
 */
function getSceneBehaviorHint(
  sceneData: SceneData,
  language: 'zh' | 'en' = 'zh'
): string {
  const { location, objects, details, atmosphere } = sceneData;
  const hints: string[] = [];

  // Study/Reading environment
  if (
    location.includes('图书馆') ||
    location.includes('书房') ||
    location.toLowerCase().includes('library') ||
    location.toLowerCase().includes('study') ||
    details.bookTitle ||
    objects.some(obj => obj.includes('书') || obj.toLowerCase().includes('book'))
  ) {
    hints.push(
      language === 'en'
        ? 'User may be studying, can show interest in their studies or provide encouragement'
        : '用户可能在学习,可以关心学习内容或提供鼓励'
    );
  }

  // Cafe/Restaurant
  if (
    location.includes('咖啡') ||
    location.includes('餐厅') ||
    location.toLowerCase().includes('cafe') ||
    location.toLowerCase().includes('restaurant') ||
    details.foodType ||
    details.beverageType
  ) {
    hints.push(
      language === 'en'
        ? 'User is dining or relaxing, can chat about casual topics'
        : '用户在用餐或休闲,可以聊聊轻松的话题'
    );
  }

  // Office/Working
  if (
    location.includes('办公') ||
    location.includes('工作室') ||
    location.toLowerCase().includes('office') ||
    location.toLowerCase().includes('workspace') ||
    details.computerType ||
    atmosphere.includes('专业') ||
    atmosphere.includes('工作') ||
    atmosphere.toLowerCase().includes('professional') ||
    atmosphere.toLowerCase().includes('work')
  ) {
    hints.push(
      language === 'en'
        ? 'User may be working, avoid too much distraction, can show care about work progress'
        : '用户可能在工作,注意不要打扰太多,适当关心工作进展'
    );
  }

  // Outdoor/Nature
  if (
    location.includes('户外') ||
    location.includes('公园') ||
    location.includes('自然') ||
    location.toLowerCase().includes('outdoor') ||
    location.toLowerCase().includes('park') ||
    location.toLowerCase().includes('nature') ||
    details.indoorOutdoor === 'outdoor'
  ) {
    hints.push(
      language === 'en'
        ? 'User is outdoors, can chat about weather, scenery or mood'
        : '用户在户外,可以聊聊天气、风景或心情'
    );
  }

  // Home/Relaxing
  if (
    location.includes('家') ||
    location.includes('卧室') ||
    location.includes('客厅') ||
    location.toLowerCase().includes('home') ||
    location.toLowerCase().includes('bedroom') ||
    location.toLowerCase().includes('living room') ||
    atmosphere.includes('放松') ||
    atmosphere.includes('舒适') ||
    atmosphere.toLowerCase().includes('relaxing') ||
    atmosphere.toLowerCase().includes('comfortable')
  ) {
    hints.push(
      language === 'en'
        ? 'User is relaxing at home, maintain a casual and pleasant atmosphere'
        : '用户在家中放松,保持轻松愉快的交流氛围'
    );
  }

  return hints.join('; ');
}

/**
 * Get timestamp freshness description
 * Describes how recent the scene analysis is
 * Supports both Chinese and English
 */
function getSceneFreshnessDescription(
  timestamp: number,
  language: 'zh' | 'en' = 'zh'
): string {
  const ageMinutes = Math.floor((Date.now() - timestamp) / (1000 * 60));

  if (ageMinutes < 1) {
    return language === 'en' ? 'just now' : '刚刚';
  } else if (ageMinutes < 5) {
    return language === 'en'
      ? `${ageMinutes} min ago`
      : `${ageMinutes}分钟前`;
  } else if (ageMinutes < 30) {
    return language === 'en' ? 'recently' : '最近';
  } else {
    return language === 'en' ? 'earlier' : '较早前';
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
 * Supports both Chinese and English
 * @param sceneData - Scene data to summarize
 * @param language - Language for the summary ('zh' or 'en')
 * @returns Brief one-line summary
 */
export function getSceneSummary(
  sceneData: SceneData | null,
  language: 'zh' | 'en' = 'zh'
): string {
  if (!sceneData) {
    return language === 'en' ? 'No scene detected' : '未检测到场景';
  }

  const parts: string[] = [];

  if (sceneData.location) {
    parts.push(sceneData.location);
  }

  if (sceneData.objects.length > 0) {
    const separator = language === 'en' ? ', ' : '、';
    parts.push(`(${sceneData.objects.slice(0, 3).join(separator)})`);
  }

  const freshness = getSceneFreshnessDescription(sceneData.timestamp, language);
  parts.push(`[${freshness}]`);

  return parts.join(' ');
}
