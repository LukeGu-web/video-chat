import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { SupportedLanguage } from '../utils/languageDetection';

// UserStore is now minimal - chat history moved to chatStore,
// scene data moved to sceneStore, environment data removed (unused)
interface UserState {
  // Language preference for AI conversations
  // Automatically detected based on user input and persisted throughout session
  currentLanguage: SupportedLanguage;

  // Reserved for future user-specific data
  // e.g., userId, userName, userPreferences, etc.
}

interface UserActions {
  // Set the current conversation language
  setCurrentLanguage: (language: SupportedLanguage) => void;
  reset: () => void;
}

type UserStore = UserState & UserActions;

const initialState: UserState = {
  currentLanguage: 'zh', // Default to Chinese
};

export const useUserStore = create<UserStore>()(
  immer((set) => ({
    ...initialState,

    setCurrentLanguage: (language) => {
      set((state) => {
        state.currentLanguage = language;
      });
    },

    reset: () => {
      set(() => initialState);
    },
  }))
);
