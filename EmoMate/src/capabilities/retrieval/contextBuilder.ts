/**
 * Context Builder - RAG上下文构建器
 * 将检索结果格式化为增强的提示词上下文
 */

import { RetrievalResult } from './multiSourceRetriever';
import { formatRelativeTime } from '../../utils/dateUtils';

// ============================================
// Main Context Building Function
// ============================================

/**
 * Build retrieval-enhanced context from search results
 */
export function buildRetrievalContext(
  retrieval: RetrievalResult,
  maxTokens: number = 500
): string {
  const sections: string[] = [];

  // 1. Object recognition records
  if (retrieval.objects.length > 0) {
    const objectSection = buildObjectSection(retrieval.objects);
    sections.push(objectSection);
  }

  // 2. Related conversations
  if (retrieval.conversations.length > 0) {
    const conversationSection = buildConversationSection(
      retrieval.conversations
    );
    sections.push(conversationSection);
  }

  // 3. Scene records
  if (retrieval.scenes.length > 0) {
    const sceneSection = buildSceneSection(retrieval.scenes);
    sections.push(sceneSection);
  }

  if (sections.length === 0) {
    return ''; // No relevant information found
  }

  const fullContext = `# 相关记忆

${sections.join('\n\n')}

---
根据上述记忆信息回答用户的问题。`;

  // Truncate if exceeding token limit
  if (estimateTokens(fullContext) > maxTokens) {
    return truncateContext(fullContext, maxTokens);
  }

  return fullContext;
}

// ============================================
// Section Builders
// ============================================

/**
 * Build object recognition section
 */
function buildObjectSection(
  objects: RetrievalResult['objects']
): string {
  const items = objects
    .map(({ record, relevance }) => {
      const timeAgo = formatRelativeTime(record.createdAt);
      const description = record.data.description.substring(0, 100);
      const truncated = record.data.description.length > 100 ? '...' : '';
      return `- **${record.data.objectName}** (${record.data.category}) - ${timeAgo}识别
  - 描述: ${description}${truncated}
  - 相关度: ${(relevance * 100).toFixed(0)}%`;
    })
    .join('\n');

  return `## 识别过的物品\n\n${items}`;
}

/**
 * Build conversation section
 */
function buildConversationSection(
  conversations: RetrievalResult['conversations']
): string {
  const items = conversations
    .map(({ message, relevance }) => {
      const timeAgo = formatRelativeTime(message.timestamp);
      const speaker = message.role === 'user' ? '用户' : '你';
      const content = message.content.substring(0, 80);
      const truncated = message.content.length > 80 ? '...' : '';
      return `- ${speaker}: "${content}${truncated}" (${timeAgo})`;
    })
    .join('\n');

  return `## 相关对话\n\n${items}`;
}

/**
 * Build scene section
 */
function buildSceneSection(scenes: RetrievalResult['scenes']): string {
  const items = scenes
    .map(({ scene, relevance }) => {
      const timeAgo = formatRelativeTime(scene.cachedAt);
      const objects = scene.scene.objects
        .slice(0, 3)
        .join('、');
      return `- **${scene.scene.location}** - ${timeAgo}
  - 周围物品: ${objects}`;
    })
    .join('\n');

  return `## 场景记录\n\n${items}`;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Estimate token count (rough estimation: 1 Chinese character ≈ 1.5 tokens)
 */
function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars / 4);
}

/**
 * Truncate context to specified token limit
 */
function truncateContext(context: string, maxTokens: number): string {
  const sections = context.split('\n\n');
  let result = '# 相关记忆\n\n';
  let currentTokens = estimateTokens(result);

  for (const section of sections) {
    const sectionTokens = estimateTokens(section);
    if (currentTokens + sectionTokens > maxTokens - 20) {
      break;
    }
    result += section + '\n\n';
    currentTokens += sectionTokens;
  }

  return result + '\n---\n根据上述记忆信息回答用户的问题。';
}
