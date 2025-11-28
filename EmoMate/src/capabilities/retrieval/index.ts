/**
 * RAG (Retrieval-Augmented Generation) System
 * Export all retrieval capabilities
 * Phase 2: Enhanced with advanced scoring, intelligent truncation, and performance monitoring
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
