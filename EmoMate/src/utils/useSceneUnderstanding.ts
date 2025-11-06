/**
 * Scene Understanding Hook
 * Main hook that integrates camera, image comparison, and Claude Vision API
 * to provide intelligent scene understanding capabilities
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { createMMKV } from 'react-native-mmkv';
import {
  SceneData,
  SceneConfig,
  SceneTriggerType,
  SceneAnalysisRequest,
  SceneAnalysisResponse,
  SceneCacheEntry,
  DEFAULT_SCENE_CONFIG,
} from '../types/scene';
import { analyzeSceneWithClaude } from './claudeVision';
import { compareImages, generateThumbnail } from './imageComparison';

/**
 * MMKV Storage instance for scene understanding data
 */
const storage = createMMKV({
  id: 'scene-understanding-storage',
  encryptionKey: 'scene-understanding-encryption-key', // Optional: for data encryption
});

/**
 * Storage keys for persisting scene data
 */
const STORAGE_KEYS = {
  SCENE_CACHE: 'scene_understanding_cache',
  LAST_SCENE: 'scene_understanding_last_scene',
  CONFIG: 'scene_understanding_config',
};

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

  /** Debug information */
  debugInfo: {
    lastImageSize: number;
    lastSimilarity: number;
    cacheHits: number;
    cacheMisses: number;
  };

  /** Timer state (Step 3.1) */
  timerState: {
    /** Whether timer is enabled */
    enabled: boolean;
    /** Time until next photo capture (ms) */
    nextCaptureIn: number;
    /** Time until next deep analysis (ms) */
    nextAnalysisIn: number;
    /** Total number of photos captured */
    totalCaptures: number;
    /** Total number of analyses triggered by timer */
    totalTimerAnalyses: number;
    /** Last scene change trigger time (for cooldown, Step 3.2) */
    lastSceneChangeTime: number | null;
    /** Total number of analyses triggered by scene change (Step 3.2) */
    totalSceneChangeAnalyses: number;
    /** Last trigger reason (timer/scene_change) */
    lastTriggerReason: string | null;
  };
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

  // Debug info
  const [debugInfo, setDebugInfo] = useState({
    lastImageSize: 0,
    lastSimilarity: 0,
    cacheHits: 0,
    cacheMisses: 0,
  });

  // Timer state (Step 3.1 & 3.2)
  const [timerState, setTimerState] = useState({
    enabled: false,
    nextCaptureIn: 30000, // 30 seconds
    nextAnalysisIn: 300000, // 5 minutes
    totalCaptures: 0,
    totalTimerAnalyses: 0,
    lastSceneChangeTime: null as number | null, // Step 3.2: For cooldown mechanism
    totalSceneChangeAnalyses: 0, // Step 3.2: Scene change trigger count
    lastTriggerReason: null as string | null, // Step 3.2: Last trigger reason
  });

  // Refs for storing data that doesn't trigger re-renders
  const sceneCache = useRef<SceneCacheEntry[]>([]);
  const lastImageBase64 = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null);
  const photoCaptureCallback = useRef<(() => Promise<string | null>) | null>(null);
  const shouldTriggerAnalysis = useRef<boolean>(false);

  /**
   * Load cached data from AsyncStorage on mount
   */
  useEffect(() => {
    loadCachedData();
    return () => {
      // Cleanup timers on unmount (Step 3.1)
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (countdownTimerRef.current) {
        clearTimeout(countdownTimerRef.current);
      }
    };
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
        console.log('[SceneUnderstanding] Timer: Capturing photo...');

        if (photoCaptureCallback.current) {
          try {
            const imageBase64 = await photoCaptureCallback.current();
            if (imageBase64) {
              console.log('[SceneUnderstanding] Timer: Photo captured');

              // Step 3.2: Check for scene change
              const hasSceneChanged = await checkSceneChange(imageBase64);

              console.log('[SceneUnderstanding] 🔍 Scene change check result:', {
                hasSceneChanged,
                timerStateLastChangeTime: timerState.lastSceneChangeTime,
              });

              if (hasSceneChanged) {
                console.log('[SceneUnderstanding] ✅ Scene change detected!');

                // Check cooldown period (1 minute = 60000ms)
                const now = Date.now();
                const lastChangeTime = timerState.lastSceneChangeTime;
                const cooldownPeriod = 60000; // 1 minute
                const isInCooldown = lastChangeTime && (now - lastChangeTime) < cooldownPeriod;

                console.log('[SceneUnderstanding] 🕐 Cooldown check:', {
                  now,
                  lastChangeTime,
                  timeSinceLastChange: lastChangeTime ? now - lastChangeTime : 'N/A',
                  cooldownPeriod,
                  isInCooldown,
                });

                if (isInCooldown) {
                  const remainingCooldown = Math.ceil((cooldownPeriod - (now - lastChangeTime!)) / 1000);
                  console.log(`[SceneUnderstanding] ⏸️ Scene change cooldown active, ${remainingCooldown}s remaining - SKIPPING ANALYSIS`);
                } else {
                  console.log('[SceneUnderstanding] 🚀 Triggering scene change analysis...');

                  // Trigger deep analysis due to scene change
                  analyzeScene(imageBase64, undefined, false, true).catch(error => {
                    console.error('[SceneUnderstanding] ❌ Scene change analysis failed:', error);
                  });

                  // Update state: record scene change trigger and reset timer
                  setTimerState(prev => ({
                    ...prev,
                    lastSceneChangeTime: now,
                    totalSceneChangeAnalyses: prev.totalSceneChangeAnalyses + 1,
                    lastTriggerReason: 'scene_change',
                    nextAnalysisIn: 300000, // Reset to 5 minutes (user requirement)
                  }));

                  console.log('[SceneUnderstanding] ✅ Scene change state updated, timer reset to 5 minutes');
                }
              } else {
                console.log('[SceneUnderstanding] ⏭️ Scene unchanged, skipping analysis');
              }

              // Store captured image
              lastImageBase64.current = imageBase64;

              // Update capture count
              setTimerState(prev => ({
                ...prev,
                totalCaptures: prev.totalCaptures + 1,
                nextCaptureIn: 30000, // Reset to 30 seconds
              }));
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
      setTimerState(prev => ({
        ...prev,
        nextCaptureIn: Math.max(0, prev.nextCaptureIn - 1000),
        nextAnalysisIn: Math.max(0, prev.nextAnalysisIn - 1000),
      }));
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
   * Load cached scene data from MMKV storage
   */
  function loadCachedData(): void {
    try {
      // Load scene cache
      const cacheJson = storage.getString(STORAGE_KEYS.SCENE_CACHE);
      if (cacheJson) {
        sceneCache.current = JSON.parse(cacheJson);
        console.log('[SceneUnderstanding] Loaded', sceneCache.current.length, 'cached scenes');
      }

      // Load last scene
      const lastSceneJson = storage.getString(STORAGE_KEYS.LAST_SCENE);
      if (lastSceneJson) {
        setCurrentScene(JSON.parse(lastSceneJson));
        console.log('[SceneUnderstanding] Loaded last scene');
      }

      // Load config
      const configJson = storage.getString(STORAGE_KEYS.CONFIG);
      if (configJson) {
        const savedConfig = JSON.parse(configJson);
        setConfig({ ...config, ...savedConfig });
        console.log('[SceneUnderstanding] Loaded saved config');
      }
    } catch (error) {
      console.error('[SceneUnderstanding] Failed to load cached data:', error);
    }
  }

  /**
   * Save scene data to cache
   */
  function saveToCache(scene: SceneData, imageThumbnail: string): void {
    try {
      const cacheEntry: SceneCacheEntry = {
        scene,
        cachedAt: Date.now(),
        expiresAt: Date.now() + config.cacheExpiration,
        imageThumbnail,
      };

      // Add to cache
      sceneCache.current.push(cacheEntry);

      // Remove expired entries
      sceneCache.current = sceneCache.current.filter(
        entry => entry.expiresAt > Date.now()
      );

      // Save to MMKV storage
      storage.set(
        STORAGE_KEYS.SCENE_CACHE,
        JSON.stringify(sceneCache.current)
      );

      console.log('[SceneUnderstanding] Saved to cache, total entries:', sceneCache.current.length);
    } catch (error) {
      console.error('[SceneUnderstanding] Failed to save cache:', error);
    }
  }

  /**
   * Check if scene is in cache (deduplication)
   */
  async function checkCache(imageBase64: string): Promise<SceneData | null> {
    try {
      // Generate thumbnail for comparison
      const thumbnail = await generateThumbnail(imageBase64);

      // Check against cached scenes
      for (const entry of sceneCache.current) {
        if (!entry.imageThumbnail) continue;

        const comparison = await compareImages(
          thumbnail,
          entry.imageThumbnail,
          config.deduplicationThreshold
        );

        if (comparison.isSameScene) {
          console.log('[SceneUnderstanding] Cache hit! Similarity:', comparison.similarity.toFixed(3));
          setDebugInfo(prev => ({ ...prev, cacheHits: prev.cacheHits + 1 }));
          return entry.scene;
        }
      }

      console.log('[SceneUnderstanding] Cache miss');
      setDebugInfo(prev => ({ ...prev, cacheMisses: prev.cacheMisses + 1 }));
      return null;
    } catch (error) {
      console.error('[SceneUnderstanding] Cache check failed:', error);
      return null;
    }
  }

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

        // Check cache first
        const cachedScene = await checkCache(imageBase64);
        if (cachedScene && !userQuestion) {
          console.log('[SceneUnderstanding] Using cached scene');
          setCurrentScene(cachedScene);
          setLastTriggerType(triggerType);
          setLastAnalysisTime(Date.now());
          setIsAnalyzing(false);
          return;
        }

        // Prepare analysis request
        const request: SceneAnalysisRequest = {
          imageBase64,
          triggerType,
          userQuestion,
          previousScene: currentScene || undefined,
        };

        // Call Claude Vision API
        const response: SceneAnalysisResponse = await analyzeSceneWithClaude(
          request,
          apiKey
        );

        if (!response.success) {
          throw new Error(response.error || 'Analysis failed');
        }

        // Update state
        setCurrentScene(response.scene);
        setLastTriggerType(triggerType);
        setLastAnalysisTime(Date.now());
        setTotalAPICalls(prev => prev + 1);
        setTotalCost(prev => prev + (response.cost || 0));

        // Update timer analysis count if triggered by timer (Step 3.1)
        if (isTimerTriggered) {
          setTimerState(prev => ({
            ...prev,
            totalTimerAnalyses: prev.totalTimerAnalyses + 1,
            lastTriggerReason: 'timer',
            nextAnalysisIn: 300000, // Reset to 5 minutes
          }));
          shouldTriggerAnalysis.current = false;
        }

        // Update scene change analysis count if triggered by scene change (Step 3.2)
        // Note: State update already done in timer callback, this is just for logging
        if (isSceneChangeTriggered) {
          console.log('[SceneUnderstanding] Scene change analysis completed');
        }

        // Save to cache
        const thumbnail = await generateThumbnail(imageBase64);
        saveToCache(response.scene, thumbnail);

        // Save last scene to MMKV storage
        storage.set(STORAGE_KEYS.LAST_SCENE, JSON.stringify(response.scene));

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
   * Check if scene has changed from previous image
   * Note: Does NOT update lastImageBase64.current - that's done by the caller
   */
  const checkSceneChange = useCallback(
    async (imageBase64: string): Promise<boolean> => {
      if (!lastImageBase64.current) {
        console.log('[SceneUnderstanding] checkSceneChange: First image, treating as scene change');
        return true; // First image, consider it a change
      }

      try {
        const comparison = await compareImages(
          imageBase64,
          lastImageBase64.current,
          config.sceneChangeThreshold
        );

        setDebugInfo(prev => ({
          ...prev,
          lastSimilarity: comparison.similarity,
        }));

        const hasChanged = !comparison.isSameScene;

        console.log('[SceneUnderstanding] checkSceneChange:', {
          similarity: comparison.similarity.toFixed(3),
          threshold: config.sceneChangeThreshold,
          isSameScene: comparison.isSameScene,
          hasChanged,
          interpretation: hasChanged ? '❌ SCENE CHANGED' : '✅ SCENE UNCHANGED',
        });

        return hasChanged;
      } catch (error) {
        console.error('[SceneUnderstanding] Scene change check failed:', error);
        return false;
      }
    },
    [config.sceneChangeThreshold]
  );

  /**
   * Clear scene cache
   */
  const clearCache = useCallback((): void => {
    try {
      sceneCache.current = [];
      storage.remove(STORAGE_KEYS.SCENE_CACHE);
      console.log('[SceneUnderstanding] Cache cleared');
    } catch (error) {
      console.error('[SceneUnderstanding] Failed to clear cache:', error);
    }
  }, []);

  /**
   * Update configuration
   */
  const updateConfig = useCallback((newConfig: Partial<SceneConfig>): void => {
    setConfig(prev => {
      const updated = { ...prev, ...newConfig };
      // Save to MMKV storage
      storage.set(STORAGE_KEYS.CONFIG, JSON.stringify(updated));
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
    console.log('[SceneUnderstanding] Statistics reset');
  }, []);

  /**
   * Start timer-based scene monitoring (Step 3.1)
   */
  const startTimer = useCallback((): void => {
    console.log('[SceneUnderstanding] Starting timer');
    setTimerState(prev => ({
      ...prev,
      enabled: true,
      nextCaptureIn: 30000, // 30 seconds
      nextAnalysisIn: 300000, // 5 minutes
    }));
  }, []);

  /**
   * Stop timer-based scene monitoring (Step 3.1)
   */
  const stopTimer = useCallback((): void => {
    console.log('[SceneUnderstanding] Stopping timer');
    setTimerState(prev => ({
      ...prev,
      enabled: false,
    }));
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

  return {
    // State
    currentScene,
    isAnalyzing,
    error,
    lastTriggerType,
    lastAnalysisTime,
    totalAPICalls,
    totalCost,
    debugInfo,
    timerState,

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
  };
}
