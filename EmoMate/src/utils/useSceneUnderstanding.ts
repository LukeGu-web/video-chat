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

  // Refs for storing data that doesn't trigger re-renders
  const sceneCache = useRef<SceneCacheEntry[]>([]);
  const lastImageBase64 = useRef<string | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Load cached data from AsyncStorage on mount
   */
  useEffect(() => {
    loadCachedData();
    return () => {
      // Cleanup timer on unmount
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  /**
   * Setup timer for periodic scene analysis
   */
  useEffect(() => {
    if (!config.enabled || !config.timerInterval) {
      return;
    }

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Setup new timer
    timerRef.current = setTimeout(() => {
      console.log('[SceneUnderstanding] Timer triggered');
      // TODO: Implement timer-based scene capture in Step 3.1
      // This will need access to camera to capture current frame
    }, config.timerInterval);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [config.enabled, config.timerInterval, lastAnalysisTime]);

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
   */
  const analyzeScene = useCallback(
    async (imageBase64: string, userQuestion?: string): Promise<void> => {
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
   * Check if scene has changed from previous image
   */
  const checkSceneChange = useCallback(
    async (imageBase64: string): Promise<boolean> => {
      if (!lastImageBase64.current) {
        lastImageBase64.current = imageBase64;
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

        if (hasChanged) {
          console.log('[SceneUnderstanding] Scene changed! Similarity:', comparison.similarity.toFixed(3));
          lastImageBase64.current = imageBase64;
        } else {
          console.log('[SceneUnderstanding] Scene unchanged, similarity:', comparison.similarity.toFixed(3));
        }

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

    // Methods
    analyzeScene,
    checkSceneChange,
    clearCache,
    updateConfig,
    getConfig,
    resetStats,
  };
}
