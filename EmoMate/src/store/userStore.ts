import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

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
}

interface UserActions {
  setSelectedCharacter: (character: string) => void;
  addEmotionLog: (log: EmotionLog) => void;
  addChatMessage: (message: ChatMessage) => void;
  clearChatHistory: () => void;
  reset: () => void;
}

type UserStore = UserState & UserActions;

const initialState: UserState = {
  selectedCharacter: '',
  emotionLog: [],
  chatHistory: [],
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
    
    reset: () => {
      set((state) => {
        state.selectedCharacter = initialState.selectedCharacter;
        state.emotionLog = initialState.emotionLog;
        state.chatHistory = initialState.chatHistory;
      });
    },
  }))
);