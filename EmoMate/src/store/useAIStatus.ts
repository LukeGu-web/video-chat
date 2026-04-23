import { create } from 'zustand';

// Avatar motion type — model-agnostic motion names
type AvatarMotion =
  | 'Idle'        // Idle state
  | 'Speaking'    // Speaking
  | 'Thinking'    // Thinking
  | 'Happy'       // Happy
  | 'Surprised'   // Surprised
  | 'Shy'         // Shy
  | 'Wave'        // Waving
  | 'Dance'       // Dancing
  | 'Laugh'       // Laughing
  | 'Excited'     // Excited
  | 'Sleepy';     // Sleepy

/**
 * AI Activity State
 * Multi-dimensional state model for AI activities
 */
interface AIActivityState {
  isListening: boolean;   // User is speaking (voice input)
  isLooking: boolean;     // Object recognition in progress
  isThinking: boolean;    // Waiting for API response (Claude/Vision API)
  isSpeaking: boolean;    // TTS playback in progress
}

/**
 * Derived State
 * Calculated from activity states
 */
interface AIDerivedState {
  currentMotion: AvatarMotion;  // Current Live2D motion
  currentActivity: string;       // Current activity description (for debugging)
}

/**
 * AI Status Store
 * Unified state management for all AI activities
 */
interface AIStatusStore extends AIActivityState, AIDerivedState {
  // State setters
  setListening: (value: boolean) => void;
  setLooking: (value: boolean) => void;
  setThinking: (value: boolean) => void;
  setSpeaking: (value: boolean) => void;

  // Batch state setter (recommended for updating multiple states at once)
  setBatchStates: (states: Partial<AIActivityState>) => void;

  // Legacy API (for backward compatibility)
  aiStatus: AvatarMotion; // Alias for currentMotion
  setAIStatus: (status: AvatarMotion) => void; // Manual override

  // Utilities
  reset: () => void; // Reset all states to idle
}

/**
 * Priority Rule for state calculation
 * Defines a condition and its corresponding derived state
 */
interface PriorityRule {
  condition: (state: AIActivityState) => boolean;
  motion: AvatarMotion;
  activity: string;
}

/**
 * Priority rules for calculating derived state
 * Ordered from highest to lowest priority
 *
 * Priority rules (highest to lowest):
 * 1. Speaking + Looking + Thinking - Small talk during object recognition
 * 2. Speaking - Always show Speaking motion when TTS is playing
 * 3. Listening - Show Thinking motion when user is speaking
 * 4. Looking - Show Thinking motion when recognizing objects
 * 5. Thinking - Show Thinking motion when waiting for API
 * 6. Idle - Default state
 */
const PRIORITY_RULES: PriorityRule[] = [
  // Priority 1: Speaking while looking at object (small talk during recognition)
  {
    condition: (s) => s.isSpeaking && s.isLooking && s.isThinking,
    motion: 'Speaking',
    activity: 'looking_and_speaking',
  },
  // Priority 2: Regular speaking
  {
    condition: (s) => s.isSpeaking,
    motion: 'Speaking',
    activity: 'speaking',
  },
  // Priority 3: Listening to user
  {
    condition: (s) => s.isListening,
    motion: 'Thinking',
    activity: 'listening',
  },
  // Priority 4: Looking at object (object recognition)
  {
    condition: (s) => s.isLooking,
    motion: 'Thinking',
    activity: 'looking',
  },
  // Priority 5: Thinking (waiting for API response)
  {
    condition: (s) => s.isThinking,
    motion: 'Thinking',
    activity: 'thinking',
  },
  // Priority 6: Idle (default state)
  {
    condition: () => true, // Always true as fallback
    motion: 'Idle',
    activity: 'idle',
  },
];

/**
 * Calculate derived state (motion and activity) from activity states
 * Uses priority rule array for clean, maintainable state calculation
 */
function calculateDerivedState(state: AIActivityState): AIDerivedState {
  // Find first matching rule (highest priority)
  const rule = PRIORITY_RULES.find((r) => r.condition(state));

  // Rule should always be found (fallback to Idle), but add safety check
  return rule
    ? { currentMotion: rule.motion, currentActivity: rule.activity }
    : { currentMotion: 'Idle', currentActivity: 'idle' };
}

/**
 * Initial state
 */
const INITIAL_STATE: AIActivityState = {
  isListening: false,
  isLooking: false,
  isThinking: false,
  isSpeaking: false,
};

/**
 * Create AI Status Store
 */
export const useAIStatus = create<AIStatusStore>((set) => ({
  // Initial activity states
  ...INITIAL_STATE,

  // Initial derived states
  currentMotion: 'Idle',
  currentActivity: 'idle',
  aiStatus: 'Idle', // Legacy alias

  // State setters with automatic derived state calculation
  setListening: (value: boolean) => {
    set((state) => {
      const newActivityState = { ...state, isListening: value };
      const derivedState = calculateDerivedState(newActivityState);
      return {
        isListening: value,
        ...derivedState,
        aiStatus: derivedState.currentMotion, // Update legacy alias
      };
    });
  },

  setLooking: (value: boolean) => {
    set((state) => {
      const newActivityState = { ...state, isLooking: value };
      const derivedState = calculateDerivedState(newActivityState);
      return {
        isLooking: value,
        ...derivedState,
        aiStatus: derivedState.currentMotion,
      };
    });
  },

  setThinking: (value: boolean) => {
    set((state) => {
      const newActivityState = { ...state, isThinking: value };
      const derivedState = calculateDerivedState(newActivityState);
      return {
        isThinking: value,
        ...derivedState,
        aiStatus: derivedState.currentMotion,
      };
    });
  },

  setSpeaking: (value: boolean) => {
    set((state) => {
      const newActivityState = { ...state, isSpeaking: value };
      const derivedState = calculateDerivedState(newActivityState);
      return {
        isSpeaking: value,
        ...derivedState,
        aiStatus: derivedState.currentMotion,
      };
    });
  },

  // Batch state setter - Update multiple activity states in a single render
  // This prevents race conditions and unnecessary re-renders when syncing
  // multiple states from external sources (e.g., useChatAI hook)
  setBatchStates: (states: Partial<AIActivityState>) => {
    set((currentState) => {
      // Merge new states with current state
      const newActivityState = {
        isListening: currentState.isListening,
        isLooking: currentState.isLooking,
        isThinking: currentState.isThinking,
        isSpeaking: currentState.isSpeaking,
        ...states, // Override with new values
      };

      // Calculate derived state once for all updates
      const derivedState = calculateDerivedState(newActivityState);

      return {
        ...states, // Update only the provided activity states
        ...derivedState,
        aiStatus: derivedState.currentMotion,
      };
    });
  },

  // Legacy API - Manual motion override (bypasses automatic calculation)
  setAIStatus: (status: AvatarMotion) => {
    console.warn(
      '[useAIStatus] setAIStatus is deprecated. Use activity setters instead (setListening, setLooking, setThinking, setSpeaking).'
    );
    set({
      currentMotion: status,
      aiStatus: status,
      currentActivity: 'manual_override',
    });
  },

  // Reset all states
  reset: () => {
    set({
      ...INITIAL_STATE,
      currentMotion: 'Idle',
      currentActivity: 'idle',
      aiStatus: 'Idle',
    });
  },
}));

// Export types
export type { AvatarMotion, AIActivityState, AIDerivedState, AIStatusStore };
export default useAIStatus;