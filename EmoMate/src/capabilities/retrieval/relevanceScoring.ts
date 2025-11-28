/**
 * Relevance Scoring - RAG相关度评分优化
 * Advanced relevance calculation with time decay and multi-factor scoring
 */

import { QueryAnalysis } from './queryAnalyzer';

// ============================================
// Types
// ============================================

export interface RelevanceScoreBreakdown {
  timeMatch: number; // Time matching score (0-1)
  keywordMatch: number; // Keyword matching score (0-1)
  entityMatch: number; // Entity type matching score (0-1)
  recencyBoost: number; // Recency boost factor (0-1)
  totalScore: number; // Final combined score (0-1)
}

export interface ScoringWeights {
  time: number; // Weight for time matching
  keyword: number; // Weight for keyword matching
  entity: number; // Weight for entity matching
  recencyDecayHalfLife?: number; // Half-life for time decay in milliseconds (default: 7 days)
}

// Default weights for different data sources
export const DEFAULT_WEIGHTS = {
  objects: {
    time: 0.3,
    keyword: 0.5,
    entity: 0.2,
    recencyDecayHalfLife: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  conversations: {
    time: 0.25,
    keyword: 0.6,
    entity: 0.15,
    recencyDecayHalfLife: 3 * 24 * 60 * 60 * 1000, // 3 days (conversations decay faster)
  },
  scenes: {
    time: 0.4,
    keyword: 0.5,
    entity: 0.1,
    recencyDecayHalfLife: 5 * 24 * 60 * 60 * 1000, // 5 days
  },
};

// ============================================
// Time Decay Functions
// ============================================

/**
 * Calculate time decay factor using exponential decay
 * More recent items get higher scores
 *
 * Formula: decay = 2^(-age / halfLife)
 * - Age = 0: decay = 1.0 (100% relevance)
 * - Age = halfLife: decay = 0.5 (50% relevance)
 * - Age = 2*halfLife: decay = 0.25 (25% relevance)
 *
 * @param timestamp - Timestamp of the item
 * @param halfLife - Half-life in milliseconds (default: 7 days)
 * @returns Decay factor between 0 and 1
 */
export function calculateTimeDecay(
  timestamp: number,
  halfLife: number = 7 * 24 * 60 * 60 * 1000
): number {
  const now = Date.now();
  const age = now - timestamp;

  if (age <= 0) {
    return 1.0; // Future or current timestamp
  }

  // Exponential decay: 2^(-age / halfLife)
  const decay = Math.pow(2, -age / halfLife);

  // Clamp to reasonable minimum (don't completely discard old items)
  return Math.max(decay, 0.01);
}

/**
 * Calculate recency boost for items within time reference
 * Items within the queried time range get additional boost
 *
 * @param itemTimestamp - Timestamp of the item
 * @param timeReference - Time reference from query analysis
 * @returns Boost factor between 0 and 1
 */
export function calculateRecencyBoost(
  itemTimestamp: number,
  timeReference?: QueryAnalysis['timeReference']
): number {
  if (!timeReference?.range) {
    return 0; // No time reference, no boost
  }

  const { start, end } = timeReference.range;
  const itemTime = itemTimestamp;

  // Item is within the queried time range
  if (itemTime >= start.getTime() && itemTime <= end.getTime()) {
    // Calculate position within range (0 = start, 1 = end)
    const rangeSize = end.getTime() - start.getTime();
    const position = (itemTime - start.getTime()) / rangeSize;

    // Boost recent items within range more
    // More recent within range = higher boost
    return 0.5 + 0.5 * position;
  }

  // Item is outside the range but close
  const distanceFromRange = Math.min(
    Math.abs(itemTime - start.getTime()),
    Math.abs(itemTime - end.getTime())
  );

  // Gradual decay for items near the range
  const dayInMs = 24 * 60 * 60 * 1000;
  const daysAway = distanceFromRange / dayInMs;

  if (daysAway <= 1) {
    return 0.3; // Within 1 day of range
  } else if (daysAway <= 3) {
    return 0.1; // Within 3 days of range
  }

  return 0; // Too far from range
}

// ============================================
// Keyword Matching with TF-IDF-like Scoring
// ============================================

/**
 * Calculate keyword match score with term frequency consideration
 *
 * @param text - Text to search in
 * @param keywords - Keywords to search for
 * @returns Score between 0 and 1
 */
export function calculateKeywordScore(
  text: string,
  keywords: string[]
): number {
  if (keywords.length === 0) {
    return 0;
  }

  const lowerText = text.toLowerCase();
  let matchedCount = 0;
  let totalOccurrences = 0;

  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();

    if (lowerText.includes(lowerKeyword)) {
      matchedCount++;

      // Count occurrences (bonus for multiple mentions)
      const occurrences =
        (lowerText.match(new RegExp(lowerKeyword, 'g')) || []).length;
      totalOccurrences += occurrences;
    }
  }

  // Base score: percentage of keywords matched
  const baseScore = matchedCount / keywords.length;

  // Bonus for multiple occurrences (up to 20% boost)
  const occurrenceBonus = Math.min(totalOccurrences * 0.05, 0.2);

  return Math.min(baseScore + occurrenceBonus, 1.0);
}

// ============================================
// Entity Matching
// ============================================

/**
 * Calculate entity match score
 *
 * @param entityType - Entity type from item
 * @param queryEntities - Entities from query analysis
 * @returns Score between 0 and 1
 */
export function calculateEntityScore(
  entityType: string,
  queryEntities?: QueryAnalysis['entities']
): number {
  if (!queryEntities || queryEntities.length === 0) {
    return 0;
  }

  const lowerEntityType = entityType.toLowerCase();

  for (const entity of queryEntities) {
    // Exact match
    if (entity.type === lowerEntityType) {
      return 1.0;
    }

    // Partial match (e.g., "书" in "书籍")
    if (
      lowerEntityType.includes(entity.value) ||
      entity.value.includes(lowerEntityType)
    ) {
      return 0.7;
    }
  }

  return 0;
}

// ============================================
// Combined Relevance Scoring
// ============================================

/**
 * Calculate combined relevance score with all factors
 *
 * @param params - Scoring parameters
 * @returns Relevance score breakdown and total
 */
export function calculateRelevanceScore(params: {
  // Item data
  itemTimestamp: number;
  itemText: string;
  itemEntityType?: string;

  // Query analysis
  queryAnalysis: QueryAnalysis;

  // Weights
  weights?: ScoringWeights;
}): RelevanceScoreBreakdown {
  const {
    itemTimestamp,
    itemText,
    itemEntityType,
    queryAnalysis,
    weights = DEFAULT_WEIGHTS.conversations,
  } = params;

  // 1. Time matching score
  const timeMatch = queryAnalysis.timeReference?.range
    ? itemTimestamp >= queryAnalysis.timeReference.range.start.getTime() &&
      itemTimestamp <= queryAnalysis.timeReference.range.end.getTime()
      ? 1.0
      : 0.0
    : 0.0;

  // 2. Keyword matching score
  const keywordMatch = calculateKeywordScore(itemText, queryAnalysis.keywords);

  // 3. Entity matching score
  const entityMatch = itemEntityType
    ? calculateEntityScore(itemEntityType, queryAnalysis.entities)
    : 0.0;

  // 4. Recency boost (time decay)
  const timeDecay = calculateTimeDecay(
    itemTimestamp,
    weights.recencyDecayHalfLife
  );
  const recencyBoost = calculateRecencyBoost(
    itemTimestamp,
    queryAnalysis.timeReference
  );

  // Calculate weighted total score
  let totalScore =
    weights.time * timeMatch +
    weights.keyword * keywordMatch +
    weights.entity * entityMatch;

  // Apply time decay multiplier (reduces old items' relevance)
  totalScore *= timeDecay;

  // Apply recency boost (increases items within queried time range)
  totalScore += recencyBoost * 0.2; // Recency boost adds up to 20%

  // Clamp to [0, 1]
  totalScore = Math.min(Math.max(totalScore, 0), 1);

  return {
    timeMatch,
    keywordMatch,
    entityMatch,
    recencyBoost,
    totalScore,
  };
}
