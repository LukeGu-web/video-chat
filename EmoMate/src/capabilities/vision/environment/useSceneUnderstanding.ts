/**
 * Scene Understanding Hook
 * Main hook that integrates camera, image comparison, and Claude Vision API
 * to provide intelligent scene understanding capabilities
 *
 * This hook has been refactored into smaller modules:
 * - sceneKeywords.ts - Keyword detection logic
 * - sceneCache.ts - Cache management
 * - sceneTimer.ts - Timer logic
 * - sceneAnalysis.ts - Core analysis logic
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  SceneData,
  SceneConfig,
  SceneTriggerType,
  SceneAnalysisRequest,
  SceneAnalysisResponse,
  SceneCacheEntry,
  DEFAULT_SCENE_CONFIG,
} from '../../../types/scene';
import { analyzeSceneWithClaude } from '../claudeVision';
import { generateThumbnail } from '../imageComparison';

// Import modularized functions
import {
  detectVisualKeywords,
  detectObjectKeywords,
  formatObjectRecognitionForAI,
} from './sceneKeywords';

import {
  loadCachedData,
  saveToCache as saveToCacheUtil,
  saveLastScene,
  saveConfig,
  checkCache as checkCacheUtil,
  clearCache as clearCacheUtil,
  clearExpiredScenes as clearExpiredScenesUtil,
} from './sceneCache';

import {
  TimerState,
  getInitialTimerState,
  updateTimerCountdown,
  checkSceneChangeCooldown,
  updateAfterPhotoCapture,
  updateAfterSceneChange,
  updateAfterTimerAnalysis,
  updateAfterKeywordAnalysis,
  updateConversationActivity,
  startTimer as startTimerUtil,
  stopTimer as stopTimerUtil,
} from './sceneTimer';

import {
  checkSceneChange as checkSceneChangeUtil,
  checkSemanticDeduplication,
} from './sceneAnalysis';

// Re-export keyword detection functions for backward compatibility
export { detectVisualKeywords, detectObjectKeywords, formatObjectRecognitionForAI };

/**
 * Scene understanding state
 */
interface SceneUnderstandingState {
  /** Current scene data */
  currentScene: SceneData | null;

  /** Whether scene analysis is in progress */
  isAnalyzing: boolean;

  /** Last error message */
  error: string | null;

  /** Last trigger type used */
  lastTriggerType: SceneTriggerType | null;

  /** Timestamp of last successful analysis */
  lastAnalysisTime: number | null;

  /** Total number of API calls made */
  totalAPICalls: number;

  /** Total cost in USD */
  totalCost: number;

  /** Performance statistics (Step 5.3) */
  performanceStats: {
    /** Average response time in ms */
    averageResponseTime: number;
    /** Last response time in ms */
    lastResponseTime: number;
    /** Total response time sum (for average calculation) */
    totalResponseTime: number;
  };

  /** Debug information */
  debugInfo: {
    lastImageSize: number;
    lastSimilarity: number;
    cacheHits: number;
    cacheMisses: number;
  };

  /** Deduplication statistics (Step 4.2) */
  deduplicationStats: {
    /** Number of API calls saved by semantic deduplication */
    savedAPICalls: number;
    /** Number of times semantic deduplication was triggered */
    deduplicationCount: number;
    /** Last semantic similarity score */
    lastSimilarity: number | null;
    /** Last deduplication timestamp */
    lastDeduplicationTime: number | null;
  };

  /** Timer state (Step 3.1) */
  timerState: TimerState;

  /** Cached scenes (Step 4.1) - for UI display */
  cachedScenes: SceneCacheEntry[];
}

/**
 * Scene understanding hook return value
 */
interface UseSceneUnderstandingReturn extends SceneUnderstandingState {
  /** Manually trigger scene analysis */
  analyzeScene: (imageBase64: string, userQuestion?: string) => Promise<void>;

  /** Check if scene has changed from previous */
  checkSceneChange: (imageBase64: string) => Promise<boolean>;

  /** Clear scene cache */
  clearCache: () => void;

  /** Update configuration */
  updateConfig: (newConfig: Partial<SceneConfig>) => void;

  /** Get current configuration */
  getConfig: () => SceneConfig;

  /** Reset statistics */
  resetStats: () => void;

  /** Start timer-based scene monitoring (Step 3.1) */
  startTimer: () => void;

  /** Stop timer-based scene monitoring (Step 3.1) */
  stopTimer: () => void;

  /** Register a callback to capture photo from camera (Step 3.1) */
  setPhotoCaptureCallback: (callback: () => Promise<string | null>) => void;

  /** Detect visual keywords in user text (Step 3.3) */
  detectKeywords: (text: string) => string | null;

  /** Trigger analysis by keyword (Step 3.3) - High priority, bypasses cooldown */
  triggerByKeyword: (keyword: string, userQuestion: string) => Promise<void>;

  /** Get cached scene history (Step 4.1) - Returns list of cached scenes sorted by time */
  getCachedScenes: () => SceneCacheEntry[];

  /** Manually clear expired scenes from cache (Step 4.1) */
  clearExpiredScenes: () => number;

  /** Notify that conversation is active (Step 5.3: Smart pause) */
  notifyConversationActivity: () => void;
}

/**
 * Main scene understanding hook
 *
 * @param apiKey - Anthropic API key for Claude Vision
 * @param initialConfig - Optional initial configuration
 * @returns Scene understanding state and methods
 */
export function useSceneUnderstanding(
  apiKey: string,
  initialConfig?: Partial<SceneConfig>
): UseSceneUnderstandingReturn {
  // Configuration state
  const [config, setConfig] = useState<SceneConfig>({
    ...DEFAULT_SCENE_CONFIG,
    ...initialConfig,
  });

  // Scene state
  const [currentScene, setCurrentScene] = useState<SceneData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTriggerType, setLastTriggerType] = useState<SceneTriggerType | null>(null);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<number | null>(null);

  // Statistics
  const [totalAPICalls, setTotalAPICalls] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  // Performance statistics (Step 5.3)
  const [performanceStats, setPerformanceStats] = useState({
    averageResponseTime: 0,
    lastResponseTime: 0,
    totalResponseTime: 0,
  });

  // Debug info
  const [debugInfo, setDebugInfo] = useState({
    lastImageSize: 0,
    lastSimilarity: 0,
    cacheHits: 0,
    cacheMisses: 0,
  });

  // Deduplication statistics (Step 4.2)
  const [deduplicationStats, setDeduplicationStats] = useState({
    savedAPICalls: 0,
    deduplicationCount: 0,
    lastSimilarity: null as number | null,
    lastDeduplicationTime: null as number | null,
  });

  // Timer state (Step 3.1 & 3.2 & 3.3 & 5.3)
  const [timerState, setTimerState] = useState<TimerState>(getInitialTimerState());

  // Cached scenes state (Step 4.1) - for triggering UI updates
  const [cachedScenes, setCachedScenes] = useState<SceneCacheEntry[]>([]);

  // Refs for storing data that doesn't trigger re-renders
  const sceneCache = useRef<SceneCacheEntry[]>([]);
  const lastImageBase64 = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const photoCaptureCallback = useRef<(() => Promise<string | null>) | null>(null);
  const shouldTriggerAnalysis = useRef<boolean>(false);

  /**
   * Load cached data from storage on mount
   */
  useEffect(() => {
    const { cache, lastScene, config: savedConfig } = loadCachedData();

    // Update refs and state
    sceneCache.current = cache;
    setCachedScenes(cache);

    if (lastScene) {
      setCurrentScene(lastScene);
    }

    if (savedConfig) {
      setConfig(prev => ({ ...prev, ...savedConfig }));
    }

    return () => {
      // Cleanup timers on unmount (Step 3.1)
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Setup timer for periodic scene capture and analysis (Step 3.1)
   */
  useEffect(() => {
    if (!timerState.enabled) {
      // Clear timers if disabled
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }
      return;
    }

    // Schedule next photo capture (every 30 seconds)
    if (timerState.nextCaptureIn > 0) {
      timerRef.current = setTimeout(async () => {
        // Step 5.3: Skip if conversation is inactive
        if (timerState.isPausedDueToInactivity) {
          console.log('[SceneUnderstanding] ⏸️ Skipping photo capture - conversation inactive');
          setTimerState(prev => ({
            ...prev,
            nextCaptureIn: 30000, // Reset to 30 seconds
          }));
          return;
        }

        console.log('[SceneUnderstanding] Timer: Capturing photo...');

        if (photoCaptureCallback.current) {
          try {
            const imageBase64 = await photoCaptureCallback.current();
            if (imageBase64) {
              console.log('[SceneUnderstanding] Timer: Photo captured');

              // Step 3.2: Check for scene change
              const hasSceneChanged = await checkSceneChangeUtil(
                imageBase64,
                lastImageBase64.current,
                config.sceneChangeThreshold
              );

              console.log('[SceneUnderstanding] 🔍 Scene change check result:', {
                hasSceneChanged,
                timerStateLastChangeTime: timerState.lastSceneChangeTime,
              });

              if (hasSceneChanged) {
                console.log('[SceneUnderstanding] ✅ Scene change detected!');

                // Check cooldown period (1 minute = 60000ms)
                const { isInCooldown, remainingCooldown } = checkSceneChangeCooldown(
                  timerState.lastSceneChangeTime
                );

                if (isInCooldown) {
                  console.log(`[SceneUnderstanding] ⏸️ Scene change cooldown active, ${remainingCooldown}s remaining - SKIPPING ANALYSIS`);
                } else {
                  console.log('[SceneUnderstanding] 🚀 Triggering scene change analysis...');

                  // Trigger deep analysis due to scene change
                  analyzeScene(imageBase64, undefined, false, true).catch(error => {
                    console.error('[SceneUnderstanding] ❌ Scene change analysis failed:', error);
                  });

                  // Update state: record scene change trigger and reset timer
                  setTimerState(prev => updateAfterSceneChange(prev));

                  console.log('[SceneUnderstanding] ✅ Scene change state updated, timer reset to 5 minutes');
                }
              } else {
                console.log('[SceneUnderstanding] ⏭️ Scene unchanged, skipping analysis');
              }

              // Store captured image
              lastImageBase64.current = imageBase64;

              // Update capture count
              setTimerState(prev => updateAfterPhotoCapture(prev));
            }
          } catch (error) {
            console.error('[SceneUnderstanding] Timer: Photo capture failed:', error);
          }
        } else {
          console.warn('[SceneUnderstanding] Timer: No photo capture callback registered');
        }
      }, timerState.nextCaptureIn);
    }

    // Set flag for deep analysis (every 5 minutes)
    if (timerState.nextAnalysisIn <= 0 && !shouldTriggerAnalysis.current) {
      console.log('[SceneUnderstanding] Timer: Marking for deep analysis...');
      shouldTriggerAnalysis.current = true;
    }

    // Setup countdown timer (updates every second)
    countdownTimerRef.current = setInterval(() => {
      setTimerState(prev => updateTimerCountdown(prev));
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerState.enabled, timerState.nextCaptureIn, timerState.nextAnalysisIn]);


  /**
   * Analyze scene using Claude Vision API
   * @param imageBase64 - Base64 encoded image
   * @param userQuestion - Optional user question for keyword-triggered analysis
   * @param isTimerTriggered - Whether triggered by timer (Step 3.1)
   * @param isSceneChangeTriggered - Whether triggered by scene change (Step 3.2)
   */
  const analyzeScene = useCallback(
    async (
      imageBase64: string,
      userQuestion?: string,
      isTimerTriggered: boolean = false,
      isSceneChangeTriggered: boolean = false
    ): Promise<void> => {
      if (!config.enabled) {
        console.log('[SceneUnderstanding] Feature disabled');
        return;
      }

      if (isAnalyzing) {
        console.log('[SceneUnderstanding] Analysis already in progress');
        return;
      }

      setIsAnalyzing(true);
      setError(null);

      try {
        console.log('[SceneUnderstanding] Starting scene analysis');

        // Update debug info
        setDebugInfo(prev => ({
          ...prev,
          lastImageSize: (imageBase64.length * 0.75) / 1024, // KB
        }));

        // Determine trigger type
        const triggerType = userQuestion
          ? SceneTriggerType.KEYWORD
          : SceneTriggerType.MANUAL;

        // Check cache first (Step 4.1: Image-based deduplication)
        const cacheResult = await checkCacheUtil(
          sceneCache.current,
          imageBase64,
          config.deduplicationThreshold
        );

        if (cacheResult.scene && !userQuestion) {
          console.log('[SceneUnderstanding] ✅ Using cached scene (Step 4.1 cache hit)');

          // Update scene with new timestamp
          const updatedScene: SceneData = {
            ...cacheResult.scene,
            timestamp: Date.now(),
          };

          setCurrentScene(updatedScene);
          setLastTriggerType(triggerType);
          setLastAnalysisTime(Date.now());

          // Update debug info for cache hit
          setDebugInfo(prev => ({
            ...prev,
            cacheHits: prev.cacheHits + 1,
            lastSimilarity: cacheResult.similarity || 0,
          }));

          // Step 4.2: Update deduplication statistics (cache hit also saves API call)
          setDeduplicationStats(prev => ({
            savedAPICalls: prev.savedAPICalls + 1,
            deduplicationCount: prev.deduplicationCount + 1,
            lastSimilarity: cacheResult.similarity, // Use the similarity from checkCache
            lastDeduplicationTime: Date.now(),
          }));

          console.log('[SceneUnderstanding] 💰 API call saved via cache! Total saved:', deduplicationStats.savedAPICalls + 1);

          // Update last image for next comparison
          lastImageBase64.current = imageBase64;

          setIsAnalyzing(false);
          return;
        } else if (!cacheResult.scene) {
          // Update debug info for cache miss
          setDebugInfo(prev => ({ ...prev, cacheMisses: prev.cacheMisses + 1 }));
        }

        // Step 4.2: Semantic deduplication - Check if scene is still the same
        // Use image similarity as a proxy for semantic similarity to avoid unnecessary API calls
        console.log('[SceneUnderstanding] 🔍 Step 4.2: Deduplication check conditions:', {
          hasCurrentScene: !!currentScene,
          hasUserQuestion: !!userQuestion,
          hasLastImage: !!lastImageBase64.current,
        });

        if (currentScene && !userQuestion && lastImageBase64.current) {
          console.log('[SceneUnderstanding] ✅ All conditions met, checking for semantic deduplication...');

          const { shouldDeduplicate, similarity: imageSimilarity } = await checkSemanticDeduplication(
            imageBase64,
            lastImageBase64.current,
            config.deduplicationThreshold
          );

          // If image similarity is very high (>= deduplicationThreshold), assume semantic similarity
          // This avoids calling the API for virtually identical scenes
          if (shouldDeduplicate) {
            console.log('[SceneUnderstanding] ✅ High image similarity detected, skipping API call (semantic deduplication)');

            // Update the scene timestamp to indicate it's still active
            const updatedScene: SceneData = {
              ...currentScene,
              timestamp: Date.now(),
            };

            setCurrentScene(updatedScene);
            setLastTriggerType(triggerType);
            setLastAnalysisTime(Date.now());

            // Update deduplication statistics
            setDeduplicationStats(prev => ({
              savedAPICalls: prev.savedAPICalls + 1,
              deduplicationCount: prev.deduplicationCount + 1,
              lastSimilarity: imageSimilarity,
              lastDeduplicationTime: Date.now(),
            }));

            console.log('[SceneUnderstanding] 💰 API call saved! Total saved:', deduplicationStats.savedAPICalls + 1);

            // Update last image for next comparison
            lastImageBase64.current = imageBase64;

            setIsAnalyzing(false);
            return;
          } else {
            console.log('[SceneUnderstanding] ⏭️ Image similarity below threshold, proceeding with API call');
          }
        }

        // Prepare analysis request
        const request: SceneAnalysisRequest = {
          imageBase64,
          triggerType,
          userQuestion,
          previousScene: currentScene || undefined,
        };

        // Step 5.3: Track response time
        const apiStartTime = Date.now();

        // Call Claude Vision API
        const response: SceneAnalysisResponse = await analyzeSceneWithClaude(
          request,
          apiKey
        );

        // Calculate response time
        const responseTime = Date.now() - apiStartTime;

        if (!response.success) {
          throw new Error(response.error || 'Analysis failed');
        }

        // Update state
        setCurrentScene(response.scene);
        setLastTriggerType(triggerType);
        setLastAnalysisTime(Date.now());
        setTotalAPICalls(prev => prev + 1);
        setTotalCost(prev => prev + (response.cost || 0));

        // Step 5.3: Update performance statistics
        setPerformanceStats(prev => {
          const newTotalResponseTime = prev.totalResponseTime + responseTime;
          const newCallCount = totalAPICalls + 1;
          const newAverageResponseTime = newTotalResponseTime / newCallCount;

          console.log('[SceneUnderstanding] ⏱️ Performance stats:', {
            lastResponseTime: `${responseTime}ms`,
            averageResponseTime: `${newAverageResponseTime.toFixed(0)}ms`,
            totalCalls: newCallCount,
          });

          return {
            lastResponseTime: responseTime,
            totalResponseTime: newTotalResponseTime,
            averageResponseTime: newAverageResponseTime,
          };
        });

        // Update timer analysis count if triggered by timer (Step 3.1)
        if (isTimerTriggered) {
          setTimerState(prev => updateAfterTimerAnalysis(prev));
          shouldTriggerAnalysis.current = false;
        }

        // Update scene change analysis count if triggered by scene change (Step 3.2)
        // Note: State update already done in timer callback, this is just for logging
        if (isSceneChangeTriggered) {
          console.log('[SceneUnderstanding] Scene change analysis completed');
        }

        // Save to cache
        const thumbnail = await generateThumbnail(imageBase64);
        const updatedCache = saveToCacheUtil(
          sceneCache.current,
          response.scene,
          thumbnail,
          config
        );
        sceneCache.current = updatedCache;
        setCachedScenes(updatedCache);

        // Save last scene to MMKV storage
        saveLastScene(response.scene);

        // Step 4.2: Update last image for future deduplication comparison
        lastImageBase64.current = imageBase64;

        console.log('[SceneUnderstanding] Analysis completed successfully');
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('[SceneUnderstanding] Analysis failed:', errorMessage);
        setError(errorMessage);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [config, isAnalyzing, currentScene, apiKey]
  );

  /**
   * Trigger deep analysis when timer flag is set (Step 3.1)
   */
  useEffect(() => {
    if (shouldTriggerAnalysis.current && lastImageBase64.current && !isAnalyzing) {
      console.log('[SceneUnderstanding] Triggering timer-based analysis...');
      analyzeScene(lastImageBase64.current, undefined, true).catch(error => {
        console.error('[SceneUnderstanding] Timer analysis failed:', error);
        shouldTriggerAnalysis.current = false;
      });
    }
  }, [timerState.nextAnalysisIn, isAnalyzing, analyzeScene]);

  /**
   * Check if scene has changed from previous image (wrapper for module function)
   * Note: Does NOT update lastImageBase64.current - that's done by the caller
   */
  const checkSceneChange = useCallback(
    async (imageBase64: string): Promise<boolean> => {
      const hasChanged = await checkSceneChangeUtil(
        imageBase64,
        lastImageBase64.current,
        config.sceneChangeThreshold
      );

      // Update debug info with similarity
      // Note: The utility function logs internally

      return hasChanged;
    },
    [config.sceneChangeThreshold]
  );

  /**
   * Clear scene cache
   */
  const clearCache = useCallback((): void => {
    const emptyCache = clearCacheUtil();
    sceneCache.current = emptyCache;
    setCachedScenes(emptyCache);
  }, []);

  /**
   * Update configuration
   */
  const updateConfig = useCallback((newConfig: Partial<SceneConfig>): void => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      // Save to MMKV storage
      saveConfig(updated);
      return updated;
    });
  }, []);

  /**
   * Get current configuration
   */
  const getConfig = useCallback((): SceneConfig => {
    return config;
  }, [config]);

  /**
   * Reset statistics
   */
  const resetStats = useCallback((): void => {
    setTotalAPICalls(0);
    setTotalCost(0);
    setDebugInfo({
      lastImageSize: 0,
      lastSimilarity: 0,
      cacheHits: 0,
      cacheMisses: 0,
    });
    setDeduplicationStats({
      savedAPICalls: 0,
      deduplicationCount: 0,
      lastSimilarity: null,
      lastDeduplicationTime: null,
    });
    console.log('[SceneUnderstanding] Statistics reset');
  }, []);

  /**
   * Start timer-based scene monitoring (Step 3.1)
   */
  const startTimer = useCallback((): void => {
    setTimerState(prev => startTimerUtil(prev));
  }, []);

  /**
   * Stop timer-based scene monitoring (Step 3.1)
   */
  const stopTimer = useCallback((): void => {
    setTimerState(prev => stopTimerUtil(prev));
  }, []);

  /**
   * Register a callback to capture photo from camera (Step 3.1)
   */
  const setPhotoCaptureCallback = useCallback(
    (callback: () => Promise<string | null>): void => {
      console.log('[SceneUnderstanding] Photo capture callback registered');
      photoCaptureCallback.current = callback;
    },
    []
  );

  /**
   * Detect visual keywords in user text (Step 3.3)
   * Wrapper for the exported detectVisualKeywords function
   */
  const detectKeywords = useCallback((text: string): string | null => {
    return detectVisualKeywords(text);
  }, []);

  /**
   * Trigger scene analysis by keyword (Step 3.3)
   * High priority trigger that bypasses cooldown period
   *
   * @param keyword - The detected keyword
   * @param userQuestion - The full user question text
   */
  const triggerByKeyword = useCallback(
    async (keyword: string, userQuestion: string): Promise<void> => {
      console.log('[SceneUnderstanding] 🎯 Keyword trigger:', keyword);
      console.log('[SceneUnderstanding] 📝 User question:', userQuestion);

      // Check if photo capture callback is registered
      if (!photoCaptureCallback.current) {
        console.warn('[SceneUnderstanding] ⚠️ No photo capture callback registered, cannot trigger keyword analysis');
        return;
      }

      try {
        // Capture photo immediately
        console.log('[SceneUnderstanding] 📸 Capturing photo for keyword analysis...');
        const imageBase64 = await photoCaptureCallback.current();

        if (!imageBase64) {
          console.error('[SceneUnderstanding] ❌ Failed to capture photo');
          return;
        }

        console.log('[SceneUnderstanding] ✅ Photo captured, triggering analysis...');

        // Trigger analysis with user question
        // Note: This bypasses cooldown and cache (high priority)
        await analyzeScene(imageBase64, userQuestion);

        // Update statistics
        setTimerState(prev => updateAfterKeywordAnalysis(prev, keyword));

        console.log('[SceneUnderstanding] ✅ Keyword-triggered analysis completed');
      } catch (error) {
        console.error('[SceneUnderstanding] ❌ Keyword-triggered analysis failed:', error);
      }
    },
    [analyzeScene]
  );

  /**
   * Get cached scene history (Step 4.1)
   * Returns list of all cached scenes sorted by timestamp (newest first)
   *
   * @returns Array of cached scene entries
   */
  const getCachedScenes = useCallback((): SceneCacheEntry[] => {
    try {
      // Return the state (which is already filtered and sorted)
      console.log('[SceneUnderstanding] 📚 Retrieved', cachedScenes.length, 'cached scenes');
      return cachedScenes;
    } catch (error) {
      console.error('[SceneUnderstanding] ❌ Failed to get cached scenes:', error);
      return [];
    }
  }, [cachedScenes]);

  /**
   * Manually clear expired scenes from cache (Step 4.1)
   * Removes all scenes that have passed their expiration time
   *
   * @returns Number of scenes removed
   */
  const clearExpiredScenes = useCallback((): number => {
    const { updatedCache, removedCount } = clearExpiredScenesUtil(sceneCache.current);
    sceneCache.current = updatedCache;
    setCachedScenes(updatedCache);
    return removedCount;
  }, []);

  /**
   * Notify that conversation is active (Step 5.3: Smart pause)
   * Call this when user sends a message or AI responds
   */
  const notifyConversationActivity = useCallback((): void => {
    setTimerState(prev => updateConversationActivity(prev));
    console.log('[SceneUnderstanding] 💬 Conversation activity notified - timer resumed');
  }, []);

  return {
    // State
    currentScene,
    isAnalyzing,
    error,
    lastTriggerType,
    lastAnalysisTime,
    totalAPICalls,
    totalCost,
    performanceStats, // Step 5.3
    debugInfo,
    deduplicationStats, // Step 4.2
    timerState,
    cachedScenes, // Step 4.1

    // Methods
    analyzeScene,
    checkSceneChange,
    clearCache,
    updateConfig,
    getConfig,
    resetStats,
    startTimer,
    stopTimer,
    setPhotoCaptureCallback,
    detectKeywords, // Step 3.3
    triggerByKeyword, // Step 3.3
    getCachedScenes, // Step 4.1
    clearExpiredScenes, // Step 4.1
    notifyConversationActivity, // Step 5.3
  };
}
