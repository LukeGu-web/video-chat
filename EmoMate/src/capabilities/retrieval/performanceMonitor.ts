/**
 * Performance Monitor - RAG性能监控
 * Track and report RAG system performance metrics
 */

import { RAGResult } from './ragPipeline';
import { debugLog } from '../../utils/debug';

// ============================================
// Types
// ============================================

export interface RAGPerformanceMetrics {
  // Timing metrics
  totalTimeMs: number;
  queryAnalysisTimeMs: number;
  retrievalTimeMs: number;
  contextBuildTimeMs: number;

  // Retrieval metrics
  totalItemsFound: number;
  objectsFound: number;
  conversationsFound: number;
  scenesFound: number;
  averageRelevance: number;

  // Context metrics
  contextLength: number;
  contextTokens: number;
  itemsIncluded: number;

  // Query metrics
  intent: string;
  keywordCount: number;
  hasTimeReference: boolean;
  hasEntities: boolean;
}

export interface PerformanceReport {
  metrics: RAGPerformanceMetrics;
  summary: string;
  recommendations: string[];
}

// ============================================
// Performance Tracking
// ============================================

const performanceHistory: RAGPerformanceMetrics[] = [];
const MAX_HISTORY_SIZE = 100;

/**
 * Record RAG performance metrics
 */
export function recordRAGPerformance(
  ragResult: RAGResult,
  timings: {
    queryAnalysisTimeMs?: number;
    retrievalTimeMs?: number;
    contextBuildTimeMs?: number;
    totalTimeMs: number;
  }
): RAGPerformanceMetrics {
  const metrics: RAGPerformanceMetrics = {
    // Timing
    totalTimeMs: timings.totalTimeMs,
    queryAnalysisTimeMs: timings.queryAnalysisTimeMs || 0,
    retrievalTimeMs: timings.retrievalTimeMs || ragResult.retrieval.metadata.searchTimeMs,
    contextBuildTimeMs: timings.contextBuildTimeMs || 0,

    // Retrieval
    totalItemsFound: ragResult.retrieval.metadata.totalFound,
    objectsFound: ragResult.retrieval.objects.length,
    conversationsFound: ragResult.retrieval.conversations.length,
    scenesFound: ragResult.retrieval.scenes.length,
    averageRelevance: ragResult.retrieval.metadata.averageRelevance || 0,

    // Context
    contextLength: ragResult.context.length,
    contextTokens: estimateTokens(ragResult.context),
    itemsIncluded:
      ragResult.retrieval.objects.length +
      ragResult.retrieval.conversations.length +
      ragResult.retrieval.scenes.length,

    // Query
    intent: ragResult.analysis.intent,
    keywordCount: ragResult.analysis.keywords.length,
    hasTimeReference: !!ragResult.analysis.timeReference,
    hasEntities: !!(ragResult.analysis.entities && ragResult.analysis.entities.length > 0),
  };

  // Add to history
  performanceHistory.push(metrics);
  if (performanceHistory.length > MAX_HISTORY_SIZE) {
    performanceHistory.shift(); // Remove oldest
  }

  // Log to console
  debugLog('RAG Performance', 'Metrics recorded', {
    totalTime: `${metrics.totalTimeMs}ms`,
    itemsFound: metrics.totalItemsFound,
    avgRelevance: `${(metrics.averageRelevance * 100).toFixed(1)}%`,
    contextTokens: metrics.contextTokens,
  });

  return metrics;
}

/**
 * Get performance statistics
 */
export function getPerformanceStats(): {
  totalQueries: number;
  avgTotalTime: number;
  avgRetrievalTime: number;
  avgItemsFound: number;
  avgRelevance: number;
  avgContextTokens: number;
} {
  if (performanceHistory.length === 0) {
    return {
      totalQueries: 0,
      avgTotalTime: 0,
      avgRetrievalTime: 0,
      avgItemsFound: 0,
      avgRelevance: 0,
      avgContextTokens: 0,
    };
  }

  const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
  const avg = (arr: number[]) => sum(arr) / arr.length;

  return {
    totalQueries: performanceHistory.length,
    avgTotalTime: avg(performanceHistory.map((m) => m.totalTimeMs)),
    avgRetrievalTime: avg(performanceHistory.map((m) => m.retrievalTimeMs)),
    avgItemsFound: avg(performanceHistory.map((m) => m.totalItemsFound)),
    avgRelevance: avg(performanceHistory.map((m) => m.averageRelevance)),
    avgContextTokens: avg(performanceHistory.map((m) => m.contextTokens)),
  };
}

/**
 * Generate performance report with recommendations
 */
export function generatePerformanceReport(
  metrics: RAGPerformanceMetrics
): PerformanceReport {
  const recommendations: string[] = [];

  // Performance recommendations
  if (metrics.totalTimeMs > 100) {
    recommendations.push('检索时间较长，考虑优化索引或缓存策略');
  }

  if (metrics.totalItemsFound === 0 && metrics.keywordCount > 0) {
    recommendations.push('未找到相关结果，建议调整关键词提取算法或降低相关度阈值');
  }

  if (metrics.averageRelevance < 0.3) {
    recommendations.push('平均相关度较低，建议优化评分算法或数据质量');
  }

  if (metrics.contextTokens > 450) {
    recommendations.push('上下文接近token限制，建议启用更激进的截断策略');
  }

  if (metrics.itemsIncluded === 0 && metrics.totalItemsFound > 0) {
    recommendations.push('找到结果但未包含在上下文中，检查截断逻辑');
  }

  // Query quality recommendations
  if (metrics.keywordCount === 0) {
    recommendations.push('未提取到关键词，检查查询分析器');
  }

  // Generate summary
  const summary = `
RAG性能报告:
- 总耗时: ${metrics.totalTimeMs}ms (查询分析: ${metrics.queryAnalysisTimeMs}ms, 检索: ${metrics.retrievalTimeMs}ms, 上下文构建: ${metrics.contextBuildTimeMs}ms)
- 检索结果: ${metrics.totalItemsFound}项 (物品: ${metrics.objectsFound}, 对话: ${metrics.conversationsFound}, 场景: ${metrics.scenesFound})
- 平均相关度: ${(metrics.averageRelevance * 100).toFixed(1)}%
- 上下文: ${metrics.contextLength}字符, 约${metrics.contextTokens} tokens
- 查询特征: ${metrics.intent}意图, ${metrics.keywordCount}个关键词, ${metrics.hasTimeReference ? '有' : '无'}时间引用, ${metrics.hasEntities ? '有' : '无'}实体
  `.trim();

  return {
    metrics,
    summary,
    recommendations,
  };
}

/**
 * Log performance report
 */
export function logPerformanceReport(report: PerformanceReport): void {
  console.log('\n' + '='.repeat(60));
  console.log(report.summary);

  if (report.recommendations.length > 0) {
    console.log('\n优化建议:');
    report.recommendations.forEach((rec, i) => {
      console.log(`  ${i + 1}. ${rec}`);
    });
  }

  console.log('='.repeat(60) + '\n');
}

/**
 * Clear performance history
 */
export function clearPerformanceHistory(): void {
  performanceHistory.length = 0;
  debugLog('RAG Performance', 'History cleared');
}

// ============================================
// Helper Functions
// ============================================

function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars / 4);
}
