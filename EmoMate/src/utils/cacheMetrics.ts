/**
 * Cache Metrics Tracker
 *
 * This module provides utilities for tracking and analyzing Claude API Prompt Caching performance.
 * It monitors cache hit rates, token savings, and cost reductions.
 *
 * @module cacheMetrics
 */

/**
 * Cache usage metrics interface
 */
export interface CacheMetrics {
  totalRequests: number;
  cacheHits: number;
  cacheMisses: number;
  cacheCreations: number;
  hitRate: number;
  tokensSaved: number;
  tokensCreated: number;
  costSaved: number; // In USD
  costSpent: number; // In USD
  lastUpdated: number; // Timestamp
}

/**
 * Cache usage from Claude API response
 */
export interface CacheUsage {
  input_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  output_tokens: number;
}

/**
 * Pricing for Claude models (USD per million tokens)
 */
const CLAUDE_PRICING = {
  // Input pricing
  normalInput: 3.0, // $3.00 / MTok
  cacheWrite: 3.75, // $3.75 / MTok (+25%)
  cacheRead: 0.3, // $0.30 / MTok (-90%)

  // Output pricing (same for all)
  output: 15.0, // $15.00 / MTok
};

/**
 * Global cache metrics tracker
 */
let globalMetrics: CacheMetrics = {
  totalRequests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  cacheCreations: 0,
  hitRate: 0,
  tokensSaved: 0,
  tokensCreated: 0,
  costSaved: 0,
  costSpent: 0,
  lastUpdated: Date.now(),
};

/**
 * Track cache usage from API response
 *
 * @param usage - Cache usage data from Claude API response
 * @returns Updated cache metrics
 */
export function trackCacheUsage(usage: CacheUsage): CacheMetrics {
  globalMetrics.totalRequests++;

  // Check if cache was created (first request)
  if (usage.cache_creation_input_tokens && usage.cache_creation_input_tokens > 0) {
    globalMetrics.cacheCreations++;
    globalMetrics.tokensCreated += usage.cache_creation_input_tokens;

    // Calculate cost for cache creation
    const creationCost =
      (usage.cache_creation_input_tokens * CLAUDE_PRICING.cacheWrite) / 1_000_000;
    globalMetrics.costSpent += creationCost;

    console.log('[CacheMetrics] 📝 Cache created:', {
      tokens: usage.cache_creation_input_tokens,
      cost: `$${creationCost.toFixed(6)}`,
    });
  }

  // Check if cache was hit (subsequent requests)
  if (usage.cache_read_input_tokens && usage.cache_read_input_tokens > 0) {
    globalMetrics.cacheHits++;
    globalMetrics.tokensSaved += usage.cache_read_input_tokens;

    // Calculate savings (normal cost - cached cost)
    const normalCost = (usage.cache_read_input_tokens * CLAUDE_PRICING.normalInput) / 1_000_000;
    const cachedCost = (usage.cache_read_input_tokens * CLAUDE_PRICING.cacheRead) / 1_000_000;
    const savings = normalCost - cachedCost;

    globalMetrics.costSaved += savings;
    globalMetrics.costSpent += cachedCost;

    console.log('[CacheMetrics] ✅ Cache hit:', {
      tokens: usage.cache_read_input_tokens,
      normalCost: `$${normalCost.toFixed(6)}`,
      cachedCost: `$${cachedCost.toFixed(6)}`,
      savings: `$${savings.toFixed(6)}`,
    });
  } else if (!usage.cache_creation_input_tokens) {
    // Cache miss (no creation, no hit)
    globalMetrics.cacheMisses++;

    console.log('[CacheMetrics] ❌ Cache miss');
  }

  // Calculate regular input tokens cost
  const regularInputTokens =
    usage.input_tokens -
    (usage.cache_creation_input_tokens || 0) -
    (usage.cache_read_input_tokens || 0);

  if (regularInputTokens > 0) {
    const regularCost = (regularInputTokens * CLAUDE_PRICING.normalInput) / 1_000_000;
    globalMetrics.costSpent += regularCost;
  }

  // Calculate output tokens cost
  if (usage.output_tokens > 0) {
    const outputCost = (usage.output_tokens * CLAUDE_PRICING.output) / 1_000_000;
    globalMetrics.costSpent += outputCost;
  }

  // Update hit rate
  globalMetrics.hitRate = globalMetrics.cacheHits / globalMetrics.totalRequests;
  globalMetrics.lastUpdated = Date.now();

  // Log summary statistics
  console.log('[CacheMetrics] 📊 Summary:', {
    requests: globalMetrics.totalRequests,
    hitRate: `${(globalMetrics.hitRate * 100).toFixed(1)}%`,
    hits: globalMetrics.cacheHits,
    misses: globalMetrics.cacheMisses,
    creations: globalMetrics.cacheCreations,
    tokensSaved: globalMetrics.tokensSaved.toLocaleString(),
    costSaved: `$${globalMetrics.costSaved.toFixed(4)}`,
    costSpent: `$${globalMetrics.costSpent.toFixed(4)}`,
  });

  return { ...globalMetrics };
}

/**
 * Get current cache metrics
 *
 * @returns Current cache metrics
 */
export function getCacheMetrics(): CacheMetrics {
  return { ...globalMetrics };
}

/**
 * Reset cache metrics
 */
export function resetCacheMetrics(): void {
  globalMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    cacheCreations: 0,
    hitRate: 0,
    tokensSaved: 0,
    tokensCreated: 0,
    costSaved: 0,
    costSpent: 0,
    lastUpdated: Date.now(),
  };

  console.log('[CacheMetrics] 🔄 Metrics reset');
}

/**
 * Get formatted cache statistics report
 *
 * @returns Formatted statistics string
 */
export function getCacheStatsReport(): string {
  const metrics = getCacheMetrics();

  if (metrics.totalRequests === 0) {
    return 'No cache data available yet.';
  }

  const avgSavingsPerRequest = metrics.costSaved / metrics.totalRequests;
  const totalCostWithoutCache =
    metrics.costSpent + (metrics.tokensSaved * CLAUDE_PRICING.normalInput) / 1_000_000;
  const savingsPercentage = (metrics.costSaved / totalCostWithoutCache) * 100;

  return `
📊 Cache Performance Report
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Requests:
  Total: ${metrics.totalRequests}
  Cache Hits: ${metrics.cacheHits} (${(metrics.hitRate * 100).toFixed(1)}%)
  Cache Misses: ${metrics.cacheMisses}
  Cache Creations: ${metrics.cacheCreations}

Tokens:
  Saved: ${metrics.tokensSaved.toLocaleString()} tokens
  Created: ${metrics.tokensCreated.toLocaleString()} tokens

Cost Analysis:
  Spent: $${metrics.costSpent.toFixed(4)}
  Saved: $${metrics.costSaved.toFixed(4)}
  Savings: ${savingsPercentage.toFixed(1)}%
  Avg Savings/Request: $${avgSavingsPerRequest.toFixed(6)}

Last Updated: ${new Date(metrics.lastUpdated).toLocaleString()}
  `.trim();
}

/**
 * Parse cache usage from Claude API SSE response
 *
 * This function extracts cache usage data from streaming API responses.
 *
 * @param responseText - Full response text from streaming API
 * @returns Cache usage object or null if not found
 */
export function parseCacheUsageFromSSE(responseText: string): CacheUsage | null {
  try {
    // Look for the message_stop event which contains usage data
    const lines = responseText.split('\n');
    let usageData: CacheUsage | null = null;

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);

          // Check for usage in message_stop event
          if (parsed.type === 'message_stop' && parsed.usage) {
            usageData = parsed.usage;
            break;
          }

          // Also check for usage in message_delta event
          if (parsed.type === 'message_delta' && parsed.usage) {
            usageData = parsed.usage;
            break;
          }
        } catch (e) {
          // Skip invalid JSON lines
          continue;
        }
      }
    }

    return usageData;
  } catch (error) {
    console.error('[CacheMetrics] Error parsing cache usage from SSE:', error);
    return null;
  }
}
