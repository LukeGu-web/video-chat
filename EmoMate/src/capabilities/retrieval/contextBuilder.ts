/**
 * Context Builder - RAG上下文构建器
 * 将检索结果格式化为增强的提示词上下文
 * Phase 2: Enhanced with intelligent truncation and priority-based selection
 */

import { RetrievalResult } from './multiSourceRetriever';
import { formatRelativeTime } from '../../utils/dateUtils';

// ============================================
// Types
// ============================================

export interface ContextBuildOptions {
  maxTokens?: number; // Maximum context tokens (default: 500)
  prioritizeRecent?: boolean; // Prioritize more recent items (default: true)
  includeScoreBreakdown?: boolean; // Include score breakdown for debugging (default: false)
}

// ============================================
// Main Context Building Function
// ============================================

/**
 * Build retrieval-enhanced context from search results
 * Phase 2: Intelligent truncation with priority-based selection
 */
export function buildRetrievalContext(
  retrieval: RetrievalResult,
  options?: ContextBuildOptions
): string {
  const {
    maxTokens = 500,
    prioritizeRecent = true,
    includeScoreBreakdown = false,
  } = options || {};

  // Phase 2: Sort all items by relevance for intelligent selection
  interface ScoredItem {
    type: 'object' | 'conversation' | 'scene';
    relevance: number;
    content: string;
    tokens: number;
  }

  const allItems: ScoredItem[] = [];

  // Add objects
  for (const { record, relevance, scoreBreakdown } of retrieval.objects) {
    const content = buildObjectItem(record, relevance, scoreBreakdown, includeScoreBreakdown);
    allItems.push({
      type: 'object',
      relevance,
      content,
      tokens: estimateTokens(content),
    });
  }

  // Add conversations
  for (const { message, relevance, scoreBreakdown } of retrieval.conversations) {
    const content = buildConversationItem(message, relevance, scoreBreakdown, includeScoreBreakdown);
    allItems.push({
      type: 'conversation',
      relevance,
      content,
      tokens: estimateTokens(content),
    });
  }

  // Add scenes
  for (const { scene, relevance, scoreBreakdown } of retrieval.scenes) {
    const content = buildSceneItem(scene, relevance, scoreBreakdown, includeScoreBreakdown);
    allItems.push({
      type: 'scene',
      relevance,
      content,
      tokens: estimateTokens(content),
    });
  }

  if (allItems.length === 0) {
    return ''; // No relevant information found
  }

  // Sort by relevance (descending)
  allItems.sort((a, b) => b.relevance - a.relevance);

  // Intelligent truncation: select items that fit within token budget
  const selectedItems = intelligentTruncate(allItems, maxTokens);

  if (selectedItems.length === 0) {
    return '';
  }

  // Group by type for better organization
  const objectItems = selectedItems.filter((i) => i.type === 'object');
  const conversationItems = selectedItems.filter((i) => i.type === 'conversation');
  const sceneItems = selectedItems.filter((i) => i.type === 'scene');

  const sections: string[] = [];

  if (objectItems.length > 0) {
    sections.push(`## 识别过的物品\n\n${objectItems.map((i) => i.content).join('\n')}`);
  }

  if (conversationItems.length > 0) {
    sections.push(`## 相关对话\n\n${conversationItems.map((i) => i.content).join('\n')}`);
  }

  if (sceneItems.length > 0) {
    sections.push(`## 场景记录\n\n${sceneItems.map((i) => i.content).join('\n')}`);
  }

  return `# 相关记忆

${sections.join('\n\n')}

---
根据上述记忆信息回答用户的问题。`;
}

// ============================================
// Intelligent Truncation
// ============================================

/**
 * Intelligent truncation: select items that fit within token budget
 * Uses greedy approach prioritizing high-relevance items
 */
function intelligentTruncate<T extends { tokens: number; relevance: number }>(
  items: T[],
  maxTokens: number
): T[] {
  const headerTokens = estimateTokens('# 相关记忆\n\n## 识别过的物品\n\n---\n根据上述记忆信息回答用户的问题。');
  const availableTokens = maxTokens - headerTokens - 50; // Reserve 50 tokens for safety

  const selected: T[] = [];
  let usedTokens = 0;

  // Greedy selection: take highest relevance items that fit
  for (const item of items) {
    if (usedTokens + item.tokens <= availableTokens) {
      selected.push(item);
      usedTokens += item.tokens;
    } else {
      // Try to fit a smaller version by truncating content
      // For now, skip if doesn't fit
      continue;
    }
  }

  return selected;
}

// ============================================
// Item Builders
// ============================================

/**
 * Build individual object item
 */
function buildObjectItem(
  record: any,
  relevance: number,
  scoreBreakdown: any,
  includeScoreBreakdown: boolean
): string {
  const timeAgo = formatRelativeTime(record.createdAt);
  const description = record.data.description.substring(0, 100);
  const truncated = record.data.description.length > 100 ? '...' : '';

  let item = `- **${record.data.objectName}** (${record.data.category}) - ${timeAgo}识别
  - 描述: ${description}${truncated}`;

  if (includeScoreBreakdown && scoreBreakdown) {
    item += `
  - 相关度: ${(relevance * 100).toFixed(0)}% (时间:${(scoreBreakdown.timeMatch * 100).toFixed(0)}% 关键词:${(scoreBreakdown.keywordMatch * 100).toFixed(0)}% 实体:${(scoreBreakdown.entityMatch * 100).toFixed(0)}%)`;
  }

  return item;
}

/**
 * Build individual conversation item
 */
function buildConversationItem(
  message: any,
  relevance: number,
  scoreBreakdown: any,
  includeScoreBreakdown: boolean
): string {
  const timeAgo = formatRelativeTime(message.timestamp);
  const speaker = message.role === 'user' ? '用户' : '你';
  const content = message.content.substring(0, 80);
  const truncated = message.content.length > 80 ? '...' : '';

  let item = `- ${speaker}: "${content}${truncated}" (${timeAgo})`;

  if (includeScoreBreakdown && scoreBreakdown) {
    item += ` [相关度: ${(relevance * 100).toFixed(0)}%]`;
  }

  return item;
}

/**
 * Build individual scene item
 */
function buildSceneItem(
  scene: any,
  relevance: number,
  scoreBreakdown: any,
  includeScoreBreakdown: boolean
): string {
  const timeAgo = formatRelativeTime(scene.cachedAt);
  const objects = scene.scene.objects.slice(0, 3).join('、');

  let item = `- **${scene.scene.location}** - ${timeAgo}
  - 周围物品: ${objects}`;

  if (includeScoreBreakdown && scoreBreakdown) {
    item += `
  - 相关度: ${(relevance * 100).toFixed(0)}%`;
  }

  return item;
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
