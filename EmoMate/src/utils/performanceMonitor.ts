/**
 * Performance Monitor
 * Phase 3: Real-time performance tracking and metrics
 *
 * Tracks:
 * - Transition audio latency
 * - First sentence latency
 * - TTS synthesis time
 * - Claude API response time
 * - Total conversation latency
 */

export interface PerformanceMetric {
  id: string;
  type: MetricType;
  value: number; // milliseconds
  timestamp: number;
  metadata?: Record<string, any>;
}

export enum MetricType {
  TRANSITION_AUDIO_LATENCY = 'transition_audio_latency',
  FIRST_SENTENCE_LATENCY = 'first_sentence_latency',
  AVG_TTS_TIME = 'avg_tts_time',
  CLAUDE_STREAM_TIME = 'claude_stream_time',
  TOTAL_RESPONSE_TIME = 'total_response_time',
  TTS_CACHE_HIT_RATE = 'tts_cache_hit_rate',
}

interface MetricStatistics {
  count: number;
  total: number;
  average: number;
  min: number;
  max: number;
  recent: number[]; // Last 10 values
}

/**
 * Performance Monitor Class
 */
class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxHistorySize = 100;
  private timers: Map<string, number> = new Map();

  /**
   * Start timing a metric
   */
  startTimer(timerId: string): void {
    this.timers.set(timerId, Date.now());
  }

  /**
   * End timing and record metric
   */
  endTimer(
    timerId: string,
    type: MetricType,
    metadata?: Record<string, any>
  ): number | null {
    const startTime = this.timers.get(timerId);
    if (!startTime) {
      console.warn(`[PerformanceMonitor] Timer ${timerId} not found`);
      return null;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(timerId);

    this.recordMetric(type, duration, metadata);
    return duration;
  }

  /**
   * Record a performance metric
   */
  recordMetric(
    type: MetricType,
    value: number,
    metadata?: Record<string, any>
  ): void {
    const metric: PerformanceMetric = {
      id: `metric_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type,
      value,
      timestamp: Date.now(),
      metadata,
    };

    this.metrics.push(metric);

    // Maintain history size limit
    if (this.metrics.length > this.maxHistorySize) {
      this.metrics.shift();
    }

    console.log(`[PerformanceMonitor] ${type}: ${value}ms`, metadata);
  }

  /**
   * Get statistics for a specific metric type
   */
  getStatistics(type: MetricType): MetricStatistics {
    const typeMetrics = this.metrics.filter((m) => m.type === type);

    if (typeMetrics.length === 0) {
      return {
        count: 0,
        total: 0,
        average: 0,
        min: 0,
        max: 0,
        recent: [],
      };
    }

    const values = typeMetrics.map((m) => m.value);
    const total = values.reduce((sum, val) => sum + val, 0);
    const average = total / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const recent = values.slice(-10);

    return {
      count: values.length,
      total,
      average: Math.round(average),
      min,
      max,
      recent,
    };
  }

  /**
   * Get all statistics
   */
  getAllStatistics(): Record<MetricType, MetricStatistics> {
    return {
      [MetricType.TRANSITION_AUDIO_LATENCY]: this.getStatistics(
        MetricType.TRANSITION_AUDIO_LATENCY
      ),
      [MetricType.FIRST_SENTENCE_LATENCY]: this.getStatistics(
        MetricType.FIRST_SENTENCE_LATENCY
      ),
      [MetricType.AVG_TTS_TIME]: this.getStatistics(MetricType.AVG_TTS_TIME),
      [MetricType.CLAUDE_STREAM_TIME]: this.getStatistics(
        MetricType.CLAUDE_STREAM_TIME
      ),
      [MetricType.TOTAL_RESPONSE_TIME]: this.getStatistics(
        MetricType.TOTAL_RESPONSE_TIME
      ),
      [MetricType.TTS_CACHE_HIT_RATE]: this.getStatistics(
        MetricType.TTS_CACHE_HIT_RATE
      ),
    };
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const stats = this.getAllStatistics();

    const lines = [
      '=== Performance Report ===',
      '',
      `Total Metrics Recorded: ${this.metrics.length}`,
      '',
      '--- Latency Metrics ---',
    ];

    for (const [type, stat] of Object.entries(stats)) {
      if (stat.count > 0) {
        lines.push(
          `${type}:`,
          `  Count: ${stat.count}`,
          `  Average: ${stat.average}ms`,
          `  Min: ${stat.min}ms`,
          `  Max: ${stat.max}ms`,
          ''
        );
      }
    }

    // Check if performance meets targets
    lines.push('--- Performance Goals ---');

    const transitionLatency = stats[MetricType.TRANSITION_AUDIO_LATENCY];
    if (transitionLatency.count > 0) {
      const target = 500; // 0.5s target
      const status = transitionLatency.average <= target ? '✅' : '❌';
      lines.push(
        `Transition Audio: ${status} ${transitionLatency.average}ms (target: <${target}ms)`
      );
    }

    const firstSentence = stats[MetricType.FIRST_SENTENCE_LATENCY];
    if (firstSentence.count > 0) {
      const target = 2000; // 2s target
      const status = firstSentence.average <= target ? '✅' : '❌';
      lines.push(
        `First Sentence: ${status} ${firstSentence.average}ms (target: <${target}ms)`
      );
    }

    const avgTTS = stats[MetricType.AVG_TTS_TIME];
    if (avgTTS.count > 0) {
      const target = 1500; // 1.5s target
      const status = avgTTS.average <= target ? '✅' : '❌';
      lines.push(
        `Average TTS: ${status} ${avgTTS.average}ms (target: <${target}ms)`
      );
    }

    return lines.join('\n');
  }

  /**
   * Clear all metrics
   */
  clearMetrics(): void {
    this.metrics = [];
    this.timers.clear();
    console.log('[PerformanceMonitor] Metrics cleared');
  }

  /**
   * Get recent metrics (last N)
   */
  getRecentMetrics(count = 10): PerformanceMetric[] {
    return this.metrics.slice(-count);
  }

  /**
   * Export metrics to JSON
   */
  exportMetrics(): string {
    return JSON.stringify(
      {
        timestamp: Date.now(),
        totalMetrics: this.metrics.length,
        metrics: this.metrics,
        statistics: this.getAllStatistics(),
      },
      null,
      2
    );
  }
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * Convenience wrapper for timing async operations
 */
export async function measureAsync<T>(
  operation: () => Promise<T>,
  type: MetricType,
  metadata?: Record<string, any>
): Promise<T> {
  const timerId = `async_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  performanceMonitor.startTimer(timerId);
  try {
    const result = await operation();
    performanceMonitor.endTimer(timerId, type, metadata);
    return result;
  } catch (error) {
    performanceMonitor.endTimer(timerId, type, {
      ...metadata,
      error: true,
    });
    throw error;
  }
}

/**
 * Convenience wrapper for timing sync operations
 */
export function measureSync<T>(
  operation: () => T,
  type: MetricType,
  metadata?: Record<string, any>
): T {
  const timerId = `sync_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  performanceMonitor.startTimer(timerId);
  try {
    const result = operation();
    performanceMonitor.endTimer(timerId, type, metadata);
    return result;
  } catch (error) {
    performanceMonitor.endTimer(timerId, type, {
      ...metadata,
      error: true,
    });
    throw error;
  }
}
