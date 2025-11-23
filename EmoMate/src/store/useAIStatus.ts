import { create } from 'zustand';

// Hiyori Live2D motion type definition - Hiyori's actual motion types
type HiyoriMotion =
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
  currentMotion: HiyoriMotion;  // Current Live2D motion
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

  // Legacy API (for backward compatibility)
  aiStatus: HiyoriMotion; // Alias for currentMotion
  setAIStatus: (status: HiyoriMotion) => void; // Manual override

  // Utilities
  reset: () => void; // Reset all states to idle
}

/**
 * Calculate derived state (motion and activity) from activity states
 * Priority rules (highest to lowest):
 * 1. Speaking - Always show Speaking motion when TTS is playing
 * 2. Listening - Show Thinking motion when user is speaking
 * 3. Looking - Show Thinking motion when recognizing objects
 * 4. Thinking - Show Thinking motion when waiting for API
 * 5. Idle - Default state
 */
function calculateDerivedState(state: AIActivityState): AIDerivedState {
  const { isListening, isLooking, isThinking, isSpeaking } = state;

  // Priority 1: Speaking (highest priority - always visible)
  if (isSpeaking) {
    if (isLooking && isThinking) {
      // Speaking while looking at object (small talk during recognition)
      return {
        currentMotion: 'Speaking',
        currentActivity: 'looking_and_speaking',
      };
    }
    // Regular speaking
    return {
      currentMotion: 'Speaking',
      currentActivity: 'speaking',
    };
  }

  // Priority 2: Listening to user
  if (isListening) {
    return {
      currentMotion: 'Thinking',
      currentActivity: 'listening',
    };
  }

  // Priority 3: Looking at object (object recognition)
  if (isLooking) {
    return {
      currentMotion: 'Thinking',
      currentActivity: 'looking',
    };
  }

  // Priority 4: Thinking (waiting for API response)
  if (isThinking) {
    return {
      currentMotion: 'Thinking',
      currentActivity: 'thinking',
    };
  }

  // Priority 5: Idle
  return {
    currentMotion: 'Idle',
    currentActivity: 'idle',
  };
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

  // Legacy API - Manual motion override (bypasses automatic calculation)
  setAIStatus: (status: HiyoriMotion) => {
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
export type { HiyoriMotion, AIActivityState, AIDerivedState, AIStatusStore };
export default useAIStatus;