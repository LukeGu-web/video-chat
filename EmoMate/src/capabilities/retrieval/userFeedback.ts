/**
 * User Feedback System - RAG用户反馈机制
 * Phase 3: Collect and learn from user feedback to improve retrieval quality
 */

import { createMMKV } from 'react-native-mmkv';
import { debugLog } from '../../utils/debug';

// ============================================
// MMKV Storage
// ============================================

const feedbackStorage = createMMKV({
  id: 'rag-feedback-storage',
  encryptionKey: 'rag-feedback-key',
});

const STORAGE_KEYS = {
  FEEDBACK_HISTORY: 'feedback_history',
  FEEDBACK_STATS: 'feedback_stats',
} as const;

// ============================================
// Types
// ============================================

export interface RetrievalFeedback {
  id: string; // Unique feedback ID
  queryText: string; // Original query
  timestamp: number; // When feedback was given
  rating: 'helpful' | 'not_helpful' | 'neutral'; // User rating
  retrievalMetadata: {
    totalFound: number;
    averageRelevance: number;
    sourcesUsed: string[];
    contextLength: number;
  };
  userComment?: string; // Optional user comment
}

export interface FeedbackStats {
  totalFeedbacks: number;
  helpfulCount: number;
  notHelpfulCount: number;
  neutralCount: number;
  averageRelevanceWhenHelpful: number;
  averageRelevanceWhenNotHelpful: number;
  lastUpdated: number;
}

// ============================================
// Feedback Collection
// ============================================

/**
 * Submit user feedback for a RAG retrieval
 */
export function submitFeedback(feedback: Omit<RetrievalFeedback, 'id' | 'timestamp'>): RetrievalFeedback {
  const completeFeedback: RetrievalFeedback = {
    ...feedback,
    id: `feedback_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
  };

  // Save to storage
  saveFeedback(completeFeedback);

  // Update stats
  updateFeedbackStats(completeFeedback);

  debugLog('UserFeedback', 'Feedback submitted', {
    rating: completeFeedback.rating,
    query: completeFeedback.queryText.substring(0, 30),
  });

  return completeFeedback;
}

/**
 * Get all feedback history
 */
export function getFeedbackHistory(): RetrievalFeedback[] {
  try {
    const historyJson = feedbackStorage.getString(STORAGE_KEYS.FEEDBACK_HISTORY);
    if (historyJson) {
      return JSON.parse(historyJson);
    }
    return [];
  } catch (error) {
    debugLog('UserFeedback', 'Failed to load history', error);
    return [];
  }
}

/**
 * Get feedback statistics
 */
export function getFeedbackStats(): FeedbackStats {
  try {
    const statsJson = feedbackStorage.getString(STORAGE_KEYS.FEEDBACK_STATS);
    if (statsJson) {
      return JSON.parse(statsJson);
    }
    return getDefaultStats();
  } catch (error) {
    debugLog('UserFeedback', 'Failed to load stats', error);
    return getDefaultStats();
  }
}

/**
 * Clear all feedback data
 */
export function clearFeedbackData(): void {
  feedbackStorage.remove(STORAGE_KEYS.FEEDBACK_HISTORY);
  feedbackStorage.remove(STORAGE_KEYS.FEEDBACK_STATS);
  debugLog('UserFeedback', 'Cleared all feedback data');
}

// ============================================
// Feedback Analysis
// ============================================

/**
 * Analyze feedback to suggest optimal relevance threshold
 */
export function suggestOptimalThreshold(): {
  suggestedThreshold: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning: string;
} {
  const stats = getFeedbackStats();
  const history = getFeedbackHistory();

  // Need at least 10 feedbacks for meaningful suggestion
  if (stats.totalFeedbacks < 10) {
    return {
      suggestedThreshold: 0.3,
      confidence: 'low',
      reasoning: '反馈数据不足（少于10条），使用默认阈值0.3',
    };
  }

  // Calculate average relevance for helpful vs not helpful
  const { averageRelevanceWhenHelpful, averageRelevanceWhenNotHelpful } = stats;

  // Find optimal threshold between the two averages
  const suggestedThreshold = (averageRelevanceWhenHelpful + averageRelevanceWhenNotHelpful) / 2;

  // Determine confidence based on sample size and separation
  const separation = averageRelevanceWhenHelpful - averageRelevanceWhenNotHelpful;
  let confidence: 'low' | 'medium' | 'high' = 'low';

  if (stats.totalFeedbacks >= 50 && separation > 0.2) {
    confidence = 'high';
  } else if (stats.totalFeedbacks >= 20 && separation > 0.1) {
    confidence = 'medium';
  }

  return {
    suggestedThreshold: Math.max(0.1, Math.min(0.8, suggestedThreshold)), // Clamp to [0.1, 0.8]
    confidence,
    reasoning: `基于${stats.totalFeedbacks}条反馈，有用结果平均相关度${(averageRelevanceWhenHelpful * 100).toFixed(1)}%，无用结果${(averageRelevanceWhenNotHelpful * 100).toFixed(1)}%`,
  };
}

/**
 * Get feedback insights for specific query patterns
 */
export function getFeedbackInsights(): {
  overallSatisfaction: number; // 0-1 score
  commonIssues: string[];
  recommendations: string[];
} {
  const stats = getFeedbackStats();
  const history = getFeedbackHistory();

  // Calculate overall satisfaction
  const overallSatisfaction =
    stats.totalFeedbacks > 0
      ? (stats.helpfulCount + stats.neutralCount * 0.5) / stats.totalFeedbacks
      : 0.5;

  const commonIssues: string[] = [];
  const recommendations: string[] = [];

  // Analyze common issues
  if (stats.notHelpfulCount / stats.totalFeedbacks > 0.3) {
    commonIssues.push('超过30%的检索结果被标记为无用');
    recommendations.push('考虑提高相关度阈值或优化评分算法');
  }

  if (stats.averageRelevanceWhenNotHelpful > 0.4) {
    commonIssues.push('即使相关度较高，用户仍不满意');
    recommendations.push('检查评分算法是否准确反映用户需求');
  }

  // Check for low relevance when helpful
  if (stats.averageRelevanceWhenHelpful < 0.5 && stats.helpfulCount > 5) {
    recommendations.push('有用的结果相关度偏低，可以降低阈值以包含更多结果');
  }

  // Check data freshness
  const recentFeedbacks = history.filter(
    (f) => Date.now() - f.timestamp < 7 * 24 * 60 * 60 * 1000
  );
  if (recentFeedbacks.length < 5) {
    commonIssues.push('最近7天反馈较少');
    recommendations.push('鼓励用户提供更多反馈以持续优化');
  }

  return {
    overallSatisfaction,
    commonIssues,
    recommendations,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Save feedback to storage
 */
function saveFeedback(feedback: RetrievalFeedback): void {
  try {
    const history = getFeedbackHistory();
    history.push(feedback);

    // Keep only last 200 feedbacks
    const MAX_HISTORY = 200;
    if (history.length > MAX_HISTORY) {
      history.splice(0, history.length - MAX_HISTORY);
    }

    feedbackStorage.set(STORAGE_KEYS.FEEDBACK_HISTORY, JSON.stringify(history));
  } catch (error) {
    debugLog('UserFeedback', 'Failed to save feedback', error);
  }
}

/**
 * Update feedback statistics
 */
function updateFeedbackStats(feedback: RetrievalFeedback): void {
  try {
    const stats = getFeedbackStats();

    // Update counts
    stats.totalFeedbacks++;
    if (feedback.rating === 'helpful') {
      stats.helpfulCount++;
    } else if (feedback.rating === 'not_helpful') {
      stats.notHelpfulCount++;
    } else {
      stats.neutralCount++;
    }

    // Update average relevance
    const history = getFeedbackHistory();
    const helpfulFeedbacks = history.filter((f) => f.rating === 'helpful');
    const notHelpfulFeedbacks = history.filter((f) => f.rating === 'not_helpful');

    stats.averageRelevanceWhenHelpful =
      helpfulFeedbacks.length > 0
        ? helpfulFeedbacks.reduce(
            (sum, f) => sum + f.retrievalMetadata.averageRelevance,
            0
          ) / helpfulFeedbacks.length
        : 0;

    stats.averageRelevanceWhenNotHelpful =
      notHelpfulFeedbacks.length > 0
        ? notHelpfulFeedbacks.reduce(
            (sum, f) => sum + f.retrievalMetadata.averageRelevance,
            0
          ) / notHelpfulFeedbacks.length
        : 0;

    stats.lastUpdated = Date.now();

    feedbackStorage.set(STORAGE_KEYS.FEEDBACK_STATS, JSON.stringify(stats));
  } catch (error) {
    debugLog('UserFeedback', 'Failed to update stats', error);
  }
}

/**
 * Get default stats
 */
function getDefaultStats(): FeedbackStats {
  return {
    totalFeedbacks: 0,
    helpfulCount: 0,
    notHelpfulCount: 0,
    neutralCount: 0,
    averageRelevanceWhenHelpful: 0,
    averageRelevanceWhenNotHelpful: 0,
    lastUpdated: Date.now(),
  };
}

// ============================================
// Feedback Prompt System
// ============================================

/**
 * Determine if we should ask user for feedback
 * Use sampling strategy to avoid overwhelming users
 */
export function shouldRequestFeedback(retrievalTriggered: boolean): boolean {
  if (!retrievalTriggered) {
    return false; // No retrieval, no feedback needed
  }

  // Sample 20% of queries
  return Math.random() < 0.2;
}

/**
 * Generate feedback prompt message
 */
export function getFeedbackPrompt(): string {
  return '这个回答对你有帮助吗？（有用/无用）';
}
