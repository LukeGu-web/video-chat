/**
 * Small Talk Manager for Object Recognition
 * Dynamically adjusts small talk based on API response time
 *
 * Strategy:
 * 1. Start with short phrase (1-2s)
 * 2. If API hasn't returned, continue with medium phrase (3-5s)
 * 3. If still waiting, continue with long phrase or repeat
 * 4. Stop immediately when API returns
 */

import { debugLog } from './debug';

/**
 * Small Talk Tier
 * Different lengths for different waiting durations
 */
export enum SmallTalkTier {
  SHORT = 'short',   // 1-2 seconds - Initial reaction
  MEDIUM = 'medium', // 3-5 seconds - If still waiting
  LONG = 'long',     // 5-8 seconds - Extended wait
}

/**
 * Small Talk Phrase
 */
export interface SmallTalkPhrase {
  text: string;
  tier: SmallTalkTier;
  estimatedDuration: number; // milliseconds
}

/**
 * Small Talk Database
 * Organized by tier for dynamic selection
 */
const SMALL_TALK_DATABASE: Record<SmallTalkTier, SmallTalkPhrase[]> = {
  [SmallTalkTier.SHORT]: [
    { text: '让我看一看~', tier: SmallTalkTier.SHORT, estimatedDuration: 1500 },
    { text: '嗯...', tier: SmallTalkTier.SHORT, estimatedDuration: 1000 },
    { text: '诶？', tier: SmallTalkTier.SHORT, estimatedDuration: 800 },
    { text: '这是什么呢？', tier: SmallTalkTier.SHORT, estimatedDuration: 1800 },
  ],

  [SmallTalkTier.MEDIUM]: [
    { text: '让我仔细看看...', tier: SmallTalkTier.MEDIUM, estimatedDuration: 2500 },
    { text: '嗯...这个好像有点复杂呢~', tier: SmallTalkTier.MEDIUM, estimatedDuration: 3500 },
    { text: '诶...让我想想这是什么~', tier: SmallTalkTier.MEDIUM, estimatedDuration: 3000 },
    { text: '稍等一下，我认真看看~', tier: SmallTalkTier.MEDIUM, estimatedDuration: 2800 },
  ],

  [SmallTalkTier.LONG]: [
    {
      text: '嗯...这个好像很有趣呢，让我好好研究一下~',
      tier: SmallTalkTier.LONG,
      estimatedDuration: 4500,
    },
    {
      text: '诶...我好像在哪里见过类似的东西...让我想想~',
      tier: SmallTalkTier.LONG,
      estimatedDuration: 5000,
    },
    {
      text: '哇...这个看起来挺特别的呢~',
      tier: SmallTalkTier.LONG,
      estimatedDuration: 3500,
    },
  ],
};

/**
 * Select a random phrase from a specific tier
 */
function selectPhrase(tier: SmallTalkTier): SmallTalkPhrase {
  const phrases = SMALL_TALK_DATABASE[tier];
  const randomIndex = Math.floor(Math.random() * phrases.length);
  return phrases[randomIndex];
}

/**
 * Small Talk Manager
 * Manages dynamic small talk playback during object recognition
 */
export class SmallTalkManager {
  private currentTier: SmallTalkTier = SmallTalkTier.SHORT;
  private isActive: boolean = false;
  private onSpeakCallback?: (text: string) => Promise<void>;
  private onStopCallback?: () => void;
  private tierTimers: NodeJS.Timeout[] = [];
  private aborted: boolean = false;

  constructor(
    onSpeak: (text: string) => Promise<void>,
    onStop?: () => void
  ) {
    this.onSpeakCallback = onSpeak;
    this.onStopCallback = onStop;
  }

  /**
   * Start dynamic small talk
   * Will automatically progress through tiers if API hasn't returned
   */
  async start(): Promise<void> {
    if (this.isActive) {
      debugLog('SmallTalkManager', 'Already active, ignoring start request');
      return;
    }

    this.isActive = true;
    this.aborted = false;
    this.currentTier = SmallTalkTier.SHORT;

    debugLog('SmallTalkManager', 'Starting dynamic small talk');

    // Start with short phrase
    await this.playCurrentTier();
  }

  /**
   * Play current tier and schedule next tier
   */
  private async playCurrentTier(): Promise<void> {
    if (!this.isActive || this.aborted) {
      return;
    }

    const phrase = selectPhrase(this.currentTier);

    debugLog('SmallTalkManager', `Playing ${this.currentTier} tier`, {
      text: phrase.text,
      duration: phrase.estimatedDuration,
    });

    // Play the phrase
    if (this.onSpeakCallback) {
      try {
        await this.onSpeakCallback(phrase.text);
      } catch (error) {
        debugLog('SmallTalkManager', 'Error playing phrase', error);
      }
    }

    // If still active after playing, schedule next tier
    if (this.isActive && !this.aborted) {
      this.scheduleNextTier(phrase.estimatedDuration);
    }
  }

  /**
   * Schedule next tier based on current tier
   */
  private scheduleNextTier(delay: number): void {
    const timer = setTimeout(() => {
      if (!this.isActive || this.aborted) {
        return;
      }

      // Progress to next tier
      if (this.currentTier === SmallTalkTier.SHORT) {
        this.currentTier = SmallTalkTier.MEDIUM;
      } else if (this.currentTier === SmallTalkTier.MEDIUM) {
        this.currentTier = SmallTalkTier.LONG;
      } else {
        // If already at LONG tier, loop back to MEDIUM
        this.currentTier = SmallTalkTier.MEDIUM;
      }

      // Play next tier
      this.playCurrentTier();
    }, delay);

    this.tierTimers.push(timer);
  }

  /**
   * Stop small talk immediately
   * Call this when API returns with result
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    debugLog('SmallTalkManager', 'Stopping small talk');

    this.isActive = false;
    this.aborted = true;

    // Clear all timers
    this.tierTimers.forEach((timer) => clearTimeout(timer));
    this.tierTimers = [];

    // Stop current TTS playback
    if (this.onStopCallback) {
      this.onStopCallback();
    }
  }

  /**
   * Check if manager is currently active
   */
  isRunning(): boolean {
    return this.isActive;
  }

  /**
   * Reset manager state
   */
  reset(): void {
    this.stop();
    this.currentTier = SmallTalkTier.SHORT;
  }
}

/**
 * Create a new Small Talk Manager instance
 */
export function createSmallTalkManager(
  onSpeak: (text: string) => Promise<void>,
  onStop?: () => void
): SmallTalkManager {
  return new SmallTalkManager(onSpeak, onStop);
}
