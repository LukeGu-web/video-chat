/**
 * RAG (Retrieval-Augmented Generation) System
 * Export all retrieval capabilities
 * Phase 3: Enhanced with conversation summarization and user feedback
 */

// Main pipeline
export { executeRAG, type RAGResult, type RAGOptions } from './ragPipeline';

// Individual modules
export { analyzeQuery, type QueryAnalysis } from './queryAnalyzer';
export {
  retrieveFromMultipleSources,
  type RetrievalResult,
} from './multiSourceRetriever';
export {
  buildRetrievalContext,
  type ContextBuildOptions,
} from './contextBuilder';

// Phase 2: Advanced modules
export {
  calculateRelevanceScore,
  calculateTimeDecay,
  calculateRecencyBoost,
  calculateKeywordScore,
  DEFAULT_WEIGHTS,
  type RelevanceScoreBreakdown,
  type ScoringWeights,
} from './relevanceScoring';

export {
  recordRAGPerformance,
  getPerformanceStats,
  generatePerformanceReport,
  logPerformanceReport,
  clearPerformanceHistory,
  type RAGPerformanceMetrics,
  type PerformanceReport,
} from './performanceMonitor';

// Phase 3: Advanced features
export {
  generateConversationSummary,
  shouldSummarizeConversation,
  createSlidingWindowSummaries,
  formatSummaryForContext,
  type ConversationSummary,
  type SummaryOptions,
} from './conversationSummarizer';

export {
  submitFeedback,
  getFeedbackHistory,
  getFeedbackStats,
  clearFeedbackData,
  suggestOptimalThreshold,
  getFeedbackInsights,
  shouldRequestFeedback,
  getFeedbackPrompt,
  type RetrievalFeedback,
  type FeedbackStats,
} from './userFeedback';
