import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { EnvironmentContext } from '../types/environment';
import { SceneData } from '../types/scene';

export interface EmotionLog {
  date: string;
  emotion: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isVoiceMessage?: boolean; // 标记是否是语音消息
}

interface UserState {
  selectedCharacter: string;
  emotionLog: EmotionLog[];
  chatHistory: ChatMessage[]; // 聊天历史
  // Environment detection state
  currentEnvironment: EnvironmentContext | null;
  environmentHistory: EnvironmentContext[];
  // Scene understanding state (Step 5.1)
  currentScene: SceneData | null;
}

interface UserActions {
  setSelectedCharacter: (character: string) => void;
  addEmotionLog: (log: EmotionLog) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
  // Environment actions
  setCurrentEnvironment: (environment: EnvironmentContext) => void;
  addEnvironmentHistory: (environment: EnvironmentContext) => void;
  // Scene understanding actions (Step 5.1)
  setCurrentScene: (scene: SceneData | null) => void;
  reset: () => void;
}

type UserStore = UserState & UserActions;

const initialState: UserState = {
  selectedCharacter: '',
  emotionLog: [],
  chatHistory: [],
  currentEnvironment: null,
  environmentHistory: [],
  currentScene: null,
};

export const useUserStore = create<UserStore>()(
  immer((set) => ({
    ...initialState,
    
    setSelectedCharacter: (character: string) => {
      set((state) => {
        state.selectedCharacter = character;
      });
    },
    
    addEmotionLog: (log: EmotionLog) => {
      set((state) => {
        state.emotionLog.push(log);
      });
    },

    addChatMessage: (message: ChatMessage) => {
      set((state) => {
        state.chatHistory.push(message);
      });
    },

    clearChatHistory: () => {
      set((state) => {
        state.chatHistory = [];
      });
    },

    setCurrentEnvironment: (environment: EnvironmentContext) => {
      set((state) => {
        state.currentEnvironment = environment;
      });
    },

    addEnvironmentHistory: (environment: EnvironmentContext) => {
      set((state) => {
        state.environmentHistory.push(environment);
        // Keep only last 20 environment records to prevent memory issues
        if (state.environmentHistory.length > 20) {
          state.environmentHistory = state.environmentHistory.slice(-20);
        }
      });
    },

    setCurrentScene: (scene: SceneData | null) => {
      set((state) => {
        state.currentScene = scene;
      });
    },

    reset: () => {
      set((state) => {
        state.selectedCharacter = initialState.selectedCharacter;
        state.emotionLog = initialState.emotionLog;
        state.chatHistory = initialState.chatHistory;
        state.currentEnvironment = initialState.currentEnvironment;
        state.environmentHistory = initialState.environmentHistory;
        state.currentScene = initialState.currentScene;
      });
    },
  }))
);