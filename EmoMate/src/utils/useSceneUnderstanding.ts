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
  ObjectRecognitionData,
} from '../types/scene';
import { analyzeSceneWithClaude } from '../capabilities/vision/claudeVision';
import { compareImages, generateThumbnail } from '../capabilities/vision/imageComparison';

/**
 * Visual keywords that trigger scene analysis (Step 3.3)
 * These keywords must match exactly to avoid false triggers
 * E.g., "看" matches but "看起来" does not
 */
const VISUAL_KEYWORDS = [
  '看',
  '看见',
  '看到',
  '这是什么',
  '周围',
  '这个',
  '那个',
  '什么东西',
  '哪里',
  '在哪',
  '附近',
  '旁边',
] as const;

/**
 * Detect visual keywords in user text (Step 3.3)
 * Uses precise matching to avoid false triggers
 * E.g., "看起来" won't trigger "看" keyword
 *
 * @param text - User input text
 * @returns The detected keyword or null
 */
export function detectVisualKeywords(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  const trimmedText = text.trim();

  // Check for exact phrase matches first (higher priority)
  const exactPhrases = ['这是什么', '什么东西', '在哪'];
  for (const phrase of exactPhrases) {
    if (trimmedText.includes(phrase)) {
      console.log(`[SceneUnderstanding] 🎯 Keyword detected: "${phrase}" in "${trimmedText}"`);
      return phrase;
    }
  }

  // Check for single character keywords with boundary detection
  const singleCharKeywords = ['看', '看见', '看到', '周围', '这个', '那个', '哪里', '附近', '旁边'];

  for (const keyword of singleCharKeywords) {
    // For single character keywords like "看", ensure it's not part of a longer word
    if (keyword.length === 1) {
      // Check if keyword appears as standalone character or at word boundary
      const regex = new RegExp(`(?:^|[^一-龥])${keyword}(?:[^一-龥起]|$)`);
      if (regex.test(trimmedText)) {
        console.log(`[SceneUnderstanding] 🎯 Keyword detected: "${keyword}" in "${trimmedText}"`);
        return keyword;
      }
    } else {
      // For multi-character keywords, simple includes check
      if (trimmedText.includes(keyword)) {
        console.log(`[SceneUnderstanding] 🎯 Keyword detected: "${keyword}" in "${trimmedText}"`);
        return keyword;
      }
    }
  }

  console.log(`[SceneUnderstanding] ⏭️ No visual keyword detected in "${trimmedText}"`);
  return null;
}

/**
 * Detect object recognition keywords in user text
 * These keywords trigger object recognition instead of scene understanding
 *
 * @param text - User input text
 * @returns The detected keyword or null
 */
export function detectObjectKeywords(text: string): string | null {
  if (!text || text.trim().length === 0) {
    return null;
  }

  const trimmedText = text.trim();

  // Object recognition phrases (specific to identifying objects)
  const objectPhrases = [
    '看这个',
    '看这个东西',
    '看看这个',
    '看看这',
    '帮我看看这个',
    '帮我看看这',
    '识别这个',
    '识别这',
    '这个是什么',
    '这是什么东西',
    '这什么',
    '这东西',
  ];

  for (const phrase of objectPhrases) {
    if (trimmedText.includes(phrase)) {
      console.log(`[ObjectRecognition] 🎯 Object keyword detected: "${phrase}" in "${trimmedText}"`);
      return phrase;
    }
  }

  console.log(`[ObjectRecognition] ⏭️ No object recognition keyword detected in "${trimmedText}"`);
  return null;
}

/**
 * Format object recognition data as AI context
 * Converts object recognition data into natural language for AI consumption
 *
 * @param objectData - Object recognition data
 * @returns Formatted context string for AI
 */
export function formatObjectRecognitionForAI(
  objectData: ObjectRecognitionData
): string {
  const parts: string[] = [];

  // Basic information
  parts.push(`【物品识别结果】`);
  parts.push(`物品名称: ${objectData.objectName}`);
  parts.push(`类别: ${objectData.category}`);
  parts.push(`描述: ${objectData.description}`);

  // Optional details
  if (objectData.brand) {
    parts.push(`品牌: ${objectData.brand}`);
  }

  if (objectData.model) {
    parts.push(`型号: ${objectData.model}`);
  }

  if (objectData.color) {
    parts.push(`颜色: ${objectData.color}`);
  }

  if (objectData.material) {
    parts.push(`材质: ${objectData.material}`);
  }

  if (objectData.priceRange) {
    parts.push(`价格范围: ${objectData.priceRange}`);
  }

  // Additional information
  if (objectData.additionalInfo && Object.keys(objectData.additionalInfo).length > 0) {
    parts.push(`其他信息:`);
    for (const [key, value] of Object.entries(objectData.additionalInfo)) {
      parts.push(`  - ${key}: ${value}`);
    }
  }

  // User's original question
  if (objectData.userPrompt) {
    parts.push(`用户提问: ${objectData.userPrompt}`);
  }

  // Confidence
  parts.push(`识别置信度: ${Math.round(objectData.confidence * 100)}%`);

  return parts.join('\n');
}

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
    /** Last trigger reason (timer/scene_change/keyword) */
    lastTriggerReason: string | null;
    /** Total number of analyses triggered by keyword (Step 3.3) */
    totalKeywordAnalyses: number;
    /** Last keyword that triggered analysis (Step 3.3) */
    lastKeyword: string | null;
    /** Last conversation activity time (Step 5.3: Smart pause) */
    lastConversationActivityTime: number | null;
    /** Whether analysis is paused due to conversation inactivity (Step 5.3) */
    isPausedDueToInactivity: boolean;
  };

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
  const [timerState, setTimerState] = useState({
    enabled: false,
    nextCaptureIn: 30000, // 30 seconds
    nextAnalysisIn: 300000, // 5 minutes
    totalCaptures: 0,
    totalTimerAnalyses: 0,
    lastSceneChangeTime: null as number | null, // Step 3.2: For cooldown mechanism
    totalSceneChangeAnalyses: 0, // Step 3.2: Scene change trigger count
    lastTriggerReason: null as string | null, // Step 3.2 & 3.3: Last trigger reason
    totalKeywordAnalyses: 0, // Step 3.3: Keyword trigger count
    lastKeyword: null as string | null, // Step 3.3: Last detected keyword
    lastConversationActivityTime: Date.now(), // Step 5.3: Track conversation activity
    isPausedDueToInactivity: false, // Step 5.3: Pause state
  });

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
      setTimerState(prev => {
        // Step 5.3: Check conversation inactivity (5 minutes = 300000ms)
        const now = Date.now();
        const inactivityThreshold = 5 * 60 * 1000; // 5 minutes
        const timeSinceLastActivity = prev.lastConversationActivityTime
          ? now - prev.lastConversationActivityTime
          : 0;

        const shouldPause = timeSinceLastActivity > inactivityThreshold;

        // Log inactivity status change
        if (shouldPause && !prev.isPausedDueToInactivity) {
          console.log('[SceneUnderstanding] ⏸️ Conversation inactive for 5 minutes - pausing scene analysis');
        } else if (!shouldPause && prev.isPausedDueToInactivity) {
          console.log('[SceneUnderstanding] ▶️ Conversation activity resumed - resuming scene analysis');
        }

        return {
          ...prev,
          nextCaptureIn: Math.max(0, prev.nextCaptureIn - 1000),
          nextAnalysisIn: Math.max(0, prev.nextAnalysisIn - 1000),
          isPausedDueToInactivity: shouldPause,
        };
      });
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
      const now = Date.now();

      // Load scene cache
      const cacheJson = storage.getString(STORAGE_KEYS.SCENE_CACHE);
      if (cacheJson) {
        const loadedCache = JSON.parse(cacheJson);
        const beforeCount = loadedCache.length;

        // Automatically clean up expired scenes on load
        sceneCache.current = loadedCache.filter(
          (entry: SceneCacheEntry) => entry.expiresAt > now
        );

        // Sort by cachedAt timestamp (newest first)
        sceneCache.current.sort((a, b) => b.cachedAt - a.cachedAt);

        const afterCount = sceneCache.current.length;
        const removedCount = beforeCount - afterCount;

        if (removedCount > 0) {
          console.log(`[SceneUnderstanding] 🗑️ Auto-cleaned ${removedCount} expired scene(s) on load`);
          // Save cleaned cache back to storage
          storage.set(
            STORAGE_KEYS.SCENE_CACHE,
            JSON.stringify(sceneCache.current)
          );
        }

        setCachedScenes(sceneCache.current); // Step 4.1: Update state for UI
        console.log('[SceneUnderstanding] Loaded', sceneCache.current.length, 'cached scenes (sorted newest first)');
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
   * Save scene data to cache (Step 4.1)
   * Implements cache capacity control (max 3 scenes) and expiration
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

      // Remove expired entries (Step 4.1: auto cleanup)
      sceneCache.current = sceneCache.current.filter(
        entry => entry.expiresAt > Date.now()
      );

      // Step 4.1: Enforce max cache size (keep most recent 3 scenes)
      const MAX_CACHE_SIZE = 3;
      if (sceneCache.current.length > MAX_CACHE_SIZE) {
        // Sort by cachedAt timestamp (newest first)
        sceneCache.current.sort((a, b) => b.cachedAt - a.cachedAt);
        // Keep only the most recent MAX_CACHE_SIZE entries
        sceneCache.current = sceneCache.current.slice(0, MAX_CACHE_SIZE);
        console.log(`[SceneUnderstanding] 🗑️ Cache size limit reached, kept ${MAX_CACHE_SIZE} most recent scenes`);
      }

      // Save to MMKV storage
      storage.set(
        STORAGE_KEYS.SCENE_CACHE,
        JSON.stringify(sceneCache.current)
      );

      // Step 4.1: Update state for UI
      setCachedScenes([...sceneCache.current]);

      console.log('[SceneUnderstanding] ✅ Saved to cache, total entries:', sceneCache.current.length);
    } catch (error) {
      console.error('[SceneUnderstanding] ❌ Failed to save cache:', error);
    }
  }

  /**
   * Calculate string similarity using Jaccard index (Step 4.2)
   * Tokenizes strings by characters and computes set similarity
   *
   * @param str1 - First string
   * @param str2 - Second string
   * @returns Similarity score (0-1)
   */
  function calculateStringSimilarity(str1: string, str2: string): number {
    if (!str1 || !str2) return 0;
    if (str1 === str2) return 1;

    // Convert to character sets
    const set1 = new Set(str1.split(''));
    const set2 = new Set(str2.split(''));

    // Calculate Jaccard similarity
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Calculate array similarity using Jaccard index (Step 4.2)
   * Computes set similarity between two arrays
   *
   * @param arr1 - First array
   * @param arr2 - Second array
   * @returns Similarity score (0-1)
   */
  function calculateArraySimilarity(arr1: string[], arr2: string[]): number {
    if (!arr1 || !arr2) return 0;
    if (arr1.length === 0 && arr2.length === 0) return 1;
    if (arr1.length === 0 || arr2.length === 0) return 0;

    const set1 = new Set(arr1);
    const set2 = new Set(arr2);

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
  }

  /**
   * Compare semantic similarity between two scenes (Step 4.2)
   * Uses weighted comparison of scene attributes
   *
   * Weights:
   * - location: 30% (most important)
   * - objects: 30% (important)
   * - atmosphere: 20%
   * - lighting: 10%
   * - details: 10%
   *
   * @param scene1 - First scene
   * @param scene2 - Second scene
   * @returns Similarity score (0-1)
   */
  function compareSceneSimilarity(scene1: SceneData, scene2: SceneData): number {
    // Location similarity (30% weight)
    const locationSimilarity = calculateStringSimilarity(
      scene1.location,
      scene2.location
    );

    // Objects similarity (30% weight)
    const objectsSimilarity = calculateArraySimilarity(
      scene1.objects,
      scene2.objects
    );

    // Atmosphere similarity (20% weight)
    const atmosphereSimilarity = calculateStringSimilarity(
      scene1.atmosphere,
      scene2.atmosphere
    );

    // Lighting similarity (10% weight)
    const lightingSimilarity = calculateStringSimilarity(
      scene1.lighting,
      scene2.lighting
    );

    // Details similarity (10% weight) - compare key detail fields
    let detailsSimilarity = 0;
    const detailFields = ['indoorOutdoor', 'timeOfDay', 'weatherCondition'];
    let validFields = 0;

    for (const field of detailFields) {
      const val1 = scene1.details[field];
      const val2 = scene2.details[field];

      if (val1 && val2) {
        validFields++;
        if (val1 === val2) {
          detailsSimilarity += 1;
        }
      }
    }

    detailsSimilarity = validFields > 0 ? detailsSimilarity / validFields : 0.5;

    // Weighted average
    const totalSimilarity =
      locationSimilarity * 0.3 +
      objectsSimilarity * 0.3 +
      atmosphereSimilarity * 0.2 +
      lightingSimilarity * 0.1 +
      detailsSimilarity * 0.1;

    console.log('[SceneUnderstanding] Scene similarity breakdown:', {
      location: locationSimilarity.toFixed(3),
      objects: objectsSimilarity.toFixed(3),
      atmosphere: atmosphereSimilarity.toFixed(3),
      lighting: lightingSimilarity.toFixed(3),
      details: detailsSimilarity.toFixed(3),
      total: totalSimilarity.toFixed(3),
    });

    return totalSimilarity;
  }

  /**
   * Check if scene is in cache (deduplication)
   * Returns both the cached scene and the similarity score
   */
  async function checkCache(imageBase64: string): Promise<{ scene: SceneData | null; similarity: number | null }> {
    try {
      // Generate thumbnail for comparison
      const thumbnail = await generateThumbnail(imageBase64);

      const now = Date.now();

      // Check against cached scenes
      for (const entry of sceneCache.current) {
        if (!entry.imageThumbnail) continue;

        // Skip expired scenes - they should not be used for deduplication
        if (entry.expiresAt <= now) {
          console.log('[SceneUnderstanding] ⏭️ Skipping expired scene in cache check');
          continue;
        }

        const comparison = await compareImages(
          thumbnail,
          entry.imageThumbnail,
          config.deduplicationThreshold
        );

        if (comparison.isSameScene) {
          console.log('[SceneUnderstanding] Cache hit! Similarity:', comparison.similarity.toFixed(3));
          setDebugInfo(prev => ({
            ...prev,
            cacheHits: prev.cacheHits + 1,
            lastSimilarity: comparison.similarity,
          }));
          return { scene: entry.scene, similarity: comparison.similarity };
        }
      }

      console.log('[SceneUnderstanding] Cache miss');
      setDebugInfo(prev => ({ ...prev, cacheMisses: prev.cacheMisses + 1 }));
      return { scene: null, similarity: null };
    } catch (error) {
      console.error('[SceneUnderstanding] Cache check failed:', error);
      return { scene: null, similarity: null };
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

        // Check cache first (Step 4.1: Image-based deduplication)
        const cacheResult = await checkCache(imageBase64);
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

          // Calculate image similarity with last analyzed image
          const imageComparison = await compareImages(
            imageBase64,
            lastImageBase64.current,
            config.deduplicationThreshold
          );

          const imageSimilarity = imageComparison.similarity;
          console.log('[SceneUnderstanding] 📊 Image similarity comparison:', {
            similarity: imageSimilarity.toFixed(3),
            threshold: config.deduplicationThreshold.toFixed(3),
            willDeduplicate: imageSimilarity >= config.deduplicationThreshold,
          });

          // If image similarity is very high (>= deduplicationThreshold), assume semantic similarity
          // This avoids calling the API for virtually identical scenes
          if (imageSimilarity >= config.deduplicationThreshold) {
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
      setCachedScenes([]); // Update state for UI
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
        setTimerState(prev => ({
          ...prev,
          totalKeywordAnalyses: prev.totalKeywordAnalyses + 1,
          lastTriggerReason: 'keyword',
          lastKeyword: keyword,
        }));

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
    try {
      const beforeCount = sceneCache.current.length;
      const now = Date.now();

      // Filter out expired entries
      sceneCache.current = sceneCache.current.filter(
        entry => entry.expiresAt > now
      );

      // Sort by cachedAt timestamp (newest first)
      sceneCache.current.sort((a, b) => b.cachedAt - a.cachedAt);

      const afterCount = sceneCache.current.length;
      const removedCount = beforeCount - afterCount;

      // Save updated cache to storage
      storage.set(
        STORAGE_KEYS.SCENE_CACHE,
        JSON.stringify(sceneCache.current)
      );

      // Step 4.1: Update state for UI
      setCachedScenes([...sceneCache.current]);

      if (removedCount > 0) {
        console.log(`[SceneUnderstanding] 🗑️ Cleared ${removedCount} expired scene(s)`);
      } else {
        console.log('[SceneUnderstanding] ✅ No expired scenes to clear');
      }

      return removedCount;
    } catch (error) {
      console.error('[SceneUnderstanding] ❌ Failed to clear expired scenes:', error);
      return 0;
    }
  }, []);

  /**
   * Notify that conversation is active (Step 5.3: Smart pause)
   * Call this when user sends a message or AI responds
   */
  const notifyConversationActivity = useCallback((): void => {
    const now = Date.now();

    setTimerState(prev => {
      const wasInactive = prev.isPausedDueToInactivity;

      return {
        ...prev,
        lastConversationActivityTime: now,
        isPausedDueToInactivity: false,
      };
    });

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
