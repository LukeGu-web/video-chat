/**
 * Centralized Error Handler
 * Phase 3: Error handling and fallback strategies
 *
 * Provides:
 * - Network error detection and handling
 * - Service degradation management
 * - Fallback response generation
 * - Error logging and tracking
 */

export enum ErrorType {
  NETWORK = 'network',
  API_RATE_LIMIT = 'api_rate_limit',
  API_QUOTA = 'api_quota',
  TTS_SYNTHESIS = 'tts_synthesis',
  SPEECH_RECOGNITION = 'speech_recognition',
  CLAUDE_API = 'claude_api',
  TIMEOUT = 'timeout',
  UNKNOWN = 'unknown',
}

export interface ErrorContext {
  type: ErrorType;
  originalError: Error | unknown;
  service: 'claude' | 'elevenlabs' | 'speech-recognition' | 'tts-queue';
  retryCount?: number;
  timestamp: number;
}

/**
 * Fallback responses for different error scenarios
 */
const FALLBACK_RESPONSES = {
  [ErrorType.NETWORK]: '抱歉，网络连接似乎有问题。请检查网络后重试。',
  [ErrorType.API_RATE_LIMIT]: '服务器有点忙呢...请稍等几秒后再试。',
  [ErrorType.API_QUOTA]: '今天的对话次数已达上限。明天再来找我聊天吧~',
  [ErrorType.TTS_SYNTHESIS]: '语音合成遇到了问题，但我还是能用文字回复你哦~',
  [ErrorType.SPEECH_RECOGNITION]: '没听清楚呢...能再说一遍吗？',
  [ErrorType.CLAUDE_API]: '我现在有点晕...请稍后重试吧。',
  [ErrorType.TIMEOUT]: '响应超时了...我们再试一次好吗？',
  [ErrorType.UNKNOWN]: '遇到了一个未知错误...请稍后重试。',
};

/**
 * Error Handler Class
 */
class ErrorHandler {
  private errorHistory: ErrorContext[] = [];
  private maxHistorySize = 50;

  /**
   * Detect error type from error message or object
   */
  detectErrorType(error: Error | unknown): ErrorType {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerMessage = errorMessage.toLowerCase();

    if (lowerMessage.includes('network') || lowerMessage.includes('fetch failed')) {
      return ErrorType.NETWORK;
    }

    if (lowerMessage.includes('429') || lowerMessage.includes('rate limit')) {
      return ErrorType.API_RATE_LIMIT;
    }

    if (lowerMessage.includes('quota') || lowerMessage.includes('402')) {
      return ErrorType.API_QUOTA;
    }

    if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
      return ErrorType.TIMEOUT;
    }

    if (lowerMessage.includes('tts') || lowerMessage.includes('synthesis')) {
      return ErrorType.TTS_SYNTHESIS;
    }

    if (lowerMessage.includes('claude') || lowerMessage.includes('anthropic')) {
      return ErrorType.CLAUDE_API;
    }

    if (lowerMessage.includes('speech') || lowerMessage.includes('recognition')) {
      return ErrorType.SPEECH_RECOGNITION;
    }

    return ErrorType.UNKNOWN;
  }

  /**
   * Log error for tracking
   */
  logError(context: ErrorContext): void {
    this.errorHistory.push(context);

    // Maintain history size limit
    if (this.errorHistory.length > this.maxHistorySize) {
      this.errorHistory.shift();
    }

    // Console log for debugging
    console.error(
      `[ErrorHandler] ${context.type} error in ${context.service}:`,
      context.originalError
    );
  }

  /**
   * Handle error with appropriate fallback
   */
  handleError(
    error: Error | unknown,
    service: ErrorContext['service'],
    retryCount = 0
  ): {
    fallbackMessage: string;
    shouldRetry: boolean;
    retryDelay: number;
  } {
    const errorType = this.detectErrorType(error);

    const context: ErrorContext = {
      type: errorType,
      originalError: error,
      service,
      retryCount,
      timestamp: Date.now(),
    };

    this.logError(context);

    // Determine retry strategy
    const shouldRetry = this.shouldRetry(errorType, retryCount);
    const retryDelay = this.getRetryDelay(errorType, retryCount);
    const fallbackMessage = FALLBACK_RESPONSES[errorType];

    return {
      fallbackMessage,
      shouldRetry,
      retryDelay,
    };
  }

  /**
   * Determine if error should be retried
   */
  private shouldRetry(errorType: ErrorType, retryCount: number): boolean {
    // Max 3 retries for most errors
    if (retryCount >= 3) {
      return false;
    }

    // Don't retry quota errors
    if (errorType === ErrorType.API_QUOTA) {
      return false;
    }

    // Retry network, timeout, and rate limit errors
    return [
      ErrorType.NETWORK,
      ErrorType.TIMEOUT,
      ErrorType.API_RATE_LIMIT,
      ErrorType.TTS_SYNTHESIS,
      ErrorType.CLAUDE_API,
    ].includes(errorType);
  }

  /**
   * Calculate retry delay based on error type and retry count
   */
  private getRetryDelay(errorType: ErrorType, retryCount: number): number {
    // Exponential backoff: 1s, 2s, 4s
    const baseDelay = 1000;

    // Rate limit errors need longer delays
    if (errorType === ErrorType.API_RATE_LIMIT) {
      return baseDelay * Math.pow(3, retryCount); // 1s, 3s, 9s
    }

    // Standard exponential backoff
    return baseDelay * Math.pow(2, retryCount); // 1s, 2s, 4s
  }

  /**
   * Get error statistics
   */
  getStatistics(): {
    total: number;
    byType: Record<ErrorType, number>;
    byService: Record<ErrorContext['service'], number>;
    recentErrors: ErrorContext[];
  } {
    const byType: Record<ErrorType, number> = {
      [ErrorType.NETWORK]: 0,
      [ErrorType.API_RATE_LIMIT]: 0,
      [ErrorType.API_QUOTA]: 0,
      [ErrorType.TTS_SYNTHESIS]: 0,
      [ErrorType.SPEECH_RECOGNITION]: 0,
      [ErrorType.CLAUDE_API]: 0,
      [ErrorType.TIMEOUT]: 0,
      [ErrorType.UNKNOWN]: 0,
    };

    const byService: Record<ErrorContext['service'], number> = {
      claude: 0,
      elevenlabs: 0,
      'speech-recognition': 0,
      'tts-queue': 0,
    };

    for (const error of this.errorHistory) {
      byType[error.type]++;
      byService[error.service]++;
    }

    return {
      total: this.errorHistory.length,
      byType,
      byService,
      recentErrors: this.errorHistory.slice(-10), // Last 10 errors
    };
  }

  /**
   * Clear error history
   */
  clearHistory(): void {
    this.errorHistory = [];
    console.log('[ErrorHandler] Error history cleared');
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

/**
 * Utility function for error handling in async operations
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  service: ErrorContext['service'],
  onError?: (fallbackMessage: string) => void
): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    const { fallbackMessage } = errorHandler.handleError(error, service);

    if (onError) {
      onError(fallbackMessage);
    }

    return null;
  }
}
