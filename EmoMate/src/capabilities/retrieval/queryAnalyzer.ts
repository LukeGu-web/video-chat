/**
 * Query Analyzer - RAG查询分析器
 * 从用户查询中提取关键信息用于检索
 */

import { getDateRange } from '../../utils/dateUtils';

// ============================================
// Types
// ============================================

export interface QueryAnalysis {
  // Time reference information
  timeReference?: {
    type: 'absolute' | 'relative';
    value: Date | string; // Date object or "昨天"、"上周" etc.
    range?: {
      start: Date;
      end: Date;
    };
  };

  // Keywords extracted from query
  keywords: string[];

  // Entity recognition results
  entities?: Array<{
    type: 'book' | 'movie' | 'person' | 'place' | 'object';
    value: string;
  }>;

  // Intent classification
  intent: 'recall' | 'search' | 'general';
}

// ============================================
// Main Analyzer Function
// ============================================

/**
 * Analyze user query and extract key information for retrieval
 */
export function analyzeQuery(query: string): QueryAnalysis {
  const analysis: QueryAnalysis = {
    keywords: [],
    intent: 'general',
  };

  const lowerQuery = query.toLowerCase();

  // 1. Detect recall intent
  const recallKeywords = [
    '还记得',
    '记得',
    '之前',
    '上次',
    '那个',
    '那本',
    '那部',
    '那天',
    '讨论',
    '聊过',
    '说过',
    '看过',
    '识别',
  ];
  if (recallKeywords.some((keyword) => lowerQuery.includes(keyword))) {
    analysis.intent = 'recall';
  }

  // 2. Extract time reference
  analysis.timeReference = extractTimeReference(query);

  // 3. Extract keywords (remove stop words)
  analysis.keywords = extractKeywords(query);

  // 4. Entity recognition
  analysis.entities = extractEntities(query);

  return analysis;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Extract time reference from query (reuses dateUtils.ts getDateRange function)
 */
function extractTimeReference(query: string): QueryAnalysis['timeReference'] {
  const lowerQuery = query.toLowerCase();

  // Supported time expressions
  const timeExpressions = [
    '今天',
    '今日',
    '昨天',
    '昨日',
    '前天',
    '这周',
    '本周',
    '上周',
    '上星期',
    '这个月',
    '本月',
    '上个月',
    '上月',
  ];

  for (const expression of timeExpressions) {
    if (lowerQuery.includes(expression)) {
      // Use existing getDateRange function from dateUtils.ts
      const range = getDateRange(expression);
      if (range) {
        return {
          type: 'relative',
          value: expression,
          range,
        };
      }
    }
  }

  return undefined;
}

/**
 * Extract keywords from query (remove Chinese stop words)
 */
function extractKeywords(query: string): string[] {
  // Chinese stop words
  const stopWords = [
    '的',
    '了',
    '在',
    '是',
    '我',
    '你',
    '他',
    '她',
    '它',
    '这',
    '那',
    '和',
    '与',
    '及',
    '或',
    '也',
    '都',
    '吗',
    '呢',
    '吧',
    '啊',
    '呀',
    '嘛',
    '哦',
    '唉',
  ];

  // Simple word segmentation (can use more sophisticated tokenizer)
  const words = query
    .split(/[\s，。！？、；：""''（）【】《》\n]+/)
    .filter((word) => word.length > 0)
    .filter((word) => !stopWords.includes(word));

  return words;
}

/**
 * Entity recognition from query
 */
function extractEntities(query: string): QueryAnalysis['entities'] {
  const entities: QueryAnalysis['entities'] = [];
  const lowerQuery = query.toLowerCase();

  // Object type detection
  const objectTypes = [
    {
      type: 'book' as const,
      keywords: ['书', '书籍', '小说', '读物', '作品'],
    },
    {
      type: 'movie' as const,
      keywords: ['电影', '影片', '片子', '视频'],
    },
    {
      type: 'object' as const,
      keywords: ['东西', '物品', '物体'],
    },
  ];

  for (const { type, keywords } of objectTypes) {
    if (keywords.some((keyword) => lowerQuery.includes(keyword))) {
      entities.push({ type, value: keywords[0] });
    }
  }

  return entities;
}
