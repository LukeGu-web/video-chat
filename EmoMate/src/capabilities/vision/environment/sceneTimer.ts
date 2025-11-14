/**
 * Scene Timer Management Module
 * Handles timer-based scene monitoring and periodic analysis triggers
 */

/**
 * Timer state (Step 3.1 & 3.2 & 3.3 & 5.3)
 */
export interface TimerState {
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
}

/**
 * Get initial timer state
 */
export function getInitialTimerState(): TimerState {
  return {
    enabled: false,
    nextCaptureIn: 30000, // 30 seconds
    nextAnalysisIn: 300000, // 5 minutes
    totalCaptures: 0,
    totalTimerAnalyses: 0,
    lastSceneChangeTime: null,
    totalSceneChangeAnalyses: 0,
    lastTriggerReason: null,
    totalKeywordAnalyses: 0,
    lastKeyword: null,
    lastConversationActivityTime: Date.now(),
    isPausedDueToInactivity: false,
  };
}

/**
 * Update timer state for countdown (called every second)
 *
 * @param currentState - Current timer state
 * @returns Updated timer state
 */
export function updateTimerCountdown(currentState: TimerState): TimerState {
  // Step 5.3: Check conversation inactivity (5 minutes = 300000ms)
  const now = Date.now();
  const inactivityThreshold = 5 * 60 * 1000; // 5 minutes
  const timeSinceLastActivity = currentState.lastConversationActivityTime
    ? now - currentState.lastConversationActivityTime
    : 0;

  const shouldPause = timeSinceLastActivity > inactivityThreshold;

  // Log inactivity status change
  if (shouldPause && !currentState.isPausedDueToInactivity) {
    console.log('[SceneTimer] ⏸️ Conversation inactive for 5 minutes - pausing scene analysis');
  } else if (!shouldPause && currentState.isPausedDueToInactivity) {
    console.log('[SceneTimer] ▶️ Conversation activity resumed - resuming scene analysis');
  }

  return {
    ...currentState,
    nextCaptureIn: Math.max(0, currentState.nextCaptureIn - 1000),
    nextAnalysisIn: Math.max(0, currentState.nextAnalysisIn - 1000),
    isPausedDueToInactivity: shouldPause,
  };
}

/**
 * Check if cooldown period is active for scene change detection
 *
 * @param lastSceneChangeTime - Timestamp of last scene change
 * @param cooldownPeriod - Cooldown period in milliseconds (default: 60000ms = 1 minute)
 * @returns Whether cooldown is active and remaining time
 */
export function checkSceneChangeCooldown(
  lastSceneChangeTime: number | null,
  cooldownPeriod: number = 60000
): {
  isInCooldown: boolean;
  remainingCooldown: number;
} {
  if (!lastSceneChangeTime) {
    return { isInCooldown: false, remainingCooldown: 0 };
  }

  const now = Date.now();
  const timeSinceLastChange = now - lastSceneChangeTime;
  const isInCooldown = timeSinceLastChange < cooldownPeriod;
  const remainingCooldown = isInCooldown
    ? Math.ceil((cooldownPeriod - timeSinceLastChange) / 1000)
    : 0;

  console.log('[SceneTimer] 🕐 Cooldown check:', {
    now,
    lastSceneChangeTime,
    timeSinceLastChange,
    cooldownPeriod,
    isInCooldown,
    remainingCooldown: remainingCooldown > 0 ? `${remainingCooldown}s` : 'N/A',
  });

  return { isInCooldown, remainingCooldown };
}

/**
 * Update timer state after photo capture
 *
 * @param currentState - Current timer state
 * @returns Updated timer state
 */
export function updateAfterPhotoCapture(currentState: TimerState): TimerState {
  return {
    ...currentState,
    totalCaptures: currentState.totalCaptures + 1,
    nextCaptureIn: 30000, // Reset to 30 seconds
  };
}

/**
 * Update timer state after scene change detection
 *
 * @param currentState - Current timer state
 * @returns Updated timer state
 */
export function updateAfterSceneChange(currentState: TimerState): TimerState {
  const now = Date.now();
  return {
    ...currentState,
    lastSceneChangeTime: now,
    totalSceneChangeAnalyses: currentState.totalSceneChangeAnalyses + 1,
    lastTriggerReason: 'scene_change',
    nextAnalysisIn: 300000, // Reset to 5 minutes
  };
}

/**
 * Update timer state after timer-triggered analysis
 *
 * @param currentState - Current timer state
 * @returns Updated timer state
 */
export function updateAfterTimerAnalysis(currentState: TimerState): TimerState {
  return {
    ...currentState,
    totalTimerAnalyses: currentState.totalTimerAnalyses + 1,
    lastTriggerReason: 'timer',
    nextAnalysisIn: 300000, // Reset to 5 minutes
  };
}

/**
 * Update timer state after keyword-triggered analysis
 *
 * @param currentState - Current timer state
 * @param keyword - The detected keyword
 * @returns Updated timer state
 */
export function updateAfterKeywordAnalysis(
  currentState: TimerState,
  keyword: string
): TimerState {
  return {
    ...currentState,
    totalKeywordAnalyses: currentState.totalKeywordAnalyses + 1,
    lastTriggerReason: 'keyword',
    lastKeyword: keyword,
  };
}

/**
 * Update timer state when conversation activity is detected
 *
 * @param currentState - Current timer state
 * @returns Updated timer state
 */
export function updateConversationActivity(currentState: TimerState): TimerState {
  const now = Date.now();
  return {
    ...currentState,
    lastConversationActivityTime: now,
    isPausedDueToInactivity: false,
  };
}

/**
 * Start timer - reset to initial values
 *
 * @param currentState - Current timer state
 * @returns Updated timer state
 */
export function startTimer(currentState: TimerState): TimerState {
  console.log('[SceneTimer] Starting timer');
  return {
    ...currentState,
    enabled: true,
    nextCaptureIn: 30000, // 30 seconds
    nextAnalysisIn: 300000, // 5 minutes
  };
}

/**
 * Stop timer
 *
 * @param currentState - Current timer state
 * @returns Updated timer state
 */
export function stopTimer(currentState: TimerState): TimerState {
  console.log('[SceneTimer] Stopping timer');
  return {
    ...currentState,
    enabled: false,
  };
}
